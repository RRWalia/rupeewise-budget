import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { mockTransactions, CATEGORY_ICONS, CATEGORY_COLORS, type Transaction } from '@/lib/mockData';
import { cn } from '@/lib/utils';

export function RecentTransactions() {
  const recentTransactions = [...mockTransactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

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

      <div className="space-y-3">
        {recentTransactions.map((transaction, index) => (
          <motion.div
            key={transaction.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + index * 0.05 }}
            className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-secondary/50"
          >
            <div 
              className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
              style={{ backgroundColor: `${CATEGORY_COLORS[transaction.category]}20` }}
            >
              {CATEGORY_ICONS[transaction.category]}
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-card-foreground">
                {transaction.note || transaction.category}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(transaction.date)} • {transaction.paymentMode}
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
                {formatCurrency(transaction.amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {transaction.category}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
