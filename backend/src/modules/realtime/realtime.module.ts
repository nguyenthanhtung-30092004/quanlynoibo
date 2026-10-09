import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RealtimeController } from './realtime.controller.js';
import { RealtimeInterceptor } from './realtime.interceptor.js';
import { RealtimeService } from './realtime.service.js';

@Global()
@Module({
  controllers: [RealtimeController],
  providers: [RealtimeService, { provide: APP_INTERCEPTOR, useClass: RealtimeInterceptor }],
  exports: [RealtimeService],
})
export class RealtimeModule {}
