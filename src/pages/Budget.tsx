import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, Wallet, PiggyBank, Target, Save, LayoutGrid, Loader2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EXPENSE_CATEGORIES, CATEGORY_ICONS, CATEGORY_DISPLAY_NAMES, type Category } from '@/lib/mockData';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudget } from '@/hooks/useBudget';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const Budget = () => {
  const { transactions } = useTransactions();
  const { budget, loading, saving, saveBudget } = useBudget();
  const isMobile = useIsMobile();
  
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [savingsGoal, setSavingsGoal] = useState('');
  const [categoryBudgets, setCategoryBudgets] = useState<Record<Category, string>>({
    Grocery: '0', Housing: '0', 'Loans & EMIs': '0', 'Tuition & Education': '0',
    Travel: '0', Shopping: '0', Entertainment: '0', Medical: '0',
    Personal: '0', Health: '0', Salary: '0', Freelance: '0', Other: '0',
  });

  useEffect(() => {
    if (!loading) {
      setMonthlyIncome(budget.monthlyIncome);
      setTotalBudget(budget.overallBudget);
      setSavingsGoal(budget.savingsGoal);
      setCategoryBudgets(budget.categoryBudgets);
    }
  }, [loading, budget]);

  const currentMonth = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const categorySpending = useMemo(() => {
    const spending: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      spending[t.category] = (spending[t.category] || 0) + Number(t.amount);
    });
    return spending;
  }, [transactions]);

  const handleCategoryBudgetChange = (category: Category, value: string) => {
    setCategoryBudgets(prev => ({ ...prev, [category]: value }));
  };

  const handleSave = async () => {
    await saveBudget({ monthlyIncome, overallBudget: totalBudget, savingsGoal, categoryBudgets });
  };

  const totalCategoryBudget = EXPENSE_CATEGORIES.reduce(
    (sum, cat) => sum + (parseFloat(categoryBudgets[cat]) || 0), 0
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="bg-background">
      {isMobile && <Header />}
      
      <div className="container py-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">Budget Planning 💰</h2>
          <p className="text-muted-foreground">Set your targets for {currentMonth}</p>
        </motion.div>

        {/* Section 1: Monthly Income */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-income/10">
                  <IndianRupee className="h-4 w-4 text-income" />
                </div>
                Monthly Income
              </CardTitle>
              <CardDescription>Your expected earnings this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">₹</span>
                <Input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} className="pl-8 text-xl font-bold h-12" placeholder="0" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Section 2: Overall Monthly Budget */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                Overall Monthly Budget
              </CardTitle>
              <CardDescription>Maximum you want to spend this month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">₹</span>
                <Input type="number" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} className="pl-8 text-xl font-bold h-12" placeholder="0" />
              </div>
              <p className="text-xs text-muted-foreground">Category budgets total: {formatCurrency(totalCategoryBudget)}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Section 3: Savings Goal */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-savings/10">
                  <PiggyBank className="h-4 w-4 text-savings" />
                </div>
                Savings Goal
              </CardTitle>
              <CardDescription>Target savings for this month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">₹</span>
                <Input type="number" value={savingsGoal} onChange={(e) => setSavingsGoal(e.target.value)} className="pl-8 text-xl font-bold h-12" placeholder="0" />
              </div>
              <p className="text-xs text-muted-foreground">
                {parseFloat(monthlyIncome) > 0 ? `${((parseFloat(savingsGoal) / parseFloat(monthlyIncome)) * 100).toFixed(1)}% of income` : '0% of income'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Section 4: Per-Category Budgets */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                  <LayoutGrid className="h-4 w-4 text-foreground" />
                </div>
                Per-Category Budgets
              </CardTitle>
              <CardDescription>Set spending limits for each category</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {EXPENSE_CATEGORIES.map((category) => {
                const budgetVal = parseFloat(categoryBudgets[category]) || 0;
                const spent = categorySpending[category] || 0;
                const percentage = budgetVal > 0 ? Math.min((spent / budgetVal) * 100, 100) : 0;
                const isOverBudget = spent > budgetVal && budgetVal > 0;

                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 text-sm">
                        <span className="text-lg">{CATEGORY_ICONS[category]}</span>
                        {CATEGORY_DISPLAY_NAMES[category]}
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                        <Input type="number" value={categoryBudgets[category]} onChange={(e) => handleCategoryBudgetChange(category, e.target.value)} className="pl-7 h-9" placeholder="0" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Progress value={percentage} className={cn('h-2', isOverBudget ? '[&>div]:bg-destructive' : percentage > 80 ? '[&>div]:bg-warning' : '[&>div]:bg-primary')} />
                      </div>
                      <span className={cn('text-xs font-medium whitespace-nowrap min-w-[120px] text-right', isOverBudget ? 'text-destructive' : percentage > 80 ? 'text-warning' : 'text-muted-foreground')}>
                        {formatCurrency(spent)} / {formatCurrency(budgetVal)}
                        <span className="ml-1 opacity-70">({percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Save Button */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="pb-6">
          <Button onClick={handleSave} className="w-full" size="lg" disabled={saving || loading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Budget Settings'}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default Budget;
