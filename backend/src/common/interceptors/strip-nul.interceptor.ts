import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';

/** Postgres không lưu được ký tự NUL (\u0000) trong chuỗi, dán từ Zalo/app khác hay lẫn vào cuối ô */
export function stripNul<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/\u0000/g, '') as T;
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      value[i] = stripNul(item);
    });
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) record[key] = stripNul(record[key]);
  }
  return value;
}

/** Làm sạch body trước khi vào ValidationPipe để mọi ô chữ đều không còn ký tự NUL */
@Injectable()
export class StripNulInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    if (req?.body && typeof req.body === 'object') stripNul(req.body);
    return next.handle();
  }
}
