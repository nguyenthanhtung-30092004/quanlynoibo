import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';

/** Kiểm tra mỗi 30 giây nên chậm nhất 30 giây sau 23:59 là đã tự chấm ra */
const CHECK_INTERVAL_MS = 30_000;

/**
 * Cứ 23:59 (giờ VN) tự chấm ra cho người quên quẹt ra và không tính công ngày đó.
 * Không dùng thư viện lên lịch: một vòng lặp nhẹ là đủ, và khởi động lại máy chủ cũng bù được các ngày bị lỡ.
 */
@Injectable()
export class AttendanceAutoCloseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttendanceAutoCloseService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly attendance: AttendanceService) {}

  onModuleInit() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), CHECK_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const closed = await this.attendance.autoCloseOpenDays();
      if (closed > 0) this.logger.log(`Đã tự chấm ra cho ${closed} người quên quẹt ra (không tính công)`);
    } catch (err) {
      this.logger.error(`Không tự chấm ra được: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
