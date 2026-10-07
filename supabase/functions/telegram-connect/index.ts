import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_API = "https://api.telegram.org";

type TelegramGetMe = {
  ok: boolean;
  result?: { id: number; username?: string; first_name?: string };
  description?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json() as { botToken?: unknown };
    const botToken = typeof body.botToken === "string" ? body.botToken.trim() : "";

    if (!/^\d+:[\w-]+$/.test(botToken)) {
      return jsonResponse({ error: "Invalid bot token format. It looks like \"123456:ABC-DEF...\" from @BotFather." }, 400);
    }

    // Validate the token and get the bot's username.
    const getMeRes = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`);
    const getMe = await getMeRes.json() as TelegramGetMe;
    if (!getMe.ok || !getMe.result) {
      return jsonResponse({ error: `Telegram rejected the token: ${getMe.description ?? "unknown error"}` }, 400);
    }
    const botUsername = getMe.result.username ?? "";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const webhookSecret = crypto.randomUUID();
    const bindCode = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-webhook?s=${webhookSecret}`;

    // Point the user's bot at our webhook (one webhook per bot; each user has their own bot).
    const setWebhookRes = await fetch(`${TELEGRAM_API}/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      }),
    });
    const setWebhook = await setWebhookRes.json() as { ok: boolean; description?: string };
    if (!setWebhook.ok) {
      return jsonResponse({ error: `Could not set webhook: ${setWebhook.description ?? "unknown error"}` }, 400);
    }

    const row = {
      user_id: user.id,
      provider: "telegram",
      status: "pending",
      chat_id: null,
      bot_token: botToken,
      bot_username: botUsername,
      bind_code: bindCode,
      webhook_secret: webhookSecret,
      last_transaction_id: null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabaseAdmin
      .from("bot_chats")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "telegram")
      .neq("status", "disabled")
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabaseAdmin.from("bot_chats").update(row).eq("id", existing.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseAdmin.from("bot_chats").insert(row);
      if (insertError) throw insertError;
    }

    return jsonResponse({
      botUsername,
      deepLink: `https://t.me/${botUsername}?start=${bindCode}`,
    });
  } catch (error) {
    console.error("telegram-connect error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
