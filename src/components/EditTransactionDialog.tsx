import { useState } from 'react';
import { IndianRupee, Calendar, MessageSquare, AlertCircle, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type Category } from '@/lib/mockData';
import { CategoryDropdown } from '@/components/CategoryDropdown';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Transaction } from '@/hooks/useTransactions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EditTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  onUpdate: (id: string, updates: Partial<Pick<Transaction, 'amount' | 'date' | 'category' | 'payment_mode' | 'note'>>) => Promise<{ success: boolean; message?: string }>;
  onDelete: (id: string) => Promise<{ success: boolean; message?: string }>;
}

interface FormErrors {
  amount?: string;
  category?: string;
}

export function EditTransactionDialog({ open, onOpenChange, transaction, onUpdate, onDelete }: EditTransactionDialogProps) {
  const [amount, setAmount] = useState(String(transaction.amount));
  const [category, setCategory] = useState<Category | undefined>(transaction.category as Category);
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'Card' | 'Cash'>(transaction.payment_mode as 'UPI' | 'Card' | 'Cash');
  const [note, setNote] = useState(transaction.note || '');
  const [date, setDate] = useState(transaction.date);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const { toast } = useToast();

  const categories = transaction.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleAmountChange = (val: string) => {
    setAmount(val);
    if (errors.amount) setErrors(prev => ({ ...prev, amount: undefined }));
  };

  const handleCategoryChange = (val: Category) => {
    setCategory(val);
    if (errors.category) setErrors(prev => ({ ...prev, category: undefined }));
  };

  const setDateToYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setDate(yesterday.toISOString().split('T')[0]);
  };

  const setDateToToday = () => {
    setDate(new Date().toISOString().split('T')[0]);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }
    if (!category) {
      newErrors.category = 'Please select a category';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const result = await onUpdate(transaction.id, {
      amount: parseFloat(amount),
      date,
      category: category!,
      payment_mode: paymentMode,
      note: note || undefined,
    });
    setLoading(false);

    if (result.success) {
      toast({ title: 'Transaction updated', description: 'Your changes have been saved.' });
      onOpenChange(false);
    } else {
      toast({ title: 'Could not update', description: result.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    const result = await onDelete(transaction.id);
    setDeleteLoading(false);
    setShowDeleteConfirm(false);

    if (result.success) {
      toast({ title: 'Transaction deleted', description: 'The transaction has been removed.' });
      onOpenChange(false);
    } else {
      toast({ title: 'Could not delete', description: result.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const lastEdited = transaction.updated_at
    ? new Date(transaction.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Transaction</DialogTitle>
            {lastEdited && (
              <p className="text-xs text-muted-foreground">Last edited on {lastEdited}</p>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type display (read-only) */}
            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <div className={cn(
                'flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-medium',
                transaction.type === 'expense'
                  ? 'border-expense bg-expense/10 text-expense'
                  : 'border-income bg-income/10 text-income'
              )}>
                {transaction.type === 'expense' ? 'Expense' : 'Income'}
                <span className="text-xs opacity-60">(cannot change)</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="edit-amount"
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className={cn('pl-10 text-lg font-semibold', errors.amount && 'border-destructive')}
                />
              </div>
              {errors.amount && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />{errors.amount}
                </p>
              )}
            </div>

            <CategoryDropdown
              categories={categories}
              value={category}
              onChange={handleCategoryChange}
              error={errors.category}
            />

            <div className="space-y-2">
              <Label htmlFor="edit-date">Transaction Date</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-10" />
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={setDateToToday} className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    date === new Date().toISOString().split('T')[0]
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  )}>Today</button>
                  <button type="button" onClick={setDateToYesterday} className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    date === (() => { const y = new Date(); y.setDate(y.getDate() - 1); return y.toISOString().split('T')[0]; })()
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  )}>Yesterday</button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <div className="flex gap-2">
                {(['UPI', 'Card', 'Cash'] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setPaymentMode(mode)} className={cn(
                    'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                    paymentMode === mode
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  )}>{mode}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-note">Note (optional)</Label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="edit-note" placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} className="pl-10" />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button
                type="submit"
                className={cn(
                  'flex-1',
                  transaction.type === 'expense' ? 'bg-expense hover:bg-expense/90' : 'bg-income hover:bg-income/90'
                )}
                size="lg"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this {transaction.type} of ₹{transaction.amount}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
