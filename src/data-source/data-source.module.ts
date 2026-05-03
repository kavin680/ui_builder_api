import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VariablesModule } from '../variables/variables.module';
import { DataSourceService } from './data-source.service';
import { GlobalConfigurationsModule } from 'src/global-configurations/global-configurations.module';
import { MessageDecoderService } from './message-decoder.service';

@Module({
  imports: [PrismaModule, VariablesModule, GlobalConfigurationsModule],
  providers: [DataSourceService, MessageDecoderService],
  exports: [DataSourceService, GlobalConfigurationsModule],
})
export class DataSourceModule {}
