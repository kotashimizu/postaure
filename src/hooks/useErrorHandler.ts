import { useState, useCallback } from 'react';

export interface ErrorState {
  error: Error | null;
  isError: boolean;
  message: string;
}

export function useErrorHandler() {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isError: false,
    message: ''
  });

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isError: false,
      message: ''
    });
  }, []);

  const handleError = useCallback((error: Error | unknown, customMessage?: string) => {
    console.error('Error caught:', error);
    
    let message = customMessage || 'エラーが発生しました';
    let errorObj: Error;

    if (error instanceof Error) {
      errorObj = error;
      // Provide user-friendly messages for common errors
      if (error.message.includes('MediaPipe')) {
        message = 'カメラの初期化に失敗しました。カメラへのアクセス許可を確認してください。';
      } else if (error.message.includes('NotAllowedError')) {
        message = 'カメラへのアクセスが拒否されました。ブラウザの設定を確認してください。';
      } else if (error.message.includes('NotFoundError')) {
        message = 'カメラが見つかりません。デバイスにカメラが接続されているか確認してください。';
      } else if (error.message.includes('network')) {
        message = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
      } else if (error.message.includes('memory')) {
        message = 'メモリ不足です。他のアプリケーションを閉じてから再試行してください。';
      }
    } else {
      errorObj = new Error(String(error));
    }

    setErrorState({
      error: errorObj,
      isError: true,
      message
    });
  }, []);

  return {
    errorState,
    handleError,
    clearError
  };
}