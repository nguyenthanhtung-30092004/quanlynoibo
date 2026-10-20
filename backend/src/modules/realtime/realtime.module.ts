import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { RealtimeController } from './realtime.controller.js';
import { RealtimeInterceptor } from './realtime.interceptor.js';
import { RealtimeService } from './realtime.service.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [RealtimeController],
  providers: [RealtimeService, { provide: APP_INTERCEPTOR, useClass: RealtimeInterceptor }],
  exports: [RealtimeService],
})
export class RealtimeModule {}
