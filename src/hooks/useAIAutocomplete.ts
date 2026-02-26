import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AISuggestion {
  category: string;
  suggestedNote: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

const AI_TIMEOUT_MS = 8000;

export function useAIAutocomplete() {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const getSuggestion = useCallback(async (amount: number, type: 'income' | 'expense', note?: string) => {
    if (amount <= 0) {
      setSuggestion(null);
      return;
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    // Timeout fallback
    const timeout = setTimeout(() => {
      controller.abort();
    }, AI_TIMEOUT_MS);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-autocomplete', {
        body: { amount, type, note }
      });

      // Check if aborted
      if (controller.signal.aborted) return;

      clearTimeout(timeout);

      if (fnError) throw fnError;

      if (data?.category) {
        setSuggestion(data as AISuggestion);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setError('Request timed out. Please try again.');
        setSuggestion(null);
        setLoading(false);
        return;
      }
      console.error('AI autocomplete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get suggestions');
      setSuggestion(null);
    } finally {
      clearTimeout(timeout);
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    setError(null);
    abortRef.current?.abort();
  }, []);

  return { suggestion, loading, error, getSuggestion, clearSuggestion };
}
