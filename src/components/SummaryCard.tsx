import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  title: string;
  amount: number;
  subtitle?: string;
  type: 'income' | 'expense' | 'budget';
  budgetUsed?: number; // percentage for budget card
  isOverBudget?: boolean;
  overBudgetAmount?: number;
  loading?: boolean;
  trend?: 'up' | 'down';
  delay?: number;
}

export function SummaryCard({ 
  title, 
  amount, 
  subtitle = 'This month', 
  type, 
  budgetUsed,
  isOverBudget,
  overBudgetAmount,
  loading,
  trend,
  delay = 0 
}: SummaryCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getIcon = () => {
    switch (type) {
      case 'income':
        return <TrendingUp className="h-5 w-5" />;
      case 'expense':
        return <TrendingDown className="h-5 w-5" />;
      case 'budget':
        return <Wallet className="h-5 w-5" />;
    }
  };

  const getIconBgClass = () => {
    switch (type) {
      case 'income':
        return 'bg-income/10 text-income';
      case 'expense':
        return 'bg-expense/10 text-expense';
      case 'budget':
        return isOverBudget ? 'bg-expense/10 text-expense' : 'bg-primary/10 text-primary';
    }
  };

  // Clamp progress bar to 100% max for visual display
  const clampedBudgetUsed = budgetUsed !== undefined ? Math.min(budgetUsed, 100) : 0;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4, ease: 'easeOut' }}
        className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-7 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-card transition-all duration-300 hover:shadow-lg",
        isOverBudget ? "border-expense/50" : "border-border"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={cn(
            "text-sm font-medium",
            isOverBudget ? "text-expense" : "text-muted-foreground"
          )}>
            {title}
          </p>
          <p className="font-display text-2xl font-bold tracking-tight text-card-foreground">
            {formatCurrency(amount)}
          </p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className={cn('rounded-xl p-2.5', getIconBgClass())}>
          {getIcon()}
        </div>
      </div>

      {type === 'budget' && budgetUsed !== undefined && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {isOverBudget ? 'Over by' : 'Used'}
            </span>
            <span className={cn(
              'font-medium',
              isOverBudget || budgetUsed > 90 ? 'text-expense' : budgetUsed > 70 ? 'text-warning' : 'text-income'
            )}>
              {isOverBudget && overBudgetAmount ? formatCurrency(overBudgetAmount) : `${budgetUsed.toFixed(0)}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${clampedBudgetUsed}%` }}
              transition={{ delay: delay + 0.3, duration: 0.6, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full transition-colors',
                isOverBudget || budgetUsed > 90 ? 'bg-expense' : budgetUsed > 70 ? 'bg-warning' : 'bg-primary'
              )}
            />
          </div>
        </div>
      )}

      {trend && type !== 'budget' && (
        <div className="mt-3 flex items-center gap-1">
          {trend === 'up' ? (
            <TrendingUp className="h-3.5 w-3.5 text-income" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-expense" />
          )}
          <span className={cn(
            'text-xs font-medium',
            trend === 'up' ? 'text-income' : 'text-expense'
          )}>
            {trend === 'up' ? '+12%' : '-8%'} vs last month
          </span>
        </div>
      )}
    </motion.div>
  );
}
