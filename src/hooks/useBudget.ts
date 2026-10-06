import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Category } from '@/lib/mockData';
import { formatMonthLabel, getCurrentMonthKey } from '@/lib/date';
import type { Tables } from '@/integrations/supabase/types';

export interface BudgetData {
  monthlyIncome: string;
  overallBudget: string;
  savingsGoal: string;
  categoryBudgets: Record<Category, string>;
}

const DEFAULT_BUDGET: BudgetData = {
  monthlyIncome: '0',
  overallBudget: '0',
  savingsGoal: '0',
  categoryBudgets: {
    Grocery: '0',
    Housing: '0',
    'Loans & EMIs': '0',
    'Tuition & Education': '0',
    Travel: '0',
    Shopping: '0',
    Entertainment: '0',
    Medical: '0',
    Personal: '0',
    Health: '0',
    Salary: '0',
    Freelance: '0',
    Other: '0',
  },
};

type BudgetRow = Tables<'budgets'>;
type BudgetCategoryColumn = keyof Pick<BudgetRow,
  'grocery' | 'housing' | 'loans_emis' | 'tuition_education' | 'travel' |
  'shopping' | 'entertainment' | 'medical' | 'personal' | 'health'
>;

// Map budgeted expense category names to DB column names.
// Income categories are valid transaction categories, but they are not budget-spend columns.
const categoryToColumn: Partial<Record<Category, BudgetCategoryColumn>> = {
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
};

// Reverse map for DB to category
const columnToCategory = Object.entries(categoryToColumn).reduce(
  (acc, [cat, col]) => ({ ...acc, [col]: cat as Category }),
  {} as Record<BudgetCategoryColumn, Category>
);

export function useBudget() {
  const [budget, setBudget] = useState<BudgetData>(DEFAULT_BUDGET);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

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
        (Object.entries(columnToCategory) as Array<[BudgetCategoryColumn, Category]>).forEach(([col, cat]) => {
          const value = data[col];
          if (value !== undefined) {
            categoryBudgets[cat] = String(value);
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

      const monthName = formatMonthLabel(monthKey);
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
