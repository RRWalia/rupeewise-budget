import { motion } from 'framer-motion';
import { Lightbulb, AlertCircle, TrendingDown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Insight {
  id: string;
  type: 'tip' | 'warning' | 'suggestion';
  title: string;
  description: string;
  savings?: number;
}

const mockInsights: Insight[] = [
  {
    id: '1',
    type: 'warning',
    title: 'Entertainment spending high',
    description: 'You\'ve spent ₹3,000 on entertainment. This is 80% of your monthly limit.',
  },
  {
    id: '2',
    type: 'suggestion',
    title: 'Reduce food delivery',
    description: 'Limiting food delivery to ₹2,000 could increase savings by ≈₹800 this month.',
    savings: 800,
  },
  {
    id: '3',
    type: 'tip',
    title: 'Great job on groceries!',
    description: 'You\'re spending 15% less on groceries compared to last month.',
  },
];

export function AIInsightsCard() {
  const getIcon = (type: Insight['type']) => {
    switch (type) {
      case 'warning':
        return AlertCircle;
      case 'suggestion':
        return Lightbulb;
      case 'tip':
        return Zap;
    }
  };

  const getStyles = (type: Insight['type']) => {
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
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Lightbulb className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-card-foreground">
            AI Insights
          </h3>
          <p className="text-xs text-muted-foreground">Weekly summary</p>
        </div>
      </div>

      <div className="space-y-3">
        {mockInsights.map((insight, index) => {
          const Icon = getIcon(insight.type);
          const styles = getStyles(insight.type);
          
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
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
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {insight.description}
                </p>
                {insight.savings && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-income">
                    <TrendingDown className="h-3 w-3" />
                    Save ₹{insight.savings}/month
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
