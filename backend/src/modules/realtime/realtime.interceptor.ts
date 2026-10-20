import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { REALTIME_TOPICS, RealtimeService, type RealtimeTopic } from './realtime.service.js';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Đường dẫn ghi nhưng không đổi dữ liệu mà ai đó đang xem (heartbeat gọi mỗi phút từ mọi nhân viên, phát sự kiện sẽ làm admin tải lại liên tục) */
const SILENT_PATHS = new Set(['attendance/heartbeat']);

/** '/orders/12/cancel?x=1' -> 'orders' nếu là nhóm được theo dõi */
export function topicOfPath(url: string): RealtimeTopic | null {
  const segments = url.split('?')[0].split('/').filter(Boolean);
  if (SILENT_PATHS.has(segments.slice(0, 2).join('/'))) return null;
  return (REALTIME_TOPICS as readonly string[]).includes(segments[0]) ? (segments[0] as RealtimeTopic) : null;
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
