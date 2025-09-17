import crypto from 'crypto';
import { supabaseBrowserClient } from '../supabase/client';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt: Date;
  createdAt: Date;
  accessCount: number;
  lastAccessedAt: Date;
  metadata?: Record<string, any>;
}

export interface CacheOptions {
  ttlMs?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache size
  persistToDB?: boolean; // Whether to persist to database
  compressionThreshold?: number; // Compress values larger than this (in bytes)
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  memoryUsage: number; // Approximate memory usage in bytes
  oldestEntry?: Date;
  newestEntry?: Date;
}

export class CacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private accessLog = new Map<string, number>(); // Track access frequency
  private defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
  private maxMemoryEntries = 1000;
  private compressionThreshold = 10000; // 10KB

  /**
   * Get value from cache (memory first, then database)
   */
  public async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.normalizeKey(key);

    // Check memory cache first
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry) {
      if (this.isExpired(memoryEntry)) {
        this.memoryCache.delete(cacheKey);
      } else {
        this.updateAccessStats(cacheKey, memoryEntry);
        return memoryEntry.value as T;
      }
    }

    // Check database cache
    try {
      const dbEntry = await this.getFromDatabase<T>(cacheKey);
      if (dbEntry && !this.isExpired(dbEntry)) {
        // Store in memory cache for faster future access
        this.setInMemory(cacheKey, dbEntry);
        this.updateAccessStats(cacheKey, dbEntry);
        return dbEntry.value;
      }
    } catch (error) {
      console.warn('Database cache lookup failed:', error);
    }

    return null;
  }

  /**
   * Set value in cache
   */
  public async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const cacheKey = this.normalizeKey(key);
    const opts = {
      ttlMs: this.defaultTTL,
      persistToDB: true,
      ...options,
    };

    const entry: CacheEntry<T> = {
      key: cacheKey,
      value,
      expiresAt: new Date(Date.now() + opts.ttlMs),
      createdAt: new Date(),
      accessCount: 0,
      lastAccessedAt: new Date(),
      metadata: options.persistToDB ? { size: this.estimateSize(value) } : undefined,
    };

    // Store in memory
    this.setInMemory(cacheKey, entry);

    // Store in database if requested
    if (opts.persistToDB) {
      try {
        await this.setInDatabase(entry);
      } catch (error) {
        console.error('Failed to persist cache entry to database:', error);
      }
    }
  }

  /**
   * Delete from cache
   */
  public async delete(key: string): Promise<void> {
    const cacheKey = this.normalizeKey(key);
    
    // Remove from memory
    this.memoryCache.delete(cacheKey);
    this.accessLog.delete(cacheKey);

    // Remove from database
    try {
      if (supabaseBrowserClient) {
        await supabaseBrowserClient
          .from('embedding_cache')
          .delete()
          .eq('content_hash', cacheKey);
      }
    } catch (error) {
      console.warn('Failed to delete from database cache:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<void> {
    this.memoryCache.clear();
    this.accessLog.clear();

    try {
      if (supabaseBrowserClient) {
        await supabaseBrowserClient
          .from('embedding_cache')
          .delete()
          .neq('id', 'non-existent'); // Delete all rows
      }
    } catch (error) {
      console.warn('Failed to clear database cache:', error);
    }
  }

  /**
   * Clean up expired entries
   */
  public async cleanup(): Promise<number> {
    let cleaned = 0;

    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        this.accessLog.delete(key);
        cleaned++;
      }
    }

    // Clean database cache
    try {
      if (supabaseBrowserClient) {
        const { count } = await supabaseBrowserClient
          .from('embedding_cache')
          .delete()
          .lt('created_at', new Date(Date.now() - this.defaultTTL).toISOString())
          .select('*', { count: 'exact', head: true });
        
        cleaned += count || 0;
      }
    } catch (error) {
      console.warn('Failed to cleanup database cache:', error);
    }

    console.log(`Cache cleanup completed: ${cleaned} entries removed`);
    return cleaned;
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<CacheStats> {
    const entries = Array.from(this.memoryCache.values());
    const totalHits = Array.from(this.accessLog.values()).reduce((sum, count) => sum + count, 0);
    const totalRequests = Math.max(totalHits, entries.length);

    return {
      totalEntries: entries.length,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      memoryUsage: this.estimateMemoryUsage(),
      oldestEntry: entries.length > 0 ? 
        new Date(Math.min(...entries.map(e => e.createdAt.getTime()))) : undefined,
      newestEntry: entries.length > 0 ? 
        new Date(Math.max(...entries.map(e => e.createdAt.getTime()))) : undefined,
    };
  }

  /**
   * Evict least recently used entries when cache is full
   */
  private evictLRU(): void {
    if (this.memoryCache.size <= this.maxMemoryEntries) {
      return;
    }

    const entries = Array.from(this.memoryCache.entries());
    
    // Sort by last accessed time (oldest first)
    entries.sort((a, b) => 
      a[1].lastAccessedAt.getTime() - b[1].lastAccessedAt.getTime()
    );

    // Remove oldest 10% of entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    
    for (let i = 0; i < toRemove; i++) {
      const [key] = entries[i];
      this.memoryCache.delete(key);
      this.accessLog.delete(key);
    }

    console.log(`Evicted ${toRemove} LRU cache entries`);
  }

  /**
   * Store entry in memory cache
   */
  private setInMemory<T>(key: string, entry: CacheEntry<T>): void {
    // Evict old entries if needed
    this.evictLRU();
    
    this.memoryCache.set(key, entry);
  }

  /**
   * Get entry from database
   */
  private async getFromDatabase<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!supabaseBrowserClient) {
      return null;
    }

    try {
      const { data, error } = await supabaseBrowserClient
        .from('embedding_cache')
        .select('content, embedding, created_at')
        .eq('content_hash', key)
        .single();

      if (error || !data) {
        return null;
      }

      // For embedding cache, we need to reconstruct the entry format
      const entry: CacheEntry<T> = {
        key,
        value: data.embedding as T, // Assuming T is embedding array
        expiresAt: new Date(Date.now() + this.defaultTTL),
        createdAt: new Date(data.created_at),
        accessCount: 0,
        lastAccessedAt: new Date(),
      };

      return entry;
    } catch (error) {
      console.error('Database cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Store entry in database
   */
  private async setInDatabase<T>(entry: CacheEntry<T>): Promise<void> {
    if (!supabaseBrowserClient) {
      return;
    }

    // For now, we only support embedding caching in the database
    // In a full implementation, you might have a generic cache table
    if (Array.isArray(entry.value) && entry.value.every(v => typeof v === 'number')) {
      try {
        await supabaseBrowserClient
          .from('embedding_cache')
          .upsert({
            content_hash: entry.key,
            content: '', // Would store actual content if needed
            embedding: entry.value as number[],
            model: 'text-embedding-3-small',
          });
      } catch (error) {
        console.error('Database cache storage error:', error);
      }
    }
  }

  /**
   * Update access statistics
   */
  private updateAccessStats<T>(key: string, entry: CacheEntry<T>): void {
    entry.accessCount++;
    entry.lastAccessedAt = new Date();
    
    const currentCount = this.accessLog.get(key) || 0;
    this.accessLog.set(key, currentCount + 1);
  }

  /**
   * Check if entry is expired
   */
  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return Date.now() > entry.expiresAt.getTime();
  }

  /**
   * Normalize cache key
   */
  private normalizeKey(key: string): string {
    return crypto.createHash('sha256').update(key.trim()).digest('hex');
  }

  /**
   * Estimate size of a value in bytes
   */
  private estimateSize(value: any): number {
    return JSON.stringify(value).length * 2; // Rough estimate
  }

  /**
   * Estimate total memory usage
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const entry of this.memoryCache.values()) {
      totalSize += this.estimateSize(entry);
    }
    
    return totalSize;
  }

  /**
   * Warm up cache with frequently accessed items
   */
  public async warmup(items: Array<{ key: string; generator: () => Promise<any> }>): Promise<void> {
    console.log(`Warming up cache with ${items.length} items...`);
    
    const promises = items.map(async (item) => {
      try {
        const cached = await this.get(item.key);
        if (!cached) {
          const value = await item.generator();
          await this.set(item.key, value, { ttlMs: this.defaultTTL * 2 }); // Longer TTL for warmed items
        }
      } catch (error) {
        console.warn(`Failed to warm up cache item ${item.key}:`, error);
      }
    });

    await Promise.allSettled(promises);
    console.log('Cache warmup completed');
  }

  /**
   * Get cache entry details for debugging
   */
  public async getEntryDetails(key: string): Promise<CacheEntry | null> {
    const cacheKey = this.normalizeKey(key);
    return this.memoryCache.get(cacheKey) || null;
  }

  /**
   * Bulk get multiple keys
   */
  public async getBulk<T>(keys: string[]): Promise<Array<{ key: string; value: T | null }>> {
    const results = await Promise.allSettled(
      keys.map(async (key) => ({ key, value: await this.get<T>(key) }))
    );

    return results.map((result, index) => ({
      key: keys[index],
      value: result.status === 'fulfilled' ? result.value.value : null,
    }));
  }

  /**
   * Bulk set multiple key-value pairs
   */
  public async setBulk<T>(
    items: Array<{ key: string; value: T }>,
    options: CacheOptions = {}
  ): Promise<void> {
    const promises = items.map(item => 
      this.set(item.key, item.value, options)
    );
    
    await Promise.allSettled(promises);
  }
}

// Singleton instance for global use
export const cacheManager = new CacheManager();