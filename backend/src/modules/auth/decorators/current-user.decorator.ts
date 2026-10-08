import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '../../users/entities/user.entity.js';

/** Payload JWT được AuthGuard gán vào request.user */
export interface JwtPayload {
  sub: number;
  username: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const user: JwtPayload = ctx.switchToHttp().getRequest().user;
    return data ? user?.[data] : user;
  },
);
