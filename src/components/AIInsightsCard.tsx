import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, AlertCircle, TrendingDown, Zap, Loader2, Info, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIInsights, type AIInsight } from '@/hooks/useAIInsights';
import type { Transaction } from '@/hooks/useTransactions';

interface AIInsightsCardProps {
  transactions: Transaction[];
}

export function AIInsightsCard({ transactions }: AIInsightsCardProps) {
  const { insights, loading, fetchInsights } = useAIInsights();

  useEffect(() => {
    fetchInsights(transactions);
  }, [transactions]);

  const getIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'warning':
        return AlertCircle;
      case 'suggestion':
        return Lightbulb;
      case 'tip':
        return Zap;
    }
  };

  const getStyles = (type: AIInsight['type']) => {
    switch (type) {
      case 'warning':
        return {
          bg: 'bg-warning/10',
          text: 'text-warning',
          border: 'border-warning/20',
        };
      case 'suggestion':
        return {
          bg: 'bg-primary/10',
          text: 'text-primary',
          border: 'border-primary/20',
        };
      case 'tip':
        return {
          bg: 'bg-income/10',
          text: 'text-income',
          border: 'border-income/20',
        };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card"
    >
      {/* Header with Beta Label */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-semibold text-card-foreground">
                AI Insights
              </h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                beta
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Weekly spending analysis</p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mb-4 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2">
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Suggestions may not be perfect—always review before acting.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Analyzing your spending...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.slice(0, 3).map((insight, index) => {
            const Icon = getIcon(insight.type);
            const styles = getStyles(insight.type);
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.1 }}
                className={cn(
                  'flex gap-3 rounded-xl border p-3',
                  styles.border,
                  styles.bg
                )}
              >
                <div className={cn('mt-0.5 shrink-0', styles.text)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-medium', styles.text)}>
                    {insight.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground whitespace-normal break-words">
                    {insight.description}
                  </p>
                  {insight.savings && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-income">
                      <TrendingDown className="h-3 w-3" />
                      Could save ₹{insight.savings.toLocaleString('en-IN')}/month
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Actionable CTA */}
      {!loading && insights.length > 0 && (
        <button className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg bg-primary/5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10">
          View tips for saving this week
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
}
