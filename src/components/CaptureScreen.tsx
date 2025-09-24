import { useState, useEffect, useRef, useCallback } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useAnnouncer } from '../hooks/useAnnouncer';
import type { ImageData } from '../types';
import CameraGuide from './CameraGuide';
import ImageUpload from './ImageUpload';
import LoadingSpinner from './LoadingSpinner';
import { mediaPipeService } from '../services/MediaPipeService';
import type { MediaPipeDetectionResult } from '../services/MediaPipeService';

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
  const [alignmentMessage, setAlignmentMessage] = useState('身体の位置を調整してください');
  const [alignmentConfidence, setAlignmentConfidence] = useState<number | null>(null);
  const [alignmentOverride, setAlignmentOverride] = useState(false);

  const captureButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const alignmentCheckInProgress = useRef(false);
  const onErrorRef = useRef(onError);

  const { 
    videoRef, 
    canvasRef, 
    cameraState, 
    capabilities, 
    initializeCamera, 
    capturePhoto, 
    grabFrame, 
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
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (captureMode !== 'camera') {
      announceStatus('アップロードモードに切り替えました');
      setAlignmentOverride(false);
      setAlignmentConfidence(null);
      setIsAligned(false);
      stopCamera();
      return;
    }

    announceStatus('カメラモードに切り替えました');
    setIsAligned(false);
    setAlignmentConfidence(null);
    setAlignmentOverride(false);

    // Check if camera is already initialized and working
    if (cameraState.hasPermission && cameraState.stream && !cameraState.isLoading) {
      console.log('[CaptureScreen] Camera already initialized, skipping');
      return;
    }

    const timeoutId = window.setTimeout(() => {
      console.log('[CaptureScreen] Starting camera initialization after delay');
      initializeCamera('user').catch((error) => {
        console.error('[CaptureScreen] Camera initialization error:', error);
        announceAction('カメラの起動に失敗しました');
        onErrorRef.current?.(error);
      });
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [captureMode, announceAction, announceStatus, initializeCamera, stopCamera]);

  useEffect(() => {
    if (captureMode === 'camera') {
      const baseMessage = currentView === 'frontal'
        ? '正面から全身が映る位置に立ち、肩と骨盤を水平に合わせてください'
        : '側面から耳・肩・腰・くるぶしが一直線になる位置に立ってください';
      setAlignmentMessage(baseMessage);
      setIsAligned(false);
      setAlignmentConfidence(null);
      setAlignmentOverride(false);
    }
  }, [captureMode, currentView]);

  useEffect(() => {
    if (captureMode !== 'camera' || !cameraState.hasPermission || cameraState.isLoading) {
      return;
    }

    let isUnmounted = false;
    let intervalId: number | null = null;

    const ensureMediaPipeInitialized = async () => {
      try {
        await mediaPipeService.initialize();
      } catch (error) {
        console.error('[CaptureScreen] Failed to initialize MediaPipe for alignment check:', error);
      }
    };

    const evaluateAlignment = (detection: MediaPipeDetectionResult) => {
      const { landmarks, confidence } = detection;

      const viewSpecificGuidance = currentView === 'frontal'
        ? '肩と骨盤の高さを揃え、中央に立ってください'
        : '耳と肩・腰が一直線になるように立ってください';

      if (!landmarks || landmarks.length === 0 || confidence < 0.4) {
        return {
          aligned: false,
          message: viewSpecificGuidance,
          confidence: null as number | null
        };
      }

      const getLandmark = (index: number) => landmarks[index];

      if (currentView === 'frontal') {
        const leftShoulder = getLandmark(11);
        const rightShoulder = getLandmark(12);
        const leftHip = getLandmark(23);
        const rightHip = getLandmark(24);

        if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
          return { aligned: false, message: viewSpecificGuidance, confidence: confidence };
        }

        const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
        const hipDiff = Math.abs(leftHip.y - rightHip.y);
        const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;

        const centered = shoulderCenterX > 0.35 && shoulderCenterX < 0.65;
        const shouldersLevel = shoulderDiff < 0.04;
        const hipsLevel = hipDiff < 0.04;

        if (centered && shouldersLevel && hipsLevel) {
          return {
            aligned: true,
            message: '良い位置です。そのまま撮影できます。',
            confidence
          };
        }

        if (!centered) {
          return {
            aligned: false,
            message: '体が中央から外れています。中央に立ち直してください。',
            confidence
          };
        }

        if (!shouldersLevel) {
          return {
            aligned: false,
            message: '肩の高さを揃えてください。',
            confidence
          };
        }

        if (!hipsLevel) {
          return {
            aligned: false,
            message: '骨盤の高さを揃えてください。',
            confidence
          };
        }

        return {
          aligned: false,
          message: viewSpecificGuidance,
          confidence
        };
      }

      const primaryShoulder = getLandmark(11);
      const secondaryShoulder = getLandmark(12);
      const hip = getLandmark(23);
      const ankle = getLandmark(27);
      const ear = getLandmark(7) || getLandmark(8);

      if (!primaryShoulder || !hip || !ankle || !ear) {
        return { aligned: false, message: viewSpecificGuidance, confidence };
      }

      const shoulderX = primaryShoulder.visibility >= (secondaryShoulder?.visibility || 0)
        ? primaryShoulder.x
        : (secondaryShoulder?.x ?? primaryShoulder.x);
      const hipX = hip.x;
      const ankleX = ankle.x;
      const earX = ear.x;

      const verticalAlignment = Math.max(
        Math.abs(shoulderX - hipX),
        Math.abs(hipX - ankleX)
      );

      const earShoulderOffset = Math.abs(earX - shoulderX);
      const centered = shoulderX > 0.25 && shoulderX < 0.75;

      const verticalAligned = verticalAlignment < 0.08;
      const headAligned = earShoulderOffset < 0.12;

      if (centered && verticalAligned && headAligned) {
        return {
          aligned: true,
          message: '良い位置です。そのまま撮影できます。',
          confidence
        };
      }

      if (!centered) {
        return {
          aligned: false,
          message: '体が中央から外れています。画面中央で横向きになってください。',
          confidence
        };
      }

      if (!verticalAligned) {
        return {
          aligned: false,
          message: '肩・腰・足首が垂直に並ぶよう姿勢を調整してください。',
          confidence
        };
      }

      if (!headAligned) {
        return {
          aligned: false,
          message: '頭が前後に傾いています。耳が肩の真上に来るよう調整してください。',
          confidence
        };
      }

      return {
        aligned: false,
        message: viewSpecificGuidance,
        confidence
      };
    };

    const performAlignmentCheck = async () => {
      if (alignmentCheckInProgress.current || isCapturing || alignmentOverride) {
        return;
      }

      alignmentCheckInProgress.current = true;

      try {
        const videoElement = videoRef.current;
        if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          return;
        }

        const frame = await grabFrame();
        const detection = await mediaPipeService.detectPose(frame);
        const result = evaluateAlignment(detection);
        if (!alignmentOverride) {
          setIsAligned(result.aligned);
          setAlignmentMessage(result.message);
          setAlignmentConfidence(result.confidence);
        }
      } catch (err) {
        console.warn('[CaptureScreen] Alignment check failed:', err);
        if (!alignmentOverride) {
          setIsAligned(false);
          setAlignmentConfidence(null);
          const fallbackMessage = currentView === 'frontal'
            ? '全身が映るように立ってください。'
            : '横向きの姿勢が認識できません。位置を調整してください。';
          setAlignmentMessage(fallbackMessage);
        }
      } finally {
        alignmentCheckInProgress.current = false;
      }
    };

    const start = async () => {
      await ensureMediaPipeInitialized();
      if (isUnmounted) return;
      await performAlignmentCheck();
      intervalId = window.setInterval(performAlignmentCheck, 2000);
    };

    start();

    return () => {
      isUnmounted = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [alignmentOverride, captureMode, cameraState.hasPermission, cameraState.isLoading, currentView, grabFrame, isCapturing, videoRef]);

  const handleCapture = useCallback(async () => {
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
  }, [cameraState.hasPermission, isCapturing, currentView, announceAction, capturePhoto, capabilities, frontalImage, onImagesCapture, announceStatus, onError]);

  const handleRetake = useCallback(() => {
    if (currentView === 'sagittal') {
      setCurrentView('frontal');
      setFrontalImage(null);
      setAlignmentOverride(false);
    }
  }, [currentView]);

  const handleSkipGuide = useCallback(() => {
    // Allow capture even if not perfectly aligned
    setAlignmentOverride(true);
    setIsAligned(true);
    setAlignmentConfidence(null);
    setAlignmentMessage('ガイドをスキップしました。撮影する準備ができています。');
  }, []);

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
          {captureMode === 'camera' && (
            <div 
              className={`alignment-status ${isAligned ? 'aligned' : 'not-aligned'}`}
              role="status"
              aria-live="polite"
            >
              <div className="alignment-status-text">{alignmentMessage}</div>
              {alignmentConfidence !== null && (
                <div className="alignment-confidence">
                  信頼度: {(alignmentConfidence * 100).toFixed(0)}%
                </div>
              )}
            </div>
          )}
          {captureMode === 'camera' ? (
            cameraState.isLoading ? (
              <LoadingSpinner message="カメラを初期化中..." />
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
