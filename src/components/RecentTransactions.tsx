import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Pencil } from 'lucide-react';
import { CATEGORY_ICONS, CATEGORY_COLORS, type Category } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/hooks/useTransactions';

interface RecentTransactionsProps {
  transactions: Transaction[];
  loading?: boolean;
  onTransactionClick?: (transaction: Transaction) => void;
}

export function RecentTransactions({ transactions, loading, onTransactionClick }: RecentTransactionsProps) {
  const [expanded, setExpanded] = useState(false);
  const recentTransactions = expanded ? transactions : transactions.slice(0, 8);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card"
      >
        <h3 className="mb-4 font-display text-lg font-semibold text-card-foreground">
          Recent Transactions
        </h3>
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          Loading...
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.4 }}
      className="overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-card-foreground">
          Recent Transactions
        </h3>
        <button className="text-sm font-medium text-primary hover:underline">
          View all
        </button>
      </div>

      {recentTransactions.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
          <p className="text-sm">Start tracking to see your spending patterns.</p>
          <p className="text-xs">Tap the <span className="font-semibold text-primary">+</span> button below to add your first transaction.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recentTransactions.map((transaction, index) => (
            <motion.div
              key={transaction.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + index * 0.05 }}
              className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-secondary/50 cursor-pointer group"
              onClick={() => onTransactionClick?.(transaction)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') onTransactionClick?.(transaction); }}
            >
              <div 
                className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                style={{ backgroundColor: `${CATEGORY_COLORS[transaction.category as Category] || 'hsl(220, 15%, 55%)'}20` }}
              >
                {CATEGORY_ICONS[transaction.category as Category] || '📦'}
              </div>
              
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-card-foreground">
                  {transaction.note || transaction.category}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(transaction.date)} • {transaction.payment_mode}
                </p>
              </div>

              <div className="text-right">
                <p className={cn(
                  'flex items-center gap-1 text-sm font-semibold',
                  transaction.type === 'income' ? 'text-income' : 'text-expense'
                )}>
                  {transaction.type === 'income' ? (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  )}
                  {formatCurrency(Number(transaction.amount))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {transaction.category}
                </p>
              </div>

              <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
