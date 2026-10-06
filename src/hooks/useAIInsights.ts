import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Transaction } from './useTransactions';

export interface AIInsight {
  type: 'warning' | 'suggestion' | 'tip';
  title: string;
  description: string;
  savings?: number;
}

const EMPTY_STATE_INSIGHTS: AIInsight[] = [{
  type: 'tip',
  title: 'Start tracking!',
  description: 'Add your first transaction to get personalized AI insights.',
}];

const FALLBACK_INSIGHTS: AIInsight[] = [{
  type: 'tip',
  title: 'Keep tracking!',
  description: 'Continue adding transactions for better insights.',
}];

export function buildInsightsFingerprint(transactions: Transaction[], monthKey: string) {
  if (transactions.length === 0) return `${monthKey}:empty`;

  return [
    monthKey,
    ...transactions
      .map(transaction => [
        transaction.id,
        transaction.updated_at ?? transaction.created_at,
        transaction.amount,
        transaction.category,
        transaction.type,
        transaction.date,
      ].join(':'))
      .sort(),
  ].join('|');
}

export function useAIInsights() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFingerprintRef = useRef<string | null>(null);
  const activeRequestRef = useRef<string | null>(null);
  const cacheRef = useRef(new Map<string, AIInsight[]>());

  const fetchInsights = useCallback(async (
    transactions: Transaction[],
    fingerprint: string,
    options: { force?: boolean } = {}
  ) => {
    if (transactions.length === 0) {
      lastFingerprintRef.current = fingerprint;
      cacheRef.current.set(fingerprint, EMPTY_STATE_INSIGHTS);
      setInsights(EMPTY_STATE_INSIGHTS);
      setError(null);
      return;
    }

    if (!options.force && lastFingerprintRef.current === fingerprint) {
      return;
    }

    const cached = cacheRef.current.get(fingerprint);
    if (!options.force && cached) {
      lastFingerprintRef.current = fingerprint;
      setInsights(cached);
      setError(null);
      return;
    }

    lastFingerprintRef.current = fingerprint;
    activeRequestRef.current = fingerprint;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-insights', {
        body: { transactions }
      });

      if (fnError) throw fnError;

      if (activeRequestRef.current !== fingerprint) return;

      if (data?.insights && Array.isArray(data.insights)) {
        const nextInsights = data.insights as AIInsight[];
        cacheRef.current.set(fingerprint, nextInsights);
        setInsights(nextInsights);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      if (activeRequestRef.current !== fingerprint) return;

      console.error('Error fetching AI insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to load insights');
      cacheRef.current.set(fingerprint, FALLBACK_INSIGHTS);
      setInsights(FALLBACK_INSIGHTS);
    } finally {
      if (activeRequestRef.current === fingerprint) {
        setLoading(false);
      }
    }
  }, []);

  return { insights, loading, error, fetchInsights };
}
