import React, { useState, useEffect } from 'react';
import { apiConfigService } from '../services/APIConfigService';
import type { APIEndpoint, APICapability } from '../services/APIConfigService';

interface APIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const APIConfigModal: React.FC<APIConfigModalProps> = ({ isOpen, onClose }) => {
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<APIEndpoint>>({});
  const [testResults, setTestResults] = useState<Map<string, { success: boolean; message: string; latency?: number }>>(new Map());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadEndpoints();
    }
  }, [isOpen]);

  const loadEndpoints = () => {
    const allEndpoints = apiConfigService.getEndpoints();
    setEndpoints(allEndpoints);
    setSelectedEndpoint(allEndpoints[0] || null);
  };

  const handleEdit = (endpoint: APIEndpoint | null) => {
    if (endpoint) {
      setEditForm({ ...endpoint });
    } else {
      // New endpoint
      setEditForm({
        id: '',
        name: '',
        url: '',
        apiKey: '',
        enabled: false,
        provider: 'custom',
        capabilities: []
      });
    }
    setIsEditing(true);
    setValidationErrors([]);
  };

  const handleSave = async () => {
    const errors = apiConfigService.validateEndpoint(editForm);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (editForm.id && endpoints.find(e => e.id === editForm.id)) {
      // Update existing
      const success = apiConfigService.updateEndpoint(editForm.id, editForm);
      if (success) {
        loadEndpoints();
        setIsEditing(false);
      }
    } else {
      // Add new
      const newEndpoint: APIEndpoint = {
        ...editForm as APIEndpoint,
        id: editForm.id || `custom-${Date.now()}`
      };
      const success = apiConfigService.addEndpoint(newEndpoint);
      if (success) {
        loadEndpoints();
        setIsEditing(false);
      }
    }
  };

  const handleDelete = (endpointId: string) => {
    if (confirm('このエンドポイントを削除しますか？')) {
      apiConfigService.removeEndpoint(endpointId);
      loadEndpoints();
      if (selectedEndpoint?.id === endpointId) {
        setSelectedEndpoint(endpoints[0] || null);
      }
    }
  };

  const handleTest = async (endpointId: string) => {
    const result = await apiConfigService.testEndpoint(endpointId);
    setTestResults(prev => new Map(prev).set(endpointId, result));
  };

  const formatCapability = (capability: APICapability) => {
    const labels: Record<string, string> = {
      'analysis': 'AI解析',
      'report_generation': 'レポート生成',
      'ai_insights': 'AI洞察',
      'cloud_storage': 'クラウド保存'
    };
    return labels[capability.type] || capability.type;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content api-config-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>API設定</h2>
          <button className="close-button" onClick={onClose} aria-label="閉じる">×</button>
        </div>

        <div className="api-config-content">
          <div className="endpoints-list">
            <div className="endpoints-header">
              <h3>エンドポイント一覧</h3>
              <button 
                className="add-endpoint-button"
                onClick={() => handleEdit(null)}
              >
                + 新規追加
              </button>
            </div>

            {endpoints.map(endpoint => (
              <div 
                key={endpoint.id}
                className={`endpoint-item ${selectedEndpoint?.id === endpoint.id ? 'selected' : ''}`}
                onClick={() => setSelectedEndpoint(endpoint)}
              >
                <div className="endpoint-info">
                  <div className="endpoint-name">
                    {endpoint.name}
                    {endpoint.enabled && endpoint.apiKey && (
                      <span className="status-badge enabled">有効</span>
                    )}
                  </div>
                  <div className="endpoint-provider">{endpoint.provider}</div>
                  <div className="endpoint-capabilities">
                    {endpoint.capabilities.map(cap => (
                      <span key={cap.type} className="capability-tag">
                        {formatCapability(cap)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="endpoint-actions">
                  <button
                    className="test-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTest(endpoint.id);
                    }}
                    disabled={!endpoint.enabled || !endpoint.apiKey}
                  >
                    テスト
                  </button>
                  {testResults.get(endpoint.id) && (
                    <div className={`test-result ${testResults.get(endpoint.id)!.success ? 'success' : 'error'}`}>
                      {testResults.get(endpoint.id)!.message}
                      {testResults.get(endpoint.id)!.latency && (
                        <span className="latency">({testResults.get(endpoint.id)!.latency}ms)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedEndpoint && !isEditing && (
            <div className="endpoint-details">
              <div className="details-header">
                <h3>{selectedEndpoint.name}</h3>
                <div className="details-actions">
                  <button
                    className="edit-button"
                    onClick={() => handleEdit(selectedEndpoint)}
                  >
                    編集
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => handleDelete(selectedEndpoint.id)}
                  >
                    削除
                  </button>
                </div>
              </div>

              <div className="details-content">
                <div className="detail-row">
                  <label>URL:</label>
                  <span>{selectedEndpoint.url}</span>
                </div>
                <div className="detail-row">
                  <label>プロバイダー:</label>
                  <span>{selectedEndpoint.provider}</span>
                </div>
                <div className="detail-row">
                  <label>ステータス:</label>
                  <span className={selectedEndpoint.enabled ? 'enabled' : 'disabled'}>
                    {selectedEndpoint.enabled ? '有効' : '無効'}
                  </span>
                </div>
                <div className="detail-row">
                  <label>APIキー:</label>
                  <span>{selectedEndpoint.apiKey ? '設定済み' : '未設定'}</span>
                </div>

                <h4>機能</h4>
                {selectedEndpoint.capabilities.map(capability => (
                  <div key={capability.type} className="capability-detail">
                    <strong>{formatCapability(capability)}</strong>
                    <p>{capability.description}</p>
                    {capability.costPerRequest && (
                      <small>コスト: ${capability.costPerRequest}/リクエスト</small>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isEditing && (
            <div className="endpoint-form">
              <h3>{editForm.id && endpoints.find(e => e.id === editForm.id) ? 'エンドポイント編集' : '新規エンドポイント'}</h3>
              
              {validationErrors.length > 0 && (
                <div className="validation-errors">
                  {validationErrors.map((error, index) => (
                    <div key={index} className="error-message">{error}</div>
                  ))}
                </div>
              )}

              <div className="form-group">
                <label>名前 *</label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="例: OpenAI GPT-4 Analysis"
                />
              </div>

              <div className="form-group">
                <label>URL *</label>
                <input
                  type="url"
                  value={editForm.url || ''}
                  onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                  placeholder="https://api.openai.com/v1/chat/completions"
                />
              </div>

              <div className="form-group">
                <label>プロバイダー</label>
                <select
                  value={editForm.provider || 'custom'}
                  onChange={e => setEditForm({ ...editForm, provider: e.target.value as APIEndpoint['provider'] })}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="custom">カスタム</option>
                </select>
              </div>

              <div className="form-group">
                <label>APIキー</label>
                <input
                  type="password"
                  value={editForm.apiKey || ''}
                  onChange={e => setEditForm({ ...editForm, apiKey: e.target.value })}
                  placeholder="sk-..."
                />
                <small>APIキーは安全に暗号化されて保存されます</small>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={editForm.enabled || false}
                    onChange={e => setEditForm({ ...editForm, enabled: e.target.checked })}
                  />
                  このエンドポイントを有効にする
                </label>
              </div>

              <div className="form-actions">
                <button
                  className="save-button"
                  onClick={handleSave}
                >
                  保存
                </button>
                <button
                  className="cancel-button"
                  onClick={() => setIsEditing(false)}
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="api-info">
            <p>
              <strong>プライバシー保護:</strong> APIキーはローカルに暗号化保存され、外部に送信されません。
            </p>
            <p>
              <strong>オプション機能:</strong> API統合は任意の機能です。ローカル分析のみでも完全に利用できます。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIConfigModal;