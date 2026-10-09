import { Controller, Header, MessageEvent, Sse } from '@nestjs/common';
import { Observable, interval, map, merge } from 'rxjs';
import { RealtimeService } from './realtime.service.js';

/** Giữ kết nối sống qua nginx/proxy (thường cắt kết nối im lặng sau ~60 giây) */
const HEARTBEAT_MS = 25_000;

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * Luồng sự kiện cho người đã đăng nhập (AuthGuard toàn cục vẫn áp dụng).
   * `no-transform` để lớp nén của Next không gom đệm làm sự kiện đến trễ.
   */
  @Sse('stream')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('X-Accel-Buffering', 'no')
  stream(): Observable<MessageEvent> {
    const changes = this.realtime.stream().pipe(
      map((e): MessageEvent => ({ type: 'change', data: e })),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: '' })),
    );
    return merge(changes, heartbeat);
  }
}
