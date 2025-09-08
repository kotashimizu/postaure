import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <h1>申し訳ございません</h1>
            <p>予期しないエラーが発生しました。</p>
            
            <div className="error-details">
              <p className="error-message">
                {this.state.error?.message || '不明なエラー'}
              </p>
              
              {import.meta.env.DEV && this.state.errorInfo && (
                <details className="error-stack">
                  <summary>エラー詳細（開発者向け）</summary>
                  <pre>{this.state.errorInfo.componentStack}</pre>
                </details>
              )}
            </div>

            <div className="error-actions">
              <button onClick={this.handleReload} className="btn-primary">
                ページを再読み込み
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="btn-secondary"
              >
                ホームに戻る
              </button>
            </div>

            <div className="error-help">
              <p>問題が続く場合は、以下をお試しください：</p>
              <ul>
                <li>ブラウザのキャッシュをクリア</li>
                <li>別のブラウザで試す</li>
                <li>最新のChrome、Firefox、Safari、またはEdgeを使用</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}