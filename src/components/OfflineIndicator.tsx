import React, { useState, useEffect } from 'react';
import { offlineService } from '../services/OfflineService';
import type { OfflineCapabilities, SyncStatus } from '../services/OfflineService';

interface OfflineIndicatorProps {
  className?: string;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className = '' }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [capabilities, setCapabilities] = useState<OfflineCapabilities | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Load initial capabilities
    loadCapabilities();
    loadSyncStatus();

    // Setup event listeners
    const handleOnline = () => {
      setIsOnline(true);
      loadCapabilities();
      loadSyncStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      loadCapabilities();
    };

    const handleSyncStart = () => {
      setSyncStatus(prev => prev ? { ...prev, syncing: true } : null);
    };

    const handleSyncComplete = (data: any) => {
      loadSyncStatus();
      if (data && (data.synced > 0 || data.failed > 0)) {
        showSyncNotification(`同期完了: ${data.synced}件成功, ${data.failed}件失敗`);
      }
    };

    const handleUpdateAvailable = () => {
      showUpdateNotification();
    };

    // Add event listeners
    offlineService.addEventListener('online', handleOnline);
    offlineService.addEventListener('offline', handleOffline);
    offlineService.addEventListener('sync-start', handleSyncStart);
    offlineService.addEventListener('sync-complete', handleSyncComplete);
    offlineService.addEventListener('update-available', handleUpdateAvailable);

    // Cleanup
    return () => {
      offlineService.removeEventListener('online', handleOnline);
      offlineService.removeEventListener('offline', handleOffline);
      offlineService.removeEventListener('sync-start', handleSyncStart);
      offlineService.removeEventListener('sync-complete', handleSyncComplete);
      offlineService.removeEventListener('update-available', handleUpdateAvailable);
    };
  }, []);

  const loadCapabilities = async () => {
    try {
      const caps = await offlineService.getCapabilities();
      setCapabilities(caps);
    } catch (error) {
      console.error('Failed to load offline capabilities:', error);
    }
  };

  const loadSyncStatus = () => {
    const status = offlineService.getSyncStatus();
    setSyncStatus(status);
  };

  const handleSync = async () => {
    if (!isOnline || syncStatus?.syncing) return;
    
    try {
      await offlineService.syncOfflineData();
    } catch (error) {
      console.error('Manual sync failed:', error);
      showErrorNotification('同期に失敗しました');
    }
  };

  const handleClearCache = async () => {
    if (confirm('キャッシュをクリアしますか？オフライン機能が無効になります。')) {
      try {
        await offlineService.clearCache();
        showNotification('キャッシュをクリアしました', 'success');
      } catch (error) {
        console.error('Failed to clear cache:', error);
        showErrorNotification('キャッシュクリアに失敗しました');
      }
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await offlineService.forceUpdate();
    } catch (error) {
      console.error('Update failed:', error);
      showErrorNotification('アップデートに失敗しました');
    } finally {
      setIsUpdating(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Simple notification - could be replaced with a proper notification system
    const notification = document.createElement('div');
    notification.className = `offline-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
  };

  const showSyncNotification = (message: string) => showNotification(message, 'success');
  const showErrorNotification = (message: string) => showNotification(message, 'error');
  const showUpdateNotification = () => showNotification('新しいバージョンが利用可能です', 'info');

  if (!capabilities) {
    return null;
  }

  const getStatusColor = () => {
    if (!isOnline) return '#e74c3c'; // Red for offline
    if (syncStatus?.pending && syncStatus.pending > 0) return '#f1c40f'; // Yellow for pending sync
    return '#27ae60'; // Green for online and synced
  };

  const getStatusText = () => {
    if (!isOnline) return 'オフライン';
    if (syncStatus?.syncing) return '同期中...';
    if (syncStatus?.pending && syncStatus.pending > 0) return `${syncStatus.pending}件未同期`;
    return 'オンライン';
  };

  return (
    <div className={`offline-indicator ${className}`}>
      <div 
        className="status-badge"
        onClick={() => setShowDetails(!showDetails)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.9)',
          border: `2px solid ${getStatusColor()}`,
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: '500',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <div
          className="status-dot"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: getStatusColor(),
            animation: !isOnline ? 'pulse 1s infinite' : 'none'
          }}
        />
        <span>{getStatusText()}</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
          {showDetails ? '▲' : '▼'}
        </span>
      </div>

      {showDetails && (
        <div 
          className="offline-details"
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '0.5rem',
            background: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            padding: '1rem',
            minWidth: '250px',
            fontSize: '0.85rem',
            zIndex: 1000
          }}
        >
          <div style={{ marginBottom: '0.75rem', fontWeight: '600', color: '#2c3e50' }}>
            オフライン機能状況
          </div>
          
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>接続状態:</span>
              <span style={{ color: getStatusColor(), fontWeight: '500' }}>
                {isOnline ? 'オンライン' : 'オフライン'}
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>オフライン分析:</span>
              <span style={{ color: capabilities.canAnalyzeOffline ? '#27ae60' : '#e74c3c' }}>
                {capabilities.canAnalyzeOffline ? '利用可能' : '利用不可'}
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>キャッシュサイズ:</span>
              <span style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>{capabilities.cacheSize}</span>
            </div>
          </div>

          {syncStatus && (
            <div style={{ marginBottom: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #ecf0f1' }}>
              <div style={{ marginBottom: '0.5rem', fontWeight: '500', color: '#34495e' }}>
                同期状況
              </div>
              
              {syncStatus.pending > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>未同期データ:</span>
                  <span style={{ color: '#f1c40f', fontWeight: '500' }}>
                    {syncStatus.pending}件
                  </span>
                </div>
              )}
              
              {syncStatus.lastSync && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>最終同期:</span>
                  <span style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>
                    {new Date(syncStatus.lastSync).toLocaleString('ja-JP')}
                  </span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {isOnline && syncStatus?.pending && syncStatus.pending > 0 && (
              <button
                onClick={handleSync}
                disabled={syncStatus.syncing}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  cursor: syncStatus.syncing ? 'not-allowed' : 'pointer',
                  opacity: syncStatus.syncing ? 0.6 : 1
                }}
              >
                {syncStatus.syncing ? '同期中...' : '今すぐ同期'}
              </button>
            )}
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleClearCache}
                style={{
                  padding: '0.4rem 0.6rem',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                キャッシュクリア
              </button>
              
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                style={{
                  padding: '0.4rem 0.6rem',
                  background: '#9b59b6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  opacity: isUpdating ? 0.6 : 1,
                  flex: 1
                }}
              >
                {isUpdating ? '更新中...' : 'アップデート'}
              </button>
            </div>
          </div>

          {syncStatus?.errors && syncStatus.errors.length > 0 && (
            <div style={{ 
              marginTop: '0.75rem', 
              paddingTop: '0.75rem', 
              borderTop: '1px solid #ecf0f1',
              maxHeight: '100px',
              overflow: 'auto'
            }}>
              <div style={{ marginBottom: '0.5rem', fontWeight: '500', color: '#e74c3c', fontSize: '0.8rem' }}>
                同期エラー ({syncStatus.errors.length}件)
              </div>
              {syncStatus.errors.slice(-3).map((error, index) => (
                <div key={index} style={{ fontSize: '0.7rem', color: '#7f8c8d', marginBottom: '0.25rem' }}>
                  {error.split(': ')[1] || error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }

          .offline-indicator {
            position: relative;
          }

          .offline-details {
            animation: slideIn 0.2s ease;
          }

          /* Close details when clicking outside */
          .offline-indicator[data-show-details="true"] {
            /* This could be enhanced with click-outside logic */
          }
        `}
      </style>
    </div>
  );
};

export default OfflineIndicator;