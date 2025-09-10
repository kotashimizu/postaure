import React, { useState, useRef } from 'react';
import { useSettings, useSettingsPresets, useSettingsImportExport } from '../hooks/useSettings';
import { SETTINGS_CATEGORIES, type SettingItem } from '../types/settings';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, className = '' }) => {
  const { settings, updateSettings, resetSettings, isModified } = useSettings();
  const { presets, applyPreset } = useSettingsPresets();
  const { downloadSettings, importSettings } = useSettingsImportExport();
  
  const [activeCategory, setActiveCategory] = useState('display');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSettingChange = (settingId: keyof typeof settings, value: any) => {
    updateSettings({ [settingId]: value });
  };

  const handlePresetApply = (presetId: string) => {
    applyPreset(presetId);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      const success = await importSettings(importData);
      
      if (success) {
        setImportError(null);
      } else {
        setImportError('設定のインポートに失敗しました');
      }
    } catch (error) {
      setImportError('ファイルの読み込みに失敗しました');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderSettingControl = (setting: SettingItem) => {
    const value = settings[setting.id];
    const isDisabled = setting.requires && !settings[setting.requires];

    switch (setting.type) {
      case 'boolean':
        return (
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={value as boolean}
              disabled={isDisabled}
              onChange={(e) => handleSettingChange(setting.id, e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        );

      case 'select':
        return (
          <select
            value={value as string}
            disabled={isDisabled}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            className="setting-select"
          >
            {setting.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'slider':
        return (
          <div className="slider-container">
            <input
              type="range"
              min={setting.min}
              max={setting.max}
              step={setting.step}
              value={value as number}
              disabled={isDisabled}
              onChange={(e) => handleSettingChange(setting.id, parseFloat(e.target.value))}
              className="setting-slider"
            />
            <span className="slider-value">
              {(value as number).toFixed(1)}{setting.unit}
            </span>
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            min={setting.min}
            max={setting.max}
            value={value as number}
            disabled={isDisabled}
            onChange={(e) => handleSettingChange(setting.id, parseInt(e.target.value))}
            className="setting-number"
          />
        );

      case 'text':
        return (
          <input
            type="text"
            value={value as string}
            disabled={isDisabled}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            className="setting-text"
          />
        );

      default:
        return <span>Unsupported setting type</span>;
    }
  };

  const filteredCategories = SETTINGS_CATEGORIES.filter(category => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return category.name.toLowerCase().includes(query) ||
           category.description.toLowerCase().includes(query) ||
           category.settings.some(setting => 
             setting.name.toLowerCase().includes(query) ||
             setting.description.toLowerCase().includes(query)
           );
  });

  const activeSettings = SETTINGS_CATEGORIES.find(c => c.id === activeCategory)?.settings
    .filter(setting => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return setting.name.toLowerCase().includes(query) ||
             setting.description.toLowerCase().includes(query);
    }) || [];

  return (
    <div className={`settings-panel ${className}`}>
      <div className="settings-overlay" onClick={onClose}></div>
      <div className="settings-content">
        {/* Header */}
        <div className="settings-header">
          <h2>設定</h2>
          <div className="settings-header-actions">
            {isModified && (
              <span className="settings-modified-indicator">
                未保存の変更があります
              </span>
            )}
            <button onClick={onClose} className="settings-close-button">
              ✕
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="settings-search">
          <input
            type="text"
            placeholder="設定を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="settings-search-input"
          />
        </div>

        <div className="settings-body">
          {/* Sidebar */}
          <div className="settings-sidebar">
            <div className="settings-categories">
              {filteredCategories.map(category => (
                <button
                  key={category.id}
                  className={`settings-category ${activeCategory === category.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(category.id)}
                >
                  <span className="category-icon">{category.icon}</span>
                  <div className="category-info">
                    <div className="category-name">{category.name}</div>
                    <div className="category-description">{category.description}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Presets */}
            <div className="settings-presets">
              <h4>プリセット</h4>
              <div className="preset-buttons">
                {presets.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetApply(preset.id)}
                    className="preset-button"
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="settings-actions">
              <button
                onClick={downloadSettings}
                className="action-button export"
              >
                📥 エクスポート
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="action-button import"
              >
                📤 インポート
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
              <button
                onClick={() => setShowConfirmReset(true)}
                className="action-button reset"
                disabled={!isModified}
              >
                🔄 リセット
              </button>
            </div>

            {importError && (
              <div className="import-error">
                {importError}
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="settings-main">
            <div className="settings-category-header">
              <h3>
                {SETTINGS_CATEGORIES.find(c => c.id === activeCategory)?.icon}{' '}
                {SETTINGS_CATEGORIES.find(c => c.id === activeCategory)?.name}
              </h3>
              <p>{SETTINGS_CATEGORIES.find(c => c.id === activeCategory)?.description}</p>
            </div>

            <div className="settings-list">
              {activeSettings.map(setting => (
                <div key={setting.id} className="setting-item">
                  <div className="setting-info">
                    <div className="setting-name">{setting.name}</div>
                    <div className="setting-description">{setting.description}</div>
                    {setting.requires && !settings[setting.requires] && (
                      <div className="setting-disabled-note">
                        {setting.requires}が有効になっている必要があります
                      </div>
                    )}
                  </div>
                  <div className="setting-control">
                    {renderSettingControl(setting)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reset confirmation dialog */}
        {showConfirmReset && (
          <div className="confirm-dialog-overlay">
            <div className="confirm-dialog">
              <h3>設定をリセット</h3>
              <p>すべての設定をデフォルト値に戻します。この操作は取り消せません。</p>
              <div className="confirm-dialog-actions">
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="cancel-button"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    resetSettings();
                    setShowConfirmReset(false);
                  }}
                  className="confirm-button"
                >
                  リセット
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .settings-panel {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .settings-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
        }

        .settings-content {
          position: relative;
          width: 90vw;
          max-width: 1000px;
          height: 80vh;
          max-height: 600px;
          background: white;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #e0e0e0;
        }

        .settings-header h2 {
          margin: 0;
          color: #2c3e50;
        }

        .settings-header-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .settings-modified-indicator {
          font-size: 0.85rem;
          color: #f39c12;
          padding: 0.25rem 0.5rem;
          background: rgba(243, 156, 18, 0.1);
          border-radius: 4px;
        }

        .settings-close-button {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #7f8c8d;
          padding: 0.25rem;
        }

        .settings-search {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e0e0e0;
        }

        .settings-search-input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 0.9rem;
        }

        .settings-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .settings-sidebar {
          width: 280px;
          background: #f8f9fa;
          border-right: 1px solid #e0e0e0;
          padding: 1rem;
          overflow-y: auto;
        }

        .settings-category {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          border-radius: 6px;
          margin-bottom: 0.5rem;
        }

        .settings-category:hover {
          background: rgba(52, 152, 219, 0.1);
        }

        .settings-category.active {
          background: #3498db;
          color: white;
        }

        .category-icon {
          font-size: 1.2rem;
        }

        .category-info {
          flex: 1;
        }

        .category-name {
          font-weight: 500;
          font-size: 0.9rem;
        }

        .category-description {
          font-size: 0.8rem;
          opacity: 0.8;
          margin-top: 0.25rem;
        }

        .settings-presets {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e0e0e0;
        }

        .settings-presets h4 {
          margin: 0 0 0.75rem 0;
          font-size: 0.9rem;
          color: #2c3e50;
        }

        .preset-button {
          width: 100%;
          padding: 0.5rem;
          margin-bottom: 0.5rem;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          text-align: left;
        }

        .preset-button:hover {
          border-color: #3498db;
        }

        .settings-actions {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .action-button {
          padding: 0.5rem;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
        }

        .action-button:hover {
          background: #f8f9fa;
        }

        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .import-error {
          margin-top: 0.5rem;
          padding: 0.5rem;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 4px;
          color: #c33;
          font-size: 0.8rem;
        }

        .settings-main {
          flex: 1;
          padding: 1.5rem;
          overflow-y: auto;
        }

        .settings-category-header h3 {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
        }

        .settings-category-header p {
          margin: 0 0 1.5rem 0;
          color: #7f8c8d;
          font-size: 0.9rem;
        }

        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1rem 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .setting-info {
          flex: 1;
          margin-right: 1rem;
        }

        .setting-name {
          font-weight: 500;
          margin-bottom: 0.25rem;
          color: #2c3e50;
        }

        .setting-description {
          font-size: 0.85rem;
          color: #7f8c8d;
          line-height: 1.4;
        }

        .setting-disabled-note {
          font-size: 0.8rem;
          color: #e74c3c;
          margin-top: 0.25rem;
          font-style: italic;
        }

        .setting-control {
          flex-shrink: 0;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 24px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.2s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.2s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background-color: #3498db;
        }

        input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }

        .setting-select,
        .setting-number,
        .setting-text {
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          min-width: 120px;
        }

        .slider-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 160px;
        }

        .setting-slider {
          flex: 1;
        }

        .slider-value {
          font-size: 0.8rem;
          color: #7f8c8d;
          min-width: 50px;
          text-align: right;
        }

        .confirm-dialog-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }

        .confirm-dialog {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          max-width: 400px;
          margin: 1rem;
        }

        .confirm-dialog h3 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
        }

        .confirm-dialog p {
          margin: 0 0 1.5rem 0;
          color: #7f8c8d;
          line-height: 1.4;
        }

        .confirm-dialog-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        .cancel-button,
        .confirm-button {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
        }

        .cancel-button {
          background: white;
          color: #7f8c8d;
        }

        .confirm-button {
          background: #e74c3c;
          color: white;
          border-color: #e74c3c;
        }

        @media (max-width: 768px) {
          .settings-content {
            width: 95vw;
            height: 90vh;
          }

          .settings-body {
            flex-direction: column;
          }

          .settings-sidebar {
            width: 100%;
            max-height: 40%;
            border-right: none;
            border-bottom: 1px solid #e0e0e0;
          }

          .settings-categories {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default SettingsPanel;