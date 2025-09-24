import { useState, useEffect } from 'react';

interface CameraDebugInfo {
  isSecureContext: boolean;
  protocol: string;
  hostname: string;
  hasNavigator: boolean;
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
  userAgent: string;
  videoDevices: Array<{
    label: string;
    deviceId: string;
  }>;
  lastError?: {
    name: string;
    message: string;
    constraint?: string;
  };
}

interface CameraDebugPanelProps {
  onDebugInfo?: (info: CameraDebugInfo) => void;
}

export default function CameraDebugPanel({ onDebugInfo }: CameraDebugPanelProps) {
  const [debugInfo, setDebugInfo] = useState<CameraDebugInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const collectDebugInfo = async (): Promise<CameraDebugInfo> => {
    const info: CameraDebugInfo = {
      isSecureContext: window.isSecureContext,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      hasNavigator: !!navigator,
      hasMediaDevices: !!navigator.mediaDevices,
      hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      userAgent: navigator.userAgent,
      videoDevices: []
    };

    // Try to enumerate devices
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        info.videoDevices = devices
          .filter(device => device.kind === 'videoinput')
          .map(d => ({ label: d.label, deviceId: d.deviceId }));
      } catch (error) {
        console.warn('Could not enumerate devices:', error);
      }
    }

    return info;
  };

  const testCameraAccess = async () => {
    const info = await collectDebugInfo();

    if (!info.hasGetUserMedia) {
      info.lastError = {
        name: 'NotSupportedError',
        message: 'getUserMedia is not supported'
      };
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (error: any) {
        info.lastError = {
          name: error.name,
          message: error.message,
          constraint: error.constraint
        };
      }
    }

    setDebugInfo(info);
    onDebugInfo?.(info);
  };

  useEffect(() => {
    collectDebugInfo().then(info => {
      setDebugInfo(info);
      onDebugInfo?.(info);
    });
  }, [onDebugInfo]);

  if (!debugInfo) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      zIndex: 9999,
      backgroundColor: 'white',
      border: '1px solid #ccc',
      borderRadius: '4px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }}>
      <button
        onClick={() => setIsVisible(!isVisible)}
        style={{
          padding: '8px 12px',
          border: 'none',
          background: debugInfo.lastError ? '#ff4444' : '#4CAF50',
          color: 'white',
          cursor: 'pointer',
          borderRadius: '4px'
        }}
      >
        Camera Debug {isVisible ? '▼' : '▶'}
      </button>

      {isVisible && (
        <div style={{
          padding: '12px',
          width: '300px',
          fontSize: '12px',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          <h4>Environment</h4>
          <div>🔒 Secure Context: {debugInfo.isSecureContext ? '✅' : '❌'}</div>
          <div>🌐 Protocol: {debugInfo.protocol}</div>
          <div>🏠 Hostname: {debugInfo.hostname}</div>
          <div>📱 User Agent: {debugInfo.userAgent.substring(0, 50)}...</div>

          <h4>API Support</h4>
          <div>Navigator: {debugInfo.hasNavigator ? '✅' : '❌'}</div>
          <div>MediaDevices: {debugInfo.hasMediaDevices ? '✅' : '❌'}</div>
          <div>GetUserMedia: {debugInfo.hasGetUserMedia ? '✅' : '❌'}</div>

          <h4>Video Devices ({debugInfo.videoDevices.length})</h4>
          {debugInfo.videoDevices.length === 0 ? (
            <div>No video devices found</div>
          ) : (
            debugInfo.videoDevices.map((device, i) => (
              <div key={i}>
                📹 {device.label || `Device ${i + 1}`}
              </div>
            ))
          )}

          {debugInfo.lastError && (
            <>
              <h4 style={{ color: '#ff4444' }}>Last Error</h4>
              <div><strong>{debugInfo.lastError.name}</strong></div>
              <div>{debugInfo.lastError.message}</div>
              {debugInfo.lastError.constraint && (
                <div>Constraint: {debugInfo.lastError.constraint}</div>
              )}
            </>
          )}

          <button
            onClick={testCameraAccess}
            style={{
              marginTop: '8px',
              padding: '4px 8px',
              border: '1px solid #ccc',
              background: '#f5f5f5',
              cursor: 'pointer',
              borderRadius: '2px',
              fontSize: '11px'
            }}
          >
            Test Camera Access
          </button>
        </div>
      )}
    </div>
  );
}