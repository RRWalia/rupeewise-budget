export const expenseCategories = [
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

export const incomeCategories = ["Salary", "Freelance", "Other"];

const MAX_AMOUNT = 100_000_000; // ₹10 crore — sanity ceiling for a personal tracker.

// Portable Deno.env access: the edge runtime provides it, the frontend
// Vitest/tsc run does not (this module is imported by tests for the pure
// helpers below).
function getEnv(key: string): string | undefined {
  const runtime = globalThis as { Deno?: { env: { get(k: string): string | undefined } } };
  return runtime.Deno?.env.get(key);
}

type AICompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

/**
 * Compose the canonical text the bank-SMS parser sees for an HTTP-ingested
 * forwarded SMS. When the forwarder supplies the original sender short code
 * (e.g. HDFCBK), prefix it as "HDFCBK: ..." — the parser's short-code envelope
 * then records the sender and treats the message as an explicitly-marked bank
 * SMS. Without a sender, prefix "SMS:" so a nonstandard alert is still held
 * for review instead of being silently dropped.
 */
export function composeIngestText(sender: string | null, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (sender && /^[A-Za-z][A-Za-z0-9_-]{2,19}$/.test(sender.trim())) {
    return `${sender.trim().toUpperCase()}: ${trimmed}`;
  }
  return `SMS: ${trimmed}`;
}

export async function smsFingerprint(userId: string, sender: string | null, message: string): Promise<string> {
  const canonical = JSON.stringify([userId, sender ?? "", message]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function categorizeWithAI(
  description: string,
  type: "income" | "expense"
): Promise<{ category: string; note: string; guessed: boolean }> {
  const categories = type === "expense" ? expenseCategories : incomeCategories;
  const fallback = type === "expense" ? "Personal" : "Other";

  const apiKey = getEnv("LOVABLE_API_KEY");
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

export { MAX_AMOUNT };
