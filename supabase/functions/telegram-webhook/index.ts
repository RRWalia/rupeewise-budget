import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isBankSmsLike } from "../_shared/sms-parser.ts";
import { enqueuePendingSms, categorizeWithAI } from "../_shared/sms-enqueue.ts";

const TELEGRAM_API = "https://api.telegram.org";

const incomeKeywords = /\b(salary|received|got paid|paycheck|paycheque|freelance(?:\s+pay(?:ment)?)?|income|refund|cashback|credited|bonus|interest earned)\b/i;

const MAX_AMOUNT = 100_000_000; // ₹10 crore — sanity ceiling for a personal tracker.

type BotChatRow = {
  id: string;
  user_id: string;
  status: string;
  chat_id: string | null;
  bot_token: string;
  bind_code: string | null;
  webhook_secret: string;
  last_transaction_id: string | null;
};

type TelegramUpdate = {
  message?: {
    message_id?: number;
    chat: { id: number };
    text?: string;
  };
};

function okResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Today's date in IST (UTC+5:30), the app's target timezone.
function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

// Extract the amount (last number in the message) and the description around it.
// "Coffee 150" / "150 coffee" / "Grocery 1,500" all work.
function parseExpenseText(text: string): { amount: number; description: string } | null {
  const matches = [...text.matchAll(/[\d,]+(?:\.\d{1,2})?/g)];
  if (matches.length === 0) return null;

  const last = matches[matches.length - 1];
  const raw = last[0].replace(/,/g, "");
  const amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;

  const description = (text.slice(0, last.index) + " " + text.slice((last.index ?? 0) + last[0].length))
    .replace(/[₹\s,.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { amount, description };
}

serve(async (req) => {
  if (req.method === "GET") return okResponse(); // liveness for manual pings
  if (req.method !== "POST") return okResponse();

  try {
    const webhookSecret = new URL(req.url).searchParams.get("s");
    if (!webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: row, error: rowError } = await supabaseAdmin
      .from("bot_chats")
      .select("id, user_id, status, chat_id, bot_token, bind_code, webhook_secret, last_transaction_id")
      .eq("webhook_secret", webhookSecret)
      .maybeSingle();

    if (rowError || !row) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const bot = row as BotChatRow;

    const update = await req.json() as TelegramUpdate;
    const message = update.message;
    if (!message || typeof message.text !== "string") return okResponse();

    const chatId = String(message.chat.id);
    const send = async (text: string) => {
      await fetch(`${TELEGRAM_API}/bot${bot.bot_token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: message.chat.id, text }),
      });
    };

    const text = message.text.trim();
    const command = (text.split(/\s+/)[0] ?? "").replace(/@\w+$/, "").toLowerCase();

    if (command === "/start") {
      if (bot.status === "active") {
        await send("Already connected ✔ Send expenses like \"Coffee 150\". Forward bank SMS here to review before they are added. /undo removes the last chat entry.");
        return okResponse();
      }
      const code = text.split(/\s+/)[1];
      if (bot.bind_code && code === bot.bind_code) {
        await supabaseAdmin
          .from("bot_chats")
          .update({ chat_id: chatId, status: "active", bind_code: null, updated_at: new Date().toISOString() })
          .eq("id", bot.id);
        await send("Connected to RupeeWise ✔\nSend expenses like \"Coffee 150\" or \"Auto 30000\".\nIncome hint: \"Received 5000 from freelance\". Forward bank SMS here to review before they are added. /undo removes the last chat entry.");
      } else {
        await send("This bot is not linked to a RupeeWise account yet. Connect it from the app: Settings → Telegram Bot.");
      }
      return okResponse();
    }

    if (bot.status !== "active" || bot.chat_id !== chatId) {
      await send("This bot is not linked to your RupeeWise account. Connect it from the app: Settings → Telegram Bot.");
      return okResponse();
    }

    if (command === "/undo") {
      if (!bot.last_transaction_id) {
        await send("Nothing to undo.");
        return okResponse();
      }
      const { data: txn } = await supabaseAdmin
        .from("transactions")
        .select("id, amount, category")
        .eq("id", bot.last_transaction_id)
        .eq("user_id", bot.user_id)
        .maybeSingle();
      if (txn) {
        await supabaseAdmin.from("transactions").delete().eq("id", txn.id);
        await send(`Removed your last entry: ₹${txn.amount} · ${txn.category}`);
      } else {
        await send("Nothing to undo.");
      }
      await supabaseAdmin.from("bot_chats").update({ last_transaction_id: null }).eq("id", bot.id);
      return okResponse();
    }

    if (isBankSmsLike(text)) {
      const result = await enqueuePendingSms(
        supabaseAdmin,
        { id: bot.id, user_id: bot.user_id },
        text,
        { telegramMessageId: message.message_id ?? null },
      );

      switch (result.kind) {
        case "not_transaction":
          await send("I recognized a forwarded bank SMS, but it does not look like a completed transaction. Nothing was added.");
          return okResponse();
        case "not_sms_like":
          // Fall through to normal chat parsing (shouldn't happen here because of isBankSmsLike guard).
          break;
        case "already_pending":
          await send("This SMS is already waiting for your review in RupeeWise → Approvals. Nothing has been added yet.");
          return okResponse();
        case "already_reviewed":
          await send("This SMS has already been reviewed, so it was not added again.");
          return okResponse();
        case "insert_failed":
          await send("I couldn't save this SMS for review. Nothing was added; please forward it again or add it in the app.");
          return okResponse();
        case "enqueued": {
          const label = result.note || result.parsed.merchant;
          await send(
            `🔎 SMS found: ${result.parsed.type === "income" ? "income" : "expense"} — ${label}, ₹${result.parsed.amount.toLocaleString("en-IN")} · suggested ${result.category}` +
              (result.guessed ? " (best guess)" : "") +
              "\nNot added yet. Review, edit, approve or dismiss it in RupeeWise → Approvals."
          );
          return okResponse();
        }
      }
    }

    if (command.startsWith("/")) {
      await send('Commands: /undo — remove the last logged entry. Anything else is logged as a transaction, e.g. "Coffee 150". Bank SMS are held for approval.');
      return okResponse();
    }

    const parsed = parseExpenseText(text);
    if (!parsed) {
      await send("I couldn't find an amount in that. Try: \"Coffee 150\" or \"Grocery 1,500\".");
      return okResponse();
    }

    const type: "income" | "expense" = incomeKeywords.test(text) ? "income" : "expense";
    const { category, note, guessed } = await categorizeWithAI(parsed.description, type);

    const { data: txn, error: txnError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: bot.user_id,
        amount: parsed.amount,
        type,
        category,
        payment_mode: "Other",
        date: todayIST(),
        note: `[Telegram] ${note}`,
      })
      .select("id")
      .single();

    if (txnError || !txn) {
      console.error("telegram-webhook insert error:", txnError);
      await send("Couldn't save that entry — please try again or add it in the app.");
      return okResponse();
    }

    await supabaseAdmin
      .from("bot_chats")
      .update({ last_transaction_id: txn.id, updated_at: new Date().toISOString() })
      .eq("id", bot.id);

    const label = parsed.description || category;
    await send(
      `✔ Logged ${type === "income" ? "income" : "expense"}: ${label} — ₹${parsed.amount.toLocaleString("en-IN")} · ${category}` +
        (guessed ? " (best guess)" : "") +
        "\n/undo to remove."
    );
    return okResponse();
  } catch (error) {
    console.error("telegram-webhook error:", error);
    return okResponse(); // always ack so Telegram stops retrying
  }
});
