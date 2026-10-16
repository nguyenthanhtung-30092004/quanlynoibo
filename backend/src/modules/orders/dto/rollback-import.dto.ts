import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsInt, Min } from 'class-validator';

export class RollbackImportDto {
  @ApiProperty({ example: [101, 102], description: 'Mã các đơn vừa nhập từ Excel cần hoàn tác' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Không có đơn nào để hoàn tác' })
  @ArrayMaxSize(50000, { message: 'Mỗi lần hoàn tác tối đa 50000 đơn' })
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids: number[];
}
