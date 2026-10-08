// Shared helpers for turning an inbound bank SMS (whether it came from
// Telegram's webhook or from a generic HTTP forwarder) into a
// pending_transactions row that the user can review in Approvals.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isBankSmsLike, parseBankSmsTransaction, type ParsedBankSms } from "./sms-parser.ts";

const expenseCategories = [
  "Grocery",
  "Housing",
  "Loans & EMIs",
  "Tuition & Education",
  "Travel",
  "Shopping",
  "Entertainment",
  "Medical",
  "Personal",
  "Health",
];

const incomeCategories = ["Salary", "Freelance", "Other"];

const AI_FALLBACKS = { expense: "Personal" as const, income: "Other" as const };

type AICompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export type EnqueueResult =
  | { kind: "enqueued"; parsed: ParsedBankSms; category: string; note: string; guessed: boolean; deduped: boolean }
  | { kind: "already_pending"; deduped: true }
  | { kind: "already_reviewed"; deduped: true }
  | { kind: "not_transaction" }
  | { kind: "not_sms_like" }
  | { kind: "insert_failed"; message: string };

export type BotChatLookup = {
  id: string;
  user_id: string;
};

export async function smsFingerprint(userId: string, sender: string | null, message: string): Promise<string> {
  const canonical = JSON.stringify([userId, sender ?? "", message]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function categorizeWithAI(
  description: string,
  type: "income" | "expense",
): Promise<{ category: string; note: string; guessed: boolean }> {
  const categories = type === "expense" ? expenseCategories : incomeCategories;
  const fallback = AI_FALLBACKS[type];

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || !description) {
    return { category: fallback, note: description, guessed: true };
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a helpful financial assistant. Always respond with valid JSON only, no markdown." },
          {
            role: "user",
            content: `An Indian user logged this ${type} via bank SMS auto-forward: "${description}".
Pick the single best category from: ${categories.join(", ")}.
Respond with JSON only: {"category": "<one from the list>", "note": "<short clean note, max 40 chars>"}`,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`AI gateway error: ${response.status}`);

    const data = await response.json() as AICompletionResponse;
    const content = data.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in AI response");

    const parsed = JSON.parse(match[0]) as { category?: unknown; note?: unknown };
    const category = typeof parsed.category === "string" && categories.includes(parsed.category)
      ? parsed.category
      : fallback;
    const note = typeof parsed.note === "string" && parsed.note.trim() ? parsed.note.trim().slice(0, 40) : description;

    return { category, note, guessed: category === fallback };
  } catch {
    return { category: fallback, note: description, guessed: true };
  }
}

/** High-level entry point used by both telegram-webhook and sms-ingest to
 *  take an inbound SMS text and (maybe) produce a pending_transactions row. */
export async function enqueuePendingSms(
  supabaseAdmin: SupabaseClient,
  bot: BotChatLookup,
  text: string,
  opts: { telegramMessageId?: number | null } = {},
): Promise<EnqueueResult> {
  if (!isBankSmsLike(text)) {
    return { kind: "not_sms_like" };
  }

  const parsedSms = parseBankSmsTransaction(text);
  if (!parsedSms) {
    return { kind: "not_transaction" };
  }

  const sourceFingerprint = await smsFingerprint(bot.user_id, parsedSms.sender, parsedSms.fingerprintText);

  const { data: alreadySeen } = await supabaseAdmin
    .from("pending_transactions")
    .select("status")
    .eq("user_id", bot.user_id)
    .eq("source_fingerprint", sourceFingerprint)
    .maybeSingle();

  if (alreadySeen) {
    return alreadySeen.status === "pending"
      ? { kind: "already_pending", deduped: true }
      : { kind: "already_reviewed", deduped: true };
  }

  const { category, note, guessed } = await categorizeWithAI(parsedSms.merchant, parsedSms.type);

  const { error: pendingError } = await supabaseAdmin.from("pending_transactions").insert({
    user_id: bot.user_id,
    bot_chat_id: bot.id,
    telegram_message_id: opts.telegramMessageId ?? null,
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
    // Race with a concurrent forward of the same SMS — check which state won.
    const { data: duplicate } = await supabaseAdmin
      .from("pending_transactions")
      .select("status")
      .eq("user_id", bot.user_id)
      .eq("source_fingerprint", sourceFingerprint)
      .maybeSingle();
    return duplicate?.status === "pending"
      ? { kind: "already_pending", deduped: true }
      : duplicate
        ? { kind: "already_reviewed", deduped: true }
        : { kind: "enqueued", parsed: parsedSms, category, note, guessed, deduped: true };
  }

  if (pendingError) {
    console.error("sms enqueue insert error:", pendingError);
    return { kind: "insert_failed", message: pendingError.message };
  }

  return { kind: "enqueued", parsed: parsedSms, category, note, guessed, deduped: false };
}

/** Convenience for sms-ingest: build an admin Supabase client from env vars. */
export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}
