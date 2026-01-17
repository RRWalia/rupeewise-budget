import { Header } from '@/components/Header';
import { SummaryCard } from '@/components/SummaryCard';
import { SpendingPieChart } from '@/components/SpendingPieChart';
import { SavingsTrendCard } from '@/components/SavingsTrendCard';
import { AIInsightsCard } from '@/components/AIInsightsCard';
import { RecentTransactions } from '@/components/RecentTransactions';
import { AddTransactionDialog } from '@/components/AddTransactionDialog';
import { calculateTotals, mockTransactions, monthlyBudget } from '@/lib/mockData';

const Index = () => {
  const { income, expenses } = calculateTotals(mockTransactions);
  const budgetUsedPercent = (expenses / monthlyBudget) * 100;

  return (
    <div className="min-h-screen bg-background">
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
            <SpendingPieChart />
            <RecentTransactions />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <SavingsTrendCard />
            <AIInsightsCard />
          </div>
        </div>
      </main>

      <AddTransactionDialog />
    </div>
  );
};

export default Index;
