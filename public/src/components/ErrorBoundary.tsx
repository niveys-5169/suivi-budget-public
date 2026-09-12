import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label ?? 'unknown'}]`, error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6 rounded-lg border border-separator bg-surface text-label/40">
        <AlertTriangle size={20} className="text-gold/60" />
        <p className="text-caption font-semibold">{this.props.label ?? 'Composant'} indisponible</p>
        <button
          onClick={this.reset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-separator text-caption hover:bg-white/10 transition-colors"
        >
          <RefreshCw size={12} />
          Réessayer
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
