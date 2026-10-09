import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { RealtimeInterceptor, topicOfPath } from './realtime.interceptor.js';
import { RealtimeService } from './realtime.service.js';

function ctx(method: string, url: string, user?: { sub: number }) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, originalUrl: url, user }) }),
  } as unknown as ExecutionContext;
}
const handler: CallHandler = { handle: () => of('ok') };

describe('topicOfPath', () => {
  it('lấy nhóm dữ liệu từ đường dẫn', () => {
    expect(topicOfPath('/orders/12/cancel?x=1')).toBe('orders');
    expect(topicOfPath('/orders/vmg-callback')).toBe('orders');
    expect(topicOfPath('/auth/login')).toBeNull();
    expect(topicOfPath('/realtime/stream')).toBeNull();
  });
});

describe('RealtimeInterceptor', () => {
  it('phát sự kiện sau thao tác ghi thành công', async () => {
    const service = new RealtimeService();
    const emit = vi.spyOn(service, 'emit');
    await new Promise((r) =>
      new RealtimeInterceptor(service)
        .intercept(ctx('PATCH', '/orders/5', { sub: 7 }), handler)
        .subscribe({ complete: () => r(null) }),
    );
    expect(emit).toHaveBeenCalledWith({ topic: 'orders', actorId: 7 });
  });

  it('không phát khi chỉ đọc hoặc nhóm không theo dõi', async () => {
    const service = new RealtimeService();
    const emit = vi.spyOn(service, 'emit');
    const run = (c: ExecutionContext) =>
      new Promise((r) => new RealtimeInterceptor(service).intercept(c, handler).subscribe({ complete: () => r(null) }));
    await run(ctx('GET', '/orders'));
    await run(ctx('POST', '/auth/login'));
    expect(emit).not.toHaveBeenCalled();
  });
});
