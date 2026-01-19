import { useState, useEffect } from 'react';
import { IndianRupee, Calendar, MessageSquare, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_ICONS, type Category } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (transaction: {
    amount: number;
    date: string;
    category: string;
    payment_mode: string;
    note?: string;
    type: 'income' | 'expense';
  }) => Promise<{ success: boolean }>;
  defaultType?: 'income' | 'expense';
}

export function AddTransactionDialog({ open, onOpenChange, onAdd, defaultType = 'expense' }: AddTransactionDialogProps) {
  const [type, setType] = useState<'expense' | 'income'>(defaultType);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'Card' | 'Cash'>('UPI');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  // Update type when defaultType changes
  useEffect(() => {
    setType(defaultType);
  }, [defaultType]);

  // Reset category when type changes
  useEffect(() => {
    setCategory('');
  }, [type]);

  const setDateToYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setDate(yesterday.toISOString().split('T')[0]);
  };

  const setDateToToday = () => {
    setDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !category) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in amount and category',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    const result = await onAdd({
      amount: parseFloat(amount),
      date,
      category,
      payment_mode: paymentMode,
      note: note || undefined,
      type,
    });

    setLoading(false);

    if (result.success) {
      toast({
        title: 'Transaction added',
        description: `${type === 'expense' ? 'Expense' : 'Income'} of ₹${amount} recorded`,
      });
      // Reset form
      setAmount('');
      setCategory('');
      setNote('');
      setDate(new Date().toISOString().split('T')[0]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add Transaction</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Type Toggle - Large, Clear Buttons */}
          <div className="space-y-2">
            <Label>Transaction Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border-2 py-3.5 font-medium transition-all',
                  type === 'expense'
                    ? 'border-expense bg-expense/10 text-expense'
                    : 'border-border text-muted-foreground hover:border-expense/50 hover:bg-expense/5'
                )}
              >
                <ArrowUpCircle className="h-5 w-5" />
                Add Expense
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border-2 py-3.5 font-medium transition-all',
                  type === 'income'
                    ? 'border-income bg-income/10 text-income'
                    : 'border-border text-muted-foreground hover:border-income/50 hover:bg-income/5'
                )}
              >
                <ArrowDownCircle className="h-5 w-5" />
                Add Income
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10 text-lg font-semibold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    <span className="flex items-center gap-2">
                      <span>{CATEGORY_ICONS[cat]}</span>
                      {cat}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Transaction Date</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={setDateToToday}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    date === new Date().toISOString().split('T')[0]
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  )}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={setDateToYesterday}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    date === (() => {
                      const y = new Date();
                      y.setDate(y.getDate() - 1);
                      return y.toISOString().split('T')[0];
                    })()
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  )}
                >
                  Yesterday
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <div className="flex gap-2">
              {(['UPI', 'Card', 'Cash'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                    paymentMode === mode
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-secondary'
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="note"
                placeholder="Add a note..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className={cn(
              'w-full',
              type === 'expense' ? 'bg-expense hover:bg-expense/90' : 'bg-income hover:bg-income/90'
            )} 
            size="lg" 
            disabled={loading}
          >
            {loading ? 'Adding...' : `Add ${type === 'expense' ? 'Expense' : 'Income'}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
