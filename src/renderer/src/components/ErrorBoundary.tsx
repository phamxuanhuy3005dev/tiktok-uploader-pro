import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
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
    console.error("Uncaught error in UI:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6 text-white">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="h-8 w-8 shrink-0" />
              <div>
                <h2 className="text-lg font-bold text-white">
                  Đã xảy ra lỗi giao diện
                </h2>
                <p className="text-xs text-slate-400">
                  Ứng dụng đã tự động ngăn chặn sự cố sập màn hình trắng.
                </p>
              </div>
            </div>

            <div className="max-h-40 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-rose-300">
              {this.state.error?.message || "Lỗi không xác định"}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="rounded-lg bg-slate-700 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-600 hover:text-white"
              >
                Thử khôi phục
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-sky-600/30 transition-colors hover:bg-sky-500"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Tải lại giao diện
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
