import { useState, useEffect } from 'react'
import CaptureScreen from './components/CaptureScreen'
import AnalysisScreen from './components/AnalysisScreen'
import ReportScreen from './components/ReportScreen'
import OfflineIndicator from './components/OfflineIndicator'
import CompatibilityCheck from './components/CompatibilityCheck'
import SettingsButton from './components/SettingsButton'
import PerformancePanel from './components/PerformancePanel'
import TestRunner from './components/TestRunner'
import ErrorBoundary from './components/ErrorBoundary'
import ErrorMessage from './components/ErrorMessage'
import { useErrorHandler } from './hooks/useErrorHandler'
import { useDeviceAdaptation } from './hooks/useDeviceAdaptation'
import type { EnhancedPostureAnalysisResult } from './services/EnhancedPostureAnalysisService'
import type { CompatibilityResult } from './utils/compatibilityChecker'
import type { DeviceInfo } from './utils/deviceDetection'
import './App.css'

interface ImageData {
  blob: Blob;
  width: number;
  height: number;
  timestamp: number;
  viewType: 'frontal' | 'sagittal';
}


type AppState = 'compatibility' | 'capture' | 'analysis' | 'report' | 'error';

function App() {
  const [appState, setAppState] = useState<AppState>('compatibility');
  const [images, setImages] = useState<{ frontal: ImageData; sagittal: ImageData } | null>(null);
  const [analysisResults, setAnalysisResults] = useState<EnhancedPostureAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCompatibilityCheck, setShowCompatibilityCheck] = useState(false);
  const [showPerformancePanel, setShowPerformancePanel] = useState(false);
  const [showTestRunner, setShowTestRunner] = useState(false);
  const { errorState, handleError: handleErrorHook, clearError } = useErrorHandler();
  const { deviceInfo } = useDeviceAdaptation();
  
  useEffect(() => {
    // Initialize offline service on app start
    console.log('Initializing offline service...');
    
    // Auto-skip compatibility check in development or if already passed
    if (import.meta.env.DEV || localStorage.getItem('compatibility_passed') === 'true') {
      setAppState('capture');
    }
  }, []);

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

  const handleCompatibilityComplete = (result: CompatibilityResult, _deviceInfo: DeviceInfo) => {
    if (result.isSupported) {
      localStorage.setItem('compatibility_passed', 'true');
      setAppState('capture');
    } else {
      setError('このデバイス・ブラウザでは一部機能が制限されます。互換性のあるブラウザをご利用ください。');
      setAppState('error');
    }
  };

  return (
    <ErrorBoundary>
      <div className="app" data-device-type={deviceInfo?.isMobile ? 'mobile' : deviceInfo?.isTablet ? 'tablet' : 'desktop'}>
        <OfflineIndicator className="app-offline-indicator" />
        <SettingsButton className="app-settings-button" position="fixed" />
        {showCompatibilityCheck && (
          <CompatibilityCheck 
            onComplete={handleCompatibilityComplete}
            showDetails={true}
            className="app-compatibility-check"
          />
        )}
        <ErrorMessage errorState={errorState} onDismiss={clearError} />
      
      {appState === 'compatibility' && (
        <CompatibilityCheck
          onComplete={handleCompatibilityComplete}
          showDetails={true}
          className="app-compatibility-check"
        />
      )}

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
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button onClick={handleRestart}>
                最初からやり直す
              </button>
              <button 
                onClick={() => setShowCompatibilityCheck(true)}
                style={{ background: '#3498db', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
              >
                互換性をチェック
              </button>
              {import.meta.env.DEV && (
                <>
                  <button 
                    onClick={() => setShowPerformancePanel(true)}
                    style={{ background: '#9b59b6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    パフォーマンス
                  </button>
                  <button 
                    onClick={() => setShowTestRunner(true)}
                    style={{ background: '#e67e22', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    テスト実行
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Development panels */}
        <PerformancePanel 
          isOpen={showPerformancePanel}
          onClose={() => setShowPerformancePanel(false)}
        />
        <TestRunner
          isOpen={showTestRunner}
          onClose={() => setShowTestRunner(false)}
        />
      </div>
    </ErrorBoundary>
  )
}

export default App
