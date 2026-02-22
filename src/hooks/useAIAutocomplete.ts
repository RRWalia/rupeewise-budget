import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AISuggestion {
  category: string;
  suggestedNote: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export function useAIAutocomplete() {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getSuggestion = async (amount: number, type: 'income' | 'expense', note?: string) => {
    if (amount <= 0) {
      setSuggestion(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-autocomplete', {
        body: { amount, type, note }
      });

      if (fnError) throw fnError;

      if (data?.category) {
        setSuggestion(data as AISuggestion);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('AI autocomplete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get suggestions');
      setSuggestion(null);
    } finally {
      setLoading(false);
    }
  };

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    setError(null);
  }, []);

  return { suggestion, loading, error, getSuggestion, clearSuggestion };
}
