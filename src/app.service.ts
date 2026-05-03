import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { SystemInitializerService } from './system-config/system-initializer.service';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly systemInitializer: SystemInitializerService) { }

  async onApplicationBootstrap() {
    this.logger.log('🚀 [App] Initializing system orchestrator on startup...');
    await this.systemInitializer.initializeSystem();
  }

  getHello(): string {
    return 'Hello World!';
  }
}
