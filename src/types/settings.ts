// Application settings types and interfaces

export interface AppSettings {
  // Display settings
  theme: 'light' | 'dark' | 'auto';
  language: 'ja' | 'en';
  uiScale: number;
  showAdvancedFeatures: boolean;
  
  // Analysis settings
  analysisMode: 'basic' | 'advanced' | 'professional';
  imageQuality: number; // 0.1 - 1.0
  processingTimeout: number; // milliseconds
  autoSave: boolean;
  
  // Privacy settings
  dataRetention: 'session' | '7days' | '30days' | 'never';
  shareAnalytics: boolean;
  allowTelemetry: boolean;
  
  // Performance settings
  enableHardwareAcceleration: boolean;
  enableBackgroundProcessing: boolean;
  maxCacheSize: number; // MB
  enableOfflineMode: boolean;
  
  // Camera settings
  preferredCamera: string;
  cameraResolution: 'auto' | '720p' | '1080p' | '4k';
  enableCameraGuide: boolean;
  mirrorMode: boolean;
  
  // Export settings
  defaultExportFormat: 'png' | 'pdf' | 'json';
  exportQuality: number; // 0.1 - 1.0
  includeRawData: boolean;
  watermark: boolean;
  
  // AI settings (optional)
  aiProvider: 'openai' | 'anthropic' | 'disabled';
  aiModel: string;
  apiKey?: string;
  enableAiReports: boolean;
  
  // Accessibility settings
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  
  // Developer settings
  debugMode: boolean;
  showPerformanceMetrics: boolean;
  enableBetaFeatures: boolean;
}

export interface SettingsCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  settings: SettingItem[];
}

export interface SettingItem {
  id: keyof AppSettings;
  type: 'boolean' | 'number' | 'select' | 'text' | 'slider' | 'color';
  name: string;
  description: string;
  defaultValue: any;
  options?: Array<{ value: any; label: string; description?: string }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  validation?: (value: any) => boolean | string;
  requires?: keyof AppSettings; // Conditional dependency
  category: string;
}

export interface SettingsState {
  current: AppSettings;
  defaults: AppSettings;
  modified: boolean;
  version: number;
  lastModified: Date;
}

export interface SettingsPreset {
  id: string;
  name: string;
  description: string;
  settings: Partial<AppSettings>;
  category: 'device' | 'use-case' | 'user' | 'system';
}

export interface SettingsExport {
  version: string;
  exportDate: string;
  settings: AppSettings;
  metadata: {
    deviceType: string;
    browserInfo: string;
    appVersion: string;
  };
}

// Default settings configuration
export const DEFAULT_SETTINGS: AppSettings = {
  // Display settings
  theme: 'auto',
  language: 'ja',
  uiScale: 1.0,
  showAdvancedFeatures: false,
  
  // Analysis settings
  analysisMode: 'advanced',
  imageQuality: 0.8,
  processingTimeout: 30000,
  autoSave: true,
  
  // Privacy settings
  dataRetention: '7days',
  shareAnalytics: false,
  allowTelemetry: false,
  
  // Performance settings
  enableHardwareAcceleration: true,
  enableBackgroundProcessing: true,
  maxCacheSize: 100,
  enableOfflineMode: true,
  
  // Camera settings
  preferredCamera: 'auto',
  cameraResolution: 'auto',
  enableCameraGuide: true,
  mirrorMode: false,
  
  // Export settings
  defaultExportFormat: 'png',
  exportQuality: 0.9,
  includeRawData: false,
  watermark: false,
  
  // AI settings
  aiProvider: 'disabled',
  aiModel: 'gpt-3.5-turbo',
  enableAiReports: false,
  
  // Accessibility settings
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  screenReader: false,
  
  // Developer settings
  debugMode: false,
  showPerformanceMetrics: false,
  enableBetaFeatures: false
};

// Settings categories configuration
export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'display',
    name: '表示設定',
    description: 'テーマ、言語、UI設定',
    icon: '🎨',
    settings: [
      {
        id: 'theme',
        type: 'select',
        name: 'テーマ',
        description: '表示テーマを選択',
        defaultValue: 'auto',
        options: [
          { value: 'light', label: 'ライト' },
          { value: 'dark', label: 'ダーク' },
          { value: 'auto', label: 'システム設定に従う' }
        ],
        category: 'display'
      },
      {
        id: 'language',
        type: 'select',
        name: '言語',
        description: '表示言語を選択',
        defaultValue: 'ja',
        options: [
          { value: 'ja', label: '日本語' },
          { value: 'en', label: 'English' }
        ],
        category: 'display'
      },
      {
        id: 'uiScale',
        type: 'slider',
        name: 'UI拡大率',
        description: 'インターフェースのサイズを調整',
        defaultValue: 1.0,
        min: 0.8,
        max: 2.0,
        step: 0.1,
        unit: '倍',
        category: 'display'
      }
    ]
  },
  {
    id: 'analysis',
    name: '分析設定',
    description: '分析の精度と品質設定',
    icon: '🔬',
    settings: [
      {
        id: 'analysisMode',
        type: 'select',
        name: '分析モード',
        description: '分析の詳細レベルを選択',
        defaultValue: 'advanced',
        options: [
          { value: 'basic', label: '基本', description: '高速で基本的な分析' },
          { value: 'advanced', label: '詳細', description: 'バランスの取れた詳細分析' },
          { value: 'professional', label: 'プロフェッショナル', description: '最高精度の専門的分析' }
        ],
        category: 'analysis'
      },
      {
        id: 'imageQuality',
        type: 'slider',
        name: '画像品質',
        description: '処理する画像の品質',
        defaultValue: 0.8,
        min: 0.3,
        max: 1.0,
        step: 0.1,
        category: 'analysis'
      },
      {
        id: 'processingTimeout',
        type: 'number',
        name: 'タイムアウト時間',
        description: '分析処理の最大時間（秒）',
        defaultValue: 30,
        min: 10,
        max: 120,
        unit: '秒',
        category: 'analysis'
      }
    ]
  },
  {
    id: 'privacy',
    name: 'プライバシー設定',
    description: 'データ保持と共有設定',
    icon: '🔒',
    settings: [
      {
        id: 'dataRetention',
        type: 'select',
        name: 'データ保持期間',
        description: '分析データの保持期間',
        defaultValue: '7days',
        options: [
          { value: 'session', label: 'セッション中のみ' },
          { value: '7days', label: '7日間' },
          { value: '30days', label: '30日間' },
          { value: 'never', label: '永続保存しない' }
        ],
        category: 'privacy'
      },
      {
        id: 'shareAnalytics',
        type: 'boolean',
        name: '匿名分析データの共有',
        description: 'アプリ改善のための匿名データ共有',
        defaultValue: false,
        category: 'privacy'
      }
    ]
  },
  {
    id: 'camera',
    name: 'カメラ設定',
    description: 'カメラ動作とガイド設定',
    icon: '📷',
    settings: [
      {
        id: 'cameraResolution',
        type: 'select',
        name: 'カメラ解像度',
        description: '撮影時の解像度設定',
        defaultValue: 'auto',
        options: [
          { value: 'auto', label: '自動' },
          { value: '720p', label: 'HD (720p)' },
          { value: '1080p', label: 'Full HD (1080p)' },
          { value: '4k', label: '4K' }
        ],
        category: 'camera'
      },
      {
        id: 'enableCameraGuide',
        type: 'boolean',
        name: 'ガイド表示',
        description: '撮影時のガイドラインを表示',
        defaultValue: true,
        category: 'camera'
      }
    ]
  },
  {
    id: 'ai',
    name: 'AI設定',
    description: 'AI機能とレポート設定',
    icon: '🤖',
    settings: [
      {
        id: 'aiProvider',
        type: 'select',
        name: 'AIプロバイダー',
        description: 'AI機能の提供者を選択',
        defaultValue: 'disabled',
        options: [
          { value: 'disabled', label: '無効' },
          { value: 'openai', label: 'OpenAI' },
          { value: 'anthropic', label: 'Anthropic' }
        ],
        category: 'ai'
      },
      {
        id: 'enableAiReports',
        type: 'boolean',
        name: 'AIレポート生成',
        description: 'AI による詳細レポートの生成',
        defaultValue: false,
        requires: 'aiProvider',
        category: 'ai'
      }
    ]
  },
  {
    id: 'accessibility',
    name: 'アクセシビリティ',
    description: 'アクセシビリティ支援機能',
    icon: '♿',
    settings: [
      {
        id: 'highContrast',
        type: 'boolean',
        name: 'ハイコントラスト',
        description: '高コントラストモードを有効化',
        defaultValue: false,
        category: 'accessibility'
      },
      {
        id: 'largeText',
        type: 'boolean',
        name: '大きな文字',
        description: 'テキストサイズを拡大',
        defaultValue: false,
        category: 'accessibility'
      },
      {
        id: 'reducedMotion',
        type: 'boolean',
        name: 'アニメーション削減',
        description: 'アニメーションと動きを最小化',
        defaultValue: false,
        category: 'accessibility'
      }
    ]
  }
];

// Device-specific preset configurations
export const SETTINGS_PRESETS: SettingsPreset[] = [
  {
    id: 'mobile-optimized',
    name: 'モバイル最適化',
    description: 'モバイルデバイス向けの最適設定',
    category: 'device',
    settings: {
      uiScale: 1.2,
      imageQuality: 0.7,
      processingTimeout: 45000,
      enableBackgroundProcessing: false,
      maxCacheSize: 50
    }
  },
  {
    id: 'desktop-power',
    name: 'デスクトップ高性能',
    description: 'デスクトップPC向けの高性能設定',
    category: 'device',
    settings: {
      uiScale: 1.0,
      imageQuality: 0.95,
      processingTimeout: 20000,
      enableHardwareAcceleration: true,
      enableBackgroundProcessing: true,
      maxCacheSize: 200
    }
  },
  {
    id: 'professional-clinical',
    name: 'プロフェッショナル（臨床）',
    description: '医療・リハビリテーション専門家向け',
    category: 'use-case',
    settings: {
      analysisMode: 'professional',
      imageQuality: 1.0,
      showAdvancedFeatures: true,
      includeRawData: true,
      dataRetention: '30days'
    }
  },
  {
    id: 'privacy-focused',
    name: 'プライバシー重視',
    description: 'プライバシーを最重視する設定',
    category: 'user',
    settings: {
      dataRetention: 'session',
      shareAnalytics: false,
      allowTelemetry: false,
      enableOfflineMode: true,
      autoSave: false
    }
  },
  {
    id: 'accessibility-enhanced',
    name: 'アクセシビリティ強化',
    description: 'アクセシビリティ機能を最大化',
    category: 'user',
    settings: {
      highContrast: true,
      largeText: true,
      reducedMotion: true,
      uiScale: 1.4,
      enableCameraGuide: true
    }
  }
];