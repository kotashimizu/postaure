// Performance monitoring and optimization utilities

export interface PerformanceMetrics {
  timestamp: number;
  event: string;
  duration?: number;
  memoryUsage?: {
    used: number;
    total: number;
    limit: number;
  };
  renderTime?: number;
  analysisTime?: number;
  cacheHits?: number;
  cacheMisses?: number;
  networkLatency?: number;
  details?: Record<string, any>;
}

export interface PerformanceBenchmark {
  name: string;
  target: number; // Target time in milliseconds
  warning: number; // Warning threshold in milliseconds
  critical: number; // Critical threshold in milliseconds
}

export interface PerformanceReport {
  summary: {
    totalMetrics: number;
    averageAnalysisTime: number;
    averageRenderTime: number;
    memoryEfficiency: number;
    cacheEfficiency: number;
  };
  benchmarks: {
    [key: string]: {
      passed: boolean;
      actualTime: number;
      benchmark: PerformanceBenchmark;
    };
  };
  recommendations: string[];
  issues: Array<{
    severity: 'warning' | 'critical';
    description: string;
    suggestion: string;
  }>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS = 1000;
  private observers: Map<string, PerformanceObserver> = new Map();
  private startTimes: Map<string, number> = new Map();

  // Performance benchmarks
  private benchmarks: Map<string, PerformanceBenchmark> = new Map([
    ['app-startup', { name: 'アプリ起動', target: 2000, warning: 3000, critical: 5000 }],
    ['image-processing', { name: '画像処理', target: 3000, warning: 5000, critical: 10000 }],
    ['landmark-detection', { name: 'ランドマーク検出', target: 2000, warning: 3000, critical: 5000 }],
    ['analysis-complete', { name: '分析完了', target: 5000, warning: 8000, critical: 15000 }],
    ['report-generation', { name: 'レポート生成', target: 1000, warning: 2000, critical: 4000 }],
    ['ui-response', { name: 'UI応答性', target: 100, warning: 200, critical: 500 }],
  ]);

  constructor() {
    this.initializeObservers();
    this.scheduleCleanup();
  }

  // Initialize performance observers
  private initializeObservers(): void {
    try {
      // Navigation timing observer
      if ('PerformanceObserver' in window) {
        const navObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              this.addMetric({
                event: 'navigation',
                duration: navEntry.loadEventEnd - navEntry.fetchStart,
                details: {
                  domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.fetchStart,
                  firstPaint: navEntry.loadEventStart - navEntry.fetchStart,
                  transferSize: navEntry.transferSize || 0
                }
              });
            }
          }
        });
        
        navObserver.observe({ entryTypes: ['navigation'] });
        this.observers.set('navigation', navObserver);
      }

      // Measure observer for custom metrics
      if ('PerformanceObserver' in window && 'measure' in performance) {
        const measureObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            this.addMetric({
              event: entry.name,
              duration: entry.duration,
              details: {
                startTime: entry.startTime
              }
            });
          }
        });
        
        measureObserver.observe({ entryTypes: ['measure'] });
        this.observers.set('measure', measureObserver);
      }

    } catch (error) {
      console.warn('Performance observers not fully supported:', error);
    }
  }

  // Start timing an operation
  startTimer(name: string): void {
    this.startTimes.set(name, performance.now());
    
    // Use Performance API mark if available
    if ('mark' in performance) {
      try {
        performance.mark(`${name}-start`);
      } catch {
        // Silently fail if mark is not supported
      }
    }
  }

  // End timing and record metric
  endTimer(name: string, details?: Record<string, any>): number {
    const startTime = this.startTimes.get(name);
    const endTime = performance.now();
    
    if (startTime === undefined) {
      console.warn(`Timer '${name}' was not started`);
      return 0;
    }

    const duration = endTime - startTime;
    this.startTimes.delete(name);

    // Use Performance API measure if available
    if ('mark' in performance && 'measure' in performance) {
      try {
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);
      } catch {
        // Silently fail if measure is not supported
      }
    }

    // Record metric
    this.addMetric({
      event: name,
      duration,
      details
    });

    return duration;
  }

  // Add a performance metric
  addMetric(metric: Omit<PerformanceMetrics, 'timestamp'>): void {
    const fullMetric: PerformanceMetrics = {
      timestamp: Date.now(),
      ...metric,
      memoryUsage: this.getMemoryUsage()
    };

    this.metrics.push(fullMetric);

    // Keep metrics array bounded
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Check against benchmarks
    this.checkBenchmarks(fullMetric);

    console.debug('Performance metric recorded:', fullMetric);
  }

  // Get current memory usage
  private getMemoryUsage(): PerformanceMetrics['memoryUsage'] | undefined {
    if ('memory' in performance) {
      try {
        // @ts-ignore - experimental API
        const memory = (performance as any).memory;
        return {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit
        };
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  // Check metric against benchmarks
  private checkBenchmarks(metric: PerformanceMetrics): void {
    const benchmark = this.benchmarks.get(metric.event);
    if (!benchmark || !metric.duration) return;

    if (metric.duration > benchmark.critical) {
      console.error(`🔴 Critical performance issue: ${benchmark.name} took ${Math.round(metric.duration)}ms (target: ${benchmark.target}ms)`);
    } else if (metric.duration > benchmark.warning) {
      console.warn(`🟡 Performance warning: ${benchmark.name} took ${Math.round(metric.duration)}ms (target: ${benchmark.target}ms)`);
    } else {
      console.log(`🟢 Performance OK: ${benchmark.name} took ${Math.round(metric.duration)}ms`);
    }
  }

  // Get all metrics
  getMetrics(eventName?: string, limit?: number): PerformanceMetrics[] {
    let filteredMetrics = eventName 
      ? this.metrics.filter(m => m.event === eventName)
      : this.metrics;

    if (limit) {
      filteredMetrics = filteredMetrics.slice(-limit);
    }

    return filteredMetrics;
  }

  // Generate performance report
  generateReport(): PerformanceReport {
    const analysisMetrics = this.metrics.filter(m => m.event.includes('analysis') && m.duration);
    const renderMetrics = this.metrics.filter(m => m.event.includes('render') && m.duration);
    
    const averageAnalysisTime = analysisMetrics.length > 0
      ? analysisMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / analysisMetrics.length
      : 0;

    const averageRenderTime = renderMetrics.length > 0
      ? renderMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / renderMetrics.length
      : 0;

    // Calculate memory efficiency
    const memoryMetrics = this.metrics.filter(m => m.memoryUsage).slice(-10);
    const memoryEfficiency = memoryMetrics.length > 0
      ? memoryMetrics.reduce((sum, m) => {
          const usage = m.memoryUsage!;
          return sum + (1 - (usage.used / usage.limit));
        }, 0) / memoryMetrics.length
      : 1;

    // Calculate cache efficiency
    const cacheMetrics = this.metrics.filter(m => 
      typeof m.cacheHits === 'number' && typeof m.cacheMisses === 'number'
    );
    const cacheEfficiency = cacheMetrics.length > 0
      ? cacheMetrics.reduce((sum, m) => {
          const total = m.cacheHits! + m.cacheMisses!;
          return sum + (total > 0 ? m.cacheHits! / total : 0);
        }, 0) / cacheMetrics.length
      : 0;

    // Check benchmarks
    const benchmarkResults: PerformanceReport['benchmarks'] = {};
    for (const [eventName, benchmark] of this.benchmarks) {
      const eventMetrics = this.metrics.filter(m => m.event === eventName && m.duration);
      if (eventMetrics.length > 0) {
        const latestMetric = eventMetrics[eventMetrics.length - 1];
        benchmarkResults[eventName] = {
          passed: latestMetric.duration! <= benchmark.target,
          actualTime: latestMetric.duration!,
          benchmark
        };
      }
    }

    // Generate recommendations and issues
    const recommendations: string[] = [];
    const issues: PerformanceReport['issues'] = [];

    if (averageAnalysisTime > 8000) {
      recommendations.push('分析処理の最適化を検討してください（画像品質の調整など）');
      issues.push({
        severity: 'warning',
        description: '分析処理が遅い',
        suggestion: '画像品質設定を下げる、または高性能デバイスを使用する'
      });
    }

    if (memoryEfficiency < 0.5) {
      recommendations.push('メモリ使用量の最適化が必要です');
      issues.push({
        severity: 'critical',
        description: 'メモリ効率が低い',
        suggestion: 'ブラウザを再起動するか、他のタブを閉じてください'
      });
    }

    if (cacheEfficiency < 0.3 && cacheMetrics.length > 0) {
      recommendations.push('キャッシュ効率の改善を検討してください');
    }

    return {
      summary: {
        totalMetrics: this.metrics.length,
        averageAnalysisTime: Math.round(averageAnalysisTime),
        averageRenderTime: Math.round(averageRenderTime),
        memoryEfficiency: Math.round(memoryEfficiency * 100) / 100,
        cacheEfficiency: Math.round(cacheEfficiency * 100) / 100
      },
      benchmarks: benchmarkResults,
      recommendations,
      issues
    };
  }

  // Get metrics for specific time period
  getMetricsInRange(startTime: number, endTime: number): PerformanceMetrics[] {
    return this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics = [];
    this.startTimes.clear();
  }

  // Export metrics as JSON
  exportMetrics(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      report: this.generateReport()
    }, null, 2);
  }

  // Cleanup old metrics periodically
  private scheduleCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    }, 60 * 60 * 1000); // Run every hour
  }

  // Optimize performance based on current metrics
  getOptimizationSuggestions(): Array<{
    type: 'setting' | 'environment' | 'usage';
    priority: 'high' | 'medium' | 'low';
    description: string;
    action: string;
  }> {
    const suggestions = [];
    const report = this.generateReport();

    // High priority suggestions
    if (report.summary.averageAnalysisTime > 10000) {
      suggestions.push({
        type: 'setting' as const,
        priority: 'high' as const,
        description: '分析処理が非常に遅いです',
        action: '画像品質を70%以下に設定することを推奨します'
      });
    }

    if (report.summary.memoryEfficiency < 0.3) {
      suggestions.push({
        type: 'environment' as const,
        priority: 'high' as const,
        description: 'メモリ不足が深刻です',
        action: 'ブラウザを再起動するか、他のタブ・アプリケーションを閉じてください'
      });
    }

    // Medium priority suggestions
    if (report.summary.averageAnalysisTime > 5000) {
      suggestions.push({
        type: 'setting' as const,
        priority: 'medium' as const,
        description: '分析処理の最適化が可能です',
        action: 'ハードウェアアクセラレーションを有効にしてください'
      });
    }

    // Low priority suggestions
    if (report.summary.cacheEfficiency < 0.5) {
      suggestions.push({
        type: 'usage' as const,
        priority: 'low' as const,
        description: 'キャッシュ効率を改善できます',
        action: '類似の分析を繰り返し実行してキャッシュを活用してください'
      });
    }

    return suggestions;
  }

  // Cleanup resources
  destroy(): void {
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
    this.metrics = [];
    this.startTimes.clear();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions
export const startPerformanceTimer = (name: string) => performanceMonitor.startTimer(name);
export const endPerformanceTimer = (name: string, details?: Record<string, any>) => 
  performanceMonitor.endTimer(name, details);
export const addPerformanceMetric = (metric: Omit<PerformanceMetrics, 'timestamp'>) => 
  performanceMonitor.addMetric(metric);

// React hook for performance monitoring
export const usePerformanceMonitoring = () => {
  return {
    startTimer: startPerformanceTimer,
    endTimer: endPerformanceTimer,
    addMetric: addPerformanceMetric,
    getReport: () => performanceMonitor.generateReport(),
    getOptimizations: () => performanceMonitor.getOptimizationSuggestions()
  };
};