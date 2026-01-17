import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Transaction } from './useTransactions';

export interface AIInsight {
  type: 'warning' | 'suggestion' | 'tip';
  title: string;
  description: string;
  savings?: number;
}

export function useAIInsights() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async (transactions: Transaction[]) => {
    if (transactions.length === 0) {
      setInsights([{
        type: 'tip',
        title: 'Start tracking!',
        description: 'Add your first transaction to get personalized AI insights.'
      }]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-insights', {
        body: { transactions }
      });

      if (fnError) throw fnError;

      if (data?.insights && Array.isArray(data.insights)) {
        setInsights(data.insights);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Error fetching AI insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to load insights');
      // Fallback insights
      setInsights([{
        type: 'tip',
        title: 'Keep tracking!',
        description: 'Continue adding transactions for better insights.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return { insights, loading, error, fetchInsights };
}
