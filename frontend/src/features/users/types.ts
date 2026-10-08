import type { User, UserRole } from '@/features/auth/types';

export interface CreateUserInput {
  username: string;
  password: string;
  fullName: string;
  /** 12 chữ số */
  citizenId: string;
  phone?: string;
  address?: string;
  role: UserRole;
}

export type UpdateUserInput = Partial<
  Omit<CreateUserInput, 'username'> & { isActive: boolean }
>;

export type { User };
