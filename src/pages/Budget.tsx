import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, Wallet, PiggyBank, Target, Save } from 'lucide-react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { EXPENSE_CATEGORIES, CATEGORY_ICONS, type Category } from '@/lib/mockData';
import { useTransactions } from '@/hooks/useTransactions';
import { AddTransactionDialog } from '@/components/AddTransactionDialog';
import { BottomNav } from '@/components/BottomNav';

const Budget = () => {
  const { toast } = useToast();
  const { transactions, addTransaction } = useTransactions();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Budget state - in production, this would come from the database
  const [monthlyIncome, setMonthlyIncome] = useState('75000');
  const [totalBudget, setTotalBudget] = useState('60000');
  const [savingsGoal, setSavingsGoal] = useState('15000');
  const [categoryBudgets, setCategoryBudgets] = useState<Record<Category, string>>({
    Grocery: '8000',
    Rent: '15000',
    Travel: '5000',
    Shopping: '5000',
    Entertainment: '3000',
    Medical: '3000',
    Personal: '2000',
    Health: '2000',
    Salary: '0',
    Freelance: '0',
    Other: '0',
  });

  // Calculate actual spending per category from transactions
  const categorySpending = useMemo(() => {
    const spending: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        spending[t.category] = (spending[t.category] || 0) + Number(t.amount);
      });
    return spending;
  }, [transactions]);

  const handleCategoryBudgetChange = (category: Category, value: string) => {
    setCategoryBudgets(prev => ({ ...prev, [category]: value }));
  };

  const handleSave = () => {
    // In production, save to database
    toast({
      title: 'Budget saved!',
      description: 'Your budget settings have been updated.',
    });
  };

  const totalCategoryBudget = EXPENSE_CATEGORIES.reduce(
    (sum, cat) => sum + (parseFloat(categoryBudgets[cat]) || 0),
    0
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      
      <main className="container py-6">
        {/* Page Title */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="font-display text-2xl font-bold text-foreground">
            Budget Planning 💰
          </h2>
          <p className="text-muted-foreground">
            Set your monthly targets and track spending
          </p>
        </motion.div>

        {/* Main Budget Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5 text-primary" />
                Monthly Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Monthly Income */}
              <div className="space-y-2">
                <Label htmlFor="income" className="flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-income" />
                  Expected Monthly Income
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input
                    id="income"
                    type="number"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    className="pl-8 text-lg font-semibold"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Total Budget */}
              <div className="space-y-2">
                <Label htmlFor="budget" className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Total Monthly Budget
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input
                    id="budget"
                    type="number"
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(e.target.value)}
                    className="pl-8 text-lg font-semibold"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Category budgets total: ₹{totalCategoryBudget.toLocaleString('en-IN')}
                </p>
              </div>

              {/* Savings Goal */}
              <div className="space-y-2">
                <Label htmlFor="savings" className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-savings" />
                  Monthly Savings Goal
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input
                    id="savings"
                    type="number"
                    value={savingsGoal}
                    onChange={(e) => setSavingsGoal(e.target.value)}
                    className="pl-8 text-lg font-semibold"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {parseFloat(monthlyIncome) > 0 
                    ? `${((parseFloat(savingsGoal) / parseFloat(monthlyIncome)) * 100).toFixed(1)}% of income`
                    : '0% of income'}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Category Budgets */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Category-wise Budgets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {EXPENSE_CATEGORIES.map((category) => {
                const budget = parseFloat(categoryBudgets[category]) || 0;
                const spent = categorySpending[category] || 0;
                const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                const isOverBudget = spent > budget && budget > 0;

                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <span className="text-lg">{CATEGORY_ICONS[category]}</span>
                        {category}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Spent: ₹{spent.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                        <Input
                          type="number"
                          value={categoryBudgets[category]}
                          onChange={(e) => handleCategoryBudgetChange(category, e.target.value)}
                          className="pl-7 h-9"
                          placeholder="0"
                        />
                      </div>
                      <div className="w-24">
                        <Progress 
                          value={percentage} 
                          className={`h-2 ${isOverBudget ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button onClick={handleSave} className="w-full" size="lg">
            <Save className="mr-2 h-4 w-4" />
            Save Budget Settings
          </Button>
        </motion.div>
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

export default Budget;
