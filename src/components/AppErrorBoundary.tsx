import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

type Props = { children: ReactNode; reload?: () => void };
type State = { error: Error | null; resetKey: number };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Roadshow Driver render error", error, info.componentStack);
  }

  retry = () => this.setState((current) => ({ error: null, resetKey: current.resetKey + 1 }));

  render() {
    if (this.state.error) {
      return (
        <main className="recovery-screen">
          <section className="recovery-card" role="alert">
            <span className="recovery-icon"><AlertTriangle /></span>
            <p className="eyebrow">RECOVERY MODE</p>
            <h1>The app hit a roadblock</h1>
            <p>Your data is still safe. Try reopening this screen, or reload the app if the problem continues.</p>
            <div>
              <button className="button primary" onClick={this.retry}><RotateCcw /> Try Again</button>
              <button className="button secondary" onClick={() => (this.props.reload || (() => window.location.reload()))()}><RefreshCw /> Reload App</button>
            </div>
          </section>
        </main>
      );
    }
    return <div key={this.state.resetKey}>{this.props.children}</div>;
  }
}
