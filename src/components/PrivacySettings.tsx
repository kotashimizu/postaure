import { useState, useEffect } from 'react';
import { localStorageService, type UserPreferences } from '../services/LocalStorageService';

interface PrivacySettingsProps {
  onClose: () => void;
}

export default function PrivacySettings({ onClose }: PrivacySettingsProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(localStorageService.getPreferences());
  const [hasConsent, setHasConsent] = useState(localStorageService.hasPrivacyConsent());
  const [storageUsage, setStorageUsage] = useState(localStorageService.getStorageUsage());

  useEffect(() => {
    // Update storage usage periodically
    const interval = setInterval(() => {
      setStorageUsage(localStorageService.getStorageUsage());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleConsentChange = (consent: boolean) => {
    setHasConsent(consent);
    localStorageService.setPrivacyConsent(consent);
    
    if (!consent) {
      // Reset preferences to defaults if consent is revoked
      setPreferences(localStorageService.getPreferences());
    }
  };

  const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    localStorageService.setPreferences(updated);
  };

  const handleClearHistory = () => {
    if (confirm('分析履歴をすべて削除しますか？この操作は元に戻せません。')) {
      localStorageService.clearAnalysisHistory();
      setStorageUsage(localStorageService.getStorageUsage());
    }
  };

  const handleClearAllData = () => {
    if (confirm('すべてのデータを削除しますか？設定と履歴がすべて消去されます。この操作は元に戻せません。')) {
      localStorageService.clearAllData();
      setPreferences(localStorageService.getPreferences());
      setHasConsent(false);
      setStorageUsage(localStorageService.getStorageUsage());
    }
  };

  const handleExportData = () => {
    try {
      const data = localStorageService.exportUserData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `postaure-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('データのエクスポートに失敗しました。');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="privacy-settings-overlay">
      <div className="privacy-settings-modal">
        <div className="privacy-settings-header">
          <h2>プライバシー設定</h2>
          <button onClick={onClose} className="close-button" aria-label="設定を閉じる">
            ✕
          </button>
        </div>

        <div className="privacy-settings-content">
          {/* Privacy Consent */}
          <section className="settings-section">
            <h3>データ保存の同意</h3>
            <div className="consent-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={hasConsent}
                  onChange={(e) => handleConsentChange(e.target.checked)}
                />
                <span>デバイスにデータを保存することに同意します</span>
              </label>
              <p className="consent-note">
                分析履歴や設定をブラウザのローカルストレージに保存します。
                データは外部に送信されず、デバイス内にのみ保存されます。
              </p>
            </div>
          </section>

          {hasConsent && (
            <>
              {/* History Settings */}
              <section className="settings-section">
                <h3>履歴設定</h3>
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={preferences.saveHistory}
                      onChange={(e) => handlePreferenceChange('saveHistory', e.target.checked)}
                    />
                    <span>分析履歴を保存する</span>
                  </label>
                </div>

                {preferences.saveHistory && (
                  <>
                    <div className="setting-item">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={preferences.includeThumbnails}
                          onChange={(e) => handlePreferenceChange('includeThumbnails', e.target.checked)}
                        />
                        <span>画像のサムネイルを保存する</span>
                      </label>
                      <p className="setting-note">
                        注意: サムネイルを保存するとストレージ使用量が大幅に増加します
                      </p>
                    </div>

                    <div className="setting-item">
                      <label>
                        <span>最大保存件数: {preferences.maxHistoryItems}件</span>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          value={preferences.maxHistoryItems}
                          onChange={(e) => handlePreferenceChange('maxHistoryItems', parseInt(e.target.value))}
                          className="range-input"
                        />
                      </label>
                    </div>

                    <div className="setting-item">
                      <label>
                        <span>自動削除: {preferences.autoDeleteAfterDays}日後</span>
                        <input
                          type="range"
                          min="7"
                          max="365"
                          value={preferences.autoDeleteAfterDays}
                          onChange={(e) => handlePreferenceChange('autoDeleteAfterDays', parseInt(e.target.value))}
                          className="range-input"
                        />
                      </label>
                    </div>
                  </>
                )}
              </section>

              {/* Accessibility Settings */}
              <section className="settings-section">
                <h3>アクセシビリティ</h3>
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={preferences.largeText}
                      onChange={(e) => handlePreferenceChange('largeText', e.target.checked)}
                    />
                    <span>大きな文字を使用</span>
                  </label>
                </div>

                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={preferences.reduceMotion}
                      onChange={(e) => handlePreferenceChange('reduceMotion', e.target.checked)}
                    />
                    <span>アニメーションを減らす</span>
                  </label>
                </div>
              </section>

              {/* Storage Usage */}
              <section className="settings-section">
                <h3>ストレージ使用量</h3>
                <div className="storage-info">
                  <div className="storage-bar">
                    <div 
                      className="storage-used"
                      style={{ width: `${(storageUsage.used / (storageUsage.used + storageUsage.available)) * 100}%` }}
                    />
                  </div>
                  <p>
                    使用中: {formatBytes(storageUsage.used)} / 
                    利用可能: {formatBytes(storageUsage.available)}
                  </p>
                </div>
              </section>

              {/* Data Management */}
              <section className="settings-section">
                <h3>データ管理</h3>
                <div className="data-actions">
                  <button onClick={handleExportData} className="btn-secondary">
                    データをエクスポート
                  </button>
                  <button onClick={handleClearHistory} className="btn-secondary">
                    履歴をクリア
                  </button>
                  <button onClick={handleClearAllData} className="btn-danger">
                    すべてのデータを削除
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}