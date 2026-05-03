import {
  Module,
  MiddlewareConsumer,
  RequestMethod,
  NestModule,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { HttpExceptionFilter } from './http-exception/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';

import { DomainEventModule } from './common/events/domain-event.module';
import { LoggerModule } from 'nestjs-pino';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { configValidationSchema } from './common/config/config.schema';
import { HealthModule } from './health/health.module';
import { AppCacheModule } from './common/cache/cache.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { UserService } from './user/user.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { GlobalConfigurationsModule } from './global-configurations/global-configurations.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { VariablesModule } from './variables/variables.module';
import { DataSourceModule } from './data-source/data-source.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerModule } from './scheduler/scheduler.module';
import { FreezeConfigurationModule } from './freeze-configuration/freeze-configuration.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { AlarmConfigModule } from './alarm-config/alarm-config.module';
// import { SystemStateModule } from './common/system-state.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logLevel = config.get('LOG_LEVEL');

        return {
          pinoHttp: {
            level: logLevel || 'info',
            autoLogging: true,
            // Request Tracing (Requirement 5 & 10)
            customProps: (req: any) => ({
              requestId: req.id || req.requestId,
              method: req.method,
              url: req.url,
            }),
            // Secure logs by redacting sensitive data (Requirement 6)
            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie'],
              remove: true,
            },
            // Environment-specific formatting (Requirement 3, 4, 9)
            transport:
              config.get('NODE_ENV') !== 'production'
                ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
                    ignore: 'pid,hostname',
                    singleLine: true,
                  },
                }
                : {
                  target: 'pino/file',
                  options: {
                    destination: './logs/app.log',
                    mkdir: true,
                  },
                },
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL') || 60000,
          limit: config.get<number>('THROTTLE_LIMIT') || 100,
        },
      ],
    }),
    PrometheusModule.register(),
    HealthModule,
    UserModule,

    DomainEventModule,
    PrismaModule,
    AuthModule,
    GlobalConfigurationsModule,
    VariablesModule,
    DataSourceModule,
    ScheduleModule.forRoot(),
    FreezeConfigurationModule,
    SystemConfigModule,
    AlarmConfigModule,
    EventEmitterModule.forRoot(),
    AppCacheModule,
    SchedulerModule,
    // SystemStateModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: BigIntInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
