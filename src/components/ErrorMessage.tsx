import type { ErrorState } from '../hooks/useErrorHandler';

interface ErrorMessageProps {
  errorState: ErrorState;
  onDismiss: () => void;
}

export default function ErrorMessage({ errorState, onDismiss }: ErrorMessageProps) {
  if (!errorState.isError) return null;

  return (
    <div className="error-message-container">
      <div className="error-message-content">
        <div className="error-icon">⚠️</div>
        <div className="error-text">
          <h4>エラー</h4>
          <p>{errorState.message}</p>
        </div>
        <button 
          className="error-dismiss"
          onClick={onDismiss}
          aria-label="エラーメッセージを閉じる"
        >
          ✕
        </button>
      </div>
    </div>
  );
}