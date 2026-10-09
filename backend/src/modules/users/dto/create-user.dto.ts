import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { UserRole } from '../entities/user.entity.js';

export class CreateUserDto {
  @ApiPropertyOptional({
    description: 'Tên đăng nhập; bỏ trống thì dùng số điện thoại',
    example: '0901234567',
  })
  @IsOptional()
  @IsString()
  @Length(3, 50, { message: 'Tên đăng nhập phải từ 3 đến 50 ký tự' })
  username?: string;

  @ApiPropertyOptional({
    description: 'Mật khẩu; bỏ trống thì dùng mật khẩu mặc định của nhân viên',
    example: 'MatKhau123',
  })
  @IsOptional()
  @IsString()
  @Length(8, 100, { message: 'Mật khẩu phải từ 8 đến 100 ký tự' })
  password?: string;

  @ApiProperty({ description: 'Họ và tên', example: 'Nguyễn Văn A' })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @IsString()
  @Length(1, 100, { message: 'Họ và tên phải từ 1 đến 100 ký tự' })
  fullName: string;

  @ApiPropertyOptional({ description: 'Số điện thoại', example: '0901234567' })
  @IsOptional()
  @IsString()
  @Matches(/^(0|\+84)\d{9,10}$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ',
    example: '12 Nguyễn Trãi, Thanh Xuân, Hà Nội',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255, { message: 'Địa chỉ không được dài quá 255 ký tự' })
  address?: string;

  @ApiPropertyOptional({
    description: 'Vai trò',
    enum: UserRole,
    default: UserRole.STAFF,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Vai trò không hợp lệ' })
  role?: UserRole;
}
