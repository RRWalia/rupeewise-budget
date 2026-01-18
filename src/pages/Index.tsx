import { useState } from 'react';
import { Header } from '@/components/Header';
import { SummaryCard } from '@/components/SummaryCard';
import { SpendingPieChart } from '@/components/SpendingPieChart';
import { SavingsTrendCard } from '@/components/SavingsTrendCard';
import { AIInsightsCard } from '@/components/AIInsightsCard';
import { RecentTransactions } from '@/components/RecentTransactions';
import { AddTransactionDialog } from '@/components/AddTransactionDialog';
import { BottomNav } from '@/components/BottomNav';
import { useTransactions } from '@/hooks/useTransactions';
import { useMemo } from 'react';

const Index = () => {
  const { transactions, loading, addTransaction } = useTransactions();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { income, expenses, monthlyBudget, budgetUsedPercent } = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const monthlyBudget = 60000; // Default budget
    const budgetUsedPercent = monthlyBudget > 0 ? (expenses / monthlyBudget) * 100 : 0;
    
    return { income, expenses, monthlyBudget, budgetUsedPercent };
  }, [transactions]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      
      <main className="container py-6">
        {/* Welcome Section */}
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">
            Good afternoon! 👋
          </h2>
          <p className="text-muted-foreground">
            Here's your financial overview for January 2025
          </p>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            title="Income"
            amount={income}
            type="income"
            trend="up"
            delay={0}
          />
          <SummaryCard
            title="Expenses"
            amount={expenses}
            type="expense"
            trend="down"
            delay={0.1}
          />
          <SummaryCard
            title="Budget for the month"
            amount={monthlyBudget}
            type="budget"
            budgetUsed={budgetUsedPercent}
            delay={0.2}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            <SpendingPieChart transactions={transactions} />
            <RecentTransactions transactions={transactions} loading={loading} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <SavingsTrendCard transactions={transactions} />
            <AIInsightsCard transactions={transactions} />
          </div>
        </div>
      </main>

      <AddTransactionDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        onAdd={addTransaction} 
      />
      <BottomNav onAddClick={() => setDialogOpen(true)} />
    </div>
  );
};

export default Index;
