import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRouteDto {
  @ApiProperty({ example: 'Hà Nội - Cẩm Phả' })
  @Transform(trim)
  @IsNotEmpty({ message: 'Tên tuyến không được để trống' })
  @IsString()
  @Length(1, 255, { message: 'Tên tuyến phải từ 1 đến 255 ký tự' })
  name: string;

  @ApiProperty({ example: 'Hà Nội' })
  @Transform(trim)
  @IsNotEmpty({ message: 'Điểm đi không được để trống' })
  @IsString()
  @Length(1, 100, { message: 'Điểm đi phải từ 1 đến 100 ký tự' })
  origin: string;

  @ApiProperty({ example: 'Cẩm Phả' })
  @Transform(trim)
  @IsNotEmpty({ message: 'Điểm đến không được để trống' })
  @IsString()
  @Length(1, 100, { message: 'Điểm đến phải từ 1 đến 100 ký tự' })
  destination: string;

  @ApiPropertyOptional({ description: 'Giá vé mặc định (VNĐ)', example: 300000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Giá vé phải là số nguyên' })
  @Min(0, { message: 'Giá vé không được âm' })
  @Max(2_000_000_000, { message: 'Giá vé quá lớn' })
  defaultPrice?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
