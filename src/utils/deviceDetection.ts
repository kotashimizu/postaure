// Device detection and platform compatibility utilities

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  platform: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';
  browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'unknown';
  hasCamera: boolean;
  hasTouchScreen: boolean;
  screenSize: 'small' | 'medium' | 'large';
  orientation: 'portrait' | 'landscape';
  pixelRatio: number;
  supportsWebGL: boolean;
  supportsWebAssembly: boolean;
  supportsServiceWorker: boolean;
  supportsMediaPipe: boolean;
}

export interface MediaCapabilities {
  hasUserMedia: boolean;
  hasGetDisplayMedia: boolean;
  supportedVideoFormats: string[];
  supportedImageFormats: string[];
  maxVideoResolution: { width: number; height: number };
  preferredCameraConstraints: MediaTrackConstraints;
}

class DeviceDetectionService {
  private deviceInfo: DeviceInfo | null = null;
  private mediaCapabilities: MediaCapabilities | null = null;

  // Get comprehensive device information
  async getDeviceInfo(): Promise<DeviceInfo> {
    if (this.deviceInfo) return this.deviceInfo;

    const userAgent = navigator.userAgent;
    const platform = this.detectPlatform(userAgent);
    const browser = this.detectBrowser(userAgent);
    const isMobile = this.isMobileDevice();
    const isTablet = this.isTabletDevice();
    const isDesktop = !isMobile && !isTablet;

    this.deviceInfo = {
      isMobile,
      isTablet,
      isDesktop,
      platform,
      browser,
      hasCamera: await this.checkCameraAvailability(),
      hasTouchScreen: this.checkTouchScreen(),
      screenSize: this.getScreenSize(),
      orientation: this.getOrientation(),
      pixelRatio: window.devicePixelRatio || 1,
      supportsWebGL: this.checkWebGLSupport(),
      supportsWebAssembly: this.checkWebAssemblySupport(),
      supportsServiceWorker: 'serviceWorker' in navigator,
      supportsMediaPipe: await this.checkMediaPipeSupport()
    };

    return this.deviceInfo;
  }

  // Get media capabilities
  async getMediaCapabilities(): Promise<MediaCapabilities> {
    if (this.mediaCapabilities) return this.mediaCapabilities;

    const hasUserMedia = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
    const hasGetDisplayMedia = 'mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices;
    
    const supportedVideoFormats = this.getSupportedVideoFormats();
    const supportedImageFormats = this.getSupportedImageFormats();
    const maxVideoResolution = await this.getMaxVideoResolution();
    const preferredCameraConstraints = this.getPreferredCameraConstraints();

    this.mediaCapabilities = {
      hasUserMedia,
      hasGetDisplayMedia,
      supportedVideoFormats,
      supportedImageFormats,
      maxVideoResolution,
      preferredCameraConstraints
    };

    return this.mediaCapabilities;
  }

  // Platform detection
  private detectPlatform(userAgent: string): DeviceInfo['platform'] {
    if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
    if (/Android/.test(userAgent)) return 'android';
    if (/Windows/.test(userAgent)) return 'windows';
    if (/Macintosh|Mac OS X/.test(userAgent)) return 'macos';
    if (/Linux/.test(userAgent)) return 'linux';
    return 'unknown';
  }

  // Browser detection
  private detectBrowser(userAgent: string): DeviceInfo['browser'] {
    if (/Chrome/.test(userAgent) && !/Edge/.test(userAgent)) return 'chrome';
    if (/Firefox/.test(userAgent)) return 'firefox';
    if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) return 'safari';
    if (/Edge/.test(userAgent)) return 'edge';
    if (/Opera/.test(userAgent)) return 'opera';
    return 'unknown';
  }

  // Mobile device detection
  private isMobileDevice(): boolean {
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  }

  // Tablet detection
  private isTabletDevice(): boolean {
    return /iPad|Android.*(?!.*Mobile)/i.test(navigator.userAgent) ||
           (window.innerWidth >= 768 && window.innerWidth <= 1024);
  }

  // Check camera availability
  private async checkCameraAvailability(): Promise<boolean> {
    try {
      if (!('mediaDevices' in navigator) || !('getUserMedia' in navigator.mediaDevices)) {
        return false;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'videoinput');
    } catch {
      return false;
    }
  }

  // Check touch screen support
  private checkTouchScreen(): boolean {
    return 'ontouchstart' in window ||
           navigator.maxTouchPoints > 0 ||
           // @ts-ignore - legacy property
           navigator.msMaxTouchPoints > 0;
  }

  // Get screen size category
  private getScreenSize(): DeviceInfo['screenSize'] {
    const width = window.innerWidth;
    if (width < 768) return 'small';
    if (width < 1024) return 'medium';
    return 'large';
  }

  // Get orientation
  private getOrientation(): DeviceInfo['orientation'] {
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  }

  // Check WebGL support
  private checkWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch {
      return false;
    }
  }

  // Check WebAssembly support
  private checkWebAssemblySupport(): boolean {
    try {
      return typeof WebAssembly === 'object' &&
             typeof WebAssembly.instantiate === 'function';
    } catch {
      return false;
    }
  }

  // Check MediaPipe support
  private async checkMediaPipeSupport(): Promise<boolean> {
    try {
      return this.checkWebAssemblySupport() && 
             this.checkWebGLSupport() &&
             'OffscreenCanvas' in window;
    } catch {
      return false;
    }
  }

  // Get supported video formats
  private getSupportedVideoFormats(): string[] {
    const video = document.createElement('video');
    const formats = [];

    const testFormats = [
      { codec: 'video/mp4; codecs="avc1.42E01E"', name: 'H.264' },
      { codec: 'video/webm; codecs="vp8"', name: 'VP8' },
      { codec: 'video/webm; codecs="vp9"', name: 'VP9' },
      { codec: 'video/ogg; codecs="theora"', name: 'Theora' }
    ];

    for (const format of testFormats) {
      if (video.canPlayType(format.codec) === 'probably' || 
          video.canPlayType(format.codec) === 'maybe') {
        formats.push(format.name);
      }
    }

    return formats;
  }

  // Get supported image formats
  private getSupportedImageFormats(): string[] {
    const formats = ['image/jpeg', 'image/png'];
    
    // Check for modern formats
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    try {
      // Check WebP support
      if (canvas.toDataURL('image/webp').startsWith('data:image/webp')) {
        formats.push('image/webp');
      }
    } catch {
      // WebP not supported
    }

    try {
      // Check AVIF support
      if (canvas.toDataURL('image/avif').startsWith('data:image/avif')) {
        formats.push('image/avif');
      }
    } catch {
      // AVIF not supported
    }

    return formats;
  }

  // Get maximum video resolution
  private async getMaxVideoResolution(): Promise<{ width: number; height: number }> {
    const deviceInfo = await this.getDeviceInfo();
    
    // Default resolutions based on device type
    if (deviceInfo.isMobile) {
      return { width: 1280, height: 720 }; // 720p for mobile
    } else if (deviceInfo.isTablet) {
      return { width: 1920, height: 1080 }; // 1080p for tablets
    } else {
      return { width: 2560, height: 1440 }; // 1440p for desktop
    }
  }

  // Get preferred camera constraints
  private getPreferredCameraConstraints(): MediaTrackConstraints {
    const isMobile = this.isMobileDevice();
    
    return {
      width: { ideal: isMobile ? 720 : 1280 },
      height: { ideal: isMobile ? 1280 : 720 },
      facingMode: { ideal: 'user' },
      frameRate: { ideal: 30, max: 30 }
    };
  }

  // Get device-specific recommendations
  getDeviceRecommendations(deviceInfo: DeviceInfo): {
    imageQuality: number;
    processingTimeout: number;
    cachingStrategy: 'aggressive' | 'conservative' | 'minimal';
    uiMode: 'touch' | 'mouse' | 'hybrid';
  } {
    let imageQuality = 0.8;
    let processingTimeout = 30000;
    let cachingStrategy: 'aggressive' | 'conservative' | 'minimal' = 'conservative';
    let uiMode: 'touch' | 'mouse' | 'hybrid' = 'hybrid';

    // Adjust based on device capabilities
    if (deviceInfo.isMobile) {
      imageQuality = 0.7;
      processingTimeout = 45000;
      cachingStrategy = 'minimal';
      uiMode = 'touch';
    } else if (deviceInfo.isTablet) {
      imageQuality = 0.85;
      processingTimeout = 35000;
      cachingStrategy = 'conservative';
      uiMode = 'touch';
    } else {
      imageQuality = 0.9;
      processingTimeout = 25000;
      cachingStrategy = 'aggressive';
      uiMode = 'mouse';
    }

    // Adjust for device performance indicators
    if (deviceInfo.pixelRatio > 2) {
      imageQuality *= 0.9; // Reduce quality for high-DPI displays
    }

    if (!deviceInfo.supportsWebGL || !deviceInfo.supportsWebAssembly) {
      processingTimeout *= 1.5; // Increase timeout for less capable devices
      cachingStrategy = 'minimal';
    }

    return {
      imageQuality: Math.max(0.3, Math.min(1.0, imageQuality)),
      processingTimeout,
      cachingStrategy,
      uiMode: deviceInfo.hasTouchScreen ? 'touch' : uiMode
    };
  }

  // Monitor device changes
  onDeviceChange(callback: () => void): () => void {
    const handleOrientationChange = () => {
      // Invalidate cached device info
      this.deviceInfo = null;
      callback();
    };

    const handleResize = () => {
      // Invalidate cached device info if screen size category changes
      const currentSize = this.getScreenSize();
      if (this.deviceInfo && this.deviceInfo.screenSize !== currentSize) {
        this.deviceInfo = null;
        callback();
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);

    // Return cleanup function
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
    };
  }
}

export const deviceDetection = new DeviceDetectionService();

// Utility functions for quick checks
export const isMobile = async () => {
  const deviceInfo = await deviceDetection.getDeviceInfo();
  return deviceInfo.isMobile;
};
export const isTablet = async () => {
  const deviceInfo = await deviceDetection.getDeviceInfo();
  return deviceInfo.isTablet;
};
export const isDesktop = async () => {
  const deviceInfo = await deviceDetection.getDeviceInfo();
  return deviceInfo.isDesktop;
};
export const hasTouch = async () => {
  const deviceInfo = await deviceDetection.getDeviceInfo();
  return deviceInfo.hasTouchScreen;
};