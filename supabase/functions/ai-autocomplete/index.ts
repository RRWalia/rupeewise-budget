import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type TransactionType = "income" | "expense";

type AICompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type Suggestion = {
  category: string;
  suggestedNote: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
};

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

const defaultAllowedOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "https://rupeewise-budget.lovable.app",
];

function getAllowedOrigins() {
  return (Deno.env.get("ALLOWED_ORIGINS")?.split(",") ?? defaultAllowedOrigins)
    .map(origin => origin.trim())
    .filter(Boolean);
}

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigins = getAllowedOrigins();
  const allowAny = allowedOrigins.includes("*");
  const allowedOrigin = allowAny || allowedOrigins.includes(origin)
    ? origin || allowedOrigins[0]
    : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function isTransactionType(value: unknown): value is TransactionType {
  return value === "income" || value === "expense";
}

function isSuggestion(value: unknown): value is Suggestion {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.category === "string" &&
    typeof candidate.suggestedNote === "string" &&
    (candidate.confidence === "high" || candidate.confidence === "medium" || candidate.confidence === "low") &&
    typeof candidate.reasoning === "string";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(req) });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const body = await req.json() as { amount?: unknown; type?: unknown; note?: unknown };
    const { amount, type, note } = body;

    // Input validation
    if (typeof amount !== "number" || amount <= 0 || !isFinite(amount)) {
      return jsonResponse(req, { error: "Invalid amount" }, 400);
    }

    if (!isTransactionType(type)) {
      return jsonResponse(req, { error: "Invalid type" }, 400);
    }

    if (note && (typeof note !== "string" || note.length > 500)) {
      return jsonResponse(req, { error: "Invalid note" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }
    
    const categories = type === "expense" ? expenseCategories : incomeCategories;

    const prompt = `You are a smart financial assistant for an Indian user. Based on the transaction details, suggest the most appropriate category and a helpful note.

Transaction Details:
- Amount: ₹${amount.toLocaleString("en-IN")}
- Type: ${type}
${note ? `- User's partial note: "${note}"` : ""}

Available Categories for ${type}: ${categories.join(", ")}

Provide suggestions in JSON format:
{
  "category": "Most likely category from the list",
  "suggestedNote": "A brief, helpful note (max 50 chars)",
  "confidence": "high" | "medium" | "low",
  "reasoning": "One sentence explaining why"
}

Rules:
- For common amounts in India: ₹500-2000 might be grocery/personal, ₹5000+ might be shopping/housing/education
- If user provided a partial note, complete it meaningfully
- Keep suggestedNote concise and in context of Indian spending
- Only use categories from the provided list`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a helpful financial assistant. Always respond with valid JSON only, no markdown." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return jsonResponse(req, { error: "Rate limit exceeded, please try again later." }, 429);
      }
      if (response.status === 402) {
        return jsonResponse(req, { error: "Payment required, please add funds." }, 402);
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json() as AICompletionResponse;
    const content = data.choices?.[0]?.message?.content || "";
    
    let suggestion: Suggestion;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedSuggestion = JSON.parse(jsonMatch[0]) as unknown;
        if (!isSuggestion(parsedSuggestion)) {
          throw new Error("Invalid suggestion response");
        }
        suggestion = parsedSuggestion;
        // Validate category is in allowed list
        if (!categories.includes(suggestion.category)) {
          suggestion.category = categories[0];
          suggestion.confidence = "low";
          suggestion.reasoning = "AI returned a category outside the supported list.";
        }
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      suggestion = {
        category: categories[0],
        suggestedNote: "",
        confidence: "low",
        reasoning: "Could not generate suggestion"
      };
    }

    return jsonResponse(req, suggestion);

  } catch (error) {
    console.error("AI autocomplete error:", error);
    return jsonResponse(req, { error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
