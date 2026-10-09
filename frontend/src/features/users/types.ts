import type { User, UserRole } from '@/features/auth/types';

export interface CreateUserInput {
  /** Bỏ trống thì server dùng số điện thoại làm tên đăng nhập */
  username?: string;
  /** Bỏ trống thì server dùng mật khẩu mặc định của nhân viên */
  password?: string;
  fullName: string;
  phone?: string;
  address?: string;
  role: UserRole;
}

export type UpdateUserInput = Partial<
  Omit<CreateUserInput, 'username'> & { isActive: boolean }
>;

export type { User };
