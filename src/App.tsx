import { useState } from 'react'
import CaptureScreen from './components/CaptureScreen'
import AnalysisScreen from './components/AnalysisScreen'
import ReportScreen from './components/ReportScreen'
import ErrorBoundary from './components/ErrorBoundary'
import ErrorMessage from './components/ErrorMessage'
import { useErrorHandler } from './hooks/useErrorHandler'
import type { EnhancedPostureAnalysisResult } from './services/EnhancedPostureAnalysisService'
import './App.css'

interface ImageData {
  blob: Blob;
  width: number;
  height: number;
  timestamp: number;
  viewType: 'frontal' | 'sagittal';
}


type AppState = 'capture' | 'analysis' | 'report' | 'error';

function App() {
  const [appState, setAppState] = useState<AppState>('capture');
  const [images, setImages] = useState<{ frontal: ImageData; sagittal: ImageData } | null>(null);
  const [analysisResults, setAnalysisResults] = useState<EnhancedPostureAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { errorState, handleError: handleErrorHook, clearError } = useErrorHandler();

  const handleImagesCapture = (frontal: ImageData, sagittal: ImageData) => {
    setImages({ frontal, sagittal });
    setAppState('analysis');
  };

  const handleAnalysisComplete = (results: EnhancedPostureAnalysisResult) => {
    setAnalysisResults(results);
    setAppState('report');
  };

  const handleError = (error: Error) => {
    setError(error.message);
    setAppState('error');
    handleErrorHook(error);
  };

  const handleRestart = () => {
    setAppState('capture');
    setImages(null);
    setAnalysisResults(null);
    setError(null);
  };

  return (
    <ErrorBoundary>
      <div className="app">
        <ErrorMessage errorState={errorState} onDismiss={clearError} />
      {appState === 'capture' && (
        <CaptureScreen
          onImagesCapture={handleImagesCapture}
          onError={handleError}
        />
      )}

      {appState === 'analysis' && images && (
        <AnalysisScreen
          frontalImage={images.frontal}
          sagittalImage={images.sagittal}
          onAnalysisComplete={handleAnalysisComplete}
          onAnalysisError={handleError}
        />
      )}

      {appState === 'report' && analysisResults && images && (
        <ReportScreen
          analysisResults={analysisResults}
          originalImages={images}
          onRestart={handleRestart}
        />
      )}

      {appState === 'error' && (
        <div className="error-screen">
          <div className="error-message">
            <h2>エラーが発生しました</h2>
            <p>{error}</p>
            <button onClick={handleRestart}>
              最初からやり直す
            </button>
          </div>
        </div>
      )}
      </div>
    </ErrorBoundary>
  )
}

export default App
