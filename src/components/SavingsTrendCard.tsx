import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { TrendingUp, AlertTriangle, Sparkles, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/hooks/useTransactions';
import { getDaysInMonth } from '@/lib/date';
import { buildMonthlySavingsTrend, calculateTotals, filterTransactionsByMonth } from '@/lib/finance';

interface SavingsTrendCardProps {
  transactions: Transaction[];
  monthKey: string;
}

interface SavingsTooltipPayload {
  payload: {
    month: string;
    value: number;
  };
}

interface SavingsTooltipProps {
  active?: boolean;
  payload?: SavingsTooltipPayload[];
}

export function SavingsTrendCard({ transactions, monthKey }: SavingsTrendCardProps) {
  const { income, expenses, projectedSavings, savingsPercent, isOnTrack, currentSavings, chartData } = useMemo(() => {
    const monthlyTransactions = filterTransactionsByMonth(transactions, monthKey);
    const totals = calculateTotals(monthlyTransactions);

    const daysInMonth = getDaysInMonth(monthKey);
    const today = new Date();
    const isCurrentMonth = monthKey === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const elapsedDays = isCurrentMonth ? Math.max(1, Math.min(today.getDate(), daysInMonth)) : daysInMonth;
    const projectedExpenses = elapsedDays > 0 ? (totals.expenses / elapsedDays) * daysInMonth : totals.expenses;
    const projectedSavings = totals.income - projectedExpenses;
    const savingsPercent = totals.income > 0 ? (projectedSavings / totals.income) * 100 : 0;
    const isOnTrack = savingsPercent >= 5;

    return {
      income: totals.income,
      expenses: totals.expenses,
      currentSavings: totals.savings,
      projectedSavings,
      savingsPercent,
      isOnTrack,
      chartData: buildMonthlySavingsTrend(transactions, monthKey),
    };
  }, [transactions, monthKey]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: SavingsTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
          <p className="text-xs text-muted-foreground">{data.month}</p>
          <p className="font-medium text-card-foreground">
            {formatCurrency(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
      className="overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-card-foreground">
          Savings & Future Trend
        </h3>
        <div className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
          isOnTrack 
            ? 'bg-income/10 text-income' 
            : 'bg-warning/10 text-warning'
        )}>
          {isOnTrack ? (
            <>
              <TrendingUp className="h-3.5 w-3.5" />
              On Track
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5" />
              Needs Attention
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl bg-secondary/50 p-4">
            <p className="text-sm text-muted-foreground">Current savings</p>
            <p className="font-display text-2xl font-bold text-card-foreground">
              {formatCurrency(currentSavings)}
            </p>
            <p className={cn(
              'text-sm',
              currentSavings >= 0 ? 'text-income' : 'text-expense'
            )}>
              {income > 0 ? ((currentSavings / income) * 100).toFixed(1) : 0}% of income
            </p>
          </div>

          <div className={cn(
            'rounded-xl p-4',
            isOnTrack ? 'bg-income/5' : 'bg-warning/5'
          )}>
            <p className="text-sm text-muted-foreground">Projected this month</p>
            <p className={cn(
              'font-display text-2xl font-bold',
              projectedSavings >= 0 ? (isOnTrack ? 'text-income' : 'text-warning') : 'text-expense'
            )}>
              ≈{formatCurrency(projectedSavings)}
            </p>
            <p className={cn(
              'text-sm',
              isOnTrack ? 'text-income' : 'text-warning'
            )}>
              {savingsPercent.toFixed(1)}% of income
            </p>
          </div>
        </div>

        <div className="flex flex-col">
          {chartData.some(point => point.value !== 0) ? (
            <div className="h-[120px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
              Add transactions to see trends
            </div>
          )}

          {/* Projection Disclaimer */}
          <div className="mt-2 flex items-start gap-1.5 rounded bg-muted/30 px-2 py-1.5">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Projection based on month-to-date spending pace.
            </p>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {transactions.length === 0 ? (
                <>Start adding transactions to track your savings and get personalized insights!</>
              ) : isOnTrack ? (
                <>At your current pace, you're <span className="font-medium text-income">on track</span> to save ≈{formatCurrency(projectedSavings)} this month.</>
              ) : projectedSavings < 0 ? (
                <>At your current pace, expenses may exceed income by ≈{formatCurrency(Math.abs(projectedSavings))}. Review discretionary spending early.</>
              ) : (
                <>At your current pace, you may save ≈{formatCurrency(projectedSavings)}. <span className="font-medium text-warning">Reduce high-spend categories</span> to stay above 5% savings.</>
              )}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
