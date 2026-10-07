import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isBankSmsLike, parseBankSmsTransaction } from "../_shared/sms-parser.ts";
import { categorizeWithAI, composeIngestText, smsFingerprint } from "../_shared/sms-ingest-core.ts";

type BotChatRow = {
  id: string;
  user_id: string;
  status: string;
  webhook_secret: string;
};

type IngestPayload = {
  secret?: unknown;
  sender?: unknown;
  from?: unknown;
  text?: unknown;
  body?: unknown;
  message?: unknown;
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

// Generic HTTP ingest for Android SMS forwarders (SMS Telebot, MacroDroid, …).
// Secured by the same unguessable per-connection secret as the Telegram webhook:
// callers POST { secret, sender, text } (or ?s=<secret> plus the same body fields).
// Only the bank-SMS approval path exists here — nothing is ever auto-logged.
serve(async (req) => {
  if (req.method === "GET") {
    return jsonResponse({ ok: true, hint: "POST JSON: { secret, sender, text }" });
  }
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

  try {
    const secretParam = new URL(req.url).searchParams.get("s");

    let payload: IngestPayload = {};
    try {
      payload = await req.json() as IngestPayload;
    } catch {
      return jsonResponse({ ok: false, error: "Expected JSON body" }, 400);
    }

    const secret = firstString(payload.secret) ?? secretParam;
    if (!secret) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: row, error: rowError } = await supabaseAdmin
      .from("bot_chats")
      .select("id, user_id, status, webhook_secret")
      .eq("webhook_secret", secret)
      .maybeSingle();

    if (rowError || !row) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }
    const bot = row as BotChatRow;

    if (bot.status !== "active") {
      return jsonResponse({ ok: false, error: "Telegram bot not connected yet. Finish setup in RupeeWise → Settings." }, 403);
    }

    const text = firstString(payload.text, payload.body, payload.message);
    if (!text) return jsonResponse({ ok: false, error: "Missing text field" }, 400);

    const sender = firstString(payload.sender, payload.from);
    const composed = composeIngestText(sender, text);

    if (!isBankSmsLike(composed)) {
      // Not a transaction alert — ack so the forwarder does not retry forever.
      return jsonResponse({ ok: true, added: false, reason: "not a bank transaction SMS" });
    }

    const parsedSms = parseBankSmsTransaction(composed);
    if (!parsedSms) {
      return jsonResponse({ ok: true, added: false, reason: "could not parse a completed transaction (OTP, failed or promotional alert?)" });
    }

    const sourceFingerprint = await smsFingerprint(bot.user_id, parsedSms.sender, parsedSms.fingerprintText);
    const { data: alreadySeen } = await supabaseAdmin
      .from("pending_transactions")
      .select("status")
      .eq("user_id", bot.user_id)
      .eq("source_fingerprint", sourceFingerprint)
      .maybeSingle();
    if (alreadySeen) {
      return jsonResponse({ ok: true, added: false, reason: alreadySeen.status === "pending" ? "already awaiting review" : "already reviewed" });
    }

    const { category, note, guessed } = await categorizeWithAI(parsedSms.merchant, parsedSms.type);
    const { error: pendingError } = await supabaseAdmin.from("pending_transactions").insert({
      user_id: bot.user_id,
      bot_chat_id: bot.id,
      telegram_message_id: null,
      source_fingerprint: sourceFingerprint,
      source_sender: parsedSms.sender,
      amount: parsedSms.amount,
      type: parsedSms.type,
      category,
      category_guessed: guessed,
      payment_mode: parsedSms.paymentMode,
      date: parsedSms.date,
      note: note || parsedSms.merchant,
    });

    if (pendingError?.code === "23505") {
      return jsonResponse({ ok: true, added: false, reason: "already received" });
    }
    if (pendingError) {
      console.error("sms-ingest pending SMS insert error:", pendingError);
      return jsonResponse({ ok: false, error: "Could not save for review" }, 500);
    }

    return jsonResponse({
      ok: true,
      added: true,
      type: parsedSms.type,
      amount: parsedSms.amount,
      category,
      guessed,
      date: parsedSms.date,
    });
  } catch (error) {
    console.error("sms-ingest error:", error);
    return jsonResponse({ ok: false, error: "Internal error" }, 500);
  }
});
