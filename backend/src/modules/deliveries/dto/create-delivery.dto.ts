import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDeliveryDto {
  @ApiProperty({ example: '2026-10-20' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày giao hàng không hợp lệ' })
  shipDate: string;

  @ApiProperty({ example: '11:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Giờ giao hàng không hợp lệ' })
  shipTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 100, { message: 'Tên người gửi không được dài quá 100 ký tự' })
  senderName?: string;

  @ApiProperty()
  @Transform(trim)
  @IsNotEmpty({ message: 'Số điện thoại người gửi không được để trống' })
  @Length(1, 30, { message: 'Số điện thoại không được dài quá 30 ký tự' })
  senderPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 255, { message: 'Địa chỉ người gửi không được dài quá 255 ký tự' })
  senderAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 100, { message: 'Tên người nhận không được dài quá 100 ký tự' })
  receiverName?: string;

  @ApiProperty()
  @Transform(trim)
  @IsNotEmpty({ message: 'Số điện thoại người nhận không được để trống' })
  @Length(1, 30, { message: 'Số điện thoại không được dài quá 30 ký tự' })
  receiverPhone: string;

  @ApiProperty()
  @Transform(trim)
  @IsNotEmpty({ message: 'Địa chỉ người nhận không được để trống' })
  @Length(1, 255, { message: 'Địa chỉ người nhận không được dài quá 255 ký tự' })
  receiverAddress: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng ít nhất là 1' })
  @Max(10000)
  quantity?: number;

  @ApiPropertyOptional({ example: 'Mỹ phẩm' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 255, { message: 'Loại hàng hóa không được dài quá 255 ký tự' })
  goodsType?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Cân nặng tối đa 2 chữ số thập phân' })
  @Min(0, { message: 'Cân nặng không được âm' })
  @Max(100000)
  weightKg?: number;

  @ApiPropertyOptional({ enum: ['SENDER', 'RECEIVER'] })
  @IsOptional()
  @IsIn(['SENDER', 'RECEIVER'], { message: 'Người trả cước không hợp lệ' })
  payer?: 'SENDER' | 'RECEIVER';

  @ApiPropertyOptional({ example: 210000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Cước phí phải là số nguyên' })
  @Min(0, { message: 'Cước phí không được âm' })
  @Max(1000000000)
  fee?: number;

  @ApiPropertyOptional({ example: 20000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Hoa hồng phải là số nguyên' })
  @Min(0, { message: 'Hoa hồng không được âm' })
  @Max(1000000000)
  commission?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 100, { message: 'Tên đối tác không được dài quá 100 ký tự' })
  partner?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 1000, { message: 'Ghi chú không được dài quá 1000 ký tự' })
  note?: string;
}
