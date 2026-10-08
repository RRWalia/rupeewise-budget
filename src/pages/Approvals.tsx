import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Check, Clock3, Inbox, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CategoryDropdown } from '@/components/CategoryDropdown';
import { useSharedTransactions } from '@/contexts/TransactionsContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type Category } from '@/lib/mockData';
import type { Tables } from '@/integrations/supabase/types';

type PendingTransaction = Tables<'pending_transactions'>;
type TransactionType = 'income' | 'expense';
type PaymentMode = 'UPI' | 'Card' | 'Cash' | 'Other';

interface ApprovalValues {
  amount: number;
  type: TransactionType;
  category: Category;
  date: string;
  paymentMode: PaymentMode;
  note: string;
}

const paymentModes: PaymentMode[] = ['UPI', 'Card', 'Cash', 'Other'];

function dateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function safeCategory(type: TransactionType, category: string): Category {
  const available = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  return available.includes(category as Category)
    ? category as Category
    : type === 'expense' ? 'Personal' : 'Other';
}

const Approvals = () => {
  const [pending, setPending] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { refetch: refetchTransactions } = useSharedTransactions();
  const { toast } = useToast();

  const loadPending = useCallback(async () => {
    const { data, error } = await supabase
      .from('pending_transactions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError(error.message);
      toast({ title: 'Could not load approvals', description: error.message, variant: 'destructive' });
    } else {
      setLoadError(null);
      setPending(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadPending();
    const onFocus = () => loadPending();
    window.addEventListener('focus', onFocus);

    // Realtime: new forwarded SMS appears instantly, no refresh needed.
    // A slow polling fallback only kicks in if the socket drops.
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const startPolling = () => {
      if (!pollTimer) pollTimer = setInterval(loadPending, 30_000);
    };

    const subscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      channel = supabase
        .channel(`approvals-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pending_transactions', filter: `user_id=eq.${user.id}` },
          () => { void loadPending(); },
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            startPolling();
          }
        });
    };
    void subscribe();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadPending]);

  const approve = async (candidate: PendingTransaction, values: ApprovalValues) => {
    setBusyId(candidate.id);
    const { error } = await supabase.rpc('approve_pending_transaction', {
      p_pending_id: candidate.id,
      p_amount: values.amount,
      p_type: values.type,
      p_category: values.category,
      p_date: values.date,
      p_payment_mode: values.paymentMode,
      p_note: values.note,
    });

    if (error) {
      toast({ title: 'Could not approve transaction', description: error.message, variant: 'destructive' });
      setBusyId(null);
      return;
    }

    setPending((current) => current.filter((item) => item.id !== candidate.id));
    toast({
      title: 'Transaction added',
      description: `${values.type === 'income' ? 'Income' : 'Expense'} · ₹${values.amount.toLocaleString('en-IN')} · ${values.category}`,
    });
    await refetchTransactions();
    setBusyId(null);
  };

  const dismiss = async (candidate: PendingTransaction) => {
    setBusyId(candidate.id);
    const { error } = await supabase.rpc('dismiss_pending_transaction', { p_pending_id: candidate.id });

    if (error) {
      toast({ title: 'Could not dismiss suggestion', description: error.message, variant: 'destructive' });
      setBusyId(null);
      return;
    }

    setPending((current) => current.filter((item) => item.id !== candidate.id));
    toast({ title: 'Suggestion dismissed', description: 'No transaction was added.' });
    setBusyId(null);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Your confirmation required</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Approvals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bank SMS suggestions stay out of your transactions until you review and approve them.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border bg-card py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading suggestions…
          </div>
        ) : loadError ? (
          <Card>
            <CardContent className="flex flex-col items-center px-6 py-10 text-center">
              <p className="text-sm text-destructive">Approvals could not be loaded. Check your connection or database migration.</p>
              <Button variant="outline" className="mt-4" onClick={() => { setLoading(true); void loadPending(); }}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : pending.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center px-6 py-14 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Inbox className="h-6 w-6" />
              </div>
              <h2 className="font-display text-lg font-semibold">You're all caught up</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Forwarded bank debits and credits will appear here with a suggested category. Nothing is added unless you approve it.
              </p>
              <Button asChild variant="outline" className="mt-5">
                <Link to="/settings">Set up SMS forwarding</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {pending.length} {pending.length === 1 ? 'suggestion is' : 'suggestions are'} waiting for review
            </div>
            {pending.map((candidate) => (
              <PendingApprovalCard
                key={candidate.id}
                candidate={candidate}
                busy={busyId === candidate.id}
                onApprove={(values) => approve(candidate, values)}
                onDismiss={() => dismiss(candidate)}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

function PendingApprovalCard({
  candidate,
  busy,
  onApprove,
  onDismiss,
}: {
  candidate: PendingTransaction;
  busy: boolean;
  onApprove: (values: ApprovalValues) => Promise<void>;
  onDismiss: () => Promise<void>;
}) {
  const initialType: TransactionType = candidate.type === 'income' ? 'income' : 'expense';
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState(String(candidate.amount));
  const [date, setDate] = useState(candidate.date);
  const [category, setCategory] = useState<Category>(() => safeCategory(initialType, candidate.category));
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(
    paymentModes.includes(candidate.payment_mode as PaymentMode) ? candidate.payment_mode as PaymentMode : 'Other',
  );
  const [note, setNote] = useState(candidate.note ?? 'Bank transaction');
  const [validationError, setValidationError] = useState('');
  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const amountValue = Number(amount);

  const changeType = (nextType: TransactionType) => {
    setType(nextType);
    setCategory((current) => safeCategory(nextType, current));
  };

  const handleApprove = () => {
    if (!Number.isFinite(amountValue) || amountValue <= 0 || amountValue > 100_000_000) {
      setValidationError('Enter an amount greater than zero and no more than ₹10 crore.');
      return;
    }
    if (!date) {
      setValidationError('Choose the transaction date.');
      return;
    }
    if (!categories.includes(category)) {
      setValidationError('Choose a category that matches the transaction type.');
      return;
    }

    setValidationError('');
    void onApprove({ amount: amountValue, type, category, date, paymentMode, note: note.trim() });
  };

  const DirectionIcon = type === 'income' ? ArrowDownLeft : ArrowUpRight;
  const categoryOptions = categories as readonly Category[];
  const labelId = `pending-${candidate.id}`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <DirectionIcon className="h-3 w-3" />
                {type === 'income' ? 'Income' : 'Expense'}
              </Badge>
              {candidate.category_guessed && <Badge variant="secondary">AI best guess</Badge>}
            </div>
            <CardTitle className="text-lg">{note || 'Bank transaction'}</CardTitle>
            <CardDescription>
              SMS from {candidate.source_sender || 'bank sender'} · transaction date {dateLabel(candidate.date)}
            </CardDescription>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-display text-2xl font-bold tabular-nums text-foreground">
              ₹{Number(candidate.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">not added yet</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${labelId}-type`}>Transaction type</Label>
            <select
              id={`${labelId}-type`}
              value={type}
              onChange={(event) => changeType(event.target.value as TransactionType)}
              disabled={busy}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${labelId}-amount`}>Amount (₹)</Label>
            <Input
              id={`${labelId}-amount`}
              type="number"
              min="0.01"
              max="100000000"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${labelId}-date`}>Transaction date</Label>
            <Input
              id={`${labelId}-date`}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${labelId}-payment-mode`}>Payment mode</Label>
            <select
              id={`${labelId}-payment-mode`}
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}
              disabled={busy}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {paymentModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <CategoryDropdown categories={categoryOptions} value={category} onChange={setCategory} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${labelId}-note`}>Description</Label>
            <Input
              id={`${labelId}-note`}
              maxLength={100}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={busy}
              placeholder="Merchant or transaction note"
            />
          </div>
        </div>

        {validationError && <p role="alert" className="text-sm text-destructive">{validationError}</p>}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => void onDismiss()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Dismiss
          </Button>
          <Button type="button" onClick={handleApprove} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Approve & add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default Approvals;
