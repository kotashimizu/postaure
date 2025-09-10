// Test runner for automated compatibility and functionality testing

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: 'compatibility' | 'functionality' | 'performance' | 'integration';
  priority: 'high' | 'medium' | 'low';
  timeout?: number;
  run: () => Promise<TestResult>;
}

export interface TestResult {
  passed: boolean;
  message: string;
  duration: number;
  details?: any;
  error?: Error;
}

export interface TestSuite {
  name: string;
  tests: TestCase[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface TestRunResult {
  suite: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  results: Array<{
    test: TestCase;
    result: TestResult;
  }>;
}

class TestRunner {
  private suites: Map<string, TestSuite> = new Map();
  private isRunning = false;

  // Register test suite
  registerSuite(name: string, suite: TestSuite): void {
    this.suites.set(name, suite);
  }

  // Run all tests
  async runAllTests(): Promise<TestRunResult[]> {
    if (this.isRunning) {
      throw new Error('Test runner is already running');
    }

    this.isRunning = true;
    const results: TestRunResult[] = [];

    try {
      for (const [name, suite] of this.suites) {
        const result = await this.runSuite(name, suite);
        results.push(result);
      }
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  // Run specific test suite
  async runSuite(name: string, suite?: TestSuite): Promise<TestRunResult> {
    const testSuite = suite || this.suites.get(name);
    if (!testSuite) {
      throw new Error(`Test suite '${name}' not found`);
    }

    const startTime = performance.now();
    let passedTests = 0;
    let failedTests = 0;
    const results: Array<{ test: TestCase; result: TestResult }> = [];

    // Setup
    if (testSuite.setup) {
      await testSuite.setup();
    }

    try {
      // Run tests
      for (const test of testSuite.tests) {
        const result = await this.runTest(test);
        results.push({ test, result });
        
        if (result.passed) {
          passedTests++;
        } else {
          failedTests++;
        }
      }
    } finally {
      // Teardown
      if (testSuite.teardown) {
        await testSuite.teardown();
      }
    }

    const duration = performance.now() - startTime;

    return {
      suite: name,
      totalTests: testSuite.tests.length,
      passedTests,
      failedTests,
      duration,
      results
    };
  }

  // Run individual test
  private async runTest(test: TestCase): Promise<TestResult> {
    const startTime = performance.now();
    
    try {
      // Apply timeout if specified
      const timeoutPromise = test.timeout ? 
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Test timeout after ${test.timeout}ms`)), test.timeout)
        ) : null;

      const testPromise = test.run();
      const result = timeoutPromise ? 
        await Promise.race([testPromise, timeoutPromise]) : 
        await testPromise;

      const duration = performance.now() - startTime;
      return { ...result, duration };
    } catch (error) {
      const duration = performance.now() - startTime;
      return {
        passed: false,
        message: `Test failed: ${error instanceof Error ? error.message : String(error)}`,
        duration,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  // Generate test report
  generateReport(results: TestRunResult[]): string {
    const lines: string[] = [];
    
    lines.push('=== Postaure テストレポート ===');
    lines.push(`実行日時: ${new Date().toLocaleString('ja-JP')}`);
    lines.push('');

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    for (const suiteResult of results) {
      totalTests += suiteResult.totalTests;
      totalPassed += suiteResult.passedTests;
      totalFailed += suiteResult.failedTests;
      totalDuration += suiteResult.duration;

      lines.push(`## ${suiteResult.suite}`);
      lines.push(`テスト数: ${suiteResult.totalTests}`);
      lines.push(`成功: ${suiteResult.passedTests} | 失敗: ${suiteResult.failedTests}`);
      lines.push(`実行時間: ${Math.round(suiteResult.duration)}ms`);
      lines.push('');

      // Show failed tests
      const failedTests = suiteResult.results.filter(r => !r.result.passed);
      if (failedTests.length > 0) {
        lines.push('### 失敗したテスト');
        for (const { test, result } of failedTests) {
          lines.push(`❌ ${test.name}: ${result.message}`);
        }
        lines.push('');
      }
    }

    lines.push('=== 総合結果 ===');
    lines.push(`総テスト数: ${totalTests}`);
    lines.push(`成功率: ${Math.round((totalPassed / totalTests) * 100)}%`);
    lines.push(`実行時間: ${Math.round(totalDuration)}ms`);

    return lines.join('\n');
  }

  // Get available test suites
  getAvailableSuites(): string[] {
    return Array.from(this.suites.keys());
  }
}

// Compatibility test suite
export const compatibilityTestSuite: TestSuite = {
  name: 'Compatibility Tests',
  tests: [
    {
      id: 'webassembly-support',
      name: 'WebAssembly Support',
      description: 'Test if WebAssembly is supported and functional',
      category: 'compatibility',
      priority: 'high',
      timeout: 5000,
      run: async () => {
        try {
          if (typeof WebAssembly !== 'object') {
            return { passed: false, message: 'WebAssembly not available', duration: 0 };
          }

          // Test basic WebAssembly functionality
          const wasmCode = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
          await WebAssembly.instantiate(wasmCode);

          return { passed: true, message: 'WebAssembly is supported and functional', duration: 0 };
        } catch (error) {
          return { 
            passed: false, 
            message: `WebAssembly test failed: ${error}`, 
            duration: 0,
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
    },
    {
      id: 'webgl-support',
      name: 'WebGL Support',
      description: 'Test if WebGL is supported and functional',
      category: 'compatibility',
      priority: 'high',
      timeout: 5000,
      run: async () => {
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          
          if (!gl) {
            return { passed: false, message: 'WebGL context not available', duration: 0 };
          }

          // Test basic WebGL functionality
          const webglContext = gl as WebGLRenderingContext;
          webglContext.clearColor(0.0, 0.0, 0.0, 1.0);
          webglContext.clear(webglContext.COLOR_BUFFER_BIT);

          const version = webglContext.getParameter(webglContext.VERSION);
          return { 
            passed: true, 
            message: `WebGL is functional: ${version}`, 
            duration: 0,
            details: { version }
          };
        } catch (error) {
          return { 
            passed: false, 
            message: `WebGL test failed: ${error}`, 
            duration: 0,
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
    },
    {
      id: 'camera-access',
      name: 'Camera Access',
      description: 'Test if camera can be accessed',
      category: 'functionality',
      priority: 'medium',
      timeout: 10000,
      run: async () => {
        try {
          if (!('mediaDevices' in navigator) || !('getUserMedia' in navigator.mediaDevices)) {
            return { passed: false, message: 'MediaDevices API not available', duration: 0 };
          }

          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');

          if (videoDevices.length === 0) {
            return { passed: false, message: 'No video input devices found', duration: 0 };
          }

          return { 
            passed: true, 
            message: `${videoDevices.length} camera device(s) available`, 
            duration: 0,
            details: { deviceCount: videoDevices.length }
          };
        } catch (error) {
          return { 
            passed: false, 
            message: `Camera access test failed: ${error}`, 
            duration: 0,
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
    },
    {
      id: 'file-api-support',
      name: 'File API Support',
      description: 'Test if File API is supported and functional',
      category: 'functionality',
      priority: 'medium',
      timeout: 3000,
      run: async () => {
        try {
          if (!('File' in window) || !('FileReader' in window) || !('FileList' in window)) {
            return { passed: false, message: 'File API not available', duration: 0 };
          }

          // Test FileReader functionality
          const reader = new FileReader();
          const testBlob = new Blob(['test'], { type: 'text/plain' });
          
          return new Promise<TestResult>((resolve) => {
            reader.onload = () => {
              resolve({ 
                passed: true, 
                message: 'File API is functional', 
                duration: 0 
              });
            };
            
            reader.onerror = () => {
              resolve({ 
                passed: false, 
                message: 'FileReader failed to read test blob', 
                duration: 0 
              });
            };
            
            reader.readAsText(testBlob);
          });
        } catch (error) {
          return { 
            passed: false, 
            message: `File API test failed: ${error}`, 
            duration: 0,
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
    },
    {
      id: 'service-worker-support',
      name: 'Service Worker Support',
      description: 'Test if Service Worker is supported',
      category: 'functionality',
      priority: 'low',
      timeout: 3000,
      run: async () => {
        try {
          if (!('serviceWorker' in navigator)) {
            return { passed: false, message: 'Service Worker not supported', duration: 0 };
          }

          return { 
            passed: true, 
            message: 'Service Worker is supported', 
            duration: 0 
          };
        } catch (error) {
          return { 
            passed: false, 
            message: `Service Worker test failed: ${error}`, 
            duration: 0,
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
    }
  ]
};

// Performance test suite
export const performanceTestSuite: TestSuite = {
  name: 'Performance Tests',
  tests: [
    {
      id: 'canvas-performance',
      name: 'Canvas Performance',
      description: 'Test canvas rendering performance',
      category: 'performance',
      priority: 'medium',
      timeout: 10000,
      run: async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            return { passed: false, message: 'Canvas 2D context not available', duration: 0 };
          }

          const startTime = performance.now();
          
          // Perform canvas operations
          for (let i = 0; i < 1000; i++) {
            ctx.fillStyle = `hsl(${i % 360}, 100%, 50%)`;
            ctx.fillRect(i % canvas.width, (i * 2) % canvas.height, 10, 10);
          }
          
          const duration = performance.now() - startTime;
          const passed = duration < 100; // Should complete in under 100ms
          
          return { 
            passed, 
            message: passed ? 
              `Canvas performance test passed in ${Math.round(duration)}ms` :
              `Canvas performance test slow: ${Math.round(duration)}ms`, 
            duration,
            details: { renderTime: duration }
          };
        } catch (error) {
          return { 
            passed: false, 
            message: `Canvas performance test failed: ${error}`, 
            duration: 0,
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
    },
    {
      id: 'memory-usage',
      name: 'Memory Usage',
      description: 'Check available memory and usage patterns',
      category: 'performance',
      priority: 'low',
      timeout: 5000,
      run: async () => {
        try {
          if ('memory' in performance) {
            // @ts-ignore - experimental API
            const memInfo = (performance as any).memory;
            const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);
            const totalMB = Math.round(memInfo.totalJSHeapSize / 1024 / 1024);
            const limitMB = Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024);
            
            const usage = usedMB / limitMB;
            const passed = usage < 0.8; // Less than 80% memory usage
            
            return {
              passed,
              message: `Memory usage: ${usedMB}MB / ${totalMB}MB (limit: ${limitMB}MB)`,
              duration: 0,
              details: { usedMB, totalMB, limitMB, usage }
            };
          } else {
            return {
              passed: true,
              message: 'Memory API not available (this is normal)',
              duration: 0
            };
          }
        } catch (error) {
          return { 
            passed: false, 
            message: `Memory usage test failed: ${error}`, 
            duration: 0,
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
    }
  ]
};

// Create and export test runner instance
export const testRunner = new TestRunner();

// Register default test suites
testRunner.registerSuite('compatibility', compatibilityTestSuite);
testRunner.registerSuite('performance', performanceTestSuite);

// Utility function to run quick compatibility check
export const runQuickCompatibilityCheck = async (): Promise<{
  isCompatible: boolean;
  issues: string[];
  score: number;
}> => {
  const result = await testRunner.runSuite('compatibility');
  const failedTests = result.results.filter(r => !r.result.passed);
  const score = Math.round((result.passedTests / result.totalTests) * 100);
  
  return {
    isCompatible: result.failedTests === 0,
    issues: failedTests.map(r => r.result.message),
    score
  };
};