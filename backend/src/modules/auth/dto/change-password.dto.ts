import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mật khẩu hiện tại', example: 'MatKhauCu123' })
  @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống' })
  @IsString()
  oldPassword: string;

  @ApiProperty({ description: 'Mật khẩu mới', example: 'MatKhauMoi456' })
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới phải có ít nhất 6 ký tự' })
  newPassword: string;

  @ApiProperty({
    description: 'Xác nhận mật khẩu mới',
    example: 'MatKhauMoi456',
  })
  @IsNotEmpty({ message: 'Xác nhận mật khẩu mới không được để trống' })
  @IsString()
  confirmPassword: string;
}
