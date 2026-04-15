"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string;
}

export class DebugErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack ?? "" });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-4 rounded border-2 border-red-400 bg-red-50 p-4 text-xs">
          <div className="text-sm font-bold text-red-700">React-feil:</div>
          <pre className="mt-1 whitespace-pre-wrap text-red-600">
            {this.state.error.message}
          </pre>
          <details className="mt-2">
            <summary className="cursor-pointer text-gray-500">Stack</summary>
            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap text-[10px] text-gray-400">
              {this.state.info}
            </pre>
          </details>
          <button
            onClick={() => this.setState({ error: null, info: "" })}
            className="mt-2 rounded bg-red-600 px-3 py-1 text-white"
          >
            Prøv igjen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
