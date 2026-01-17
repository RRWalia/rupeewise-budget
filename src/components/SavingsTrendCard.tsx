import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';
import { savingsTrend, lastMonthSavings, lastMonthSavingsPercent, calculateTotals, mockTransactions, monthlyBudget } from '@/lib/mockData';
import { cn } from '@/lib/utils';

export function SavingsTrendCard() {
  const { income, expenses } = calculateTotals(mockTransactions);
  const currentSavings = income - expenses;
  const daysInMonth = 31;
  const currentDay = 17; // Mock current day
  const projectedExpenses = (expenses / currentDay) * daysInMonth;
  const projectedSavings = income - projectedExpenses;
  const savingsPercent = income > 0 ? (projectedSavings / income) * 100 : 0;
  const isOnTrack = savingsPercent >= 5;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const chartData = savingsTrend.map(item => ({
    ...item,
    value: item.savings || item.projected,
    isProjected: 'projected' in item,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
          <p className="text-xs text-muted-foreground">{data.month}</p>
          <p className="font-medium text-card-foreground">
            {formatCurrency(data.value)}
            {data.isProjected && <span className="text-xs text-muted-foreground"> (projected)</span>}
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
            <p className="text-sm text-muted-foreground">Last month you saved</p>
            <p className="font-display text-2xl font-bold text-card-foreground">
              {formatCurrency(lastMonthSavings)}
            </p>
            <p className="text-sm text-income">
              {lastMonthSavingsPercent}% of income
            </p>
          </div>

          <div className={cn(
            'rounded-xl p-4',
            isOnTrack ? 'bg-income/5' : 'bg-warning/5'
          )}>
            <p className="text-sm text-muted-foreground">Projected this month</p>
            <p className={cn(
              'font-display text-2xl font-bold',
              isOnTrack ? 'text-income' : 'text-warning'
            )}>
              ≈{formatCurrency(Math.max(0, projectedSavings))}
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

          <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary/5 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {isOnTrack ? (
                <>At your current pace, you're <span className="font-medium text-income">on track</span> to save ≈{formatCurrency(projectedSavings)} this month!</>
              ) : (
                <>At your current pace, you may save only ≈{formatCurrency(Math.max(0, projectedSavings))}. <span className="font-medium text-warning">Reduce shopping and entertainment</span> to stay above 5% savings.</>
              )}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
