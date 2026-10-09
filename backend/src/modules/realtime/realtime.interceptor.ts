import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { REALTIME_TOPICS, RealtimeService, type RealtimeTopic } from './realtime.service.js';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** '/orders/12/cancel?x=1' -> 'orders' nếu là nhóm được theo dõi */
export function topicOfPath(url: string): RealtimeTopic | null {
  const first = url.split('?')[0].split('/').filter(Boolean)[0];
  return (REALTIME_TOPICS as readonly string[]).includes(first) ? (first as RealtimeTopic) : null;
}

/**
 * Mọi thao tác ghi (POST/PATCH/PUT/DELETE) thành công trên các nhóm dữ liệu đều
 * phát một sự kiện, kể cả callback trạng thái tin nhắn từ nhà mạng gọi vào.
 * Làm ở một chỗ nên endpoint mới không bị bỏ sót.
 */
@Injectable()
export class RealtimeInterceptor implements NestInterceptor {
  constructor(private readonly realtime: RealtimeService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const topic = WRITE_METHODS.has(req.method) ? topicOfPath(req.originalUrl ?? req.url) : null;
    if (!topic) return next.handle();
    return next.handle().pipe(
      tap(() => this.realtime.emit({ topic, actorId: req.user?.sub ?? null })),
    );
  }
}
