import { useState, useEffect, useRef } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useAnnouncer } from '../hooks/useAnnouncer';
import CameraGuide from './CameraGuide';
import ImageUpload from './ImageUpload';

interface ImageData {
  blob: Blob;
  width: number;
  height: number;
  timestamp: number;
  viewType: 'frontal' | 'sagittal';
}

interface CaptureScreenProps {
  onImagesCapture: (frontal: ImageData, sagittal: ImageData) => void;
  onError: (error: Error) => void;
}

export default function CaptureScreen({ onImagesCapture, onError }: CaptureScreenProps) {
  const [currentView, setCurrentView] = useState<'frontal' | 'sagittal'>('frontal');
  const [frontalImage, setFrontalImage] = useState<ImageData | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAligned, setIsAligned] = useState(false);
  const [captureMode, setCaptureMode] = useState<'camera' | 'upload'>('camera');
  
  const captureButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { 
    videoRef, 
    canvasRef, 
    cameraState, 
    capabilities, 
    initializeCamera, 
    capturePhoto, 
    stopCamera 
  } = useCamera();
  
  const { announceAction, announceStatus } = useAnnouncer();
  useKeyboardNavigation({
    onSpace: () => {
      if (captureMode === 'camera' && isAligned && captureButtonRef.current) {
        captureButtonRef.current.click();
      }
    },
    onTab: (event) => {
      // Implement focus trap within capture screen
      if (containerRef.current && event.shiftKey && document.activeElement === containerRef.current.querySelector('button')) {
        event.preventDefault();
        const lastFocusable = containerRef.current.querySelector('button:last-of-type') as HTMLElement;
        lastFocusable?.focus();
      }
    }
  });

  useEffect(() => {
    // Initialize camera only in camera mode
    if (captureMode === 'camera') {
      announceStatus('カメラモードに切り替えました');
      
      // Add a small delay to prevent immediate startup errors
      const timeoutId = setTimeout(() => {
        console.log('[CaptureScreen] Starting camera initialization after delay');
        initializeCamera('user').catch((error) => {
          console.error('[CaptureScreen] Camera initialization error:', error);
          announceAction('カメラの起動に失敗しました');
          onError(error);
        });
      }, 500); // 500ms delay
      
      // Cleanup timeout on unmount or mode change
      return () => {
        clearTimeout(timeoutId);
        stopCamera();
      };
    } else {
      announceStatus('アップロードモードに切り替えました');
      stopCamera();
    }
    
    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, [captureMode]);

  // TODO: Implement real-time alignment detection using MediaPipe
  useEffect(() => {
    if (cameraState.hasPermission) {
      // For now, always consider aligned to allow capture
      // TODO: Implement actual pose detection for alignment guidance
      setIsAligned(true);
    }
  }, [cameraState.hasPermission]);

  const handleCapture = async () => {
    if (!cameraState.hasPermission || isCapturing) return;
    
    setIsCapturing(true);
    announceAction(`${currentView === 'frontal' ? '正面' : '側面'}画像を撮影中`);
    
    try {
      const blob = await capturePhoto();
      const imageData: ImageData = {
        blob,
        width: capabilities?.width || 0,
        height: capabilities?.height || 0,
        timestamp: Date.now(),
        viewType: currentView
      };

      if (currentView === 'frontal') {
        setFrontalImage(imageData);
        setCurrentView('sagittal');
        announceStatus('正面画像を撮影しました。次に側面画像を撮影してください。');
      } else if (frontalImage) {
        // Both images captured, proceed to analysis
        announceStatus('側面画像を撮影しました。分析を開始します。');
        onImagesCapture(frontalImage, imageData);
      }
    } catch (error) {
      announceAction('撮影に失敗しました');
      onError(error as Error);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    if (currentView === 'sagittal') {
      setCurrentView('frontal');
      setFrontalImage(null);
    }
  };

  const handleSkipGuide = () => {
    // Allow capture even if not perfectly aligned
    setIsAligned(true);
  };

  const handleImageUpload = async (file: File) => {
    try {
      // Convert file to blob
      const blob = new Blob([file], { type: file.type });
      
      // Get image dimensions
      const img = new Image();
      const imageUrl = URL.createObjectURL(blob);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(imageUrl);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          reject(new Error('画像の読み込みに失敗しました'));
        };
        img.src = imageUrl;
      });

      const imageData: ImageData = {
        blob,
        width: img.naturalWidth,
        height: img.naturalHeight,
        timestamp: Date.now(),
        viewType: currentView
      };

      if (currentView === 'frontal') {
        setFrontalImage(imageData);
        setCurrentView('sagittal');
      } else if (frontalImage) {
        // Both images uploaded, proceed to analysis
        onImagesCapture(frontalImage, imageData);
      }
    } catch (error) {
      onError(error as Error);
    }
  };

  const handleUploadError = (error: string) => {
    onError(new Error(error));
  };

  if (cameraState.error) {
    return (
      <div className="capture-screen">
        <div className="error-message" style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>📷 カメラエラー</h2>
          <p style={{ marginBottom: '2rem', fontSize: '1.1rem' }}>{cameraState.error}</p>
          
          <div style={{ background: '#f0f4f8', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', textAlign: 'left' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>トラブルシューティング:</h3>
            <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
              <li>ブラウザのアドレスバー付近のカメラアイコンをクリックしてアクセスを許可</li>
              <li>他のアプリがカメラを使用していないか確認</li>
              <li>ブラウザを再起動してから再度お試しください</li>
              {captureMode === 'camera' && (
                <li>それでも解決しない場合は「写真を選択」モードをご利用ください</li>
              )}
            </ol>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={() => {
                console.log('[CaptureScreen] Retrying camera initialization');
                initializeCamera('user').catch((error) => {
                  console.error('[CaptureScreen] Retry failed:', error);
                  onError(error);
                });
              }} 
              className="btn-primary"
              style={{ padding: '0.75rem 2rem' }}
            >
              🔄 再試行
            </button>
            {captureMode === 'camera' && (
              <button 
                onClick={() => setCaptureMode('upload')} 
                className="btn-secondary"
                style={{ padding: '0.75rem 2rem' }}
              >
                📁 写真を選択
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="capture-screen" ref={containerRef}>
      <div className="capture-header">
        <h1>姿勢分析</h1>
        <p aria-live="polite" aria-atomic="true">
          {currentView === 'frontal' ? '前額面' : '矢状面'}の{captureMode === 'camera' ? '撮影' : '画像選択'}
          {frontalImage && currentView === 'sagittal' && ' (2/2)'}
        </p>
        
        <div className="mode-selector" role="tablist" aria-label="撮影モード選択">
          <button
            role="tab"
            aria-selected={captureMode === 'camera'}
            aria-controls="capture-panel"
            onClick={() => setCaptureMode('camera')}
            className={`mode-button ${captureMode === 'camera' ? 'active' : ''}`}
          >
            📷 カメラ撮影
          </button>
          <button
            role="tab"
            aria-selected={captureMode === 'upload'}
            aria-controls="capture-panel"
            onClick={() => setCaptureMode('upload')}
            className={`mode-button ${captureMode === 'upload' ? 'active' : ''}`}
          >
            📁 写真を選択
          </button>
        </div>
      </div>

      <div className="camera-container" id="capture-panel" role="tabpanel">
        <div className="camera-preview" aria-label={`${currentView === 'frontal' ? '正面' : '側面'}画像プレビュー`}>
          {captureMode === 'camera' ? (
            cameraState.isLoading ? (
              <div className="camera-placeholder">
                <div className="loading-spinner"></div>
                <p>カメラを初期化中...</p>
              </div>
            ) : cameraState.hasPermission ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="camera-video"
                  aria-label="カメラプレビュー"
                />
                <CameraGuide viewType={currentView} isAligned={isAligned} />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </>
            ) : (
              <div className="camera-placeholder">
                カメラへのアクセスを許可してください
              </div>
            )
          ) : (
            <ImageUpload
              viewType={currentView}
              onImageUpload={handleImageUpload}
              onError={handleUploadError}
            />
          )}
        </div>
      </div>

      <div className="capture-controls">
        {captureMode === 'camera' && (
          <>
            <button
              ref={captureButtonRef}
              onClick={handleCapture}
              disabled={isCapturing || !cameraState.hasPermission || cameraState.isLoading}
              className="capture-button"
              aria-label={`${currentView === 'frontal' ? '正面' : '側面'}画像を撮影`}
              aria-describedby="capture-instructions"
              style={{
                backgroundColor: isAligned ? 'var(--color-accent)' : 'var(--color-border)',
                transform: isCapturing ? 'scale(0.95)' : 'scale(1)'
              }}
            >
              {isCapturing ? '撮影中...' : '撮影'}
            </button>
            
            {!isAligned && cameraState.hasPermission && (
              <button onClick={handleSkipGuide} className="btn-secondary">
                位置調整をスキップ
              </button>
            )}
          </>
        )}
        
        {currentView === 'sagittal' && frontalImage && (
          <button onClick={handleRetake} className="btn-secondary">
            前額面をやり直す
          </button>
        )}
      </div>

      <div className="capture-progress">
        {frontalImage && (
          <div className="progress-indicator">
            <div className="step completed">1. 前額面 ✓</div>
            <div className={`step ${currentView === 'sagittal' ? 'active' : ''}`}>
              2. 矢状面
            </div>
          </div>
        )}
      </div>

      <div className="capture-instructions" id="capture-instructions">
        <h2>{captureMode === 'camera' ? '撮影' : '画像選択'}のポイント</h2>
        <ul>
          {captureMode === 'camera' ? (
            <>
              <li>スマートフォンを縦向き（ポートレートモード）で持ってください</li>
              <li>十分な照明を確保してください</li>
              <li>背景はシンプルに保ってください</li>
              <li>{currentView === 'frontal' ? '肩、骨盤、頭部' : '耳と肩'}がフレーム内に収まるようにしてください</li>
              {currentView === 'sagittal' && (
                <li>完全に横向きになって、耳のラインが見えるようにしてください</li>
              )}
            </>
          ) : (
            <>
              <li>縦向き（ポートレート）で撮影された写真を選択してください</li>
              <li>十分な明るさで、背景がシンプルな写真を選択してください</li>
              <li>{currentView === 'frontal' ? '正面から撮影された' : '完全に側面から撮影された'}写真を選択してください</li>
              <li>全身が写っている写真を選択してください</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}