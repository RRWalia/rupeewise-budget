import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * Last line of defence for a finance app: a render error must never leave
 * the user staring at a blank white page. Shows a friendly recovery screen
 * with a reload button instead.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('RupeeWise crashed:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="font-display text-xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          RupeeWise hit an unexpected error. Your data is safe — reloading usually fixes this.
        </p>
        <div className="mt-6 flex gap-3">
          <Button onClick={this.handleReload}>Reload app</Button>
          <Button variant="outline" onClick={this.handleGoHome}>Go to dashboard</Button>
        </div>
      </div>
    );
  }
}
