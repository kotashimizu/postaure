import React, { useState, useEffect } from 'react';
import { compatibilityChecker, type CompatibilityResult } from '../utils/compatibilityChecker';
import { deviceDetection, type DeviceInfo } from '../utils/deviceDetection';

interface CompatibilityCheckProps {
  onComplete?: (result: CompatibilityResult, deviceInfo: DeviceInfo) => void;
  showDetails?: boolean;
  className?: string;
}

const CompatibilityCheck: React.FC<CompatibilityCheckProps> = ({
  onComplete,
  showDetails = false,
  className = ''
}) => {
  const [compatibilityResult, setCompatibilityResult] = useState<CompatibilityResult | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    performCompatibilityCheck();
  }, []);

  const performCompatibilityCheck = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Run compatibility checks in parallel
      const [compatResult, devInfo] = await Promise.all([
        compatibilityChecker.checkCompatibility(),
        deviceDetection.getDeviceInfo()
      ]);

      setCompatibilityResult(compatResult);
      setDeviceInfo(devInfo);

      // Notify parent component
      if (onComplete) {
        onComplete(compatResult, devInfo);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '互換性チェック中にエラーが発生しました';
      setError(errorMessage);
      console.error('Compatibility check failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error': return '#e74c3c';
      case 'warning': return '#f1c40f';
      case 'info': return '#3498db';
      default: return '#95a5a6';
    }
  };

  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '•';
    }
  };

  const getLevelColor = (level: 'full' | 'partial' | 'unsupported') => {
    switch (level) {
      case 'full': return '#27ae60';
      case 'partial': return '#f1c40f';
      case 'unsupported': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const getLevelText = (level: 'full' | 'partial' | 'unsupported') => {
    switch (level) {
      case 'full': return '完全対応';
      case 'partial': return '部分対応';
      case 'unsupported': return '非対応';
      default: return '不明';
    }
  };

  if (isLoading) {
    return (
      <div className={`compatibility-check loading ${className}`} style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '1rem' }}>
          <div className="spinner" style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e3e3e3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
        </div>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#2c3e50' }}>互換性をチェック中...</h3>
        <p style={{ margin: '0', color: '#7f8c8d', fontSize: '0.9rem' }}>
          デバイスとブラウザの対応状況を確認しています
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`compatibility-check error ${className}`} style={{
        padding: '2rem',
        textAlign: 'center',
        border: '2px solid #e74c3c',
        borderRadius: '8px',
        background: '#fdf2f2'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌</div>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#e74c3c' }}>チェックに失敗しました</h3>
        <p style={{ margin: '0 0 1rem 0', color: '#c0392b', fontSize: '0.9rem' }}>
          {error}
        </p>
        <button
          onClick={performCompatibilityCheck}
          style={{
            padding: '0.5rem 1rem',
            background: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          再試行
        </button>
      </div>
    );
  }

  if (!compatibilityResult || !deviceInfo) {
    return null;
  }

  const hasErrors = compatibilityResult.issues.some(issue => issue.severity === 'error');

  return (
    <div className={`compatibility-check ${className}`} style={{
      border: `2px solid ${getLevelColor(compatibilityResult.level)}`,
      borderRadius: '12px',
      background: 'white',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        background: getLevelColor(compatibilityResult.level),
        color: 'white',
        padding: '1rem',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          {compatibilityResult.isSupported ? '✅' : hasErrors ? '❌' : '⚠️'}
        </div>
        <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem' }}>
          {getLevelText(compatibilityResult.level)}
        </h3>
        <p style={{ margin: '0', fontSize: '0.9rem', opacity: 0.9 }}>
          スコア: {compatibilityResult.score}/100
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: '1rem' }}>
        {/* Device Info Summary */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
            <div>
              <strong>デバイス:</strong> {deviceInfo.isMobile ? 'モバイル' : deviceInfo.isTablet ? 'タブレット' : 'デスクトップ'}
            </div>
            <div>
              <strong>プラットフォーム:</strong> {deviceInfo.platform}
            </div>
            <div>
              <strong>ブラウザ:</strong> {deviceInfo.browser}
            </div>
            <div>
              <strong>画面サイズ:</strong> {deviceInfo.screenSize}
            </div>
          </div>
        </div>

        {/* Issues Summary */}
        {compatibilityResult.issues.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: '0.85rem' }}>
              <span style={{ color: '#e74c3c' }}>
                ❌ {compatibilityResult.issues.filter(i => i.severity === 'error').length} エラー
              </span>
              <span style={{ color: '#f1c40f' }}>
                ⚠️ {compatibilityResult.issues.filter(i => i.severity === 'warning').length} 警告
              </span>
              <span style={{ color: '#3498db' }}>
                ℹ️ {compatibilityResult.issues.filter(i => i.severity === 'info').length} 情報
              </span>
            </div>
          </div>
        )}

        {/* Key Issues */}
        {compatibilityResult.issues.filter(issue => issue.severity === 'error').slice(0, 3).length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#2c3e50' }}>主要な問題</h4>
            {compatibilityResult.issues
              .filter(issue => issue.severity === 'error')
              .slice(0, 3)
              .map((issue, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  fontSize: '0.85rem'
                }}>
                  <span style={{ color: getSeverityColor(issue.severity) }}>
                    {getSeverityIcon(issue.severity)}
                  </span>
                  <div>
                    <strong>{issue.feature}:</strong> {issue.description}
                    {issue.solution && (
                      <div style={{ color: '#7f8c8d', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        💡 {issue.solution}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Recommendations */}
        {compatibilityResult.recommendations.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#2c3e50' }}>推奨事項</h4>
            {compatibilityResult.recommendations.slice(0, 2).map((recommendation, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                fontSize: '0.85rem',
                color: '#34495e'
              }}>
                <span>💡</span>
                <span>{recommendation}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          {showDetails && (
            <button
              onClick={() => setShowDetailedReport(!showDetailedReport)}
              style={{
                padding: '0.5rem 0.75rem',
                background: 'transparent',
                color: '#3498db',
                border: '1px solid #3498db',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              {showDetailedReport ? '詳細を非表示' : '詳細レポート'}
            </button>
          )}
          
          <button
            onClick={performCompatibilityCheck}
            style={{
              padding: '0.5rem 0.75rem',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            再チェック
          </button>
        </div>

        {/* Detailed Report */}
        {showDetailedReport && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#f8f9fa',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            maxHeight: '300px',
            overflow: 'auto'
          }}>
            {compatibilityChecker.generateCompatibilityReport(compatibilityResult)}
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default CompatibilityCheck;