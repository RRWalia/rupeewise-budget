import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Category } from '@/lib/mockData';

export interface BudgetData {
  monthlyIncome: string;
  overallBudget: string;
  savingsGoal: string;
  categoryBudgets: Record<Category, string>;
}

const DEFAULT_BUDGET: BudgetData = {
  monthlyIncome: '75000',
  overallBudget: '60000',
  savingsGoal: '15000',
  categoryBudgets: {
    Grocery: '8000',
    Housing: '15000',
    'Loans & EMIs': '10000',
    'Tuition & Education': '5000',
    Travel: '5000',
    Shopping: '5000',
    Entertainment: '3000',
    Medical: '3000',
    Personal: '2000',
    Health: '2000',
    Salary: '0',
    Freelance: '0',
    Other: '0',
  },
};

// Map category names to DB column names
const categoryToColumn: Record<Category, string> = {
  Grocery: 'grocery',
  Housing: 'housing',
  'Loans & EMIs': 'loans_emis',
  'Tuition & Education': 'tuition_education',
  Travel: 'travel',
  Shopping: 'shopping',
  Entertainment: 'entertainment',
  Medical: 'medical',
  Personal: 'personal',
  Health: 'health',
  Salary: 'salary',
  Freelance: 'freelance',
  Other: 'other',
};

// Reverse map for DB to category
const columnToCategory: Record<string, Category> = Object.entries(categoryToColumn).reduce(
  (acc, [cat, col]) => ({ ...acc, [col]: cat as Category }),
  {} as Record<string, Category>
);

export function useBudget() {
  const [budget, setBudget] = useState<BudgetData>(DEFAULT_BUDGET);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Get current month key (e.g., "2026-01")
  const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const monthKey = getCurrentMonthKey();

  const fetchBudget = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('month', monthKey)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Map DB row to BudgetData
        const categoryBudgets: Record<Category, string> = { ...DEFAULT_BUDGET.categoryBudgets };
        Object.entries(columnToCategory).forEach(([col, cat]) => {
          if (data[col] !== undefined) {
            categoryBudgets[cat] = String(data[col]);
          }
        });

        setBudget({
          monthlyIncome: String(data.monthly_income),
          overallBudget: String(data.overall_budget),
          savingsGoal: String(data.savings_goal),
          categoryBudgets,
        });
      }
      // If no data, keep defaults
    } catch (error) {
      console.error('Error fetching budget:', error);
      toast({
        title: 'Error',
        description: 'Failed to load budget settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  const saveBudget = async (budgetData: BudgetData): Promise<{ success: boolean }> => {
    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Build DB row with proper typing
      const row = {
        month: monthKey,
        user_id: user.id,
        monthly_income: parseFloat(budgetData.monthlyIncome) || 0,
        overall_budget: parseFloat(budgetData.overallBudget) || 0,
        savings_goal: parseFloat(budgetData.savingsGoal) || 0,
        grocery: parseFloat(budgetData.categoryBudgets.Grocery) || 0,
        housing: parseFloat(budgetData.categoryBudgets.Housing) || 0,
        loans_emis: parseFloat(budgetData.categoryBudgets['Loans & EMIs']) || 0,
        tuition_education: parseFloat(budgetData.categoryBudgets['Tuition & Education']) || 0,
        travel: parseFloat(budgetData.categoryBudgets.Travel) || 0,
        shopping: parseFloat(budgetData.categoryBudgets.Shopping) || 0,
        entertainment: parseFloat(budgetData.categoryBudgets.Entertainment) || 0,
        medical: parseFloat(budgetData.categoryBudgets.Medical) || 0,
        personal: parseFloat(budgetData.categoryBudgets.Personal) || 0,
        health: parseFloat(budgetData.categoryBudgets.Health) || 0,
      };

      const { error } = await supabase
        .from('budgets')
        .upsert(row, { onConflict: 'month,user_id' });

      if (error) throw error;

      setBudget(budgetData);

      const monthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      toast({
        title: 'Budget saved!',
        description: `Your budget for ${monthName} has been saved.`,
      });

      return { success: true };
    } catch (error) {
      console.error('Error saving budget:', error);
      toast({
        title: 'Error',
        description: 'Failed to save budget settings',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  return {
    budget,
    loading,
    saving,
    saveBudget,
    refetch: fetchBudget,
    monthKey,
  };
}
