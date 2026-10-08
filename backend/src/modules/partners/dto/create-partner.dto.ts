import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

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
}
