import { Controller, Get, Header, HttpStatus, MessageEvent, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable, defer, interval, map, merge } from 'rxjs';
import { filter, finalize } from 'rxjs/operators';
import { CurrentUser, type JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { RealtimeService } from './realtime.service.js';

/** Giữ kết nối sống qua nginx/proxy (thường cắt kết nối im lặng sau ~60 giây) */
const HEARTBEAT_MS = 25_000;

@ApiTags('Realtime')
@ApiBearerAuth()
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
  stream(@CurrentUser() user?: JwtPayload): Observable<MessageEvent> {
    const userId = user?.sub;
    const isAdmin = !user || user.role === UserRole.ADMIN;
    return defer(() => {
      if (userId) this.realtime.addConnection(userId);
      const changes = this.realtime.stream().pipe(
        // R2: Bỏ phát presence cho người dùng thường, chỉ Admin xem trang online mới cần
        filter((e) => isAdmin || e.topic !== 'presence'),
        map((e): MessageEvent => ({ type: 'change', data: e })),
      );
      const heartbeat = interval(HEARTBEAT_MS).pipe(
        map((): MessageEvent => ({ type: 'ping', data: '' })),
      );
      return merge(changes, heartbeat).pipe(
        finalize(() => {
          if (userId) this.realtime.removeConnection(userId);
        }),
      );
    });
  }

  /**
   * Lấy danh sách tài khoản đang online. Chỉ Admin mới gọi được; nhân viên gọi trả về 403.
   */
  @Get('online')
  @Roles(UserRole.ADMIN)
  async getOnlineUsers() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy danh sách người đang online thành công',
      data: await this.realtime.getOnlineUsersData(),
    };
  }
}
