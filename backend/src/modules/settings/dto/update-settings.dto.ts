import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'CÔNG TY TNHH TM & DV XVIP' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  companyName?: string;

  @ApiPropertyOptional({ example: '1900 6868' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  hotline?: string;

  @ApiPropertyOptional({ example: 'dieuhanh@xvip.vn' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ example: 'Số 12 Bến xe Mỹ Đình, Từ Liêm, Hà Nội' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ description: 'Mẫu tin nhắn SMS / Zalo' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  smsTemplate?: string;

  @ApiPropertyOptional({ description: 'Tài khoản nhận tiền trang Tạo QR (JSON)' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  qrAccounts?: string;
}
