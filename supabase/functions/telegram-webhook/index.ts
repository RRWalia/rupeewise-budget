import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_API = "https://api.telegram.org";

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
    chat: { id: number };
    text?: string;
  };
};

type AICompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
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
    .replace(/[₹\s,.\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { amount, description };
}

async function categorizeWithAI(
  description: string,
  type: "income" | "expense"
): Promise<{ category: string; note: string; guessed: boolean }> {
  const categories = type === "expense" ? expenseCategories : incomeCategories;
  const fallback = type === "expense" ? "Personal" : "Other";

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
            content: `An Indian user logged this ${type} via chat: "${description}".
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
        await send("Already connected ✔ Just send expenses like \"Coffee 150\". /undo removes the last one.");
        return okResponse();
      }
      const code = text.split(/\s+/)[1];
      if (bot.bind_code && code === bot.bind_code) {
        await supabaseAdmin
          .from("bot_chats")
          .update({ chat_id: chatId, status: "active", bind_code: null, updated_at: new Date().toISOString() })
          .eq("id", bot.id);
        await send("Connected to RupeeWise ✔\nSend expenses like \"Coffee 150\" or \"Auto 30000\".\nIncome hint: \"Received 5000 from freelance\". /undo removes the last entry.");
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

    if (command.startsWith("/")) {
      await send("Commands: /undo — remove the last logged entry. Anything else is logged as a transaction, e.g. \"Coffee 150\".");
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
