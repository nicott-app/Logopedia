import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldCheck } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error in ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50 dark:bg-bg-dark text-slate-800 dark:text-gray-100 font-sans">
          <div className="max-w-md w-full bg-white dark:bg-surface-dark border border-gray-100 dark:border-gray-800 rounded-3xl p-8 shadow-xl text-center space-y-6">
            
            {/* Warning Icon Badge */}
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Algo no ha salido como esperábamos
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Se ha producido una incidencia inesperada en la aplicación. No te preocupes: los registros clínicos y las citas guardadas no se han perdido.
              </p>
            </div>

            {/* Reassurance Badge */}
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-medium text-left">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Tus datos permanecen protegidos y sincronizados con seguridad.</span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium text-sm transition-all shadow-md shadow-primary/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reintentar</span>
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700/80 text-gray-700 dark:text-gray-200 font-medium text-sm transition-all"
              >
                <Home className="w-4 h-4" />
                <span>Ir al Panel</span>
              </button>
            </div>

            {/* Technical Diagnostics (Collapsible) */}
            {this.state.error && (
              <details className="text-left text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
                <summary className="cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none py-1">
                  Detalles técnicos del error
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded-xl overflow-x-auto text-[11px] text-red-600 dark:text-red-400 font-mono">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
