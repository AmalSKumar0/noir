import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    // Update state so the next render shows the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You could log the error to an error reporting service
    console.error('ErrorBoundary caught an error', error, errorInfo);
    this.setState({ error });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive space-y-3">
          <div className="flex items-center gap-2 text-base font-semibold">
            <span>Something went wrong while loading the report.</span>
          </div>
          <details className="text-sm">
            <summary>Show error details</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all">{this.state.error?.toString()}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
