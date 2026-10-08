import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { SummaryCard } from '@/components/SummaryCard';
import { AIInsightsCard } from '@/components/AIInsightsCard';
import { RecentTransactions } from '@/components/RecentTransactions';
import { EditTransactionDialog } from '@/components/EditTransactionDialog';
import { useSharedTransactions } from '@/contexts/TransactionsContext';
import { useBudget } from '@/hooks/useBudget';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Transaction } from '@/hooks/useTransactions';
import { formatMonthLabel, getCurrentMonthKey, getRelativeMonthKey } from '@/lib/date';
import { calculateTotals, calculateTrend, filterTransactionsByMonth } from '@/lib/finance';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

// Charts are the heaviest part of the bundle (recharts) — load them on demand.
const SpendingPieChart = lazy(() =>
  import('@/components/SpendingPieChart').then((m) => ({ default: m.SpendingPieChart }))
);
const SavingsTrendCard = lazy(() =>
  import('@/components/SavingsTrendCard').then((m) => ({ default: m.SavingsTrendCard }))
);

const ChartLoader = () => (
  <Card>
    <CardContent className="flex h-64 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </CardContent>
  </Card>
);

const Index = () => {
  const { transactions, loading, updateTransaction, deleteTransaction } = useSharedTransactions();
  const { budget, loading: budgetLoading } = useBudget();
  const isMobile = useIsMobile();

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);
  const previousMonthKey = useMemo(() => getRelativeMonthKey(currentMonthKey, -1), [currentMonthKey]);
  const currentMonth = useMemo(() => formatMonthLabel(currentMonthKey), [currentMonthKey]);

  const currentMonthTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, currentMonthKey),
    [transactions, currentMonthKey]
  );

  const previousMonthTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, previousMonthKey),
    [transactions, previousMonthKey]
  );

  const currentTotals = useMemo(
    () => calculateTotals(currentMonthTransactions),
    [currentMonthTransactions]
  );

  const previousTotals = useMemo(
    () => calculateTotals(previousMonthTransactions),
    [previousMonthTransactions]
  );

  const incomeTrend = useMemo(
    () => calculateTrend(currentTotals.income, previousTotals.income),
    [currentTotals.income, previousTotals.income]
  );

  const expenseTrend = useMemo(
    () => calculateTrend(currentTotals.expenses, previousTotals.expenses),
    [currentTotals.expenses, previousTotals.expenses]
  );

  const { overallBudget, budgetUsedPercent, isOverBudget, overBudgetAmount } = useMemo(() => {
    const overallBudget = Number(budget.overallBudget) || 0;
    const budgetUsedPercent = overallBudget > 0 ? (currentTotals.expenses / overallBudget) * 100 : 0;
    const isOverBudget = budgetUsedPercent > 100;
    const overBudgetAmount = isOverBudget ? currentTotals.expenses - overallBudget : 0;

    return { overallBudget, budgetUsedPercent, isOverBudget, overBudgetAmount };
  }, [budget.overallBudget, currentTotals.expenses]);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 0 && hour < 12) setGreeting('Good morning');
      else if (hour >= 12 && hour < 17) setGreeting('Good afternoon');
      else if (hour >= 17 && hour < 21) setGreeting('Good evening');
      else setGreeting('Good night');
    };
    updateGreeting();
    const interval = setInterval(updateGreeting, 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-background">
      {/* Show header only on mobile */}
      {isMobile && <Header />}
      
      <div className="container py-6">
        {/* Welcome Section */}
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">
            {greeting}! 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track UPI, cards, wallets & cash in one view—with AI tips to save more.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            title="This month's Income"
            amount={currentTotals.income}
            subtitle={currentMonth}
            type="income"
            trend={incomeTrend?.direction}
            trendLabel={incomeTrend?.label}
            delay={0}
          />
          <SummaryCard
            title="This month's Expenses"
            amount={currentTotals.expenses}
            subtitle={currentMonth}
            type="expense"
            trend={expenseTrend?.direction}
            trendLabel={expenseTrend?.label}
            delay={0.1}
          />
          <SummaryCard
            title={isOverBudget ? "Over budget!" : "Budget used this month"}
            amount={overallBudget}
            subtitle={currentMonth}
            type="budget"
            budgetUsed={budgetUsedPercent}
            isOverBudget={isOverBudget}
            overBudgetAmount={overBudgetAmount}
            loading={budgetLoading}
            delay={0.2}
          />
        </div>

        {/* First-run empty state: guide brand-new users instead of showing empty charts */}
        {!loading && transactions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center px-6 py-14 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground">Start with your first transaction</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Tap the <span className="font-medium text-foreground">+</span> button to log an income or expense.
                Your charts, savings trend and AI tips will appear here as soon as you do.
              </p>
            </CardContent>
          </Card>
        ) : (
          /* Main Content Grid */
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column */}
            <div className="space-y-6">
              <Suspense fallback={<ChartLoader />}>
                <SpendingPieChart transactions={currentMonthTransactions} />
              </Suspense>
              <RecentTransactions
                transactions={currentMonthTransactions}
                loading={loading}
                onTransactionClick={(t) => setEditingTransaction(t)}
              />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <Suspense fallback={<ChartLoader />}>
                <SavingsTrendCard transactions={transactions} monthKey={currentMonthKey} />
              </Suspense>
              <AIInsightsCard transactions={currentMonthTransactions} monthKey={currentMonthKey} />
            </div>
          </div>
        )}
      </div>

      {editingTransaction && (
        <EditTransactionDialog
          open={!!editingTransaction}
          onOpenChange={(open) => { if (!open) setEditingTransaction(null); }}
          transaction={editingTransaction}
          onUpdate={updateTransaction}
          onDelete={deleteTransaction}
        />
      )}
    </div>
  );
};

export default Index;
