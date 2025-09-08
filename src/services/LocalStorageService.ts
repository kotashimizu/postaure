import type { EnhancedPostureAnalysisResult } from './EnhancedPostureAnalysisService';

export interface AnalysisHistoryItem {
  id: string;
  timestamp: number;
  results: EnhancedPostureAnalysisResult;
  thumbnails?: {
    frontal: string; // base64 data URL
    sagittal: string; // base64 data URL
  };
  notes?: string;
}

export interface UserPreferences {
  saveHistory: boolean;
  maxHistoryItems: number;
  autoDeleteAfterDays: number;
  includeThumbnails: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: 'ja' | 'en';
  accessibilityMode: boolean;
  largeText: boolean;
  reduceMotion: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  saveHistory: false, // Privacy-first default
  maxHistoryItems: 10,
  autoDeleteAfterDays: 30,
  includeThumbnails: false, // Privacy-first default
  theme: 'auto',
  language: 'ja',
  accessibilityMode: false,
  largeText: false,
  reduceMotion: false
};

class LocalStorageService {
  private readonly HISTORY_KEY = 'postaure_analysis_history';
  private readonly PREFERENCES_KEY = 'postaure_user_preferences';
  private readonly PRIVACY_CONSENT_KEY = 'postaure_privacy_consent';

  // Privacy and consent management
  hasPrivacyConsent(): boolean {
    return localStorage.getItem(this.PRIVACY_CONSENT_KEY) === 'true';
  }

  setPrivacyConsent(consent: boolean): void {
    localStorage.setItem(this.PRIVACY_CONSENT_KEY, consent.toString());
    
    // If consent is revoked, clear all stored data
    if (!consent) {
      this.clearAllData();
    }
  }

  // User preferences
  getPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(this.PREFERENCES_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load preferences:', error);
    }
    return DEFAULT_PREFERENCES;
  }

  setPreferences(preferences: Partial<UserPreferences>): void {
    try {
      const current = this.getPreferences();
      const updated = { ...current, ...preferences };
      localStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(updated));
      
      // Apply accessibility preferences
      this.applyAccessibilityPreferences(updated);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  private applyAccessibilityPreferences(preferences: UserPreferences): void {
    const root = document.documentElement;
    
    // Large text
    if (preferences.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }
    
    // Reduced motion
    if (preferences.reduceMotion) {
      root.style.setProperty('--animation-duration', '0.01ms');
      root.style.setProperty('--transition-duration', '0.01ms');
    } else {
      root.style.removeProperty('--animation-duration');
      root.style.removeProperty('--transition-duration');
    }
    
    // Theme
    if (preferences.theme !== 'auto') {
      root.setAttribute('data-theme', preferences.theme);
    } else {
      root.removeAttribute('data-theme');
    }
  }

  // Analysis history management
  getAnalysisHistory(): AnalysisHistoryItem[] {
    if (!this.hasPrivacyConsent() || !this.getPreferences().saveHistory) {
      return [];
    }

    try {
      const stored = localStorage.getItem(this.HISTORY_KEY);
      if (stored) {
        const history = JSON.parse(stored) as AnalysisHistoryItem[];
        return this.cleanupExpiredItems(history);
      }
    } catch (error) {
      console.warn('Failed to load analysis history:', error);
    }
    return [];
  }

  saveAnalysisResult(
    results: EnhancedPostureAnalysisResult,
    thumbnails?: { frontal: string; sagittal: string },
    notes?: string
  ): string | null {
    const preferences = this.getPreferences();
    
    if (!this.hasPrivacyConsent() || !preferences.saveHistory) {
      return null;
    }

    try {
      const id = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const item: AnalysisHistoryItem = {
        id,
        timestamp: Date.now(),
        results,
        notes
      };

      // Only include thumbnails if user has opted in
      if (preferences.includeThumbnails && thumbnails) {
        item.thumbnails = thumbnails;
      }

      const history = this.getAnalysisHistory();
      history.unshift(item); // Add to beginning

      // Limit history size
      if (history.length > preferences.maxHistoryItems) {
        history.splice(preferences.maxHistoryItems);
      }

      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
      return id;
    } catch (error) {
      console.error('Failed to save analysis result:', error);
      return null;
    }
  }

  deleteAnalysisItem(id: string): boolean {
    try {
      const history = this.getAnalysisHistory();
      const updatedHistory = history.filter(item => item.id !== id);
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(updatedHistory));
      return true;
    } catch (error) {
      console.error('Failed to delete analysis item:', error);
      return false;
    }
  }

  updateAnalysisNotes(id: string, notes: string): boolean {
    try {
      const history = this.getAnalysisHistory();
      const item = history.find(item => item.id === id);
      if (item) {
        item.notes = notes;
        localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
        return true;
      }
    } catch (error) {
      console.error('Failed to update analysis notes:', error);
    }
    return false;
  }

  private cleanupExpiredItems(history: AnalysisHistoryItem[]): AnalysisHistoryItem[] {
    const preferences = this.getPreferences();
    const cutoffTime = Date.now() - (preferences.autoDeleteAfterDays * 24 * 60 * 60 * 1000);
    
    const filtered = history.filter(item => item.timestamp > cutoffTime);
    
    // Update storage if items were removed
    if (filtered.length !== history.length) {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(filtered));
    }
    
    return filtered;
  }

  // Data management
  getStorageUsage(): { used: number; available: number } {
    let used = 0;
    for (const key in localStorage) {
      if (key.startsWith('postaure_')) {
        used += localStorage.getItem(key)?.length || 0;
      }
    }
    
    // Estimate available storage (5MB is common limit for localStorage)
    const estimated = 5 * 1024 * 1024; // 5MB in bytes
    
    return {
      used: used * 2, // UTF-16 encoding uses 2 bytes per character
      available: Math.max(0, estimated - (used * 2))
    };
  }

  clearAnalysisHistory(): void {
    localStorage.removeItem(this.HISTORY_KEY);
  }

  clearAllData(): void {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('postaure_'));
    keys.forEach(key => localStorage.removeItem(key));
  }

  exportUserData(): string {
    const data = {
      preferences: this.getPreferences(),
      history: this.getAnalysisHistory(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
    
    return JSON.stringify(data, null, 2);
  }

  importUserData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.preferences) {
        this.setPreferences(data.preferences);
      }
      
      if (data.history && Array.isArray(data.history)) {
        localStorage.setItem(this.HISTORY_KEY, JSON.stringify(data.history));
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import user data:', error);
      return false;
    }
  }
}

export const localStorageService = new LocalStorageService();