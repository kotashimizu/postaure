import { useState, useEffect, useCallback } from 'react';
import { settingsService } from '../services/SettingsService';
import type { AppSettings } from '../types/settings';

interface UseSettingsReturn {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  isModified: boolean;
  version: number;
  isLoading: boolean;
}

export const useSettings = (): UseSettingsReturn => {
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.getSettings());
  const [isModified, setIsModified] = useState(false);
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize settings
    const currentSettings = settingsService.getSettings();
    setSettings(currentSettings);
    setIsModified(settingsService.isModified());
    setVersion(settingsService.getVersion());
    setIsLoading(false);

    // Listen for settings changes
    const unsubscribe = settingsService.addListener((newSettings) => {
      setSettings(newSettings);
      setIsModified(settingsService.isModified());
      setVersion(settingsService.getVersion());
    });

    // Initialize theme detection
    settingsService.initializeThemeDetection();

    return unsubscribe;
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    settingsService.updateSettings(updates);
  }, []);

  const resetSettings = useCallback(() => {
    settingsService.resetSettings();
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
    isModified,
    version,
    isLoading
  };
};

// Hook for specific setting categories
export const useSettingsCategory = (categoryId?: string) => {
  const { settings, updateSettings } = useSettings();

  const categorySettings = categoryId 
    ? settingsService.getSettingsByCategory(categoryId)
    : settings;

  return {
    settings: categorySettings,
    updateSettings,
    allSettings: settings
  };
};

// Hook for settings presets
export const useSettingsPresets = () => {
  const [presets] = useState(() => settingsService.getPresets());
  
  const applyPreset = useCallback((presetId: string) => {
    return settingsService.applyPreset(presetId);
  }, []);

  return {
    presets,
    applyPreset
  };
};

// Hook for settings import/export
export const useSettingsImportExport = () => {
  const exportSettings = useCallback(() => {
    return settingsService.exportSettings();
  }, []);

  const importSettings = useCallback(async (settingsData: any) => {
    return settingsService.importSettings(settingsData);
  }, []);

  const downloadSettings = useCallback(() => {
    const exported = exportSettings();
    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `postaure-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [exportSettings]);

  return {
    exportSettings,
    importSettings,
    downloadSettings
  };
};

// Hook for theme management
export const useTheme = () => {
  const { settings, updateSettings } = useSettings();
  
  const setTheme = useCallback((theme: AppSettings['theme']) => {
    updateSettings({ theme });
  }, [updateSettings]);

  const getCurrentTheme = useCallback((): 'light' | 'dark' => {
    if (settings.theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return settings.theme;
  }, [settings.theme]);

  return {
    theme: settings.theme,
    currentTheme: getCurrentTheme(),
    setTheme
  };
};

// Hook for accessibility settings
export const useAccessibility = () => {
  const { settings, updateSettings } = useSettings();

  const toggleHighContrast = useCallback(() => {
    updateSettings({ highContrast: !settings.highContrast });
  }, [settings.highContrast, updateSettings]);

  const toggleLargeText = useCallback(() => {
    updateSettings({ largeText: !settings.largeText });
  }, [settings.largeText, updateSettings]);

  const toggleReducedMotion = useCallback(() => {
    updateSettings({ reducedMotion: !settings.reducedMotion });
  }, [settings.reducedMotion, updateSettings]);

  const setUIScale = useCallback((scale: number) => {
    updateSettings({ uiScale: Math.max(0.5, Math.min(3.0, scale)) });
  }, [updateSettings]);

  return {
    highContrast: settings.highContrast,
    largeText: settings.largeText,
    reducedMotion: settings.reducedMotion,
    uiScale: settings.uiScale,
    toggleHighContrast,
    toggleLargeText,
    toggleReducedMotion,
    setUIScale
  };
};

// Hook for performance settings
export const usePerformanceSettings = () => {
  const { settings, updateSettings } = useSettings();

  const updatePerformanceSettings = useCallback((updates: {
    imageQuality?: number;
    processingTimeout?: number;
    enableHardwareAcceleration?: boolean;
    enableBackgroundProcessing?: boolean;
    maxCacheSize?: number;
  }) => {
    updateSettings(updates);
  }, [updateSettings]);

  return {
    imageQuality: settings.imageQuality,
    processingTimeout: settings.processingTimeout,
    enableHardwareAcceleration: settings.enableHardwareAcceleration,
    enableBackgroundProcessing: settings.enableBackgroundProcessing,
    maxCacheSize: settings.maxCacheSize,
    updatePerformanceSettings
  };
};

// Hook for privacy settings
export const usePrivacySettings = () => {
  const { settings, updateSettings } = useSettings();

  const updatePrivacySettings = useCallback((updates: {
    dataRetention?: AppSettings['dataRetention'];
    shareAnalytics?: boolean;
    allowTelemetry?: boolean;
  }) => {
    updateSettings(updates);
  }, [updateSettings]);

  return {
    dataRetention: settings.dataRetention,
    shareAnalytics: settings.shareAnalytics,
    allowTelemetry: settings.allowTelemetry,
    updatePrivacySettings
  };
};