import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @ApiProperty({ example: 'Khách không đi nữa', description: 'Lý do hủy vé' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Vui lòng nhập lý do hủy vé' })
  @IsString()
  @MaxLength(500, { message: 'Lý do hủy không được dài quá 500 ký tự' })
  reason: string;
}
