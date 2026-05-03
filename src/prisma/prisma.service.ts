import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {

  private readonly logger = new Logger(PrismaService.name);

  constructor(private config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.get<string>('DATABASE_URL'),
        },
      },
    });
  }

  async onModuleInit() {
    // We loop here because if the database is starting up (e.g. in docker-compose),
    // we don't want the app to crash immediately. We'll wait for it.
    while (true) {
      try {
        await this.$connect();
        
        // These timeouts prevent a single slow query from hanging the entire event loop.
        // 15s is plenty for most industrial telemetry queries, but short enough to 
        // fail fast if the DB is locked up.
        try {
          await this.$executeRawUnsafe(`SET statement_timeout = '15s'`);
          await this.$executeRawUnsafe(`SET idle_in_transaction_session_timeout = '15s'`);
        } catch {
          // MySQL or older Postgres versions might not support these settings.
          // We ignore errors here so we don't block the actual connection.
        }
        this.logger.log('Successfully connected to database with timeout safeguards');
        break;
      } catch (err) {
        this.logger.error('Database connection failed, retrying in 5 seconds...', err.message);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
