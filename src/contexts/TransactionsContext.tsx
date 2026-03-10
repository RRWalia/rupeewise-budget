import { createContext, useContext, type ReactNode } from 'react';
import { useTransactions } from '@/hooks/useTransactions';

type TransactionsContextType = ReturnType<typeof useTransactions>;

const TransactionsContext = createContext<TransactionsContextType | null>(null);

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const transactions = useTransactions();
  return (
    <TransactionsContext.Provider value={transactions}>
      {children}
    </TransactionsContext.Provider>
  );
}

export function useSharedTransactions(): TransactionsContextType {
  const ctx = useContext(TransactionsContext);
  if (!ctx) throw new Error('useSharedTransactions must be used within TransactionsProvider');
  return ctx;
}
