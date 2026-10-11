import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { getBusinessDate } from '../orders/order-time-lock.js';
import { UserRole } from '../users/entities/user.entity.js';

interface Owned {
  createdById: number | null;
  createdAt: Date;
}

/**
 * Admin sửa/xóa tự do. Nhân viên chỉ sửa/xóa được bản ghi do chính mình tạo
 * và chỉ trong ngày tạo (đến 00:00 giờ VN hôm sau là khóa).
 */
export function canModifyOwnToday(record: Owned, actor: JwtPayload): boolean {
  if (actor.role === UserRole.ADMIN) return true;
  return (
    record.createdById === actor.sub &&
    getBusinessDate(record.createdAt) === getBusinessDate()
  );
}

export function assertCanModify(record: Owned, actor: JwtPayload, what: string): void {
  if (!canModifyOwnToday(record, actor)) {
    throw new ForbiddenException(
      `Bạn chỉ được sửa hoặc xóa ${what} do chính mình tạo trong ngày hôm nay.`,
    );
  }
}
