import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Bộ lọc dùng chung cho danh sách và xuất Excel */
export class OrderFilterDto {
  @ApiPropertyOptional({
    description: 'Tìm theo tên khách, SĐT, tuyến, loại hình, đối tác, ghi chú',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo nhân viên (chỉ có tác dụng với Admin)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  staffId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo tuyến đi' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo đối tác (tên, không phân biệt hoa thường)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  partner?: string;

  @ApiPropertyOptional({ description: 'Từ ngày vào sổ (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'dateFrom phải có dạng YYYY-MM-DD' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Đến hết ngày vào sổ (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'dateTo phải có dạng YYYY-MM-DD' })
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Từ ngày khởi hành (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'departureFrom phải có dạng YYYY-MM-DD' })
  departureFrom?: string;

  @ApiPropertyOptional({ description: 'Đến hết ngày khởi hành (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'departureTo phải có dạng YYYY-MM-DD' })
  departureTo?: string;
}

export class QueryOrdersDto extends OrderFilterDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class KpiQueryDto {
  @ApiPropertyOptional({ description: 'Ngày xem KPI (YYYY-MM-DD, mặc định hôm nay)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'date phải có dạng YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ description: 'Lọc theo nhân viên (chỉ có tác dụng với Admin)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  staffId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo tuyến đi' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo đối tác (tên, không phân biệt hoa thường)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  partner?: string;

  @ApiPropertyOptional({ description: 'Từ ngày vào sổ (YYYY-MM-DD); nếu có thì thay cho `date`' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'dateFrom phải có dạng YYYY-MM-DD' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Đến hết ngày vào sổ (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'dateTo phải có dạng YYYY-MM-DD' })
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Từ ngày khởi hành (YYYY-MM-DD); nếu có thì thay cho `date`' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'departureFrom phải có dạng YYYY-MM-DD' })
  departureFrom?: string;

  @ApiPropertyOptional({ description: 'Đến hết ngày khởi hành (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'departureTo phải có dạng YYYY-MM-DD' })
  departureTo?: string;
}
