import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';

@Injectable()
export class SlowRequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SlowRequest');
  private readonly SLOW_THRESHOLD_MS = 300;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const req = context.switchToHttp().getRequest<Request>();
    const method = req?.method;
    const url = req?.originalUrl || req?.url;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        // Bỏ qua SSE stream vì là kết nối dài hạn
        if (duration > this.SLOW_THRESHOLD_MS && url && !url.includes('/realtime/stream')) {
          this.logger.warn(`SLOW REQUEST [${method} ${url}] hoàn thành sau ${duration}ms`);
        }
      }),
    );
  }
}
