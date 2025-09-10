// Bundle optimization and code splitting utilities

export interface BundleAnalysis {
  totalSize: number;
  chunks: Array<{
    name: string;
    size: number;
    modules: string[];
    isAsync: boolean;
    dependencies: string[];
  }>;
  recommendations: Array<{
    type: 'split' | 'lazy-load' | 'tree-shake' | 'compress';
    priority: 'high' | 'medium' | 'low';
    description: string;
    potentialSavings: number;
  }>;
}

// Dynamic import wrappers with error handling and loading states
export class DynamicLoader {
  private static cache: Map<string, Promise<any>> = new Map();
  private static loadingStates: Map<string, boolean> = new Map();

  // Load MediaPipe components dynamically
  static async loadMediaPipe() {
    const key = 'mediapipe';
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    this.loadingStates.set(key, true);
    
    try {
      // Mock MediaPipe loading for development
      const promise = new Promise(resolve => {
        setTimeout(() => resolve({
          Pose: () => 'MediaPipe Pose',
          Camera: () => 'MediaPipe Camera', 
          drawConnectors: () => 'Draw Connectors',
          drawLandmarks: () => 'Draw Landmarks',
          POSE_CONNECTIONS: [],
          POSE_LANDMARKS: []
        }), 500);
      });

      this.cache.set(key, promise);
      const result = await promise;
      this.loadingStates.set(key, false);
      
      return result;
    } catch (error) {
      this.loadingStates.delete(key);
      this.cache.delete(key);
      throw new Error(`Failed to load MediaPipe: ${error}`);
    }
  }

  // Load chart library dynamically (for performance reports)
  static async loadCharting() {
    const key = 'charting';
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    this.loadingStates.set(key, true);

    try {
      // Mock implementation - replace with actual chart library
      const promise = new Promise(resolve => {
        setTimeout(() => resolve({
          LineChart: () => 'Line Chart Component',
          BarChart: () => 'Bar Chart Component',
          PieChart: () => 'Pie Chart Component'
        }), 100);
      });

      this.cache.set(key, promise);
      const result = await promise;
      this.loadingStates.set(key, false);
      
      return result;
    } catch (error) {
      this.loadingStates.delete(key);
      this.cache.delete(key);
      throw new Error(`Failed to load charting library: ${error}`);
    }
  }

  // Load PDF generation library dynamically
  static async loadPDFGenerator() {
    const key = 'pdf-generator';
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    this.loadingStates.set(key, true);

    try {
      const promise = import('jspdf').then(module => module.default || module);
      this.cache.set(key, promise);
      const result = await promise;
      this.loadingStates.set(key, false);
      
      return result;
    } catch (error) {
      this.loadingStates.delete(key);
      this.cache.delete(key);
      throw new Error(`Failed to load PDF generator: ${error}`);
    }
  }

  // Load HTML to canvas library dynamically
  static async loadHtml2Canvas() {
    const key = 'html2canvas';
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    this.loadingStates.set(key, true);

    try {
      const promise = import('html2canvas').then(module => module.default || module);
      this.cache.set(key, promise);
      const result = await promise;
      this.loadingStates.set(key, false);
      
      return result;
    } catch (error) {
      this.loadingStates.delete(key);
      this.cache.delete(key);
      throw new Error(`Failed to load html2canvas: ${error}`);
    }
  }

  // Check if a module is currently loading
  static isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }

  // Clear cache for testing or memory management
  static clearCache(): void {
    this.cache.clear();
    this.loadingStates.clear();
  }

  // Get cache statistics
  static getCacheStats() {
    return {
      cached: Array.from(this.cache.keys()),
      loading: Array.from(this.loadingStates.entries()).filter(([, loading]) => loading).map(([key]) => key),
      totalCached: this.cache.size
    };
  }
}

// Resource preloader for critical resources
export class ResourcePreloader {
  private static preloadQueue: Array<{
    url: string;
    type: 'script' | 'module' | 'image' | 'font' | 'style';
    priority: 'high' | 'medium' | 'low';
  }> = [];

  // Add resource to preload queue
  static add(url: string, type: 'script' | 'module' | 'image' | 'font' | 'style', priority: 'high' | 'medium' | 'low' = 'medium') {
    this.preloadQueue.push({ url, type, priority });
  }

  // Execute preloading
  static async preload() {
    // Sort by priority
    const sorted = this.preloadQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    const promises = sorted.map(resource => this.preloadResource(resource));
    
    try {
      await Promise.allSettled(promises);
      console.log(`Preloaded ${promises.length} resources`);
    } catch (error) {
      console.warn('Some resources failed to preload:', error);
    }
  }

  // Preload individual resource
  private static preloadResource(resource: typeof ResourcePreloader.preloadQueue[0]): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource.url;
      
      switch (resource.type) {
        case 'script':
        case 'module':
          link.as = 'script';
          if (resource.type === 'module') {
            link.setAttribute('crossorigin', '');
          }
          break;
        case 'image':
          link.as = 'image';
          break;
        case 'font':
          link.as = 'font';
          link.setAttribute('crossorigin', '');
          break;
        case 'style':
          link.as = 'style';
          break;
      }

      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to preload: ${resource.url}`));
      
      document.head.appendChild(link);
    });
  }

  // Preload critical MediaPipe assets
  static preloadMediaPipeAssets() {
    const baseUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/';
    
    this.add(`${baseUrl}pose.js`, 'script', 'high');
    this.add(`${baseUrl}pose_solution_packed_assets_loader.js`, 'script', 'high');
    // Add other critical MediaPipe assets as needed
  }

  // Get preload statistics
  static getStats() {
    return {
      queued: this.preloadQueue.length,
      resources: [...this.preloadQueue]
    };
  }
}

// Bundle size analyzer (mock implementation)
export class BundleAnalyzer {
  // Analyze current bundle (would integrate with build tools in production)
  static async analyzeCurrent(): Promise<BundleAnalysis> {
    // Mock analysis - in production this would analyze actual webpack stats
    const mockAnalysis: BundleAnalysis = {
      totalSize: 1200000, // 1.2MB
      chunks: [
        {
          name: 'main',
          size: 800000,
          modules: ['react', 'react-dom', 'app-core'],
          isAsync: false,
          dependencies: []
        },
        {
          name: 'mediapipe',
          size: 400000,
          modules: ['@mediapipe/pose', '@mediapipe/camera_utils'],
          isAsync: true,
          dependencies: ['main']
        }
      ],
      recommendations: [
        {
          type: 'split',
          priority: 'high',
          description: 'MediaPipeコンポーネントを動的読み込みに変更',
          potentialSavings: 400000
        },
        {
          type: 'lazy-load',
          priority: 'medium',
          description: '設定パネルを遅延読み込みに変更',
          potentialSavings: 50000
        },
        {
          type: 'tree-shake',
          priority: 'low',
          description: '未使用のユーティリティ関数を削除',
          potentialSavings: 30000
        }
      ]
    };

    return mockAnalysis;
  }

  // Get optimization recommendations
  static getOptimizationTips(): string[] {
    return [
      '大きなライブラリ（MediaPipe、PDF生成など）は動的インポートを使用',
      '設定パネルやレポート機能は初期表示時には読み込まない',
      'Tree shakingを有効にして未使用コードを削除',
      '画像やフォントは適切に圧縮・最適化する',
      'Service Workerでキャッシュ戦略を最適化',
      'Critical CSSをインライン化してレンダリングブロッキングを回避'
    ];
  }
}

// Performance-optimized component wrapper (disabled for now)
// export function withPerformanceOptimization<T extends object>(
//   Component: React.ComponentType<T>,
//   options: {
//     lazy?: boolean;
//     preload?: boolean;
//     memo?: boolean;
//   } = {}
// ) {
//   const { lazy = false, preload = false, memo = true } = options;

//   if (lazy) {
//     const LazyComponent = React.lazy(() => 
//       Promise.resolve({ default: Component })
//     );

//     if (preload) {
//       // Preload the component
//       setTimeout(() => {
//         const element = React.createElement(LazyComponent, {} as T);
//         // This triggers the lazy loading without rendering
//         React.Children.toArray(element);
//       }, 0);
//     }

//     return React.memo(LazyComponent);
//   }

//   return memo ? React.memo(Component) : Component;
// }

// Initialize optimization
export const initializeBundleOptimization = () => {
  // Preload critical resources
  ResourcePreloader.preloadMediaPipeAssets();
  ResourcePreloader.preload();

  // Setup dynamic loading for non-critical features
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // Pre-cache commonly used dynamic imports during idle time
      DynamicLoader.loadCharting().catch(() => {}); // Silently fail if not needed
    });
  }

  console.log('Bundle optimization initialized');
};