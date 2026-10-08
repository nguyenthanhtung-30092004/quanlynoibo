import { OmitType } from '@nestjs/swagger';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';

/** Đăng ký tài khoản Admin đầu tiên (bootstrap); vai trò luôn là ADMIN */
export class RegisterDto extends OmitType(CreateUserDto, ['role'] as const) {}
