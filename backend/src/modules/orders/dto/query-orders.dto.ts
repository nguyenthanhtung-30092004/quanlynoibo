import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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

  @ApiPropertyOptional({ description: 'Lọc nhiều tuyến cùng lúc, danh sách id cách nhau bằng dấu phẩy (VD: 1,4,7)' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean).map(Number) : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  routeIds?: number[];

  @ApiPropertyOptional({ description: 'Lọc theo đối tác (tên, không phân biệt hoa thường)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  partner?: string;

  @ApiPropertyOptional({ description: 'Lọc nhiều đối tác cùng lúc, tên cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  partners?: string[];

  @ApiPropertyOptional({ description: 'true = bỏ vé đã hủy (khớp cách các báo cáo KPI đếm)' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value))
  @IsBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({ description: 'true = chỉ lấy đơn khách đã cọc (deposit > 0)' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value))
  @IsBoolean()
  depositOnly?: boolean;

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

  @ApiPropertyOptional({ description: 'Lọc nhiều tên khách hàng, cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  customerNames?: string[];

  @ApiPropertyOptional({ description: 'Lọc nhiều số điện thoại, cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  phones?: string[];

  @ApiPropertyOptional({ description: 'Lọc nhiều nhân viên (chỉ có tác dụng với Admin), cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean).map(Number) : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  staffIds?: number[];

  @ApiPropertyOptional({ description: 'Lọc nhiều giờ khởi hành HH:mm, cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { each: true, message: 'departureTimes phải có định dạng HH:mm' })
  departureTimes?: string[];

  @ApiPropertyOptional({ enum: ['sent', 'unsent'], description: 'Trạng thái tin nhắn đã gửi hoặc chưa gửi' })
  @IsOptional()
  @Matches(/^(sent|unsent)$/, { message: 'smsStatus phải là "sent" hoặc "unsent"' })
  smsStatus?: 'sent' | 'unsent';

  @ApiPropertyOptional({ description: 'Giá bán tối thiểu (số nguyên không âm)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sellPriceMin?: number;

  @ApiPropertyOptional({ description: 'Giá bán tối đa (số nguyên không âm)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sellPriceMax?: number;

  @ApiPropertyOptional({ description: 'Hoa hồng tối thiểu (số nguyên không âm)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  commissionMin?: number;

  @ApiPropertyOptional({ description: 'Hoa hồng tối đa (số nguyên không âm)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  commissionMax?: number;

  @ApiPropertyOptional({ description: 'Mã đơn (XV116 hoặc 116)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  orderCode?: string;
}

export class QueryOrdersDto extends OrderFilterDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
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

  @ApiPropertyOptional({ description: 'Lọc nhiều tuyến cùng lúc, danh sách id cách nhau bằng dấu phẩy (VD: 1,4,7)' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean).map(Number) : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  routeIds?: number[];

  @ApiPropertyOptional({ description: 'Lọc nhiều đối tác cùng lúc, tên cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  partners?: string[];

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

export class ColumnValuesQueryDto extends OrderFilterDto {
  @ApiPropertyOptional({
    enum: ['customer', 'phone', 'staff', 'route', 'partner', 'departureTime'],
    description: 'Cột cần lấy danh sách giá trị',
  })
  @Matches(/^(customer|phone|staff|route|partner|departureTime)$/, {
    message: 'column phải là customer, phone, staff, route, partner hoặc departureTime',
  })
  column: 'customer' | 'phone' | 'staff' | 'route' | 'partner' | 'departureTime';

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm trong giá trị' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
