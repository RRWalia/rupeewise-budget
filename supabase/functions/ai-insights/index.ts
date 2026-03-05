import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const { transactions } = await req.json();

    // Input validation
    if (!Array.isArray(transactions) || transactions.length > 500) {
      return new Response(JSON.stringify({ error: 'Invalid or too many transactions (max 500)' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const t of transactions) {
      if (!t.type || !['income', 'expense'].includes(t.type)) {
        return new Response(JSON.stringify({ error: 'Invalid transaction type' }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof t.amount !== 'number' || !isFinite(t.amount) || t.amount < 0) {
        return new Response(JSON.stringify({ error: 'Invalid amount' }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof t.category !== 'string' || t.category.length > 100) {
        return new Response(JSON.stringify({ error: 'Invalid category' }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Ownership validation
      if (t.user_id && t.user_id !== userId) {
        return new Response(JSON.stringify({ error: 'Forbidden: Transaction does not belong to user' }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Calculate spending summary
    const expenses = transactions.filter((t: any) => t.type === 'expense');
    const income = transactions.filter((t: any) => t.type === 'income');
    
    const totalExpenses = expenses.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
    const totalIncome = income.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
    
    // Group by category
    const categoryTotals: Record<string, number> = {};
    expenses.forEach((t: any) => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Number(t.amount);
    });

    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, amount]) => `${cat}: ₹${amount.toLocaleString('en-IN')}`);

    const prompt = `You are a personal finance assistant for an Indian user. Analyze their transaction data and provide helpful insights.

Transaction Summary:
- Total Income: ₹${totalIncome.toLocaleString('en-IN')}
- Total Expenses: ₹${totalExpenses.toLocaleString('en-IN')}
- Savings: ₹${(totalIncome - totalExpenses).toLocaleString('en-IN')}
- Top spending categories: ${topCategories.join(', ')}

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
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse the JSON response
    let insights;
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

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI insights error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
