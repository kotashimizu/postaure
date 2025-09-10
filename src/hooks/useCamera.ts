import { useRef, useEffect, useState } from 'react';

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

  const initializeCamera = async (facingMode: 'user' | 'environment' = 'user') => {
    console.log('[Camera] Starting camera initialization:', { facingMode, timestamp: new Date().toISOString() });
    setCameraState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('[Camera] getUserMedia not supported');
        throw new Error('カメラアクセスがサポートされていません');
      }

      // Request camera access with constraints (portrait orientation)
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1080, max: 1920 },
          height: { ideal: 1920, max: 2160 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      };

      console.log('[Camera] Requesting camera access with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[Camera] Camera stream obtained:', { streamId: stream.id, tracks: stream.getTracks().length });
      
      // Set up video element
      if (videoRef.current) {
        console.log('[Camera] Setting video stream');
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              console.log('[Camera] Video metadata loaded');
              resolve();
            };
          }
        });
      }

      // Get actual capabilities
      const videoTrack = stream.getVideoTracks()[0];
      const trackCapabilities = videoTrack.getCapabilities();
      
      setCapabilities({
        width: videoRef.current?.videoWidth || 0,
        height: videoRef.current?.videoHeight || 0,
        facingMode: trackCapabilities.facingMode?.[0] || facingMode
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
  };

  const capturePhoto = async (): Promise<Blob> => {
    if (!videoRef.current || !canvasRef.current || !cameraState.stream) {
      throw new Error('カメラが初期化されていません');
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas context が取得できません');
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('画像の生成に失敗しました'));
        }
      }, 'image/png', 0.9);
    });
  };

  const stopCamera = () => {
    if (cameraState.stream) {
      cameraState.stream.getTracks().forEach(track => track.stop());
      setCameraState(prev => ({
        ...prev,
        stream: null,
        hasPermission: false
      }));
    }
  };

  const switchCamera = async () => {
    if (capabilities) {
      stopCamera();
      const newFacingMode = capabilities.facingMode === 'user' ? 'environment' : 'user';
      await initializeCamera(newFacingMode);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    cameraState,
    capabilities,
    initializeCamera,
    capturePhoto,
    stopCamera,
    switchCamera
  };
}