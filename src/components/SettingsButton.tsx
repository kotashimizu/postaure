import React, { useState } from 'react';
import SettingsPanel from './SettingsPanel';
import { useSettings } from '../hooks/useSettings';

interface SettingsButtonProps {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'icon' | 'text' | 'full';
  position?: 'fixed' | 'relative';
}

const SettingsButton: React.FC<SettingsButtonProps> = ({
  className = '',
  size = 'medium',
  variant = 'icon',
  position = 'relative'
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isModified } = useSettings();

  const sizeStyles = {
    small: { fontSize: '0.8rem', padding: '0.5rem' },
    medium: { fontSize: '1rem', padding: '0.75rem' },
    large: { fontSize: '1.2rem', padding: '1rem' }
  };

  const buttonStyle = {
    ...sizeStyles[size],
    background: 'white',
    border: '2px solid #e0e0e0',
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: position as any,
    zIndex: 10,
    ...(position === 'fixed' && {
      bottom: '2rem',
      right: '2rem',
    })
  };

  const getButtonContent = () => {
    switch (variant) {
      case 'text':
        return '設定';
      case 'full':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⚙️ 設定
            {isModified && (
              <span style={{
                width: '6px',
                height: '6px',
                background: '#f39c12',
                borderRadius: '50%'
              }} />
            )}
          </span>
        );
      case 'icon':
      default:
        return (
          <div style={{ position: 'relative' }}>
            ⚙️
            {isModified && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '8px',
                height: '8px',
                background: '#f39c12',
                borderRadius: '50%',
                border: '2px solid white'
              }} />
            )}
          </div>
        );
    }
  };

  return (
    <>
      <button
        className={`settings-button ${className}`}
        style={buttonStyle}
        onClick={() => setIsSettingsOpen(true)}
        title="設定を開く"
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#3498db';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#e0e0e0';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {getButtonContent()}
      </button>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};

export default SettingsButton;