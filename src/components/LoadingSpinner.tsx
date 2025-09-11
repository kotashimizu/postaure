import React from 'react';
import type { BaseComponentProps } from '../types';

interface LoadingSpinnerProps extends BaseComponentProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  centered?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  message,
  centered = true,
  className = '',
  style
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const wrapperClasses = [
    'loading-spinner',
    centered ? 'flex flex-col items-center justify-center' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses} style={style}>
      <div 
        className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}
        role="status"
        aria-label={message || 'Loading...'}
      />
      {message && (
        <p className="mt-2 text-sm text-gray-600" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;