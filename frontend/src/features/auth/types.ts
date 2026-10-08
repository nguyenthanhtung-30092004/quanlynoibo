export type UserRole = 'ADMIN' | 'STAFF';

export interface User {
  id: number;
  username: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  citizenId: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}
