export interface Transaction {
  id: string;
  amount: number;
  date: string;
  category: Category;
  paymentMode: 'UPI' | 'Card' | 'Cash';
  note?: string;
  type: 'income' | 'expense';
}

export type Category = 
  | 'Grocery' 
  | 'Rent' 
  | 'Travel' 
  | 'Shopping' 
  | 'Entertainment' 
  | 'Medical' 
  | 'Personal' 
  | 'Health'
  | 'Salary'
  | 'Freelance'
  | 'Other';

export const EXPENSE_CATEGORIES: Category[] = [
  'Grocery',
  'Rent',
  'Travel',
  'Shopping',
  'Entertainment',
  'Medical',
  'Personal',
  'Health',
];

export const INCOME_CATEGORIES: Category[] = ['Salary', 'Freelance', 'Other'];

export const CATEGORY_COLORS: Record<Category, string> = {
  Grocery: 'hsl(142, 70%, 45%)',
  Rent: 'hsl(220, 70%, 55%)',
  Travel: 'hsl(280, 60%, 55%)',
  Shopping: 'hsl(330, 70%, 55%)',
  Entertainment: 'hsl(45, 90%, 50%)',
  Medical: 'hsl(0, 70%, 55%)',
  Personal: 'hsl(190, 70%, 50%)',
  Health: 'hsl(160, 60%, 45%)',
  Salary: 'hsl(158, 64%, 45%)',
  Freelance: 'hsl(200, 85%, 50%)',
  Other: 'hsl(220, 15%, 55%)',
};

export const CATEGORY_ICONS: Record<Category, string> = {
  Grocery: '🛒',
  Rent: '🏠',
  Travel: '✈️',
  Shopping: '🛍️',
  Entertainment: '🎬',
  Medical: '💊',
  Personal: '👤',
  Health: '💪',
  Salary: '💰',
  Freelance: '💼',
  Other: '📦',
};

// Mock transactions for demo
export const mockTransactions: Transaction[] = [
  { id: '1', amount: 75000, date: '2025-01-01', category: 'Salary', paymentMode: 'UPI', type: 'income', note: 'Monthly salary' },
  { id: '2', amount: 15000, date: '2025-01-02', category: 'Rent', paymentMode: 'UPI', type: 'expense', note: 'Monthly rent' },
  { id: '3', amount: 4500, date: '2025-01-03', category: 'Grocery', paymentMode: 'UPI', type: 'expense' },
  { id: '4', amount: 2800, date: '2025-01-05', category: 'Shopping', paymentMode: 'Card', type: 'expense', note: 'New shoes' },
  { id: '5', amount: 1200, date: '2025-01-06', category: 'Entertainment', paymentMode: 'UPI', type: 'expense', note: 'Movie night' },
  { id: '6', amount: 3500, date: '2025-01-08', category: 'Travel', paymentMode: 'UPI', type: 'expense', note: 'Uber rides' },
  { id: '7', amount: 800, date: '2025-01-10', category: 'Health', paymentMode: 'Cash', type: 'expense', note: 'Gym membership' },
  { id: '8', amount: 2200, date: '2025-01-11', category: 'Medical', paymentMode: 'Card', type: 'expense', note: 'Doctor visit' },
  { id: '9', amount: 5000, date: '2025-01-12', category: 'Freelance', paymentMode: 'UPI', type: 'income', note: 'Side project' },
  { id: '10', amount: 1500, date: '2025-01-13', category: 'Personal', paymentMode: 'UPI', type: 'expense', note: 'Haircut & grooming' },
  { id: '11', amount: 3200, date: '2025-01-14', category: 'Grocery', paymentMode: 'UPI', type: 'expense' },
  { id: '12', amount: 2500, date: '2025-01-15', category: 'Shopping', paymentMode: 'Card', type: 'expense', note: 'Electronics' },
  { id: '13', amount: 1800, date: '2025-01-16', category: 'Entertainment', paymentMode: 'UPI', type: 'expense', note: 'Concert tickets' },
];

export const monthlyBudget = 60000;
export const lastMonthSavings = 3250;
export const lastMonthSavingsPercent = 5.4;

export function calculateTotals(transactions: Transaction[]) {
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  return { income, expenses, savings: income - expenses };
}

export function calculateCategorySpending(transactions: Transaction[]) {
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const categoryTotals: Record<string, number> = {};
  
  expenseTransactions.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });
  
  const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
  
  return Object.entries(categoryTotals).map(([category, amount]) => ({
    category: category as Category,
    amount,
    percentage: total > 0 ? (amount / total) * 100 : 0,
    color: CATEGORY_COLORS[category as Category],
    icon: CATEGORY_ICONS[category as Category],
  }));
}

// Savings trend data for sparkline
export const savingsTrend = [
  { month: 'Aug', savings: 2800 },
  { month: 'Sep', savings: 3100 },
  { month: 'Oct', savings: 2500 },
  { month: 'Nov', savings: 3400 },
  { month: 'Dec', savings: 3250 },
  { month: 'Jan', projected: 3500 },
];
