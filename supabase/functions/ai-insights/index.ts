import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type TransactionPayload = {
  amount: number;
  type: "income" | "expense";
  category: string;
  user_id?: string;
};

type AICompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

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

function parseTransactions(input: unknown): TransactionPayload[] | string {
  if (!Array.isArray(input) || input.length > 500) {
    return "Invalid or too many transactions (max 500)";
  }

  const transactions: TransactionPayload[] = [];

  for (const transaction of input) {
    if (!transaction || typeof transaction !== "object") {
      return "Invalid transaction";
    }

    const candidate = transaction as Record<string, unknown>;
    const { amount, type, category, user_id } = candidate;

    if (type !== "income" && type !== "expense") {
      return "Invalid transaction type";
    }

    if (typeof amount !== "number" || !isFinite(amount) || amount < 0) {
      return "Invalid amount";
    }

    if (typeof category !== "string" || category.length > 100) {
      return "Invalid category";
    }

    if (user_id !== undefined && typeof user_id !== "string") {
      return "Invalid transaction owner";
    }

    transactions.push({ amount, type, category, user_id });
  }

  return transactions;
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

    const requestBody = await req.json() as { transactions?: unknown };
    const parsedTransactions = parseTransactions(requestBody.transactions);

    if (typeof parsedTransactions === "string") {
      return jsonResponse(req, { error: parsedTransactions }, 400);
    }

    for (const transaction of parsedTransactions) {
      if (transaction.user_id && transaction.user_id !== user.id) {
        return jsonResponse(req, { error: "Forbidden: Transaction does not belong to user" }, 403);
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Calculate spending summary
    const expenses = parsedTransactions.filter(transaction => transaction.type === "expense");
    const income = parsedTransactions.filter(transaction => transaction.type === "income");
    
    const totalExpenses = expenses.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const totalIncome = income.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    
    // Group by category
    const categoryTotals: Record<string, number> = {};
    expenses.forEach(transaction => {
      categoryTotals[transaction.category] = (categoryTotals[transaction.category] || 0) + Number(transaction.amount);
    });

    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, amount]) => `${cat}: ₹${amount.toLocaleString("en-IN")}`);

    const prompt = `You are a personal finance assistant for an Indian user. Analyze their transaction data and provide helpful insights.

Transaction Summary:
- Total Income: ₹${totalIncome.toLocaleString("en-IN")}
- Total Expenses: ₹${totalExpenses.toLocaleString("en-IN")}
- Savings: ₹${(totalIncome - totalExpenses).toLocaleString("en-IN")}
- Top spending categories: ${topCategories.join(", ")}

Provide exactly 3 insights in JSON format with this structure:
{
  "insights": [
    {
      "type": "warning" | "suggestion" | "tip",
      "title": "Short title (max 6 words)",
      "description": "Brief actionable insight (max 25 words)",
      "savings": optional number (only for suggestions with potential savings)
    }
  ]
}

Focus on:
1. One warning about high spending category
2. One specific savings suggestion with amount
3. One positive tip or encouragement

Keep insights specific to the data, actionable, and in Indian context (use ₹).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a helpful financial advisor. Always respond with valid JSON only, no markdown." },
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
    
    // Parse the JSON response
    let insights: unknown;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      // Fallback insights if parsing fails
      insights = {
        insights: [
          {
            type: "tip",
            title: "Track your spending",
            description: "Keep adding transactions to get personalized insights!"
          }
        ]
      };
    }

    return jsonResponse(req, insights);

  } catch (error) {
    console.error("AI insights error:", error);
    return jsonResponse(req, { error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
