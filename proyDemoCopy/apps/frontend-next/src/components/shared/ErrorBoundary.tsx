"use client";
import * as React from "react";
// [ErrorBoundary]: captura errores de render del subárbol y muestra fallback | [Patrón]: Error Boundary | [Principio]: SRP + LSP

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  // [fallback]: nodo o render-prop que recibe el error capturado | [Patrón]: Render Prop
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  // [onError]: hook para logging externo (Sentry, etc.) | [Patrón]: Observer
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  reset = (): void => this.setState({ error: null });

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback } = this.props;
    if (typeof fallback === "function") return fallback(error, this.reset);
    if (fallback !== undefined) return fallback;

    // [Fallback por defecto]: accesible y minimalista | [Buena práctica]: WCAG
    return (
      <div role="alert" className="p-4 rounded-md border border-destructive/30 bg-destructive/5">
        <h2 className="font-semibold text-destructive">Algo salió mal</h2>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-3 inline-flex items-center rounded-md border px-3 py-1 text-sm hover:bg-muted"
        >
          Reintentar
        </button>
      </div>
    );
  }
}
