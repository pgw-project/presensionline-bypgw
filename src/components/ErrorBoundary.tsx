import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Terjadi Kesalahan Tampilan</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aplikasi mengalami kendala saat memuat data. Silakan tekan tombol di bawah untuk memuat ulang halaman.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 text-[11px] font-mono text-red-300 text-left overflow-auto max-h-28">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm py-2.5 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Halaman</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
