// Generic HTTP ingest endpoint for Android SMS forwarders (SMS Telebot,
// MacroDroid, "Incoming SMS to URL Forwarder" from F-Droid, etc.).
//
// The forwarder POSTs JSON:
//   { "secret": "<your webhook_secret>", "sender": "HDFCBK", "text": "Rs.150 debited..." }
//
// We look up the bot_chats row by the (unguessable) webhook_secret, run the
// same SMS parser + AI categorizer used by the Telegram webhook, and enqueue
// a pending_transactions row that shows up in Approvals.
//
// This endpoint does NOT require a JWT (the forwarder has no Supabase session).
// It is secured purely by the per-user webhook_secret, which is unique per
// bot connection and shown only to the connected user in Settings.
//
// Accepts application/json or application/x-www-form-urlencoded. Also allows
// sender/text as query params for very simple forwarders.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { composeForwardedSmsText } from "../_shared/sms-parser.ts";
import { createAdminClient, enqueuePendingSms } from "../_shared/sms-enqueue.ts";

const MAX_BODY_BYTES = 16 * 1024; // 16 KiB is plenty for an SMS.

type IngestPayload = {
  secret?: unknown;
  sender?: unknown;
  text?: unknown;
  // Common alternative names used by forwarder apps — accept them all.
  from?: unknown;
  address?: unknown;
  message?: unknown;
  body?: unknown;
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function readPayload(req: Request): Promise<IngestPayload> {
  const url = new URL(req.url);
  const fromQuery: IngestPayload = {
    secret: url.searchParams.get("secret"),
    sender: url.searchParams.get("sender") ?? url.searchParams.get("from"),
    text: url.searchParams.get("text") ?? url.searchParams.get("message") ?? url.searchParams.get("body"),
  };

  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();

  try {
    if (contentType.includes("application/json")) {
      const cloned = req.clone();
      const json = await cloned.json() as IngestPayload;
      return { ...fromQuery, ...json };
    }
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await req.clone().formData();
      return {
        secret: fromQuery.secret ?? form.get("secret"),
        sender: fromQuery.sender ?? form.get("sender") ?? form.get("from") ?? form.get("address"),
        text: fromQuery.text ?? form.get("text") ?? form.get("message") ?? form.get("body"),
      };
    }
  } catch {
    // Fall through to query-only.
  }

  return fromQuery;
}

serve(async (req) => {
  // Lightweight CORS — browser-based senders (MacroDroid HTTP action, custom
  // tasker plugins) often send an OPTIONS preflight.
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
    return jsonResponse(200, { ok: true, service: "rupeewise-sms-ingest" });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  // Cap body size so a misconfigured forwarder cannot POST a huge blob.
  if (req.headers.get("content-length") && Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: "Payload too large" });
  }

  try {
    const payload = await readPayload(req);

    const secret = asString(payload.secret);
    if (!secret) {
      return jsonResponse(401, { error: "Missing secret" });
    }

    const rawText = asString(payload.text) ?? asString(payload.message) ?? asString(payload.body);
    if (!rawText) {
      return jsonResponse(400, { error: "Missing text" });
    }

    const sender = asString(payload.sender) ?? asString(payload.from) ?? asString(payload.address);
    const text = composeForwardedSmsText(sender, rawText);

    const supabase = createAdminClient();

    const { data: bot, error: botError } = await supabase
      .from("bot_chats")
      .select("id, user_id, status")
      .eq("webhook_secret", secret)
      .maybeSingle();

    if (botError || !bot) {
      return jsonResponse(401, { error: "Unauthorized" });
    }
    if (bot.status !== "active") {
      return jsonResponse(403, { error: "Bot not connected" });
    }

    const result = await enqueuePendingSms(
      supabase,
      { id: bot.id, user_id: bot.user_id },
      text,
    );

    switch (result.kind) {
      case "not_sms_like":
        return jsonResponse(422, { ok: false, error: "Not recognized as a bank SMS" });
      case "not_transaction":
        return jsonResponse(422, { ok: false, error: "Recognized but not a completed debit/credit (OTP? failed? promo?)" });
      case "already_pending":
        return jsonResponse(200, { ok: true, queued: false, status: "already_pending" });
      case "already_reviewed":
        return jsonResponse(200, { ok: true, queued: false, status: "already_reviewed" });
      case "insert_failed":
        return jsonResponse(500, { ok: false, error: result.message });
      case "enqueued":
        return jsonResponse(200, {
          ok: true,
          queued: true,
          amount: result.parsed.amount,
          type: result.parsed.type,
          merchant: result.parsed.merchant,
          category: result.category,
          date: result.parsed.date,
        });
    }
  } catch (err) {
    console.error("sms-ingest error:", err);
    return jsonResponse(500, { error: "Internal error" });
  }
});
