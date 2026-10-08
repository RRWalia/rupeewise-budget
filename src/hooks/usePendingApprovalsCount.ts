import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Live count of bank-SMS suggestions waiting for review. Subscribes to
 * realtime changes on pending_transactions so the badge updates the moment
 * a forwarder delivers a new SMS.
 */
export function usePendingApprovalsCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCount(0);
      return;
    }
    const { count: pendingCount, error } = await supabase
      .from('pending_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (!error) setCount(pendingCount ?? 0);
  }, []);

  useEffect(() => {
    refresh();

    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    const subscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      channel = supabase
        .channel(`pending-count-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pending_transactions', filter: `user_id=eq.${user.id}` },
          () => { void refresh(); },
        )
        .subscribe();
    };
    void subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  return count;
}
