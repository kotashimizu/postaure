// Browser and feature compatibility checker

export interface CompatibilityResult {
  isSupported: boolean;
  level: 'full' | 'partial' | 'unsupported';
  score: number; // 0-100
  issues: CompatibilityIssue[];
  recommendations: string[];
}

export interface CompatibilityIssue {
  severity: 'error' | 'warning' | 'info';
  feature: string;
  description: string;
  solution?: string;
}

export interface RequiredFeatures {
  camera: boolean;
  webAssembly: boolean;
  webGL: boolean;
  serviceWorker: boolean;
  offscreenCanvas: boolean;
  modules: boolean;
  mediaDevices: boolean;
  fileApi: boolean;
  canvas2d: boolean;
}

class CompatibilityChecker {
  private requiredFeatures: RequiredFeatures = {
    camera: true,
    webAssembly: true,
    webGL: true,
    serviceWorker: false, // Optional
    offscreenCanvas: false, // Optional
    modules: true,
    mediaDevices: true,
    fileApi: true,
    canvas2d: true
  };

  // Comprehensive compatibility check
  async checkCompatibility(): Promise<CompatibilityResult> {
    const issues: CompatibilityIssue[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check each required feature
    const cameraSupport = await this.checkCamera();
    if (!cameraSupport.supported) {
      if (this.requiredFeatures.camera) {
        issues.push({
          severity: 'error',
          feature: 'Camera',
          description: cameraSupport.message,
          solution: 'カメラへのアクセスを許可するか、写真アップロード機能をご利用ください'
        });
        score -= 30;
      }
    }

    const wasmSupport = this.checkWebAssembly();
    if (!wasmSupport.supported) {
      issues.push({
        severity: this.requiredFeatures.webAssembly ? 'error' : 'warning',
        feature: 'WebAssembly',
        description: wasmSupport.message,
        solution: 'より新しいブラウザにアップデートしてください'
      });
      score -= this.requiredFeatures.webAssembly ? 40 : 20;
    }

    const webglSupport = this.checkWebGL();
    if (!webglSupport.supported) {
      issues.push({
        severity: this.requiredFeatures.webGL ? 'error' : 'warning',
        feature: 'WebGL',
        description: webglSupport.message,
        solution: 'ハードウェアアクセラレーションを有効にするか、より新しいデバイスをご利用ください'
      });
      score -= this.requiredFeatures.webGL ? 25 : 10;
    }

    const serviceWorkerSupport = this.checkServiceWorker();
    if (!serviceWorkerSupport.supported && this.requiredFeatures.serviceWorker) {
      issues.push({
        severity: 'warning',
        feature: 'Service Worker',
        description: serviceWorkerSupport.message,
        solution: 'オフライン機能は利用できませんが、基本機能は使用可能です'
      });
      score -= 10;
    }

    const offscreenCanvasSupport = this.checkOffscreenCanvas();
    if (!offscreenCanvasSupport.supported && this.requiredFeatures.offscreenCanvas) {
      issues.push({
        severity: 'info',
        feature: 'OffscreenCanvas',
        description: offscreenCanvasSupport.message
      });
      score -= 5;
    }

    const moduleSupport = this.checkModules();
    if (!moduleSupport.supported) {
      issues.push({
        severity: 'error',
        feature: 'ES Modules',
        description: moduleSupport.message,
        solution: 'より新しいブラウザにアップデートしてください'
      });
      score -= 30;
    }

    const mediaDevicesSupport = this.checkMediaDevices();
    if (!mediaDevicesSupport.supported) {
      issues.push({
        severity: this.requiredFeatures.mediaDevices ? 'error' : 'warning',
        feature: 'Media Devices API',
        description: mediaDevicesSupport.message,
        solution: 'カメラ機能は写真アップロードで代替可能です'
      });
      score -= this.requiredFeatures.mediaDevices ? 20 : 5;
    }

    const fileApiSupport = this.checkFileAPI();
    if (!fileApiSupport.supported) {
      issues.push({
        severity: 'error',
        feature: 'File API',
        description: fileApiSupport.message,
        solution: 'より新しいブラウザにアップデートしてください'
      });
      score -= 25;
    }

    const canvas2dSupport = this.checkCanvas2D();
    if (!canvas2dSupport.supported) {
      issues.push({
        severity: 'error',
        feature: 'Canvas 2D',
        description: canvas2dSupport.message,
        solution: 'ハードウェアアクセラレーションを有効にしてください'
      });
      score -= 20;
    }

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(issues));

    // Determine support level
    const errorCount = issues.filter(issue => issue.severity === 'error').length;
    let level: CompatibilityResult['level'];
    let isSupported: boolean;

    if (errorCount === 0) {
      level = 'full';
      isSupported = true;
    } else if (errorCount <= 2 && score >= 50) {
      level = 'partial';
      isSupported = true;
    } else {
      level = 'unsupported';
      isSupported = false;
    }

    return {
      isSupported,
      level,
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  // Individual feature checks
  private async checkCamera(): Promise<{ supported: boolean; message: string }> {
    try {
      if (!('mediaDevices' in navigator) || !('getUserMedia' in navigator.mediaDevices)) {
        return {
          supported: false,
          message: 'ブラウザがカメラAPIをサポートしていません'
        };
      }

      // Test camera access without actually requesting permission
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      
      if (!hasCamera) {
        return {
          supported: false,
          message: 'カメラデバイスが見つかりません'
        };
      }

      return { supported: true, message: 'カメラ機能が利用可能です' };
    } catch (error) {
      return {
        supported: false,
        message: `カメラアクセスエラー: ${error}`
      };
    }
  }

  private checkWebAssembly(): { supported: boolean; message: string } {
    try {
      const supported = typeof WebAssembly === 'object' && 
                       typeof WebAssembly.instantiate === 'function';
      
      if (!supported) {
        return {
          supported: false,
          message: 'WebAssemblyがサポートされていません。MediaPipe処理に必要です。'
        };
      }

      // Check for streaming compilation support
      const hasStreaming = typeof WebAssembly.instantiateStreaming === 'function';
      
      return {
        supported: true,
        message: hasStreaming ? 
          'WebAssembly（ストリーミング対応）が利用可能です' : 
          'WebAssemblyが利用可能です（ストリーミング非対応）'
      };
    } catch {
      return {
        supported: false,
        message: 'WebAssemblyの検証中にエラーが発生しました'
      };
    }
  }

  private checkWebGL(): { supported: boolean; message: string } {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        return {
          supported: false,
          message: 'WebGLがサポートされていません。ハードウェアアクセラレーションが必要です。'
        };
      }

      // Check WebGL version and capabilities
      const webglContext = gl as WebGLRenderingContext;
      const version = webglContext.getParameter(webglContext.VERSION);
      const renderer = webglContext.getParameter(webglContext.RENDERER);
      
      return {
        supported: true,
        message: `WebGL利用可能: ${version} (${renderer})`
      };
    } catch (error) {
      return {
        supported: false,
        message: `WebGLエラー: ${error}`
      };
    }
  }

  private checkServiceWorker(): { supported: boolean; message: string } {
    const supported = 'serviceWorker' in navigator;
    return {
      supported,
      message: supported ? 
        'Service Workerが利用可能です（オフライン機能対応）' : 
        'Service Workerがサポートされていません（オフライン機能無効）'
    };
  }

  private checkOffscreenCanvas(): { supported: boolean; message: string } {
    const supported = 'OffscreenCanvas' in window;
    return {
      supported,
      message: supported ? 
        'OffscreenCanvasが利用可能です（バックグラウンド処理対応）' : 
        'OffscreenCanvasがサポートされていません（処理性能に影響する可能性）'
    };
  }

  private checkModules(): { supported: boolean; message: string } {
    try {
      // Check if ES modules are supported
      const supported = 'noModule' in HTMLScriptElement.prototype;
      return {
        supported,
        message: supported ? 
          'ES Modulesが利用可能です' : 
          'ES Modulesがサポートされていません'
      };
    } catch {
      return {
        supported: false,
        message: 'ES Modulesの検証中にエラーが発生しました'
      };
    }
  }

  private checkMediaDevices(): { supported: boolean; message: string } {
    const supported = 'mediaDevices' in navigator;
    return {
      supported,
      message: supported ? 
        'Media Devices APIが利用可能です' : 
        'Media Devices APIがサポートされていません'
    };
  }

  private checkFileAPI(): { supported: boolean; message: string } {
    const supported = 'File' in window && 'FileReader' in window && 'FileList' in window;
    return {
      supported,
      message: supported ? 
        'File APIが利用可能です' : 
        'File APIがサポートされていません'
    };
  }

  private checkCanvas2D(): { supported: boolean; message: string } {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return {
          supported: false,
          message: 'Canvas 2D Contextが利用できません'
        };
      }

      // Test basic drawing capabilities
      ctx.fillRect(0, 0, 1, 1);
      ctx.getImageData(0, 0, 1, 1);
      
      return {
        supported: true,
        message: 'Canvas 2Dが利用可能です'
      };
    } catch (error) {
      return {
        supported: false,
        message: `Canvas 2Dエラー: ${error}`
      };
    }
  }

  // Generate recommendations based on issues
  private generateRecommendations(issues: CompatibilityIssue[]): string[] {
    const recommendations: string[] = [];
    const browsers = this.getRecommendedBrowsers();

    // General browser recommendations
    if (issues.some(issue => issue.severity === 'error')) {
      recommendations.push(`推奨ブラウザをご利用ください: ${browsers.join(', ')}`);
    }

    // Feature-specific recommendations
    if (issues.some(issue => issue.feature === 'Camera')) {
      recommendations.push('カメラが利用できない場合は、写真アップロード機能をご利用ください');
    }

    if (issues.some(issue => issue.feature === 'WebAssembly' || issue.feature === 'WebGL')) {
      recommendations.push('最適なパフォーマンスのため、ハードウェアアクセラレーションを有効にしてください');
    }

    if (issues.some(issue => issue.feature === 'Service Worker')) {
      recommendations.push('オフライン機能を利用するにはHTTPS環境が必要です');
    }

    return recommendations;
  }

  // Get list of recommended browsers
  private getRecommendedBrowsers(): string[] {
    return [
      'Chrome 90+',
      'Firefox 88+',
      'Safari 14+',
      'Edge 90+'
    ];
  }

  // Check specific MediaPipe requirements
  async checkMediaPipeCompatibility(): Promise<CompatibilityResult> {
    const issues: CompatibilityIssue[] = [];
    let score = 100;

    // MediaPipe specific requirements
    const wasmSupport = this.checkWebAssembly();
    if (!wasmSupport.supported) {
      issues.push({
        severity: 'error',
        feature: 'WebAssembly',
        description: 'MediaPipeはWebAssemblyを必要とします',
        solution: 'Chrome 57+, Firefox 52+, Safari 11+にアップデートしてください'
      });
      score -= 50;
    }

    const webglSupport = this.checkWebGL();
    if (!webglSupport.supported) {
      issues.push({
        severity: 'error',
        feature: 'WebGL',
        description: 'MediaPipeはWebGLハードウェアアクセラレーションを必要とします',
        solution: 'グラフィックドライバを更新し、ハードウェアアクセラレーションを有効にしてください'
      });
      score -= 40;
    }

    // Check memory limits (approximate)
    if ('memory' in performance) {
      // @ts-ignore - experimental API
      const memInfo = (performance as any).memory;
      if (memInfo && memInfo.usedJSHeapSize > memInfo.totalJSHeapSize * 0.8) {
        issues.push({
          severity: 'warning',
          feature: 'Memory',
          description: 'メモリ使用量が高いため、パフォーマンスが低下する可能性があります'
        });
        score -= 10;
      }
    }

    // Check for SharedArrayBuffer (optional but beneficial)
    if (typeof SharedArrayBuffer === 'undefined') {
      issues.push({
        severity: 'info',
        feature: 'SharedArrayBuffer',
        description: 'SharedArrayBufferが無効です。パフォーマンスが制限される可能性があります',
        solution: 'サイトがHTTPS環境で提供されていることを確認してください'
      });
      score -= 5;
    }

    const errorCount = issues.filter(issue => issue.severity === 'error').length;
    const level = errorCount === 0 ? 'full' : errorCount <= 1 ? 'partial' : 'unsupported';

    return {
      isSupported: errorCount === 0,
      level,
      score: Math.max(0, score),
      issues,
      recommendations: this.generateRecommendations(issues)
    };
  }

  // Generate compatibility report
  generateCompatibilityReport(result: CompatibilityResult): string {
    const lines = [
      '=== Postaure 互換性レポート ===',
      `サポートレベル: ${result.level}`,
      `互換性スコア: ${result.score}/100`,
      `総合判定: ${result.isSupported ? '✅ 利用可能' : '❌ 利用不可'}`,
      ''
    ];

    if (result.issues.length > 0) {
      lines.push('検出された問題:');
      result.issues.forEach((issue, index) => {
        const icon = issue.severity === 'error' ? '❌' : 
                    issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`${index + 1}. ${icon} ${issue.feature}: ${issue.description}`);
        if (issue.solution) {
          lines.push(`   解決策: ${issue.solution}`);
        }
      });
      lines.push('');
    }

    if (result.recommendations.length > 0) {
      lines.push('推奨事項:');
      result.recommendations.forEach((rec, index) => {
        lines.push(`${index + 1}. ${rec}`);
      });
    }

    return lines.join('\n');
  }
}

export const compatibilityChecker = new CompatibilityChecker();