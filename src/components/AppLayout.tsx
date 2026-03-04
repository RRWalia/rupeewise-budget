import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { BottomNav } from '@/components/BottomNav';
import { AddTransactionDialog } from '@/components/AddTransactionDialog';
import { useTransactions } from '@/hooks/useTransactions';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { addTransaction } = useTransactions();
  const [lastTransactionType, setLastTransactionType] = useState<'income' | 'expense'>('expense');

  const handleAddTransaction = async (transaction: Parameters<typeof addTransaction>[0]) => {
    const result = await addTransaction(transaction);
    if (result.success) {
      setLastTransactionType(transaction.type);
    }
    return result;
  };

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-24">
        {children}
        <AddTransactionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAdd={handleAddTransaction}
          defaultType={lastTransactionType}
        />
        <BottomNav onAddClick={() => setDialogOpen(true)} />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar onAddClick={() => setDialogOpen(true)} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
            <SidebarTrigger className="ml-3" />
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
      <AddTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={handleAddTransaction}
        defaultType={lastTransactionType}
      />
    </SidebarProvider>
  );
}
