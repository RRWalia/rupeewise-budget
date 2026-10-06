import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Transaction {
  id: string;
  amount: number;
  date: string;
  category: string;
  payment_mode: string;
  note?: string | null;
  type: 'income' | 'expense';
  created_at: string;
  updated_at?: string | null;
  user_id?: string | null;
}

type EditableTransactionField = keyof Pick<Transaction, 'amount' | 'date' | 'category' | 'payment_mode' | 'note'>;
type EditableTransactionUpdates = Partial<Pick<Transaction, EditableTransactionField>>;

function normalizeTransaction(transaction: {
  id: string;
  amount: number;
  date: string;
  category: string;
  payment_mode: string;
  note?: string | null;
  type: string;
  created_at: string;
  updated_at?: string | null;
  user_id?: string | null;
}): Transaction {
  return {
    ...transaction,
    type: transaction.type as 'income' | 'expense',
  };
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTransactions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setTransactions((data || []).map(normalizeTransaction));
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'created_at' | 'user_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired. Please sign in again.');

      const { data, error } = await supabase
        .from('transactions')
        .insert([{ ...transaction, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      
      const typedData = normalizeTransaction(data);
      // Update local state immediately with server-confirmed data
      setTransactions(prev => {
        const updated = [typedData, ...prev];
        updated.sort((a, b) => b.date.localeCompare(a.date));
        return updated;
      });
      return { success: true, data: typedData };
    } catch (error) {
      console.error('Error adding transaction:', error);
      const message = error instanceof Error ? error.message : 'Failed to add transaction';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      return { success: false, error, message };
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const updateTransaction = async (
    id: string,
    updates: EditableTransactionUpdates
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired. Please sign in again.');

      // Get current transaction to avoid unnecessary writes. The database trigger owns audit history.
      const current = transactions.find(t => t.id === id);
      if (!current) throw new Error('Transaction not found');

      const changedFields = (Object.keys(updates) as EditableTransactionField[]).filter(key => {
        const oldVal = String(current[key] ?? '');
        const newVal = String(updates[key] ?? '');
        return oldVal !== newVal;
      });

      if (changedFields.length === 0) {
        return { success: true, data: current };
      }

      const { data, error } = await supabase
        .from('transactions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      const typedData = normalizeTransaction(data);
      setTransactions(prev => prev.map(t => t.id === id ? typedData : t));
      return { success: true, data: typedData };
    } catch (error) {
      console.error('Error updating transaction:', error);
      const message = error instanceof Error ? error.message : 'Failed to update transaction';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      return { success: false, error, message };
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired. Please sign in again.');

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      setTransactions(prev => prev.filter(t => t.id !== id));
      return { success: true };
    } catch (error) {
      console.error('Error deleting transaction:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete transaction';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      return { success: false, error, message };
    }
  };

  // Realtime subscription scoped to the current user. A slower polling fallback starts only if realtime fails.
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    const startFallbackPolling = () => {
      if (!pollTimer) {
        pollTimer = setInterval(fetchTransactions, 60_000);
      }
    };

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      channel = supabase
        .channel(`transactions-realtime-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchTransactions();
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            startFallbackPolling();
          }
        });
    };

    setupRealtime();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchTransactions]);

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction, refetch: fetchTransactions };
}
