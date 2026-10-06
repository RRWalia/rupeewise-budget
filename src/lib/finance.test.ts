import { describe, expect, it } from 'vitest';
import { calculateCategorySpending, calculateTotals, calculateTrend, filterTransactionsByMonth } from '@/lib/finance';
import type { Transaction } from '@/hooks/useTransactions';

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(),
  amount: 0,
  date: '2026-10-01',
  category: 'Other',
  payment_mode: 'UPI',
  note: null,
  type: 'expense',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: null,
  user_id: 'user-1',
  ...overrides,
});

describe('finance calculations', () => {
  it('filters transactions by local date month key', () => {
    const transactions = [
      tx({ id: '1', date: '2026-10-01', amount: 100 }),
      tx({ id: '2', date: '2026-10-31', amount: 200 }),
      tx({ id: '3', date: '2026-11-01', amount: 300 }),
    ];

    expect(filterTransactionsByMonth(transactions, '2026-10').map(transaction => transaction.id)).toEqual(['1', '2']);
  });

  it('calculates income, expenses, savings, and category spending', () => {
    const transactions = [
      tx({ id: 'income', type: 'income', category: 'Salary', amount: 75_000 }),
      tx({ id: 'grocery-1', category: 'Grocery', amount: 2_500 }),
      tx({ id: 'grocery-2', category: 'Grocery', amount: 1_500 }),
      tx({ id: 'rent', category: 'Housing', amount: 15_000 }),
    ];

    expect(calculateTotals(transactions)).toEqual({ income: 75_000, expenses: 19_000, savings: 56_000 });
    expect(calculateCategorySpending(transactions)).toEqual({ Grocery: 4_000, Housing: 15_000 });
  });

  it('returns an actual percentage trend instead of a hardcoded label', () => {
    expect(calculateTrend(12_000, 10_000)).toMatchObject({ direction: 'up', label: '+20% vs last month' });
    expect(calculateTrend(8_000, 10_000)).toMatchObject({ direction: 'down', label: '-20% vs last month' });
    expect(calculateTrend(8_000, 0)).toBeUndefined();
  });
});
