import React, { useState } from 'react';
import { testRunner, runQuickCompatibilityCheck } from '../utils/testRunner';
import type { TestRunResult } from '../utils/testRunner';

interface TestRunnerProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const TestRunner: React.FC<TestRunnerProps> = ({ isOpen, onClose, className = '' }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestRunResult[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<string>('all');
  const [quickCheckResult, setQuickCheckResult] = useState<{
    isCompatible: boolean;
    issues: string[];
    score: number;
  } | null>(null);

  const availableSuites = testRunner.getAvailableSuites();

  const runTests = async () => {
    setIsRunning(true);
    try {
      let testResults: TestRunResult[];
      
      if (selectedSuite === 'all') {
        testResults = await testRunner.runAllTests();
      } else {
        const singleResult = await testRunner.runSuite(selectedSuite);
        testResults = [singleResult];
      }
      
      setResults(testResults);
    } catch (error) {
      console.error('Test execution failed:', error);
      // Show error in results
      setResults([{
        suite: 'Error',
        totalTests: 0,
        passedTests: 0,
        failedTests: 1,
        duration: 0,
        results: []
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const runQuickCheck = async () => {
    try {
      const result = await runQuickCompatibilityCheck();
      setQuickCheckResult(result);
    } catch (error) {
      console.error('Quick check failed:', error);
      setQuickCheckResult({
        isCompatible: false,
        issues: ['クイックチェックに失敗しました'],
        score: 0
      });
    }
  };

  const exportResults = () => {
    const report = testRunner.generateReport(results);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `postaure-test-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (passed: number, failed: number) => {
    if (failed > 0) return '❌';
    if (passed > 0) return '✅';
    return '⏳';
  };

  const getStatusColor = (passRate: number) => {
    if (passRate >= 1.0) return '#27ae60';
    if (passRate >= 0.8) return '#f39c12';
    return '#e74c3c';
  };

  if (!isOpen) return null;

  return (
    <div className={`test-runner ${className}`}>
      <div className="test-overlay" onClick={onClose}></div>
      <div className="test-content">
        {/* Header */}
        <div className="test-header">
          <h2>🧪 テストランナー</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>

        <div className="test-body">
          {/* Quick Check Section */}
          <div className="quick-check-section">
            <h3>⚡ クイック互換性チェック</h3>
            <div className="quick-check-controls">
              <button 
                onClick={runQuickCheck} 
                className="quick-check-button"
                disabled={isRunning}
              >
                クイックチェック実行
              </button>
            </div>
            
            {quickCheckResult && (
              <div className="quick-check-result">
                <div className={`compatibility-status ${quickCheckResult.isCompatible ? 'compatible' : 'incompatible'}`}>
                  {quickCheckResult.isCompatible ? '✅ 互換性あり' : '❌ 互換性問題あり'}
                  <span className="score">スコア: {quickCheckResult.score}%</span>
                </div>
                {quickCheckResult.issues.length > 0 && (
                  <div className="compatibility-issues">
                    <h4>検出された問題:</h4>
                    <ul>
                      {quickCheckResult.issues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Full Test Suite Section */}
          <div className="full-tests-section">
            <h3>🔬 完全テストスイート</h3>
            
            <div className="test-controls">
              <div className="suite-selector">
                <label>テストスイート:</label>
                <select 
                  value={selectedSuite} 
                  onChange={(e) => setSelectedSuite(e.target.value)}
                  disabled={isRunning}
                >
                  <option value="all">すべて</option>
                  {availableSuites.map(suite => (
                    <option key={suite} value={suite}>{suite}</option>
                  ))}
                </select>
              </div>
              
              <button 
                onClick={runTests} 
                className="run-tests-button"
                disabled={isRunning}
              >
                {isRunning ? '⏳ 実行中...' : '▶️ テスト実行'}
              </button>
              
              {results.length > 0 && (
                <button onClick={exportResults} className="export-button">
                  📥 レポート出力
                </button>
              )}
            </div>

            {/* Test Results */}
            {results.length > 0 && (
              <div className="test-results">
                <h4>📊 テスト結果</h4>
                
                {/* Summary */}
                <div className="results-summary">
                  {results.map(result => {
                    const passRate = result.totalTests > 0 ? result.passedTests / result.totalTests : 0;
                    
                    return (
                      <div key={result.suite} className="suite-summary">
                        <div className="suite-header">
                          <span className="suite-icon">
                            {getStatusIcon(result.passedTests, result.failedTests)}
                          </span>
                          <span className="suite-name">{result.suite}</span>
                          <span 
                            className="pass-rate" 
                            style={{ color: getStatusColor(passRate) }}
                          >
                            {Math.round(passRate * 100)}%
                          </span>
                        </div>
                        
                        <div className="suite-stats">
                          <span>✅ {result.passedTests}合格</span>
                          <span>❌ {result.failedTests}失敗</span>
                          <span>⏱️ {Math.round(result.duration)}ms</span>
                        </div>
                        
                        {/* Failed Tests Details */}
                        {result.results.filter(r => !r.result.passed).length > 0 && (
                          <div className="failed-tests">
                            <h5>失敗したテスト:</h5>
                            {result.results
                              .filter(r => !r.result.passed)
                              .map((failedTest, index) => (
                                <div key={index} className="failed-test">
                                  <div className="test-name">❌ {failedTest.test.name}</div>
                                  <div className="test-message">{failedTest.result.message}</div>
                                  {failedTest.result.error && (
                                    <div className="test-error">
                                      エラー: {failedTest.result.error.message}
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Detailed Results */}
                <details className="detailed-results">
                  <summary>詳細結果を表示</summary>
                  <div className="detailed-content">
                    {results.map(result => (
                      <div key={result.suite} className="suite-details">
                        <h5>{result.suite}</h5>
                        {result.results.map((testResult, index) => (
                          <div 
                            key={index} 
                            className={`test-detail ${testResult.result.passed ? 'passed' : 'failed'}`}
                          >
                            <div className="test-info">
                              <span className="test-status">
                                {testResult.result.passed ? '✅' : '❌'}
                              </span>
                              <span className="test-name">{testResult.test.name}</span>
                              <span className="test-duration">
                                {Math.round(testResult.result.duration)}ms
                              </span>
                            </div>
                            <div className="test-description">
                              {testResult.test.description}
                            </div>
                            {!testResult.result.passed && (
                              <div className="test-failure">
                                {testResult.result.message}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .test-runner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .test-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
        }

        .test-content {
          position: relative;
          width: 90vw;
          max-width: 900px;
          height: 85vh;
          max-height: 700px;
          background: white;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .test-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #e0e0e0;
        }

        .test-header h2 {
          margin: 0;
          color: #2c3e50;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          color: #7f8c8d;
          padding: 0.25rem;
        }

        .test-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .quick-check-section, .full-tests-section {
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #f0f0f0;
        }

        .full-tests-section {
          border-bottom: none;
        }

        .quick-check-section h3, .full-tests-section h3 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
        }

        .quick-check-button, .run-tests-button {
          background: #3498db;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
        }

        .quick-check-button:hover, .run-tests-button:hover {
          background: #2980b9;
        }

        .quick-check-button:disabled, .run-tests-button:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }

        .quick-check-result {
          margin-top: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .compatibility-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 500;
          margin-bottom: 0.5rem;
        }

        .compatibility-status.compatible {
          color: #27ae60;
        }

        .compatibility-status.incompatible {
          color: #e74c3c;
        }

        .score {
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .compatibility-issues h4 {
          margin: 0.5rem 0;
          color: #e74c3c;
        }

        .compatibility-issues ul {
          margin: 0;
          padding-left: 1.5rem;
        }

        .test-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .suite-selector {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .suite-selector select {
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .export-button {
          background: #27ae60;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
        }

        .results-summary {
          margin-bottom: 1rem;
        }

        .suite-summary {
          margin-bottom: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .suite-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .suite-stats {
          display: flex;
          gap: 1rem;
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .failed-tests {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e0e0e0;
        }

        .failed-tests h5 {
          margin: 0 0 0.5rem 0;
          color: #e74c3c;
        }

        .failed-test {
          margin-bottom: 0.5rem;
          padding: 0.5rem;
          background: #fdf2f2;
          border-left: 4px solid #e74c3c;
          border-radius: 4px;
        }

        .test-name {
          font-weight: 500;
          margin-bottom: 0.25rem;
        }

        .test-message {
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .test-error {
          font-size: 0.8rem;
          color: #c0392b;
          margin-top: 0.25rem;
        }

        .detailed-results {
          margin-top: 1rem;
        }

        .detailed-results summary {
          cursor: pointer;
          font-weight: 500;
          color: #3498db;
        }

        .detailed-content {
          margin-top: 1rem;
        }

        .suite-details {
          margin-bottom: 1rem;
        }

        .suite-details h5 {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
          border-bottom: 1px solid #e0e0e0;
          padding-bottom: 0.5rem;
        }

        .test-detail {
          margin-bottom: 0.5rem;
          padding: 0.75rem;
          border-radius: 6px;
        }

        .test-detail.passed {
          background: #f2f9f2;
          border-left: 4px solid #27ae60;
        }

        .test-detail.failed {
          background: #fdf2f2;
          border-left: 4px solid #e74c3c;
        }

        .test-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }

        .test-duration {
          margin-left: auto;
          font-size: 0.8rem;
          color: #7f8c8d;
        }

        .test-description {
          font-size: 0.85rem;
          color: #7f8c8d;
          margin-bottom: 0.25rem;
        }

        .test-failure {
          font-size: 0.85rem;
          color: #c0392b;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .test-content {
            width: 95vw;
            height: 90vh;
          }

          .test-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .suite-header {
            flex-wrap: wrap;
          }

          .suite-stats {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
};

export default TestRunner;