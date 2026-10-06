import type { Transaction } from '@/hooks/useTransactions';
import { formatShortMonthLabel, getMonthKey, getRelativeMonthKey, isInMonth } from '@/lib/date';

export interface Totals {
  income: number;
  expenses: number;
  savings: number;
}

export interface TrendInfo {
  direction: 'up' | 'down';
  label: string;
  percentChange: number;
}

export interface MonthlySavingsPoint {
  monthKey: string;
  month: string;
  value: number;
}

export function filterTransactionsByMonth(transactions: Transaction[], monthKey: string): Transaction[] {
  return transactions.filter(transaction => isInMonth(transaction.date, monthKey));
}

export function calculateTotals(transactions: Transaction[]): Totals {
  const income = transactions
    .filter(transaction => transaction.type === 'income')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const expenses = transactions
    .filter(transaction => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  return { income, expenses, savings: income - expenses };
}

export function calculateCategorySpending(transactions: Transaction[]): Record<string, number> {
  return transactions
    .filter(transaction => transaction.type === 'expense')
    .reduce<Record<string, number>>((spending, transaction) => {
      spending[transaction.category] = (spending[transaction.category] || 0) + Number(transaction.amount);
      return spending;
    }, {});
}

export function calculateTrend(currentValue: number, previousValue: number): TrendInfo | undefined {
  if (previousValue <= 0 || currentValue <= 0) {
    return undefined;
  }

  const percentChange = ((currentValue - previousValue) / previousValue) * 100;
  const rounded = Math.round(percentChange);

  if (rounded === 0) {
    return undefined;
  }

  return {
    direction: percentChange > 0 ? 'up' : 'down',
    percentChange,
    label: `${percentChange > 0 ? '+' : ''}${rounded}% vs last month`,
  };
}

export function buildMonthlySavingsTrend(
  transactions: Transaction[],
  currentMonthKey: string,
  monthsToShow = 6
): MonthlySavingsPoint[] {
  const monthKeys = Array.from({ length: monthsToShow }, (_, index) =>
    getRelativeMonthKey(currentMonthKey, index - monthsToShow + 1)
  );

  const totalsByMonth = new Map<string, Totals>();
  monthKeys.forEach(monthKey => totalsByMonth.set(monthKey, { income: 0, expenses: 0, savings: 0 }));

  transactions.forEach(transaction => {
    const monthKey = getMonthKey(transaction.date);
    const totals = totalsByMonth.get(monthKey);
    if (!totals) return;

    if (transaction.type === 'income') {
      totals.income += Number(transaction.amount);
    } else {
      totals.expenses += Number(transaction.amount);
    }
    totals.savings = totals.income - totals.expenses;
  });

  return monthKeys.map(monthKey => ({
    monthKey,
    month: formatShortMonthLabel(monthKey),
    value: totalsByMonth.get(monthKey)?.savings ?? 0,
  }));
}
