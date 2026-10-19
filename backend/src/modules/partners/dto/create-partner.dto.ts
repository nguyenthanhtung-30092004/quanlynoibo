import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePartnerDto {
  @ApiProperty({ example: 'Phúc Xuyên' })
  @Transform(trim)
  @IsNotEmpty({ message: 'Tên đối tác không được để trống' })
  @IsString()
  @Length(1, 100, { message: 'Tên đối tác phải từ 1 đến 100 ký tự' })
  name: string;

  @ApiPropertyOptional({ example: 'Chạy tuyến Hà Nội - Cẩm Phả' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 1000, { message: 'Ghi chú không được dài quá 1000 ký tự' })
  note?: string;

  @ApiPropertyOptional({ example: 20000, description: 'Hoa hồng mỗi vé (VNĐ); chỉ Admin được đặt' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Hoa hồng mỗi vé phải là số nguyên' })
  @Min(0, { message: 'Hoa hồng mỗi vé không được âm' })
  @Max(100000000)
  commissionPerSeat?: number;

  @ApiPropertyOptional({ example: 10, description: 'Hoa hồng theo % giá vé (0-100); chỉ Admin được đặt' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '% hoa hồng tối đa 2 chữ số thập phân' })
  @Min(0, { message: '% hoa hồng không được âm' })
  @Max(100, { message: '% hoa hồng tối đa 100' })
  commissionPercent?: number;
}
