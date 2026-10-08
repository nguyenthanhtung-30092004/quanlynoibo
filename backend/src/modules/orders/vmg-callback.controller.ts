import { timingSafeEqual } from 'node:crypto';
import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator.js';
import { OrdersService } from './orders.service.js';

interface VmgCallbackBody {
  referentId?: string;
  status?: number;
}

/**
 * VMG gọi vào đây để báo trạng thái tin (II.2.8 Service callback).
 * URL đăng ký với VMG: https://<domain>/api/orders/vmg-callback?secret=<VMG_CALLBACK_SECRET>
 */
@Controller('orders/vmg-callback')
export class VmgCallbackController {
  constructor(
    private readonly config: ConfigService,
    private readonly ordersService: OrdersService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async callback(@Query('secret') secret: string, @Body() body: VmgCallbackBody) {
    const expected = this.config.get<string>('VMG_CALLBACK_SECRET');
    if (!expected || !safeEqual(secret, expected)) throw new ForbiddenException();
    if (body?.referentId && typeof body.status === 'number') {
      await this.ordersService.applyCallback(body.referentId, body.status);
    }
    return { statusCode: HttpStatus.OK, message: 'OK' };
  }
}

/** So sánh hằng thời gian để không lộ secret qua độ trễ phản hồi */
function safeEqual(a: unknown, b: string): boolean {
  if (typeof a !== 'string') return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
