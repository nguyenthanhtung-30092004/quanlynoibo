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
  @ApiProperty({ description: 'Tên đăng nhập', example: 'nhanvien1' })
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  @IsString()
  @Length(3, 50, { message: 'Tên đăng nhập phải từ 3 đến 50 ký tự' })
  username: string;

  @ApiProperty({ description: 'Mật khẩu', example: 'MatKhau123' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString()
  @Length(8, 100, { message: 'Mật khẩu phải từ 8 đến 100 ký tự' })
  password: string;

  @ApiProperty({ description: 'Họ và tên', example: 'Nguyễn Văn A' })
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @IsString()
  @Length(1, 100, { message: 'Họ và tên phải từ 1 đến 100 ký tự' })
  fullName: string;

  @ApiPropertyOptional({ description: 'Số điện thoại', example: '0901234567' })
  @IsOptional()
  @IsString()
  @Length(1, 15, { message: 'Số điện thoại phải từ 1 đến 15 ký tự' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ',
    example: '12 Nguyễn Trãi, Thanh Xuân, Hà Nội',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255, { message: 'Địa chỉ không được dài quá 255 ký tự' })
  address?: string;

  @ApiProperty({
    description: 'Số căn cước công dân (12 chữ số)',
    example: '001204012345',
  })
  @IsNotEmpty({ message: 'Căn cước công dân không được để trống' })
  @Matches(/^\d{12}$/, { message: 'Căn cước công dân phải gồm đúng 12 chữ số' })
  citizenId: string;

  @ApiPropertyOptional({
    description: 'Vai trò',
    enum: UserRole,
    default: UserRole.STAFF,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Vai trò không hợp lệ' })
  role?: UserRole;
}
