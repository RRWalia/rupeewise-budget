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

    const body = await req.json();
    const { amount, type, note } = body;

    // Input validation
    if (typeof amount !== 'number' || amount <= 0 || !isFinite(amount)) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!type || !['income', 'expense'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (note && (typeof note !== 'string' || note.length > 500)) {
      return new Response(JSON.stringify({ error: 'Invalid note' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const expenseCategories = ["Housing", "Loans & EMIs", "Tuition & Education", "Grocery", "Travel", "Food Delivery", "Shopping", "Bills", "Medical", "Subscriptions", "Fuel", "Entertainment", "Personal", "Health"];
    const incomeCategories = ["Salary", "Freelance", "Investment", "Business", "Rent", "Other"];
    
    const categories = type === 'expense' ? expenseCategories : incomeCategories;

    const prompt = `You are a smart financial assistant for an Indian user. Based on the transaction details, suggest the most appropriate category and a helpful note.

Transaction Details:
- Amount: ₹${amount.toLocaleString('en-IN')}
- Type: ${type}
${note ? `- User's partial note: "${note}"` : ''}

Available Categories for ${type}: ${categories.join(', ')}

Provide suggestions in JSON format:
{
  "category": "Most likely category from the list",
  "suggestedNote": "A brief, helpful note (max 50 chars)",
  "confidence": "high" | "medium" | "low",
  "reasoning": "One sentence explaining why"
}

Rules:
- For common amounts in India: ₹500-2000 might be food/grocery, ₹5000+ might be shopping/bills
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
    
    let suggestion;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        suggestion = JSON.parse(jsonMatch[0]);
        // Validate category is in allowed list
        if (!categories.includes(suggestion.category)) {
          suggestion.category = categories[0];
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

    return new Response(JSON.stringify(suggestion), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI autocomplete error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
