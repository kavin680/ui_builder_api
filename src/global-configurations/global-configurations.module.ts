import { Module } from '@nestjs/common';
import { GlobalConfigurationsService } from './global-configurations.service';
import { GlobalConfigurationsController } from './global-configurations.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AppCacheModule } from 'src/common/cache/cache.module';

@Module({
  controllers: [GlobalConfigurationsController],
  providers: [GlobalConfigurationsService],
  imports: [PrismaModule, AppCacheModule],
  exports: [GlobalConfigurationsService],
})
export class GlobalConfigurationsModule { }
