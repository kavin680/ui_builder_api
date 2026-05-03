import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Get()
  @Public()
  getHello() {
    return this.appService.getHello();
  }

  constructor(private readonly appService: AppService) { }

  @Get('health')
  @Public()
  healthCheck() {
    return { health: true, status: 'OK', message: 'Server is healthy' };
  }
}
