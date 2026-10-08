import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const stripSpaces = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, '') : value;

export class CreateCarrierDto {
  @ApiProperty({ example: 'Sao Việt' })
  @Transform(trim)
  @IsNotEmpty({ message: 'Tên nhà xe không được để trống' })
  @IsString()
  @Length(1, 100, { message: 'Tên nhà xe phải từ 1 đến 100 ký tự' })
  name: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @Transform(stripSpaces)
  // Chuỗi rỗng nghĩa là "xóa số điện thoại", chỉ kiểm tra định dạng khi có giá trị
  @ValidateIf((o: CreateCarrierDto) => o.phone !== '')
  @Matches(/^(0|\+84)\d{9,10}$/, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Số 1 Lê Duẩn, Hà Nội' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 255, { message: 'Địa chỉ không được dài quá 255 ký tự' })
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 1000, { message: 'Ghi chú không được dài quá 1000 ký tự' })
  note?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
