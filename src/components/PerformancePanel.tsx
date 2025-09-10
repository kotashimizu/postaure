import React, { useState, useEffect } from 'react';
import { performanceMonitor, usePerformanceMonitoring } from '../utils/performanceMonitor';
import { BundleAnalyzer } from '../utils/bundleOptimizer';
import type { PerformanceReport } from '../utils/performanceMonitor';

interface PerformancePanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const PerformancePanel: React.FC<PerformancePanelProps> = ({ isOpen, onClose, className = '' }) => {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'metrics' | 'optimization'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const { getReport, getOptimizations } = usePerformanceMonitoring();

  useEffect(() => {
    if (isOpen) {
      updateReport();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!autoRefresh || !isOpen) return;

    const interval = setInterval(updateReport, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, isOpen]);

  const updateReport = () => {
    const newReport = getReport();
    setReport(newReport);
  };

  const exportReport = () => {
    const data = performanceMonitor.exportMetrics();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `postaure-performance-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearMetrics = () => {
    if (confirm('すべてのパフォーマンス指標をクリアしますか？')) {
      performanceMonitor.clearMetrics();
      updateReport();
    }
  };

  const getSeverityColor = (severity: 'warning' | 'critical') => {
    return severity === 'critical' ? '#e74c3c' : '#f39c12';
  };

  const getScoreColor = (score: number, isPercentage: boolean = false) => {
    const threshold = isPercentage ? 70 : 5000;
    if (isPercentage) {
      if (score >= 80) return '#27ae60';
      if (score >= 60) return '#f39c12';
      return '#e74c3c';
    } else {
      if (score <= threshold * 0.5) return '#27ae60';
      if (score <= threshold) return '#f39c12';
      return '#e74c3c';
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`performance-panel ${className}`}>
      <div className="performance-overlay" onClick={onClose}></div>
      <div className="performance-content">
        {/* Header */}
        <div className="performance-header">
          <h2>🚀 パフォーマンス監視</h2>
          <div className="performance-header-actions">
            <label className="auto-refresh-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              自動更新
            </label>
            <button onClick={updateReport} className="refresh-button">
              🔄 更新
            </button>
            <button onClick={onClose} className="close-button">
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="performance-tabs">
          <button
            className={`tab ${selectedTab === 'overview' ? 'active' : ''}`}
            onClick={() => setSelectedTab('overview')}
          >
            📊 概要
          </button>
          <button
            className={`tab ${selectedTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setSelectedTab('metrics')}
          >
            📈 詳細指標
          </button>
          <button
            className={`tab ${selectedTab === 'optimization' ? 'active' : ''}`}
            onClick={() => setSelectedTab('optimization')}
          >
            ⚡ 最適化
          </button>
        </div>

        <div className="performance-body">
          {selectedTab === 'overview' && report && (
            <div className="overview-tab">
              {/* Summary Cards */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-label">分析時間 (平均)</div>
                  <div 
                    className="metric-value"
                    style={{ color: getScoreColor(report.summary.averageAnalysisTime) }}
                  >
                    {report.summary.averageAnalysisTime}ms
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">描画時間 (平均)</div>
                  <div 
                    className="metric-value"
                    style={{ color: getScoreColor(report.summary.averageRenderTime) }}
                  >
                    {report.summary.averageRenderTime}ms
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">メモリ効率</div>
                  <div 
                    className="metric-value"
                    style={{ color: getScoreColor(report.summary.memoryEfficiency * 100, true) }}
                  >
                    {Math.round(report.summary.memoryEfficiency * 100)}%
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">キャッシュ効率</div>
                  <div 
                    className="metric-value"
                    style={{ color: getScoreColor(report.summary.cacheEfficiency * 100, true) }}
                  >
                    {Math.round(report.summary.cacheEfficiency * 100)}%
                  </div>
                </div>
              </div>

              {/* Benchmark Results */}
              {Object.keys(report.benchmarks).length > 0 && (
                <div className="benchmarks-section">
                  <h3>🎯 ベンチマーク結果</h3>
                  <div className="benchmarks-list">
                    {Object.entries(report.benchmarks).map(([key, benchmark]) => (
                      <div key={key} className="benchmark-item">
                        <div className="benchmark-info">
                          <span className="benchmark-name">{benchmark.benchmark.name}</span>
                          <span className="benchmark-result">
                            {Math.round(benchmark.actualTime)}ms
                            <span className="benchmark-target">
                              (目標: {benchmark.benchmark.target}ms)
                            </span>
                          </span>
                        </div>
                        <div className={`benchmark-status ${benchmark.passed ? 'passed' : 'failed'}`}>
                          {benchmark.passed ? '✅ 合格' : '❌ 要改善'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues */}
              {report.issues.length > 0 && (
                <div className="issues-section">
                  <h3>⚠️ 検出された問題</h3>
                  <div className="issues-list">
                    {report.issues.map((issue, index) => (
                      <div key={index} className="issue-item" style={{ borderLeft: `4px solid ${getSeverityColor(issue.severity)}` }}>
                        <div className="issue-severity">
                          {issue.severity === 'critical' ? '🔴' : '🟡'} {issue.severity === 'critical' ? '重要' : '警告'}
                        </div>
                        <div className="issue-content">
                          <div className="issue-description">{issue.description}</div>
                          <div className="issue-suggestion">{issue.suggestion}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {report.recommendations.length > 0 && (
                <div className="recommendations-section">
                  <h3>💡 推奨事項</h3>
                  <ul className="recommendations-list">
                    {report.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {selectedTab === 'metrics' && (
            <div className="metrics-tab">
              <div className="metrics-controls">
                <button onClick={exportReport} className="export-button">
                  📥 レポート出力
                </button>
                <button onClick={clearMetrics} className="clear-button">
                  🗑️ データクリア
                </button>
              </div>
              
              <div className="raw-metrics">
                <h3>📋 生データ</h3>
                <div className="metrics-summary">
                  <p>総計測数: {report?.summary.totalMetrics || 0}</p>
                  <p>データが不足しています。アプリを使用してパフォーマンスデータを収集してください。</p>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'optimization' && (
            <div className="optimization-tab">
              <h3>⚡ 最適化提案</h3>
              
              {(() => {
                const suggestions = getOptimizations();
                const grouped = {
                  high: suggestions.filter(s => s.priority === 'high'),
                  medium: suggestions.filter(s => s.priority === 'medium'),
                  low: suggestions.filter(s => s.priority === 'low')
                };

                return (
                  <div className="optimization-suggestions">
                    {grouped.high.length > 0 && (
                      <div className="priority-group high">
                        <h4>🔴 高優先度</h4>
                        {grouped.high.map((suggestion, index) => (
                          <div key={index} className="suggestion-item">
                            <div className="suggestion-type">{suggestion.type}</div>
                            <div className="suggestion-content">
                              <div className="suggestion-description">{suggestion.description}</div>
                              <div className="suggestion-action">{suggestion.action}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {grouped.medium.length > 0 && (
                      <div className="priority-group medium">
                        <h4>🟡 中優先度</h4>
                        {grouped.medium.map((suggestion, index) => (
                          <div key={index} className="suggestion-item">
                            <div className="suggestion-type">{suggestion.type}</div>
                            <div className="suggestion-content">
                              <div className="suggestion-description">{suggestion.description}</div>
                              <div className="suggestion-action">{suggestion.action}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {grouped.low.length > 0 && (
                      <div className="priority-group low">
                        <h4>🟢 低優先度</h4>
                        {grouped.low.map((suggestion, index) => (
                          <div key={index} className="suggestion-item">
                            <div className="suggestion-type">{suggestion.type}</div>
                            <div className="suggestion-content">
                              <div className="suggestion-description">{suggestion.description}</div>
                              <div className="suggestion-action">{suggestion.action}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {suggestions.length === 0 && (
                      <div className="no-suggestions">
                        <p>🎉 現在、特に改善が必要な項目はありません。</p>
                        <p>アプリを使用してより多くのデータを収集すると、詳細な最適化提案が表示されます。</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="general-tips">
                <h4>💡 一般的な最適化Tips</h4>
                <ul>
                  {BundleAnalyzer.getOptimizationTips().map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .performance-panel {
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

        .performance-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
        }

        .performance-content {
          position: relative;
          width: 90vw;
          max-width: 1200px;
          height: 85vh;
          max-height: 800px;
          background: white;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .performance-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #e0e0e0;
        }

        .performance-header h2 {
          margin: 0;
          color: #2c3e50;
        }

        .performance-header-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .auto-refresh-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .refresh-button, .close-button {
          background: none;
          border: 1px solid #ddd;
          padding: 0.5rem;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .close-button {
          border: none;
          font-size: 1.2rem;
          color: #7f8c8d;
        }

        .performance-tabs {
          display: flex;
          border-bottom: 1px solid #e0e0e0;
        }

        .tab {
          flex: 1;
          padding: 1rem;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.9rem;
          color: #7f8c8d;
          border-bottom: 3px solid transparent;
        }

        .tab:hover {
          background: #f8f9fa;
        }

        .tab.active {
          color: #3498db;
          border-bottom-color: #3498db;
        }

        .performance-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .metric-card {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          text-align: center;
        }

        .metric-label {
          font-size: 0.8rem;
          color: #7f8c8d;
          margin-bottom: 0.5rem;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .benchmarks-section, .issues-section, .recommendations-section {
          margin-bottom: 2rem;
        }

        .benchmarks-section h3, .issues-section h3, .recommendations-section h3 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
        }

        .benchmark-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .benchmark-name {
          font-weight: 500;
        }

        .benchmark-target {
          font-size: 0.8rem;
          color: #7f8c8d;
          margin-left: 0.5rem;
        }

        .benchmark-status.passed {
          color: #27ae60;
        }

        .benchmark-status.failed {
          color: #e74c3c;
        }

        .issue-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          margin-bottom: 0.5rem;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .issue-severity {
          flex-shrink: 0;
          font-weight: 500;
        }

        .issue-description {
          font-weight: 500;
          margin-bottom: 0.25rem;
        }

        .issue-suggestion {
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .recommendations-list {
          list-style: none;
          padding: 0;
        }

        .recommendations-list li {
          padding: 0.5rem 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .recommendations-list li:before {
          content: "💡 ";
          margin-right: 0.5rem;
        }

        .metrics-controls {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .export-button, .clear-button {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }

        .clear-button {
          background: #e74c3c;
          color: white;
          border-color: #e74c3c;
        }

        .raw-metrics {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
        }

        .priority-group {
          margin-bottom: 1.5rem;
        }

        .priority-group h4 {
          margin: 0 0 1rem 0;
        }

        .suggestion-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          margin-bottom: 0.5rem;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .suggestion-type {
          flex-shrink: 0;
          padding: 0.25rem 0.5rem;
          background: #3498db;
          color: white;
          border-radius: 4px;
          font-size: 0.8rem;
        }

        .suggestion-description {
          font-weight: 500;
          margin-bottom: 0.25rem;
        }

        .suggestion-action {
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .no-suggestions {
          text-align: center;
          padding: 2rem;
          color: #7f8c8d;
        }

        .general-tips {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #e0e0e0;
        }

        .general-tips ul {
          list-style: none;
          padding: 0;
        }

        .general-tips li {
          padding: 0.5rem 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .general-tips li:before {
          content: "⚡ ";
          margin-right: 0.5rem;
        }

        @media (max-width: 768px) {
          .performance-content {
            width: 95vw;
            height: 90vh;
          }

          .metrics-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }

          .benchmark-item, .issue-item, .suggestion-item {
            flex-direction: column;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default PerformancePanel;