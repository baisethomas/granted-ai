import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-red-600">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600 mb-4">
            We encountered an unexpected error. Please try refreshing the page or contact support if the issue persists.
          </p>
          <details className="mb-4">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
              Technical Details
            </summary>
            <pre className="text-xs bg-slate-100 p-2 mt-2 rounded overflow-x-auto">
              {error.message}
            </pre>
          </details>
          <div className="flex gap-2">
            <Button onClick={resetError} variant="outline">
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AuthErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  const isNetworkError = error.message.includes('fetch') || error.message.includes('network');
  const isAuthError = error.message.includes('401') || error.message.includes('403') || error.message.includes('Unauthorized');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-red-600">
            {isNetworkError ? 'Connection Error' : isAuthError ? 'Authentication Error' : 'Login Error'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600 mb-4">
            {isNetworkError 
              ? 'Unable to connect to our servers. Please check your internet connection and try again.'
              : isAuthError 
              ? 'Your session has expired or your credentials are invalid. Please log in again.'
              : 'There was a problem with the login process. Please try again.'
            }
          </p>
          <div className="flex gap-2">
            <Button onClick={resetError} variant="outline">
              Try Again
            </Button>
            <Button onClick={() => window.location.href = '/auth'}>
              Go to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}