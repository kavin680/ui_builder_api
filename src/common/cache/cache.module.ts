import { Module, Global, Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { AppCacheService } from './cache.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
    imports: [
        ConfigModule,
        CacheModule.registerAsync({
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => {
                const host = config.get<string>('REDIS_HOST') ?? '127.0.0.1';
                const port = config.get<number>('REDIS_PORT') ?? 6379;
                try {
                    // Set a timeout to prevent infinite hanging
                    const store = await redisStore({ 
                        url: `redis://${host}:${port}`, 
                        ttl: 600,
                        socket: { connectTimeout: 5000 }
                    });
                    return { store };
                } catch (err: any) {
                    const logger = new Logger('AppCacheModule');
                    logger.warn(`Redis Cache connection failed: ${err.message}. Degraded mode: Using in-memory fallback.`);
                    return {}; // NestJS cache-manager defaults to in-memory if store is omitted
                }
            },
        }),
    ],
    providers: [AppCacheService],
    exports: [AppCacheService],
})
export class AppCacheModule { }
