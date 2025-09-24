import { useRef, useEffect, useState, useCallback } from 'react';

interface CameraState {
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
}

interface CameraCapabilities {
  width: number;
  height: number;
  facingMode: string;
}

const isIOSDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  const iOSPattern = /iphone|ipad|ipod/gi;
  const isIOSUA = iOSPattern.test(ua);
  const isIOSMacTouch = platform === 'macintel' && navigator.maxTouchPoints > 1;
  return isIOSUA || isIOSMacTouch;
};

const buildConstraintCandidates = (facingMode: 'user' | 'environment'): MediaStreamConstraints[] => {
  const isIOS = isIOSDevice();

  const baseResolutions = isIOS
    ? [
        { width: { ideal: 640 }, height: { ideal: 960 } },
        { width: { ideal: 720 }, height: { ideal: 1280 } },
        { width: { ideal: 960 }, height: { ideal: 1280 } },
        { width: { ideal: 1080 }, height: { ideal: 1920 } }
      ]
    : [
        { width: { ideal: 1080 }, height: { ideal: 1920 } },
        { width: { ideal: 960 }, height: { ideal: 1280 } },
        { width: { ideal: 720 }, height: { ideal: 1280 } },
        { width: { ideal: 640 }, height: { ideal: 960 } }
      ];

  const facingConstraint: MediaTrackConstraints['facingMode'] = isIOS
    ? { ideal: facingMode }
    : facingMode;

  const candidates: MediaStreamConstraints[] = baseResolutions.map((resolution) => ({
    video: {
      facingMode: facingConstraint,
      width: resolution.width,
      height: resolution.height,
      frameRate: { ideal: 30, max: 30 }
    },
    audio: false
  }));

  candidates.push({
    video: {
      facingMode: facingConstraint,
      frameRate: { ideal: 30 }
    },
    audio: false
  });

  candidates.push({ video: true, audio: false });

  return candidates;
};

const waitForVideoReady = async (video: HTMLVideoElement, timeout = 5000) => {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('ビデオの準備がタイムアウトしました'));
    }, timeout);

    const checkReady = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
        clearTimeout(timeoutId);
        resolve();
      } else {
        requestAnimationFrame(checkReady);
      }
    };

    checkReady();
  });
};

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [cameraState, setCameraState] = useState<CameraState>({
    stream: null,
    isLoading: false,
    error: null,
    hasPermission: false
  });

  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);

  const initializeCamera = useCallback(async (facingMode: 'user' | 'environment' = 'user') => {
    console.log('[Camera] Starting camera initialization:', { facingMode, timestamp: new Date().toISOString() });
    setCameraState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('[Camera] Environment check:', {
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        hasNavigator: !!navigator,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        userAgent: navigator.userAgent
      });

      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          console.log('[Camera] Available devices:', {
            total: devices.length,
            videoDevices: videoDevices.length,
            devices: videoDevices.map(d => ({ label: d.label, deviceId: d.deviceId }))
          });
        } catch (enumerateError) {
          console.warn('[Camera] Could not enumerate devices:', enumerateError);
        }
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('[Camera] getUserMedia not supported');
        throw new Error('カメラアクセスがサポートされていません');
      }

      const constraintCandidates = buildConstraintCandidates(facingMode);
      let stream: MediaStream | null = null;
      let lastError: unknown = null;

      for (const candidate of constraintCandidates) {
        try {
          console.log('[Camera] Attempting getUserMedia with constraints:', candidate);
          stream = await navigator.mediaDevices.getUserMedia(candidate);
          console.log('[Camera] Stream obtained with constraints:', candidate.video);
          break;
        } catch (candidateError) {
          lastError = candidateError;
          const err = candidateError as DOMException;
          console.warn('[Camera] Constraint attempt failed:', {
            name: err?.name,
            message: err?.message,
            constraints: candidate
          });
        }
      }

      if (!stream) {
        throw lastError instanceof Error
          ? lastError
          : new Error('適切なカメラ制約が見つかりませんでした');
      }

      if (videoRef.current) {
        const video = videoRef.current;
        console.log('[Camera] Setting video stream');
        video.srcObject = stream;

        await new Promise<void>((resolve, reject) => {
          const handleLoaded = async () => {
            video.onloadedmetadata = null;
            video.onerror = null;
            try {
              await video.play();
              resolve();
            } catch (playError) {
              reject(playError);
            }
          };

          const handleError = () => {
            video.onloadedmetadata = null;
            video.onerror = null;
            reject(new Error('ビデオの読み込みに失敗しました'));
          };

          video.onloadedmetadata = handleLoaded;
          video.onerror = handleError;

          if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            handleLoaded();
          }
        });

        await waitForVideoReady(video);
      }

      const videoTrack = stream.getVideoTracks()[0];
      const trackCapabilities = typeof videoTrack.getCapabilities === 'function'
        ? videoTrack.getCapabilities()
        : ({} as MediaTrackCapabilities);
      const trackSettings = typeof videoTrack.getSettings === 'function'
        ? videoTrack.getSettings()
        : ({} as MediaTrackSettings);
      
      setCapabilities({
        width: videoRef.current?.videoWidth || trackSettings.width || 0,
        height: videoRef.current?.videoHeight || trackSettings.height || 0,
        facingMode: trackCapabilities.facingMode?.[0] || trackSettings.facingMode || facingMode
      });

      setCameraState({
        stream,
        isLoading: false,
        error: null,
        hasPermission: true
      });

      console.log('[Camera] Camera initialization successful');
      return stream;
    } catch (error) {
      console.error('[Camera] Camera initialization failed:', error);
      let errorMessage = 'カメラの初期化に失敗しました';
      
      if (error instanceof Error) {
        console.error('[Camera] Error details:', { name: error.name, message: error.message });
        if (error.name === 'NotAllowedError') {
          errorMessage = 'カメラアクセスが拒否されました。ブラウザの設定でカメラへのアクセスを許可してください。';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'カメラが見つかりません。デバイスにカメラが接続されているか確認してください。';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'このブラウザではカメラがサポートされていません。';
        } else if (error.name === 'ConstraintNotSatisfiedError') {
          errorMessage = '指定されたカメラ設定に対応していません。別のデバイスまたは解像度をお試しください。';
        } else {
          errorMessage = error.message;
        }
      }

      setCameraState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        hasPermission: false
      }));
      
      throw new Error(errorMessage);
    }
  }, []);

  const capturePhoto = useCallback(async (): Promise<Blob> => {
    console.log('[Camera] capturePhoto called, checking refs:', {
      hasVideoRef: !!videoRef.current,
      hasCanvasRef: !!canvasRef.current,
      hasSrcObject: !!videoRef.current?.srcObject,
      videoWidth: videoRef.current?.videoWidth || 0,
      videoHeight: videoRef.current?.videoHeight || 0,
      readyState: videoRef.current?.readyState || 0,
      hasStateStream: !!cameraState.stream
    });

    if (!videoRef.current || !canvasRef.current) {
      throw new Error('カメラが初期化されていません');
    }

    const stream = (videoRef.current.srcObject as MediaStream | null) || cameraState.stream;
    if (!stream) {
      throw new Error('カメラストリームが接続されていません');
    }

    if (!videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    await waitForVideoReady(video);

    const videoWidth = video.videoWidth || stream.getVideoTracks()[0]?.getSettings().width || 0;
    const videoHeight = video.videoHeight || stream.getVideoTracks()[0]?.getSettings().height || 0;

    if (videoWidth === 0 || videoHeight === 0) {
      throw new Error('ビデオが正しく読み込まれていません');
    }

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas context が取得できません');
    }

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    
    console.log('[Camera] Capturing photo:', { width: canvas.width, height: canvas.height });

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('[Camera] Photo captured successfully:', { size: blob.size, type: blob.type });
            resolve(blob);
          } else {
            console.error('[Camera] toBlob returned null');
            reject(new Error('画像の生成に失敗しました'));
          }
        }, 'image/jpeg', 0.8);
      } catch (error) {
        console.error('[Camera] toBlob error:', error);
        reject(error);
      }
    });
  }, [cameraState.stream]);

  const grabFrame = useCallback(async (quality = 0.7): Promise<Blob> => {
    if (!videoRef.current || !canvasRef.current) {
      throw new Error('カメラが初期化されていません');
    }

    const stream = (videoRef.current.srcObject as MediaStream | null) || cameraState.stream;
    if (!stream) {
      throw new Error('カメラストリームが接続されていません');
    }

    if (!videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    await waitForVideoReady(video, 3000);

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error('ビデオフレームがまだ利用できません');
    }

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context が取得できません');
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('フレームの取得に失敗しました'));
          }
        }, 'image/jpeg', quality);
      } catch (error) {
        reject(error);
      }
    });
  }, [cameraState.stream]);

  const stopCamera = useCallback(() => {
    console.log('[Camera] Stopping camera');
    setCameraState(prev => {
      prev.stream?.getTracks().forEach(track => {
        console.log('[Camera] Stopping track:', track.kind);
        track.stop();
      });
      return {
        ...prev,
        stream: null,
        hasPermission: false
      };
    });

    if (videoRef.current) {
      console.log('[Camera] Clearing video srcObject');
      videoRef.current.srcObject = null;
    }
  }, []);

  const switchCamera = useCallback(async () => {
    if (capabilities) {
      stopCamera();
      const newFacingMode = capabilities.facingMode === 'user' ? 'environment' : 'user';
      await initializeCamera(newFacingMode);
    }
  }, [capabilities, initializeCamera, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    cameraState,
    capabilities,
    initializeCamera,
    capturePhoto,
    grabFrame,
    stopCamera,
    switchCamera
  };
}
