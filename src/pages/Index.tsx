import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { SummaryCard } from '@/components/SummaryCard';
import { SpendingPieChart } from '@/components/SpendingPieChart';
import { SavingsTrendCard } from '@/components/SavingsTrendCard';
import { AIInsightsCard } from '@/components/AIInsightsCard';
import { RecentTransactions } from '@/components/RecentTransactions';
import { AddTransactionDialog } from '@/components/AddTransactionDialog';
import { BottomNav } from '@/components/BottomNav';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudget } from '@/hooks/useBudget';

const Index = () => {
  const { transactions, loading, addTransaction } = useTransactions();
  const { budget, loading: budgetLoading } = useBudget();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastTransactionType, setLastTransactionType] = useState<'income' | 'expense'>('expense');

  const currentMonth = new Date().toLocaleDateString('en-IN', { 
    month: 'long', 
    year: 'numeric' 
  });

  // Get current month key for filtering (e.g., "2026-01")
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Filter transactions for current month only
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const txDate = new Date(t.date);
      const txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      return txMonthKey === currentMonthKey;
    });
  }, [transactions, currentMonthKey]);

  const { income, expenses, overallBudget, budgetUsedPercent, isOverBudget, overBudgetAmount } = useMemo(() => {
    const income = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const expenses = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const overallBudget = Number(budget.overallBudget) || 0;
    const budgetUsedPercent = overallBudget > 0 ? (expenses / overallBudget) * 100 : 0;
    const isOverBudget = budgetUsedPercent > 100;
    const overBudgetAmount = isOverBudget ? expenses - overallBudget : 0;
    
    return { income, expenses, overallBudget, budgetUsedPercent, isOverBudget, overBudgetAmount };
  }, [currentMonthTransactions, budget.overallBudget]);

  const handleAddTransaction = async (transaction: Parameters<typeof addTransaction>[0]) => {
    const result = await addTransaction(transaction);
    if (result.success) {
      setLastTransactionType(transaction.type);
    }
    return result;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      
      <main className="container py-6">
        {/* Welcome Section */}
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">
            Good afternoon! 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track UPI, cards, wallets & cash in one view—with AI tips to save more.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            title="This month's Income"
            amount={income}
            subtitle={currentMonth}
            type="income"
            trend="up"
            delay={0}
          />
          <SummaryCard
            title="This month's Expenses"
            amount={expenses}
            subtitle={currentMonth}
            type="expense"
            trend="down"
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

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            <SpendingPieChart transactions={currentMonthTransactions} />
            <RecentTransactions transactions={currentMonthTransactions} loading={loading} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <SavingsTrendCard transactions={currentMonthTransactions} />
            <AIInsightsCard transactions={currentMonthTransactions} />
          </div>
        </div>
      </main>

      <AddTransactionDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onAdd={handleAddTransaction}
        defaultType={lastTransactionType}
      />
      <BottomNav onAddClick={() => setDialogOpen(true)} />
    </div>
  );
};

export default Index;
