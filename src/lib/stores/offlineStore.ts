import { writable } from 'svelte/store';

// IndexedDB configuration
const DB_NAME = 'BlockateAudioBrowserDB';
const DB_VERSION = 1;
const STORES = {
  SEARCH_RESULTS: 'searchResults',
  AUDIO_METADATA: 'audioMetadata',
  USER_PREFERENCES: 'userPreferences'
} as const;

// Types
interface SearchResult {
  id: string;
  query: string;
  filters: any;
  sort: any;
  page: number;
  results: any[];
  total: number;
  timestamp: number;
  expiresAt: number;
}

interface AudioMetadata {
  id: string;
  name: string;
  category: string;
  tags: string[];
  is_previewable: boolean;
  audio_url: string | null;
  created_at: string;
  duration?: number;
  cached_at: number;
}

interface UserPreference {
  key: string;
  value: any;
  updated_at: number;
}

interface CacheSettings {
  enableSearchResultsCaching: boolean;
  enableAudioMetadataCaching: boolean;
  enableUserPreferencesCaching: boolean;
  searchResultsTTL: number; // hours
  autoCleanupEnabled: boolean;
  maxStorageUsagePercent: number;
}

interface OfflineStoreState {
  isOnline: boolean;
  hasOfflineData: boolean;
  lastSync: number | null;
  storageQuota: {
    usage: number;
    quota: number;
    usagePercentage: number;
    available: number;
  } | null;
  cacheSettings: CacheSettings;
}

interface StorageQuotaInfo {
  usage: number;
  quota: number;
  usagePercentage: number;
  available: number;
}

class OfflineDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create search results store
        if (!db.objectStoreNames.contains(STORES.SEARCH_RESULTS)) {
          const searchStore = db.createObjectStore(STORES.SEARCH_RESULTS, { keyPath: 'id' });
          searchStore.createIndex('query', 'query', { unique: false });
          searchStore.createIndex('timestamp', 'timestamp', { unique: false });
          searchStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // Create audio metadata store
        if (!db.objectStoreNames.contains(STORES.AUDIO_METADATA)) {
          const audioStore = db.createObjectStore(STORES.AUDIO_METADATA, { keyPath: 'id' });
          audioStore.createIndex('name', 'name', { unique: false });
          audioStore.createIndex('category', 'category', { unique: false });
          audioStore.createIndex('cached_at', 'cached_at', { unique: false });
        }

        // Create user preferences store
        if (!db.objectStoreNames.contains(STORES.USER_PREFERENCES)) {
          db.createObjectStore(STORES.USER_PREFERENCES, { keyPath: 'key' });
        }

        console.log('IndexedDB schema created/updated');
      };
    });

    return this.initPromise;
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  // Search Results Management
  async cacheSearchResults(
    query: string,
    filters: any,
    sort: any,
    page: number,
    results: any[],
    total: number,
    ttlHours: number = 6
  ): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.SEARCH_RESULTS], 'readwrite');
    const store = transaction.objectStore(STORES.SEARCH_RESULTS);

    const searchResult: SearchResult = {
      id: this.generateSearchId(query, filters, sort, page),
      query,
      filters,
      sort,
      page,
      results,
      total,
      timestamp: Date.now(),
      expiresAt: Date.now() + (ttlHours * 60 * 60 * 1000)
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(searchResult);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('Cached search results:', searchResult.id);
  }

  async getSearchResults(
    query: string,
    filters: any,
    sort: any,
    page: number
  ): Promise<SearchResult | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.SEARCH_RESULTS], 'readonly');
    const store = transaction.objectStore(STORES.SEARCH_RESULTS);

    const id = this.generateSearchId(query, filters, sort, page);

    return new Promise<SearchResult | null>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const result = request.result as SearchResult | undefined;
        
        if (result && result.expiresAt > Date.now()) {
          console.log('Found cached search results:', id);
          resolve(result);
        } else {
          if (result) {
            // Clean up expired result
            this.deleteSearchResult(id);
          }
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSearchResult(id: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.SEARCH_RESULTS], 'readwrite');
    const store = transaction.objectStore(STORES.SEARCH_RESULTS);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Audio Metadata Management
  async cacheAudioMetadata(audioData: Omit<AudioMetadata, 'cached_at'>): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.AUDIO_METADATA], 'readwrite');
    const store = transaction.objectStore(STORES.AUDIO_METADATA);

    const metadata: AudioMetadata = {
      ...audioData,
      cached_at: Date.now()
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(metadata);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('Cached audio metadata:', audioData.id);
  }

  async getAudioMetadata(id: string): Promise<AudioMetadata | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.AUDIO_METADATA], 'readonly');
    const store = transaction.objectStore(STORES.AUDIO_METADATA);

    return new Promise<AudioMetadata | null>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllAudioMetadata(): Promise<AudioMetadata[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.AUDIO_METADATA], 'readonly');
    const store = transaction.objectStore(STORES.AUDIO_METADATA);

    return new Promise<AudioMetadata[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // User Preferences Management
  async setUserPreference(key: string, value: any): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.USER_PREFERENCES], 'readwrite');
    const store = transaction.objectStore(STORES.USER_PREFERENCES);

    const preference: UserPreference = {
      key,
      value,
      updated_at: Date.now()
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(preference);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUserPreference(key: string): Promise<any> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.USER_PREFERENCES], 'readonly');
    const store = transaction.objectStore(STORES.USER_PREFERENCES);

    return new Promise<any>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result as UserPreference | undefined;
        resolve(result?.value || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Utility Methods
  private generateSearchId(query: string, filters: any, sort: any, page: number): string {
    const searchParams = {
      query: query.toLowerCase().trim(),
      filters: filters || {},
      sort: sort || {},
      page
    };
    return btoa(JSON.stringify(searchParams)).replace(/[+/=]/g, '');
  }

  async cleanupExpiredData(): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.SEARCH_RESULTS], 'readwrite');
    const store = transaction.objectStore(STORES.SEARCH_RESULTS);
    const index = store.index('expiresAt');

    const now = Date.now();
    const range = IDBKeyRange.upperBound(now);

    await new Promise<void>((resolve, reject) => {
      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    console.log('Cleaned up expired search results');
  }

  async getStorageStats(): Promise<{
    searchResults: number;
    audioMetadata: number;
    userPreferences: number;
  }> {
    const db = await this.ensureDB();
    
    const [searchCount, audioCount, prefCount] = await Promise.all([
      this.getStoreCount(STORES.SEARCH_RESULTS),
      this.getStoreCount(STORES.AUDIO_METADATA),
      this.getStoreCount(STORES.USER_PREFERENCES)
    ]);

    return {
      searchResults: searchCount,
      audioMetadata: audioCount,
      userPreferences: prefCount
    };
  }

  private async getStoreCount(storeName: string): Promise<number> {
    const db = await this.ensureDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise<number>((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Storage Quota Management
  async getStorageQuota(): Promise<StorageQuotaInfo | null> {
    if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
      console.warn('Storage API not supported');
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const usagePercentage = quota > 0 ? (usage / quota) * 100 : 0;
      const available = quota - usage;

      return {
        usage,
        quota,
        usagePercentage,
        available
      };
    } catch (error) {
      console.error('Failed to get storage quota:', error);
      return null;
    }
  }

  async checkStorageQuota(): Promise<boolean> {
    const quota = await this.getStorageQuota();
    if (!quota) return true; // If we can't check, assume it's okay

    const usageThreshold = 85; // Alert when 85% full
    const criticalThreshold = 95; // Critical when 95% full

    if (quota.usagePercentage >= criticalThreshold) {
      console.warn('Storage quota critical! Usage:', quota.usagePercentage.toFixed(1) + '%');
      // Trigger aggressive cleanup
      await this.cleanupExpiredData();
      await this.cleanupOldestData(0.1); // Remove 10% of data
      return false;
    } else if (quota.usagePercentage >= usageThreshold) {
      console.warn('Storage quota high! Usage:', quota.usagePercentage.toFixed(1) + '%');
      // Trigger moderate cleanup
      await this.cleanupExpiredData();
      return true;
    }

    return true;
  }

  async cleanupOldestData(percentage: number = 0.1): Promise<void> {
    try {
      const db = await this.ensureDB();
      
      // Clean up oldest search results
      const searchTransaction = db.transaction([STORES.SEARCH_RESULTS], 'readwrite');
      const searchStore = searchTransaction.objectStore(STORES.SEARCH_RESULTS);
      const searchIndex = searchStore.index('timestamp');
      
      const searchResults = await new Promise<any[]>((resolve, reject) => {
        const request = searchIndex.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const searchToDelete = Math.floor(searchResults.length * percentage);
      const oldestSearch = searchResults
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, searchToDelete);

      for (const item of oldestSearch) {
        await new Promise<void>((resolve, reject) => {
          const deleteRequest = searchStore.delete(item.id);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      }

      // Clean up oldest audio metadata
      const audioTransaction = db.transaction([STORES.AUDIO_METADATA], 'readwrite');
      const audioStore = audioTransaction.objectStore(STORES.AUDIO_METADATA);
      const audioIndex = audioStore.index('cached_at');
      
      const audioResults = await new Promise<any[]>((resolve, reject) => {
        const request = audioIndex.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const audioToDelete = Math.floor(audioResults.length * percentage);
      const oldestAudio = audioResults
        .sort((a, b) => a.cached_at - b.cached_at)
        .slice(0, audioToDelete);

      for (const item of oldestAudio) {
        await new Promise<void>((resolve, reject) => {
          const deleteRequest = audioStore.delete(item.id);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      }

      console.log(`Cleaned up ${searchToDelete} search results and ${audioToDelete} audio metadata entries`);
    } catch (error) {
      console.error('Failed to cleanup oldest data:', error);
    }
  }

  async clearAllData(): Promise<void> {
    try {
      const db = await this.ensureDB();
      
      // Clear all object stores
      const storeNames = [STORES.SEARCH_RESULTS, STORES.AUDIO_METADATA, STORES.USER_PREFERENCES];
      
      for (const storeName of storeNames) {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        await new Promise<void>((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      
      console.log('Cleared all cached data');
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }

  async requestPersistentStorage(): Promise<boolean> {
    if (!('storage' in navigator) || !('persist' in navigator.storage)) {
      console.warn('Persistent storage not supported');
      return false;
    }

    try {
      const isPersistent = await navigator.storage.persist();
      console.log('Persistent storage:', isPersistent ? 'granted' : 'denied');
      return isPersistent;
    } catch (error) {
      console.error('Failed to request persistent storage:', error);
      return false;
    }
  }

  async getCacheSettings(): Promise<CacheSettings> {
    const settings = await this.getUserPreference('cacheSettings');
    if (settings) {
      return settings;
    }
    
    // Return default settings
    return {
      enableSearchResultsCaching: true,
      enableAudioMetadataCaching: true,
      enableUserPreferencesCaching: true,
      searchResultsTTL: 1,
      autoCleanupEnabled: true,
      maxStorageUsagePercent: 85
    };
  }

  async updateCacheSettings(settings: Partial<CacheSettings>): Promise<void> {
    const currentSettings = await this.getCacheSettings();
    const newSettings = { ...currentSettings, ...settings };
    await this.setUserPreference('cacheSettings', newSettings);
  }
}

// Create singleton instance
const offlineDBService = new OfflineDBService();

// Create Svelte store
function createOfflineStore() {
  const defaultCacheSettings: CacheSettings = {
    enableSearchResultsCaching: true,
    enableAudioMetadataCaching: true,
    enableUserPreferencesCaching: true,
    searchResultsTTL: 1, // 1 hour
    autoCleanupEnabled: true,
    maxStorageUsagePercent: 85
  };

  const { subscribe, set, update } = writable<OfflineStoreState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    hasOfflineData: false,
    lastSync: null,
    storageQuota: null,
    cacheSettings: defaultCacheSettings
  });

  // Initialize online/offline detection
  if (typeof window !== 'undefined') {
    const updateOnlineStatus = () => {
      update(state => ({ ...state, isOnline: navigator.onLine }));
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  }

  return {
    subscribe,
    init: async () => {
      await offlineDBService.init();
      
      // Request persistent storage
      await offlineDBService.requestPersistentStorage();
      
      const [stats, quota, cacheSettings] = await Promise.all([
        offlineDBService.getStorageStats(),
        offlineDBService.getStorageQuota(),
        offlineDBService.getCacheSettings()
      ]);
      
      const hasData = stats.searchResults > 0 || stats.audioMetadata > 0;
      
      update(state => ({
        ...state,
        hasOfflineData: hasData,
        lastSync: Date.now(),
        storageQuota: quota,
        cacheSettings
      }));
    },
    cacheSearchResults: async (query: string, filters: any, sort: any, page: number, results: any[], total: number, ttlHours?: number) => {
      // Get current cache settings
      const cacheSettings = await offlineDBService.getCacheSettings();
      
      // Check if search results caching is enabled
      if (!cacheSettings.enableSearchResultsCaching) {
        console.log('Search results caching is disabled');
        return;
      }
      
      // Use TTL from settings if not provided
      const actualTTL = ttlHours || cacheSettings.searchResultsTTL;
      
      // Check quota before caching
      const quotaOk = await offlineDBService.checkStorageQuota();
      if (!quotaOk) {
        console.warn('Storage quota exceeded, skipping cache');
        return;
      }
      
      await offlineDBService.cacheSearchResults(query, filters, sort, page, results, total, actualTTL);
      
      // Update quota info
      const quota = await offlineDBService.getStorageQuota();
      update(state => ({ ...state, storageQuota: quota }));
    },
    cacheAudioMetadata: async (audioData: Omit<AudioMetadata, 'cached_at'>) => {
      // Get current cache settings
      const cacheSettings = await offlineDBService.getCacheSettings();
      
      // Check if audio metadata caching is enabled
      if (!cacheSettings.enableAudioMetadataCaching) {
        console.log('Audio metadata caching is disabled');
        return;
      }
      
      // Check quota before caching
      const quotaOk = await offlineDBService.checkStorageQuota();
      if (!quotaOk) {
        console.warn('Storage quota exceeded, skipping audio metadata cache');
        return;
      }
      
      await offlineDBService.cacheAudioMetadata(audioData);
      
      // Update quota info
      const quota = await offlineDBService.getStorageQuota();
      update(state => ({ ...state, storageQuota: quota }));
    },
    getSearchResults: offlineDBService.getSearchResults.bind(offlineDBService),
    getAudioMetadata: offlineDBService.getAudioMetadata.bind(offlineDBService),
    getAllAudioMetadata: offlineDBService.getAllAudioMetadata.bind(offlineDBService),
    setUserPreference: offlineDBService.setUserPreference.bind(offlineDBService),
    getUserPreference: offlineDBService.getUserPreference.bind(offlineDBService),
    cleanupExpiredData: async () => {
      await offlineDBService.cleanupExpiredData();
      const quota = await offlineDBService.getStorageQuota();
      update(state => ({ ...state, storageQuota: quota }));
    },
    getStorageStats: offlineDBService.getStorageStats.bind(offlineDBService),
    getStorageQuota: offlineDBService.getStorageQuota.bind(offlineDBService),
    checkStorageQuota: offlineDBService.checkStorageQuota.bind(offlineDBService),
    cleanupOldestData: async (percentage?: number) => {
      await offlineDBService.cleanupOldestData(percentage);
      const quota = await offlineDBService.getStorageQuota();
      update(state => ({ ...state, storageQuota: quota }));
    },
    requestPersistentStorage: offlineDBService.requestPersistentStorage.bind(offlineDBService),
    updateLastSync: () => {
      update(state => ({ ...state, lastSync: Date.now() }));
    },
    updateStorageQuota: async () => {
      const quota = await offlineDBService.getStorageQuota();
      update(state => ({ ...state, storageQuota: quota }));
    },
    clearAllData: async () => {
      await offlineDBService.clearAllData();
      const quota = await offlineDBService.getStorageQuota();
      update(state => ({
        ...state,
        hasOfflineData: false,
        storageQuota: quota
      }));
    },
    getCacheSettings: async () => {
      return await offlineDBService.getCacheSettings();
    },
    updateCacheSettings: async (settings: Partial<CacheSettings>) => {
      await offlineDBService.updateCacheSettings(settings);
      const newSettings = await offlineDBService.getCacheSettings();
      update(state => ({ ...state, cacheSettings: newSettings }));
    }
  };
}

export const offlineStore = createOfflineStore();
export { offlineDBService };
export type { SearchResult, AudioMetadata, UserPreference, OfflineStoreState, CacheSettings };