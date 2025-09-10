// Settings management service

import type { 
  AppSettings, 
  SettingsState, 
  SettingsPreset, 
  SettingsExport 
} from '../types/settings';
import { DEFAULT_SETTINGS, SETTINGS_PRESETS } from '../types/settings';
import { deviceDetection } from '../utils/deviceDetection';

class SettingsService {
  private readonly STORAGE_KEY = 'postaure_settings';
  private readonly VERSION = '1.0.0';
  
  private state: SettingsState;
  private listeners: Set<(settings: AppSettings) => void> = new Set();

  constructor() {
    this.state = this.initializeState();
    this.applyDeviceSpecificSettings();
    this.scheduleCleanup();
  }

  // Initialize settings state
  private initializeState(): SettingsState {
    const savedState = this.loadFromStorage();
    
    if (savedState && this.isValidState(savedState)) {
      return {
        ...savedState,
        current: this.mergeWithDefaults(savedState.current)
      };
    }

    return {
      current: { ...DEFAULT_SETTINGS },
      defaults: { ...DEFAULT_SETTINGS },
      modified: false,
      version: 1,
      lastModified: new Date()
    };
  }

  // Load settings from storage
  private loadFromStorage(): SettingsState | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          lastModified: new Date(parsed.lastModified)
        };
      }
    } catch (error) {
      console.error('Failed to load settings from storage:', error);
    }
    return null;
  }

  // Save settings to storage
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        ...this.state,
        lastModified: this.state.lastModified.toISOString()
      }));
    } catch (error) {
      console.error('Failed to save settings to storage:', error);
    }
  }

  // Validate settings state
  private isValidState(state: any): state is SettingsState {
    return state &&
           typeof state === 'object' &&
           state.current &&
           typeof state.current === 'object' &&
           typeof state.version === 'number';
  }

  // Merge current settings with defaults to handle missing properties
  private mergeWithDefaults(current: Partial<AppSettings>): AppSettings {
    const merged = { ...DEFAULT_SETTINGS };
    
    for (const [key, value] of Object.entries(current)) {
      if (key in DEFAULT_SETTINGS && value !== undefined) {
        (merged as any)[key] = value;
      }
    }
    
    return merged;
  }

  // Apply device-specific settings on first run
  private async applyDeviceSpecificSettings(): Promise<void> {
    if (this.state.modified) return; // Don't override user settings

    try {
      const deviceInfo = await deviceDetection.getDeviceInfo();
      const updates: Partial<AppSettings> = {};

      // Apply device-specific defaults
      if (deviceInfo.isMobile) {
        Object.assign(updates, SETTINGS_PRESETS.find(p => p.id === 'mobile-optimized')?.settings || {});
      } else if (deviceInfo.isDesktop) {
        Object.assign(updates, SETTINGS_PRESETS.find(p => p.id === 'desktop-power')?.settings || {});
      }

      // Apply platform-specific adjustments
      if (deviceInfo.platform === 'ios') {
        updates.enableBackgroundProcessing = false; // iOS restrictions
        updates.mirrorMode = true; // Common iOS preference
      }

      // Apply accessibility detection
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        updates.reducedMotion = true;
      }

      if (window.matchMedia('(prefers-contrast: high)').matches) {
        updates.highContrast = true;
      }

      if (Object.keys(updates).length > 0) {
        this.updateSettings(updates, false); // Don't mark as modified
      }
    } catch (error) {
      console.error('Failed to apply device-specific settings:', error);
    }
  }

  // Get current settings
  getSettings(): AppSettings {
    return { ...this.state.current };
  }

  // Update settings
  updateSettings(updates: Partial<AppSettings>, markModified: boolean = true): void {
    const newSettings = { ...this.state.current, ...updates };
    
    // Validate settings
    const validatedSettings = this.validateSettings(newSettings);
    
    this.state = {
      ...this.state,
      current: validatedSettings,
      modified: this.state.modified || markModified,
      version: this.state.version + 1,
      lastModified: new Date()
    };

    this.saveToStorage();
    this.notifyListeners();
    this.applySettingsToDocument();
  }

  // Validate settings values
  private validateSettings(settings: AppSettings): AppSettings {
    const validated = { ...settings };

    // Validate ranges and constraints
    validated.uiScale = Math.max(0.5, Math.min(3.0, validated.uiScale));
    validated.imageQuality = Math.max(0.1, Math.min(1.0, validated.imageQuality));
    validated.exportQuality = Math.max(0.1, Math.min(1.0, validated.exportQuality));
    validated.processingTimeout = Math.max(5000, Math.min(300000, validated.processingTimeout));
    validated.maxCacheSize = Math.max(10, Math.min(1000, validated.maxCacheSize));

    // Conditional validations
    if (validated.aiProvider === 'disabled') {
      validated.enableAiReports = false;
    }

    return validated;
  }

  // Apply settings to document/DOM
  private applySettingsToDocument(): void {
    const settings = this.state.current;
    const root = document.documentElement;

    // Apply theme
    if (settings.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', settings.theme);
    }

    // Apply UI scale
    root.style.setProperty('--ui-scale', settings.uiScale.toString());

    // Apply accessibility settings
    root.setAttribute('data-high-contrast', settings.highContrast.toString());
    root.setAttribute('data-large-text', settings.largeText.toString());
    root.setAttribute('data-reduced-motion', settings.reducedMotion.toString());

    // Apply language
    root.setAttribute('lang', settings.language);

    // Update document class for styling
    const classes = ['settings-applied'];
    if (settings.highContrast) classes.push('high-contrast');
    if (settings.largeText) classes.push('large-text');
    if (settings.reducedMotion) classes.push('reduced-motion');
    
    document.body.className = document.body.className
      .split(' ')
      .filter(c => !c.startsWith('settings-') && !['high-contrast', 'large-text', 'reduced-motion'].includes(c))
      .concat(classes)
      .join(' ');
  }

  // Reset settings to defaults
  resetSettings(): void {
    this.state = {
      current: { ...DEFAULT_SETTINGS },
      defaults: { ...DEFAULT_SETTINGS },
      modified: false,
      version: 1,
      lastModified: new Date()
    };

    this.saveToStorage();
    this.notifyListeners();
    this.applySettingsToDocument();
    this.applyDeviceSpecificSettings();
  }

  // Apply preset
  applyPreset(presetId: string): boolean {
    const preset = SETTINGS_PRESETS.find(p => p.id === presetId);
    if (!preset) {
      console.error(`Preset not found: ${presetId}`);
      return false;
    }

    this.updateSettings(preset.settings);
    return true;
  }

  // Get available presets
  getPresets(): SettingsPreset[] {
    return [...SETTINGS_PRESETS];
  }

  // Export settings
  exportSettings(): SettingsExport {
    return {
      version: this.VERSION,
      exportDate: new Date().toISOString(),
      settings: this.getSettings(),
      metadata: {
        deviceType: 'unknown', // Will be filled by device detection
        browserInfo: navigator.userAgent,
        appVersion: this.VERSION
      }
    };
  }

  // Import settings
  async importSettings(exportedSettings: SettingsExport): Promise<boolean> {
    try {
      // Validate import format
      if (!exportedSettings.settings || typeof exportedSettings.settings !== 'object') {
        throw new Error('Invalid settings format');
      }

      // Apply imported settings
      this.updateSettings(exportedSettings.settings);
      console.log('Settings imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }

  // Get settings by category
  getSettingsByCategory(_categoryId: string): Partial<AppSettings> {
    const settings = this.getSettings();

    // This would normally use category mapping
    // For now, return all settings
    return settings;
  }

  // Check if settings are modified from defaults
  isModified(): boolean {
    return this.state.modified;
  }

  // Get settings version
  getVersion(): number {
    return this.state.version;
  }

  // Add change listener
  addListener(listener: (settings: AppSettings) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Notify all listeners
  private notifyListeners(): void {
    const settings = this.getSettings();
    this.listeners.forEach(listener => {
      try {
        listener(settings);
      } catch (error) {
        console.error('Settings listener error:', error);
      }
    });
  }

  // Schedule cleanup of old data based on retention settings
  private scheduleCleanup(): void {
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    
    setInterval(() => {
      this.performCleanup();
    }, cleanupInterval);
    
    // Perform initial cleanup
    setTimeout(() => this.performCleanup(), 1000);
  }

  // Perform data cleanup based on retention settings
  private performCleanup(): void {
    const settings = this.getSettings();
    const now = Date.now();
    
    try {
      // Clean up cached analysis data
      const analysisKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('postaure_analysis_')) {
          analysisKeys.push(key);
        }
      }

      let retentionMs = 0;
      switch (settings.dataRetention) {
        case 'session':
          retentionMs = 0; // Clean immediately
          break;
        case '7days':
          retentionMs = 7 * 24 * 60 * 60 * 1000;
          break;
        case '30days':
          retentionMs = 30 * 24 * 60 * 60 * 1000;
          break;
        case 'never':
          return; // Don't clean up
      }

      for (const key of analysisKeys) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const data = JSON.parse(item);
            const timestamp = new Date(data.timestamp || 0).getTime();
            
            if (retentionMs === 0 || (now - timestamp) > retentionMs) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          // Remove invalid items
          localStorage.removeItem(key);
        }
      }

      console.log(`Cleaned up ${analysisKeys.length} analysis records`);
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  // Migrate settings from older versions (reserved for future use)
  // private migrateSettings(_version: number): void {
  //   // Handle future migrations
  //   // if (version < 2) {
  //   //   // Example migration logic
  //   // }
  // }

  // Get settings summary for display
  getSettingsSummary(): {
    totalSettings: number;
    modifiedSettings: number;
    lastModified: Date;
    presetApplied?: string;
  } {
    const current = this.getSettings();
    const defaults = DEFAULT_SETTINGS;
    
    let modifiedCount = 0;
    for (const [key, value] of Object.entries(current)) {
      if (JSON.stringify(value) !== JSON.stringify((defaults as any)[key])) {
        modifiedCount++;
      }
    }

    return {
      totalSettings: Object.keys(current).length,
      modifiedSettings: modifiedCount,
      lastModified: this.state.lastModified
    };
  }

  // Initialize and apply theme detection
  initializeThemeDetection(): void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = () => {
      if (this.state.current.theme === 'auto') {
        this.applySettingsToDocument();
      }
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    handleThemeChange(); // Apply initially
  }
}

export const settingsService = new SettingsService();