import { Injectable, Inject, OnApplicationShutdown, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class AppCacheService implements OnApplicationShutdown {
    private readonly logger = new Logger(AppCacheService.name);
    constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) { }

    async onApplicationShutdown() {
        this.logger.log('AppCacheService: Initiating Redis buffer disconnect...');
        const client = this.getRedisClient();
        if (client) {
            try {
                if (typeof client.quit === 'function') {
                    await client.quit();
                } else if (typeof client.disconnect === 'function') {
                    await client.disconnect();
                }
                this.logger.log('AppCacheService: Redis client disconnected gracefully.');
            } catch (err) {
                this.logger.error('AppCacheService: Error closing Redis', err);
            }
        }
    }

    async get<T>(key: string): Promise<T | undefined> {
        const val = await this.cacheManager.get<T>(key);
        return val;
    }

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        // Use a safe version for BigInt if it's an object/array
        if (typeof value === 'object' && value !== null) {
            const safeValue = JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v));
            await this.cacheManager.set(key, safeValue, ttl);
        } else {
            await this.cacheManager.set(key, value, ttl);
        }
    }

    async del(key: string): Promise<void> {
        await this.cacheManager.del(key);
    }

    async clear(): Promise<void> {
        await this.cacheManager.clear();
    }

    async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
        const client = this.getRedisClient();
        if (client?.mget) {
            const results = await client.mget(...keys);
            return results.map((r: string | null) => {
                if (!r) return undefined;
                try {
                    return JSON.parse(r) as T;
                } catch {
                    return r as unknown as T;
                }
            });
        }
        return Promise.all(keys.map((k) => this.get<T>(k)));
    }

    // Redis HASH operations (requires ioredis-based cache manager)
    private getRedisClient() {
        // @ts-ignore - access internal redis client from cache-manager
        const store = this.cacheManager?.store;
        return (store as any)?.client || (store as any)?.instance;
    }

    private fallbackMemoryHash = new Map<string, Record<string, string>>();

    async hset(key: string, field: string, value: string): Promise<void> {
        const client = this.getRedisClient();
        if (client?.hset) {
            await client.hset(key, field, value);
            return;
        }
        if (!this.fallbackMemoryHash.has(key)) this.fallbackMemoryHash.set(key, {});
        this.fallbackMemoryHash.get(key)![field] = value;
    }

    async hget(key: string, field: string): Promise<string | undefined> {
        const client = this.getRedisClient();
        if (client?.hget) return client.hget(key, field);
        return this.fallbackMemoryHash.get(key)?.[field] || undefined;
    }

    async hdel(key: string, field: string): Promise<void> {
        const client = this.getRedisClient();
        if (client?.hdel) {
            await client.hdel(key, field);
            return;
        }
        if (this.fallbackMemoryHash.has(key)) {
            delete this.fallbackMemoryHash.get(key)![field];
        }
    }

    async hmset(key: string, data: Record<string, string>): Promise<void> {
        const client = this.getRedisClient();
        if (client?.hmset) {
            await client.hmset(key, data);
            return;
        }
        if (!this.fallbackMemoryHash.has(key)) this.fallbackMemoryHash.set(key, {});
        Object.assign(this.fallbackMemoryHash.get(key)!, data);
    }

    async hmget(key: string, fields: string[]): Promise<(string | null)[]> {
        const client = this.getRedisClient();
        if (client?.hmget) return client.hmget(key, ...fields);
        
        const hash = this.fallbackMemoryHash.get(key);
        return fields.map(f => hash?.[f] || null);
    }

    async expire(key: string, seconds: number): Promise<void> {
        const client = this.getRedisClient();
        if (client?.expire) await client.expire(key, seconds);
        // Memory fallback cleanup not strictly needed for basic failsafe
    }
}
