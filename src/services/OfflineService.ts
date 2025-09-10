// Offline Service for managing offline functionality and service worker integration

export interface OfflineAnalysis {
  id: string;
  timestamp: string;
  data: any;
  synced: boolean;
  retryCount: number;
}

export interface OfflineCapabilities {
  isOnline: boolean;
  hasServiceWorker: boolean;
  canAnalyzeOffline: boolean;
  canSyncLater: boolean;
  mediaPipeAvailable: boolean;
  cacheSize: string;
}

export interface SyncStatus {
  pending: number;
  syncing: boolean;
  lastSync: string | null;
  errors: string[];
}

class OfflineService {
  private readonly OFFLINE_STORAGE_KEY = 'postaure_offline_data';
  private readonly MAX_OFFLINE_ITEMS = 50;
  private readonly MAX_RETRY_COUNT = 3;
  
  private syncInProgress = false;
  private listeners: Map<string, Function[]> = new Map();
  
  constructor() {
    this.initializeOfflineSupport();
    this.setupConnectionMonitoring();
  }

  // Initialize offline support
  private async initializeOfflineSupport(): Promise<void> {
    try {
      // Register service worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        console.log('Service Worker registered:', registration);
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          console.log('Service Worker update found');
          this.emit('update-available');
        });
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', event => {
          this.handleServiceWorkerMessage(event.data);
        });
        
        // Check if service worker is controlling the page
        if (navigator.serviceWorker.controller) {
          console.log('Page is controlled by service worker');
          this.emit('service-worker-ready');
        }
      }
      
      // Setup background sync if supported
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        console.log('Background sync is supported');
      }
      
      // Setup push notifications if supported
      if ('Notification' in window && 'serviceWorker' in navigator) {
        await this.setupPushNotifications();
      }
      
    } catch (error) {
      console.error('Failed to initialize offline support:', error);
    }
  }

  // Setup connection monitoring
  private setupConnectionMonitoring(): void {
    // Monitor online/offline events
    window.addEventListener('online', () => {
      console.log('Connection restored');
      this.emit('online');
      this.syncOfflineData();
    });

    window.addEventListener('offline', () => {
      console.log('Connection lost');
      this.emit('offline');
    });

    // Periodic connectivity check
    setInterval(() => {
      this.checkRealConnectivity();
    }, 30000); // Check every 30 seconds
  }

  // Check actual connectivity beyond navigator.onLine
  private async checkRealConnectivity(): Promise<boolean> {
    try {
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      const isOnline = response.ok;
      if (isOnline !== navigator.onLine) {
        // Browser state doesn't match actual connectivity
        console.log(`Connectivity mismatch: navigator.onLine=${navigator.onLine}, actual=${isOnline}`);
        this.emit(isOnline ? 'online' : 'offline');
      }
      
      return isOnline;
    } catch {
      return false;
    }
  }

  // Get current offline capabilities
  async getCapabilities(): Promise<OfflineCapabilities> {
    const hasServiceWorker = 'serviceWorker' in navigator && 
                           navigator.serviceWorker.controller !== null;
    
    const mediaPipeAvailable = await this.checkMediaPipeAvailability();
    const cacheSize = await this.getCacheSize();
    
    return {
      isOnline: navigator.onLine,
      hasServiceWorker,
      canAnalyzeOffline: hasServiceWorker && mediaPipeAvailable,
      canSyncLater: hasServiceWorker,
      mediaPipeAvailable,
      cacheSize
    };
  }

  // Check if MediaPipe assets are cached and available offline
  private async checkMediaPipeAvailability(): Promise<boolean> {
    try {
      if (!('caches' in window)) return false;
      
      const cache = await caches.open('postaure-analysis-v1.2.0');
      const requests = await cache.keys();
      
      // Check for critical MediaPipe files
      const criticalFiles = [
        'vision_wasm_internal.js',
        'vision_wasm_internal.wasm'
      ];
      
      const availableFiles = requests.map(req => req.url);
      return criticalFiles.some(file => 
        availableFiles.some(url => url.includes(file))
      );
    } catch {
      return false;
    }
  }

  // Get cache size information
  private async getCacheSize(): Promise<string> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        
        return `${this.formatBytes(used)} / ${this.formatBytes(quota)}`;
      }
      
      // Fallback to cache inspection
      try {
        const cacheNames = await caches.keys();
        const sizes = await Promise.all(
          cacheNames.map(async name => {
            const cache = await caches.open(name);
            const requests = await cache.keys();
            return requests.length;
          })
        );
        
        const totalEntries = sizes.reduce((sum, size) => sum + size, 0);
        return `${totalEntries} entries cached`;
      } catch {
        return 'Unknown';
      }
    } catch {
      return 'Unknown';
    }
  }

  // Store analysis for offline sync
  async storeOfflineAnalysis(analysisData: any): Promise<string> {
    const analysis: OfflineAnalysis = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      data: analysisData,
      synced: false,
      retryCount: 0
    };

    try {
      const stored = this.getStoredOfflineData();
      stored.push(analysis);
      
      // Limit stored items
      if (stored.length > this.MAX_OFFLINE_ITEMS) {
        stored.splice(0, stored.length - this.MAX_OFFLINE_ITEMS);
      }
      
      localStorage.setItem(this.OFFLINE_STORAGE_KEY, JSON.stringify(stored));
      
      // Schedule background sync if available
      await this.scheduleBackgroundSync('analysis-upload');
      
      return analysis.id;
    } catch (error) {
      console.error('Failed to store offline analysis:', error);
      throw error;
    }
  }

  // Get offline analysis data
  getOfflineAnalysis(): OfflineAnalysis[] {
    return this.getStoredOfflineData();
  }

  // Get sync status
  getSyncStatus(): SyncStatus {
    const stored = this.getStoredOfflineData();
    const pending = stored.filter(item => !item.synced).length;
    
    return {
      pending,
      syncing: this.syncInProgress,
      lastSync: localStorage.getItem('last_sync_time'),
      errors: this.getSyncErrors()
    };
  }

  // Manually sync offline data
  async syncOfflineData(): Promise<void> {
    if (this.syncInProgress || !navigator.onLine) {
      return;
    }

    this.syncInProgress = true;
    this.emit('sync-start');

    try {
      const stored = this.getStoredOfflineData();
      const unsyncedItems = stored.filter(item => !item.synced && item.retryCount < this.MAX_RETRY_COUNT);
      
      console.log(`Syncing ${unsyncedItems.length} offline items`);
      
      for (const item of unsyncedItems) {
        try {
          await this.syncSingleItem(item);
          item.synced = true;
          item.retryCount = 0;
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
          item.retryCount++;
          this.addSyncError(`Failed to sync analysis ${item.id}: ${error}`);
        }
      }
      
      // Update storage
      localStorage.setItem(this.OFFLINE_STORAGE_KEY, JSON.stringify(stored));
      localStorage.setItem('last_sync_time', new Date().toISOString());
      
      // Clean up old synced items
      this.cleanupSyncedItems();
      
      this.emit('sync-complete', { 
        synced: unsyncedItems.filter(item => item.synced).length,
        failed: unsyncedItems.filter(item => !item.synced).length 
      });

    } catch (error) {
      console.error('Sync process failed:', error);
      this.emit('sync-error', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync a single item
  private async syncSingleItem(item: OfflineAnalysis): Promise<void> {
    const response = await fetch('/api/analysis/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: item.id,
        timestamp: item.timestamp,
        data: item.data
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  // Schedule background sync
  private async scheduleBackgroundSync(tag: string): Promise<void> {
    try {
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        // @ts-ignore - Background sync is experimental
        await registration.sync.register(tag);
        console.log(`Background sync scheduled: ${tag}`);
      }
    } catch (error) {
      console.error('Failed to schedule background sync:', error);
    }
  }

  // Setup push notifications
  private async setupPushNotifications(): Promise<void> {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Push notifications enabled');
        // Could setup push subscription here
      }
    } catch (error) {
      console.error('Failed to setup push notifications:', error);
    }
  }

  // Handle messages from service worker
  private handleServiceWorkerMessage(data: any): void {
    if (data.type === 'CACHE_UPDATED') {
      this.emit('cache-updated');
    } else if (data.type === 'SYNC_COMPLETE') {
      this.emit('sync-complete', data.payload);
    } else if (data.type === 'OFFLINE_ANALYSIS_READY') {
      this.emit('offline-analysis-ready');
    }
  }

  // Clear all offline data
  clearOfflineData(): void {
    localStorage.removeItem(this.OFFLINE_STORAGE_KEY);
    localStorage.removeItem('last_sync_time');
    localStorage.removeItem('sync_errors');
    this.emit('data-cleared');
  }

  // Get stored offline data
  private getStoredOfflineData(): OfflineAnalysis[] {
    try {
      const stored = localStorage.getItem(this.OFFLINE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // Clean up old synced items
  private cleanupSyncedItems(): void {
    const stored = this.getStoredOfflineData();
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    const filtered = stored.filter(item => {
      if (item.synced && new Date(item.timestamp).getTime() < cutoff) {
        return false; // Remove old synced items
      }
      return true;
    });
    
    if (filtered.length !== stored.length) {
      localStorage.setItem(this.OFFLINE_STORAGE_KEY, JSON.stringify(filtered));
      console.log(`Cleaned up ${stored.length - filtered.length} old synced items`);
    }
  }

  // Sync error management
  private addSyncError(error: string): void {
    try {
      const errors = this.getSyncErrors();
      errors.push(`${new Date().toISOString()}: ${error}`);
      
      // Keep only last 10 errors
      if (errors.length > 10) {
        errors.splice(0, errors.length - 10);
      }
      
      localStorage.setItem('sync_errors', JSON.stringify(errors));
    } catch {
      console.error('Failed to store sync error');
    }
  }

  private getSyncErrors(): string[] {
    try {
      const errors = localStorage.getItem('sync_errors');
      return errors ? JSON.parse(errors) : [];
    } catch {
      return [];
    }
  }

  // Utility functions
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  // Event system
  private emit(event: string, data?: any): void {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  // Public event listener methods
  addEventListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Cache management
  async clearCache(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.startsWith('postaure-'))
          .map(name => caches.delete(name))
      );
      
      console.log('All caches cleared');
      this.emit('cache-cleared');
    }
  }

  // Check for updates
  async checkForUpdates(): Promise<boolean> {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          return true;
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
    return false;
  }

  // Force update
  async forceUpdate(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    }
  }
}

export const offlineService = new OfflineService();