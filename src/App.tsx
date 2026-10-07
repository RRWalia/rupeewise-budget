import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { AppLayout } from "@/components/AppLayout";
import { TransactionsProvider } from "@/contexts/TransactionsContext";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Budget from "./pages/Budget";
import Settings from "./pages/Settings";
import Approvals from "./pages/Approvals";
import NotFound from "./pages/NotFound";
import { RouteMeta } from "@/components/RouteMeta";

const queryClient = new QueryClient();

const ProtectedApp = () => (
  <AuthGuard>
    <TransactionsProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </TransactionsProvider>
  </AuthGuard>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RouteMeta />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<Auth />} />
            <Route path="/*" element={<ProtectedApp />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
