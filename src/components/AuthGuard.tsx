import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Auth from '@/pages/Auth';
import Landing from '@/pages/Landing';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const isPasswordRecovery = location.hash.includes('type=recovery') ||
      location.search.includes('type=recovery');

    if (location.pathname === '/' && !isPasswordRecovery) return <Landing />;
    return <Auth />;
  }

  return <>{children}</>;
}
