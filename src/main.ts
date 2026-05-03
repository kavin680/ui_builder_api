import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './http-exception/http-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  // ✅ Fix for BigInt serialization
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const logger = app.get(Logger);
  const configService = app.get(ConfigService);

  // ✅ Enable CORS
  const corsOrigin = configService.get('CORS_ORIGIN');
  app.enableCors({
    origin: corsOrigin === 'true' ? true : (corsOrigin?.split(',') || true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-request-id'],
  });

  // ✅ Global prefix
  app.setGlobalPrefix('api');

  // ✅ Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ✅ Swagger
  const config = new DocumentBuilder()
    .setTitle('Industrial IoT & UI Builder API')
    .setDescription('Production-ready backend for real-time telemetry, alarm management, and dynamic UI configuration.')
    .setVersion('2.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // ✅ Enable Nest shutdown hooks
  app.enableShutdownHooks();

  // ✅ Error handlers (keep logs, don’t crash instantly)
  process.on('uncaughtException', (err) => {
    logger.error(`Critical Uncaught Exception: ${err.message}`, err.stack);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  const port = configService.get<number>('PORT') || 3000;

  // 🚀 Start server
  await app.listen(port, '127.0.0.1');

  // ================================
  // 🔥 PROPER GRACEFUL SHUTDOWN
  // ================================

  let isShuttingDown = false;

  const handleGracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress, forcing exit...');
      process.exit(1);
    }

    isShuttingDown = true;

    logger.warn(`Received ${signal}, initiating Graceful Shutdown...`);

    try {
      await Promise.race([
        app.close(), // 🔥 closes HTTP + triggers all providers shutdown
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Shutdown timeout')), 15000)
        ),
      ]);

      logger.log('Graceful shutdown completed successfully.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown.', err);
      process.exit(1);
    }
  };

  // ✅ Handle signals (ONLY ONCE)
  process.once('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
  process.once('SIGINT', () => handleGracefulShutdown('SIGINT'));

  // ✅ Startup logs
  console.log(`Application is running on: http://localhost:${port}/api`);
  console.log(`WebSocket is running on: ws://localhost:${port}`);
  console.log(`Swagger is running on: http://localhost:${port}/api-docs`);
}

bootstrap();