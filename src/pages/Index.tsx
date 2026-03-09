import { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/Header';
import { SummaryCard } from '@/components/SummaryCard';
import { SpendingPieChart } from '@/components/SpendingPieChart';
import { SavingsTrendCard } from '@/components/SavingsTrendCard';
import { AIInsightsCard } from '@/components/AIInsightsCard';
import { RecentTransactions } from '@/components/RecentTransactions';
import { EditTransactionDialog } from '@/components/EditTransactionDialog';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudget } from '@/hooks/useBudget';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Transaction } from '@/hooks/useTransactions';

const Index = () => {
  const { transactions, loading, updateTransaction, deleteTransaction } = useTransactions();
  const { budget, loading: budgetLoading } = useBudget();
  const isMobile = useIsMobile();

  const currentMonth = new Date().toLocaleDateString('en-IN', { 
    month: 'long', 
    year: 'numeric' 
  });

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

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
            amount={income}
            subtitle={currentMonth}
            type="income"
            trend={income > 0 ? "up" : undefined}
            delay={0}
          />
          <SummaryCard
            title="This month's Expenses"
            amount={expenses}
            subtitle={currentMonth}
            type="expense"
            trend={expenses > 0 ? "down" : undefined}
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
            <RecentTransactions
              transactions={currentMonthTransactions}
              loading={loading}
              onTransactionClick={(t) => setEditingTransaction(t)}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <SavingsTrendCard transactions={currentMonthTransactions} />
            <AIInsightsCard transactions={currentMonthTransactions} />
          </div>
        </div>
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
  );
};

export default Index;
