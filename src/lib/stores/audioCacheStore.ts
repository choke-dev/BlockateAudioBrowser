import { writable } from 'svelte/store';

interface CachedAudio {
  blob: Blob;
  url: string;
  lastAccessed: number;
  size: number;
}

interface CacheOperation {
  trackId: string;
  abortController: AbortController;
  promise: Promise<string>;
}

interface AudioCacheState {
  cache: Map<string, CachedAudio>;
  totalSize: number;
  maxSize: number; // Maximum cache size in bytes (default: 100MB)
}

class AudioCacheService {
  public cache = new Map<string, CachedAudio>();
  private maxSize = 100 * 1024 * 1024; // 100MB default
  private totalSize = 0;
  private ongoingOperations = new Map<string, CacheOperation>();

  constructor(maxSizeMB = 100) {
    this.maxSize = maxSizeMB * 1024 * 1024;
  }

  /**
   * Get cached audio blob URL if available
   */
  getCachedAudio(trackId: string): string | null {
    const cached = this.cache.get(trackId);
    if (cached) {
      // Update last accessed time
      cached.lastAccessed = Date.now();
      return cached.url;
    }
    return null;
  }

  /**
   * Cache an audio blob for a track
   */
  async cacheAudio(trackId: string, audioUrl: string): Promise<string> {
    try {
      // Check if already cached
      const existing = this.cache.get(trackId);
      if (existing) {
        existing.lastAccessed = Date.now();
        return existing.url;
      }

      // Check if already being cached
      const ongoing = this.ongoingOperations.get(trackId);
      if (ongoing) {
        return ongoing.promise;
      }

      // Create abort controller for this operation
      const abortController = new AbortController();
      
      // Create the caching promise
      const cachePromise = this.performCaching(trackId, audioUrl, abortController);
      
      // Track the ongoing operation
      this.ongoingOperations.set(trackId, {
        trackId,
        abortController,
        promise: cachePromise
      });

      // Clean up the operation when done (success or failure)
      cachePromise.finally(() => {
        this.ongoingOperations.delete(trackId);
      });

      return cachePromise;
    } catch (error) {
      console.error(`Failed to cache audio for track ${trackId}:`, error);
      // Return original URL as fallback
      return audioUrl;
    }
  }

  /**
   * Perform the actual caching operation
   */
  private async performCaching(trackId: string, audioUrl: string, abortController: AbortController): Promise<string> {
    try {
      // Fetch the audio as blob with abort signal
      const response = await fetch(audioUrl, {
        signal: abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status}`);
      }

      const blob = await response.blob();
      
      // Check if operation was aborted
      if (abortController.signal.aborted) {
        throw new Error('Cache operation was aborted');
      }

      const blobUrl = URL.createObjectURL(blob);
      const size = blob.size;

      // Check if we need to free up space
      await this.ensureSpace(size);

      // Cache the audio
      const cachedAudio: CachedAudio = {
        blob,
        url: blobUrl,
        lastAccessed: Date.now(),
        size
      };

      this.cache.set(trackId, cachedAudio);
      this.totalSize += size;

      console.log(`Cached audio for track ${trackId}, size: ${(size / 1024 / 1024).toFixed(2)}MB`);
      return blobUrl;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`Cache operation aborted for track ${trackId}`);
      } else {
        console.error(`Failed to cache audio for track ${trackId}:`, error);
      }
      // Return original URL as fallback
      return audioUrl;
    }
  }

  /**
   * Remove a specific track from cache
   */
  removeCachedAudio(trackId: string): void {
    const cached = this.cache.get(trackId);
    if (cached) {
      URL.revokeObjectURL(cached.url);
      this.totalSize -= cached.size;
      this.cache.delete(trackId);
      console.log(`Removed cached audio for track ${trackId}`);
    }
  }

  /**
   * Cancel ongoing cache operation for a specific track
   */
  cancelCacheOperation(trackId: string): void {
    const operation = this.ongoingOperations.get(trackId);
    if (operation) {
      operation.abortController.abort();
      this.ongoingOperations.delete(trackId);
      console.log(`Cancelled cache operation for track ${trackId}`);
    }
  }

  /**
   * Cancel all ongoing cache operations
   */
  cancelAllOperations(): void {
    for (const [trackId, operation] of this.ongoingOperations.entries()) {
      operation.abortController.abort();
    }
    this.ongoingOperations.clear();
    console.log('Cancelled all ongoing cache operations');
  }

  /**
   * Ensure there's enough space for a new audio file
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    // If the required size is larger than max cache size, don't cache
    if (requiredSize > this.maxSize) {
      console.warn(`Audio file too large to cache: ${(requiredSize / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    // Remove oldest entries until we have enough space
    while (this.totalSize + requiredSize > this.maxSize && this.cache.size > 0) {
      const oldestEntry = this.findOldestEntry();
      if (oldestEntry) {
        this.removeCachedAudio(oldestEntry);
      } else {
        break;
      }
    }
  }

  /**
   * Find the oldest (least recently accessed) cache entry
   */
  private findOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, cached] of this.cache.entries()) {
      if (cached.lastAccessed < oldestTime) {
        oldestTime = cached.lastAccessed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Clear all cached audio
   */
  clearCache(): void {
    // Cancel all ongoing operations first
    this.cancelAllOperations();
    
    // Clear cached audio
    for (const [trackId, cached] of this.cache.entries()) {
      URL.revokeObjectURL(cached.url);
    }
    this.cache.clear();
    this.totalSize = 0;
    console.log('Audio cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalSize: number;
    totalSizeMB: number;
    maxSize: number;
    maxSizeMB: number;
    entryCount: number;
    entries: Array<{ trackId: string; sizeMB: number; lastAccessed: Date }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([trackId, cached]) => ({
      trackId,
      sizeMB: cached.size / 1024 / 1024,
      lastAccessed: new Date(cached.lastAccessed)
    }));

    return {
      totalSize: this.totalSize,
      totalSizeMB: this.totalSize / 1024 / 1024,
      maxSize: this.maxSize,
      maxSizeMB: this.maxSize / 1024 / 1024,
      entryCount: this.cache.size,
      entries
    };
  }

  /**
   * Set maximum cache size
   */
  setMaxSize(maxSizeMB: number): void {
    this.maxSize = maxSizeMB * 1024 * 1024;
    // Trigger cleanup if current size exceeds new limit
    this.ensureSpace(0);
  }

  /**
   * Check if a track is cached
   */
  isCached(trackId: string): boolean {
    return this.cache.has(trackId);
  }

  /**
   * Preload audio for a track (cache without playing)
   */
  async preloadAudio(trackId: string, audioUrl: string): Promise<void> {
    if (!this.isCached(trackId)) {
      await this.cacheAudio(trackId, audioUrl);
    }
  }
}

// Create a singleton instance
const audioCacheService = new AudioCacheService();

// Create a Svelte store for reactive cache stats
function createAudioCacheStore() {
  const { subscribe, set, update } = writable<AudioCacheState>({
    cache: new Map(),
    totalSize: 0,
    maxSize: 100 * 1024 * 1024
  });

  return {
    subscribe,
    getCachedAudio: (trackId: string) => audioCacheService.getCachedAudio(trackId),
    cacheAudio: async (trackId: string, audioUrl: string) => {
      const result = await audioCacheService.cacheAudio(trackId, audioUrl);
      // Update store with current stats
      const stats = audioCacheService.getCacheStats();
      update(state => ({
        ...state,
        totalSize: stats.totalSize,
        cache: new Map(audioCacheService.cache)
      }));
      return result;
    },
    removeCachedAudio: (trackId: string) => {
      audioCacheService.removeCachedAudio(trackId);
      const stats = audioCacheService.getCacheStats();
      update(state => ({
        ...state,
        totalSize: stats.totalSize,
        cache: new Map(audioCacheService.cache)
      }));
    },
    clearCache: () => {
      audioCacheService.clearCache();
      update(state => ({
        ...state,
        totalSize: 0,
        cache: new Map()
      }));
    },
    getCacheStats: () => audioCacheService.getCacheStats(),
    setMaxSize: (maxSizeMB: number) => {
      audioCacheService.setMaxSize(maxSizeMB);
      update(state => ({
        ...state,
        maxSize: maxSizeMB * 1024 * 1024
      }));
    },
    isCached: (trackId: string) => audioCacheService.isCached(trackId),
    preloadAudio: (trackId: string, audioUrl: string) => audioCacheService.preloadAudio(trackId, audioUrl),
    cancelCacheOperation: (trackId: string) => audioCacheService.cancelCacheOperation(trackId),
    cancelAllOperations: () => audioCacheService.cancelAllOperations()
  };
}

export const audioCache = createAudioCacheStore();
export { audioCacheService };