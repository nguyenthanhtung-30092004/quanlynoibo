import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './modules/auth/decorators/public.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  async getHealth() {
    return this.appService.getHealth();
  }
}
