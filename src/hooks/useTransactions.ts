import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Transaction {
  id: string;
  amount: number;
  date: string;
  category: string;
  payment_mode: string;
  note?: string;
  type: 'income' | 'expense';
  created_at: string;
  updated_at?: string | null;
  user_id?: string;
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
      setTransactions((data || []).map(t => ({
        ...t,
        type: t.type as 'income' | 'expense'
      })));
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
      
      const typedData = { ...data, type: data.type as 'income' | 'expense' };
      // Optimistically update local state immediately with the returned data
      setTransactions(prev => {
        const updated = [typedData, ...prev];
        // Sort by date descending
        updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return updated;
      });
      // Also refetch in background for consistency
      fetchTransactions();
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
    updates: Partial<Pick<Transaction, 'amount' | 'date' | 'category' | 'payment_mode' | 'note'>>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired. Please sign in again.');

      // Get current transaction for audit trail
      const current = transactions.find(t => t.id === id);
      if (!current) throw new Error('Transaction not found');

      // Build audit entries
      const historyEntries: { transaction_id: string; user_id: string; field_name: string; old_value: string; new_value: string }[] = [];
      for (const [key, newVal] of Object.entries(updates)) {
        const oldVal = String((current as any)[key] ?? '');
        const newValStr = String(newVal ?? '');
        if (oldVal !== newValStr) {
          historyEntries.push({
            transaction_id: id,
            user_id: user.id,
            field_name: key,
            old_value: oldVal,
            new_value: newValStr,
          });
        }
      }

      if (historyEntries.length === 0) {
        return { success: true, data: current };
      }

      // Update transaction
      const { data, error } = await supabase
        .from('transactions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Log edit history
      if (historyEntries.length > 0) {
        await supabase.from('transaction_history').insert(historyEntries);
      }

      const typedData = { ...data, type: data.type as 'income' | 'expense' };
      await fetchTransactions();
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
      await fetchTransactions();
      return { success: true };
    } catch (error) {
      console.error('Error deleting transaction:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete transaction';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      return { success: false, error, message };
    }
  };

  // Realtime subscription + polling fallback for reliability
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval>;

    const channel = supabase
      .channel('transactions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          fetchTransactions();
        }
      )
      .subscribe((status) => {
        console.log('Realtime channel status:', status);
        // If realtime fails, fall back to polling every 3s
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (!pollTimer) {
            pollTimer = setInterval(fetchTransactions, 3000);
          }
        }
      });

    // Always poll as a safety net (every 5s), in case realtime silently drops events
    pollTimer = setInterval(fetchTransactions, 5000);

    return () => {
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchTransactions]);

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction, refetch: fetchTransactions };
}
