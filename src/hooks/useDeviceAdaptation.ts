import { useState, useEffect, useCallback } from 'react';
import { deviceDetection, type DeviceInfo } from '../utils/deviceDetection';
import { compatibilityChecker, type CompatibilityResult } from '../utils/compatibilityChecker';

interface DeviceAdaptationConfig {
  // UI Settings
  uiScale: number;
  touchTargetSize: number;
  gestureSupport: boolean;
  
  // Performance Settings
  imageQuality: number;
  processingTimeout: number;
  enableOptimizations: boolean;
  
  // Feature Settings
  enableOffline: boolean;
  enableCamera: boolean;
  enableBackgroundProcessing: boolean;
  
  // Layout Settings
  layoutMode: 'mobile' | 'tablet' | 'desktop';
  orientationLock: boolean;
}

interface UseDeviceAdaptationReturn {
  deviceInfo: DeviceInfo | null;
  compatibilityResult: CompatibilityResult | null;
  config: DeviceAdaptationConfig;
  isLoading: boolean;
  error: string | null;
  updateConfig: (updates: Partial<DeviceAdaptationConfig>) => void;
  refreshDeviceInfo: () => Promise<void>;
  getOptimalImageConstraints: () => MediaTrackConstraints;
  getRecommendedSettings: () => Partial<DeviceAdaptationConfig>;
}

const DEFAULT_CONFIG: DeviceAdaptationConfig = {
  uiScale: 1.0,
  touchTargetSize: 44,
  gestureSupport: true,
  imageQuality: 0.8,
  processingTimeout: 30000,
  enableOptimizations: true,
  enableOffline: true,
  enableCamera: true,
  enableBackgroundProcessing: true,
  layoutMode: 'desktop',
  orientationLock: false
};

export const useDeviceAdaptation = (): UseDeviceAdaptationReturn => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [compatibilityResult, setCompatibilityResult] = useState<CompatibilityResult | null>(null);
  const [config, setConfig] = useState<DeviceAdaptationConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize device detection and adaptation
  useEffect(() => {
    initializeDeviceAdaptation();
  }, []);

  // Monitor device changes
  useEffect(() => {
    if (!deviceInfo) return;

    const cleanup = deviceDetection.onDeviceChange(() => {
      refreshDeviceInfo();
    });

    return cleanup;
  }, [deviceInfo]);

  const initializeDeviceAdaptation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get device information and compatibility
      const [devInfo, compatResult] = await Promise.all([
        deviceDetection.getDeviceInfo(),
        compatibilityChecker.checkCompatibility()
      ]);

      setDeviceInfo(devInfo);
      setCompatibilityResult(compatResult);

      // Apply device-specific configuration
      const adaptedConfig = adaptConfigForDevice(devInfo, compatResult);
      setConfig(adaptedConfig);

      console.log('Device adaptation initialized:', { devInfo, compatResult, adaptedConfig });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'デバイス情報の取得に失敗しました';
      setError(errorMessage);
      console.error('Device adaptation initialization failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDeviceInfo = async () => {
    try {
      const newDeviceInfo = await deviceDetection.getDeviceInfo();
      setDeviceInfo(newDeviceInfo);

      // Update config if device characteristics changed
      const currentLayoutMode = getLayoutMode(newDeviceInfo);
      if (currentLayoutMode !== config.layoutMode) {
        const newConfig = adaptConfigForDevice(newDeviceInfo, compatibilityResult);
        setConfig(newConfig);
      }
    } catch (err) {
      console.error('Failed to refresh device info:', err);
    }
  };

  const adaptConfigForDevice = (
    devInfo: DeviceInfo,
    compatResult: CompatibilityResult | null
  ): DeviceAdaptationConfig => {
    const newConfig: DeviceAdaptationConfig = { ...DEFAULT_CONFIG };

    // Adapt based on device type
    if (devInfo.isMobile) {
      newConfig.layoutMode = 'mobile';
      newConfig.uiScale = 1.2;
      newConfig.touchTargetSize = 48;
      newConfig.imageQuality = 0.7;
      newConfig.processingTimeout = 45000;
      newConfig.orientationLock = true;
    } else if (devInfo.isTablet) {
      newConfig.layoutMode = 'tablet';
      newConfig.uiScale = 1.1;
      newConfig.touchTargetSize = 46;
      newConfig.imageQuality = 0.85;
      newConfig.processingTimeout = 35000;
      newConfig.orientationLock = false;
    } else {
      newConfig.layoutMode = 'desktop';
      newConfig.uiScale = 1.0;
      newConfig.touchTargetSize = devInfo.hasTouchScreen ? 44 : 32;
      newConfig.imageQuality = 0.9;
      newConfig.processingTimeout = 25000;
      newConfig.orientationLock = false;
    }

    // Adapt based on platform
    if (devInfo.platform === 'ios') {
      newConfig.gestureSupport = true;
      newConfig.enableBackgroundProcessing = false; // iOS restrictions
    } else if (devInfo.platform === 'android') {
      newConfig.gestureSupport = true;
    }

    // Adapt based on performance capabilities
    if (devInfo.pixelRatio > 2) {
      newConfig.imageQuality *= 0.9; // Reduce quality for high-DPI displays
    }

    if (!devInfo.supportsWebGL || !devInfo.supportsWebAssembly) {
      newConfig.enableOptimizations = false;
      newConfig.processingTimeout *= 1.5;
      newConfig.imageQuality *= 0.8;
    }

    // Adapt based on compatibility results
    if (compatResult) {
      if (compatResult.level === 'partial' || compatResult.score < 80) {
        newConfig.enableOptimizations = false;
        newConfig.processingTimeout *= 1.3;
      }

      if (!compatResult.isSupported) {
        newConfig.enableCamera = false;
        newConfig.enableBackgroundProcessing = false;
      }

      // Disable features based on specific issues
      const hasServiceWorkerIssue = compatResult.issues.some(
        issue => issue.feature === 'Service Worker' && issue.severity === 'error'
      );
      if (hasServiceWorkerIssue) {
        newConfig.enableOffline = false;
      }

      const hasCameraIssue = compatResult.issues.some(
        issue => issue.feature === 'Camera' && issue.severity === 'error'
      );
      if (hasCameraIssue) {
        newConfig.enableCamera = false;
      }
    }

    return newConfig;
  };

  const getLayoutMode = (devInfo: DeviceInfo): 'mobile' | 'tablet' | 'desktop' => {
    if (devInfo.isMobile) return 'mobile';
    if (devInfo.isTablet) return 'tablet';
    return 'desktop';
  };

  const updateConfig = useCallback((updates: Partial<DeviceAdaptationConfig>) => {
    setConfig(prevConfig => ({ ...prevConfig, ...updates }));
  }, []);

  const getOptimalImageConstraints = useCallback((): MediaTrackConstraints => {
    if (!deviceInfo) return {};

    const baseConstraints: MediaTrackConstraints = {
      facingMode: { ideal: 'user' },
      frameRate: { ideal: 30, max: 30 }
    };

    if (deviceInfo.isMobile) {
      return {
        ...baseConstraints,
        width: { ideal: 720, max: 1280 },
        height: { ideal: 1280, max: 1920 },
        aspectRatio: { ideal: 9/16 }
      };
    } else if (deviceInfo.isTablet) {
      return {
        ...baseConstraints,
        width: { ideal: 1080, max: 1920 },
        height: { ideal: 1920, max: 2560 },
        aspectRatio: { ideal: 9/16 }
      };
    } else {
      return {
        ...baseConstraints,
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        aspectRatio: { ideal: 16/9 }
      };
    }
  }, [deviceInfo]);

  const getRecommendedSettings = useCallback((): Partial<DeviceAdaptationConfig> => {
    if (!deviceInfo || !compatibilityResult) return {};

    const recommendations = deviceDetection.getDeviceRecommendations(deviceInfo);
    
    return {
      imageQuality: recommendations.imageQuality,
      processingTimeout: recommendations.processingTimeout,
      enableOptimizations: compatibilityResult.score > 70,
      enableOffline: compatibilityResult.level !== 'unsupported' && config.enableOffline,
      enableBackgroundProcessing: deviceInfo.supportsWebAssembly && deviceInfo.supportsWebGL
    };
  }, [deviceInfo, compatibilityResult, config.enableOffline]);

  return {
    deviceInfo,
    compatibilityResult,
    config,
    isLoading,
    error,
    updateConfig,
    refreshDeviceInfo,
    getOptimalImageConstraints,
    getRecommendedSettings
  };
};

// Utility hook for responsive breakpoints
export const useResponsiveBreakpoints = () => {
  const [breakpoint, setBreakpoint] = useState<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('lg');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 576) setBreakpoint('xs');
      else if (width < 768) setBreakpoint('sm');
      else if (width < 992) setBreakpoint('md');
      else if (width < 1200) setBreakpoint('lg');
      else setBreakpoint('xl');
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);

    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return {
    breakpoint,
    isXs: breakpoint === 'xs',
    isSm: breakpoint === 'sm',
    isMd: breakpoint === 'md',
    isLg: breakpoint === 'lg',
    isXl: breakpoint === 'xl',
    isMobile: breakpoint === 'xs' || breakpoint === 'sm',
    isTablet: breakpoint === 'md',
    isDesktop: breakpoint === 'lg' || breakpoint === 'xl'
  };
};