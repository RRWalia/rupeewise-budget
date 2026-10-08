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

type IngestOutcome =
  | "enqueued"
  | "duplicate"
  | "not_sms"
  | "not_transaction"
  | "unauthorized"
  | "rate_limited"
  | "error";

type IngestPayload = {
  secret?: unknown;
  sender?: unknown;
  from?: unknown;
  text?: unknown;
  body?: unknown;
  message?: unknown;
};

type IngestLogEntry = {
  bot_chat_id?: string | null;
  secret_prefix?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  sender?: string | null;
  outcome: IngestOutcome;
  amount?: number | null;
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

function requestMeta(req: Request): { ip: string | null; user_agent: string | null } {
  const forwarded = req.headers.get("x-forwarded-for");
  const ipValue = (forwarded ? forwarded.split(",")[0] : (req.headers.get("x-real-ip") ?? "")).trim();
  const userAgent = req.headers.get("user-agent");
  return {
    ip: ipValue ? ipValue.slice(0, 64) : null,
    user_agent: userAgent ? userAgent.slice(0, 200) : null,
  };
}

// Awaited, not fire-and-forget: Deno edge isolates drop pending promises once
// the response is returned, so fire-and-forget inserts never landed in
// sms_ingest_logs. A logging failure must never break the ingest request,
// hence the try/catch swallow.
async function logAttempt(
  supabaseAdmin: ReturnType<typeof createClient>,
  entry: IngestLogEntry
) {
  try {
    const { error } = await supabaseAdmin
      .from("sms_ingest_logs")
      .insert({
        bot_chat_id: entry.bot_chat_id ?? null,
        secret_prefix: entry.secret_prefix ?? null,
        ip: entry.ip ?? null,
        user_agent: entry.user_agent ?? null,
        sender: entry.sender ?? null,
        outcome: entry.outcome,
        amount: entry.amount ?? null,
      });
    if (error) console.error("sms-ingest log insert error:", error);
  } catch (e) {
    console.error("sms-ingest log insert error:", e);
  }
}

// Generic HTTP ingest for Android SMS forwarders (SMS Telebot, MacroDroid, …).
// Secured by the same unguessable per-connection secret as the Telegram webhook:
// callers POST { secret, sender, text } (or ?s=<secret> plus the same body fields).
// Only the bank-SMS approval path exists here — nothing is ever auto-logged.
// Every attempt is written to sms_ingest_logs (audit + sliding-window rate limit).
serve(async (req) => {
  // Browser-based senders (MacroDroid HTTP action, Tasker plugins) send an
  // OPTIONS preflight for JSON POSTs — answer it or they cannot call us at all.
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (req.method === "GET") {
    return jsonResponse({ ok: true, hint: "POST JSON: { secret, sender, text }" });
  }
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

  const meta = requestMeta(req);
  let supabaseAdmin: ReturnType<typeof createClient> | null = null;

  try {
    const secretParam = new URL(req.url).searchParams.get("s");

    let payload: IngestPayload = {};
    try {
      payload = await req.json() as IngestPayload;
    } catch {
      return jsonResponse({ ok: false, error: "Expected JSON body" }, 400);
    }

    supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const admin = supabaseAdmin;

    const secret = firstString(payload.secret) ?? secretParam;
    // Reject anything shorter than the real secrets before hitting the DB.
    if (!secret || secret.length < 8) {
      await logAttempt(admin, { outcome: "unauthorized", secret_prefix: secret ? secret.slice(0, 8) : null, ...meta });
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const { data: row, error: rowError } = await admin
      .from("bot_chats")
      .select("id, user_id, status, webhook_secret")
      .eq("webhook_secret", secret)
      .maybeSingle();

    if (rowError || !row) {
      await logAttempt(admin, { outcome: "unauthorized", secret_prefix: secret.slice(0, 8), ...meta });
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }
    const bot = row as BotChatRow;

    // Sliding-window rate limit: at most 30 attempts per bot per 60 seconds.
    const windowStart = new Date(Date.now() - 60_000).toISOString();
    const { count: recentAttempts, error: countError } = await admin
      .from("sms_ingest_logs")
      .select("id", { count: "exact", head: true })
      .eq("bot_chat_id", bot.id)
      .gte("created_at", windowStart);
    if (countError) console.error("sms-ingest rate-limit count error:", countError);
    if (!countError && (recentAttempts ?? 0) >= 30) {
      await logAttempt(admin, { bot_chat_id: bot.id, outcome: "rate_limited", ...meta });
      return jsonResponse({ ok: false, error: "Rate limit exceeded" }, 429);
    }

    if (bot.status !== "active") {
      return jsonResponse({ ok: false, error: "Telegram bot not connected yet. Finish setup in RupeeWise → Settings." }, 403);
    }

    const text = firstString(payload.text, payload.body, payload.message);
    if (!text) return jsonResponse({ ok: false, error: "Missing text field" }, 400);

    const sender = firstString(payload.sender, payload.from);
    const senderLog = sender ? sender.slice(0, 40) : null;
    // Cap the raw SMS text before composing so a huge forward cannot bloat us.
    const rawText = text.slice(0, 2000);
    const composed = composeIngestText(sender, rawText);

    if (!isBankSmsLike(composed)) {
      // Not a transaction alert — ack so the forwarder does not retry forever.
      await logAttempt(admin, { bot_chat_id: bot.id, outcome: "not_sms", sender: senderLog, ...meta });
      return jsonResponse({ ok: true, added: false, reason: "not a bank transaction SMS" });
    }

    const parsedSms = parseBankSmsTransaction(composed);
    if (!parsedSms) {
      await logAttempt(admin, { bot_chat_id: bot.id, outcome: "not_transaction", sender: senderLog, ...meta });
      return jsonResponse({ ok: true, added: false, reason: "could not parse a completed transaction (OTP, failed or promotional alert?)" });
    }

    const sourceFingerprint = await smsFingerprint(bot.user_id, parsedSms.sender, parsedSms.fingerprintText);
    const { data: alreadySeen } = await admin
      .from("pending_transactions")
      .select("status")
      .eq("user_id", bot.user_id)
      .eq("source_fingerprint", sourceFingerprint)
      .maybeSingle();
    if (alreadySeen) {
      await logAttempt(admin, {
        bot_chat_id: bot.id,
        outcome: "duplicate",
        sender: senderLog,
        amount: parsedSms.amount,
        ...meta,
      });
      return jsonResponse({ ok: true, added: false, reason: alreadySeen.status === "pending" ? "already awaiting review" : "already reviewed" });
    }

    const { category, note, guessed } = await categorizeWithAI(parsedSms.merchant, parsedSms.type);
    const { error: pendingError } = await admin.from("pending_transactions").insert({
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
      await logAttempt(admin, {
        bot_chat_id: bot.id,
        outcome: "duplicate",
        sender: senderLog,
        amount: parsedSms.amount,
        ...meta,
      });
      return jsonResponse({ ok: true, added: false, reason: "already received" });
    }
    if (pendingError) {
      console.error("sms-ingest pending SMS insert error:", pendingError);
      await logAttempt(admin, {
        bot_chat_id: bot.id,
        outcome: "error",
        sender: senderLog,
        amount: parsedSms.amount,
        ...meta,
      });
      return jsonResponse({ ok: false, error: "Could not save for review" }, 500);
    }

    await logAttempt(admin, {
      bot_chat_id: bot.id,
      outcome: "enqueued",
      sender: senderLog,
      amount: parsedSms.amount,
      ...meta,
    });

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
    if (supabaseAdmin) {
      await logAttempt(supabaseAdmin, { outcome: "error", ...meta });
    }
    return jsonResponse({ ok: false, error: "Internal error" }, 500);
  }
});
