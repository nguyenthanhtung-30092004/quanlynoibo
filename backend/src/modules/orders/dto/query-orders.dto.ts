import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Dấu tách danh sách giá trị văn bản (ghi chú, địa chỉ có thể chứa dấu phẩy) */
export const LIST_SEP = '\u001f';

const splitText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(LIST_SEP).filter((v) => v !== '') : value;

const splitNumbers = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value.split(',').map((v) => v.trim()).filter((v) => v !== '').map(Number)
    : value;

/** Các cột lọc kiểu danh sách giá trị thêm sau (ngày, văn bản, số) */
export const EXTRA_COLUMNS = [
  'entryDate',
  'departureDate',
  'vehicleType',
  'seatFront',
  'seatMiddle',
  'seatBack',
  'seatCount',
  'costPrice',
  'collectOnDelivery',
  'note',
  'pickupPoint',
  'dropoffPoint',
  'cancelReason',
] as const;

export type ColumnValuesKey =
  | 'customer'
  | 'phone'
  | 'staff'
  | 'route'
  | 'partner'
  | 'departureTime'
  | 'deposit'
  | 'sellPrice'
  | 'commission'
  | 'message'
  | (typeof EXTRA_COLUMNS)[number];

/** Bộ lọc dùng chung cho danh sách và xuất Excel */
export class OrderFilterDto {
  @ApiPropertyOptional({
    description: 'Tìm theo tên khách, SĐT, tuyến, loại hình, đối tác, ghi chú',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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

  @ApiPropertyOptional({
    description: 'Lọc nhiều trạng thái tin nhắn (sms, zalo, unsent), cách nhau bằng dấu phẩy',
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((v) => v.trim()).filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(['sms', 'zalo', 'unsent'], {
    each: true,
    message: 'messageStates phải gồm các giá trị sms, zalo hoặc unsent',
  })
  messageStates?: Array<'sms' | 'zalo' | 'unsent'>;

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

  @ApiPropertyOptional({ description: 'Lọc nhiều mức tiền cọc, cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((v) => v.trim()).filter((v) => v !== '').map(Number)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(0, { each: true })
  deposits?: number[];

  @ApiPropertyOptional({ description: 'Lọc nhiều mức giá bán, cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((v) => v.trim()).filter((v) => v !== '').map(Number)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(0, { each: true })
  sellPrices?: number[];

  @ApiPropertyOptional({ description: 'Lọc nhiều mức hoa hồng, cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((v) => v.trim()).filter((v) => v !== '').map(Number)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(0, { each: true })
  commissions?: number[];

  @ApiPropertyOptional({ description: 'Mã đơn (XV116 hoặc 116)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  orderCode?: string;

  @ApiPropertyOptional({ description: 'Lọc nhiều ngày vào sổ (YYYY-MM-DD), cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @Matches(DATE_RE, { each: true, message: 'entryDates phải có dạng YYYY-MM-DD' })
  entryDates?: string[];

  @ApiPropertyOptional({ description: 'Lọc nhiều ngày khởi hành (YYYY-MM-DD), cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @Matches(DATE_RE, { each: true, message: 'departureDates phải có dạng YYYY-MM-DD' })
  departureDates?: string[];

  @ApiPropertyOptional({ description: 'Lọc nhiều loại hình (ký tự \\u001f tách giá trị; "—" = để trống)' })
  @IsOptional()
  @Transform(splitText)
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  vehicleTypes?: string[];

  @ApiPropertyOptional({ description: 'Lọc nhiều ghi chú (ký tự \\u001f tách giá trị; "—" = để trống)' })
  @IsOptional()
  @Transform(splitText)
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  notes?: string[];

  @ApiPropertyOptional({ description: 'Lọc nhiều điểm đón (ký tự \\u001f tách giá trị; "—" = để trống)' })
  @IsOptional()
  @Transform(splitText)
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  pickupPoints?: string[];

  @ApiPropertyOptional({ description: 'Lọc nhiều điểm trả (ký tự \\u001f tách giá trị; "—" = để trống)' })
  @IsOptional()
  @Transform(splitText)
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  dropoffPoints?: string[];

  @ApiPropertyOptional({ description: 'Lọc nhiều lý do hủy (ký tự \\u001f tách giá trị; "—" = để trống)' })
  @IsOptional()
  @Transform(splitText)
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  cancelReasons?: string[];

  @ApiPropertyOptional({ description: 'Lọc nhiều số ghế đầu, cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(splitNumbers)
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(0, { each: true })
  seatFronts?: number[];

  @ApiPropertyOptional({ description: 'Lọc nhiều số ghế giữa, cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(splitNumbers)
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(0, { each: true })
  seatMiddles?: number[];

  @ApiPropertyOptional({ description: 'Lọc nhiều số ghế cuối, cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(splitNumbers)
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(0, { each: true })
  seatBacks?: number[];

  @ApiPropertyOptional({ description: 'Lọc nhiều số ghế, cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(splitNumbers)
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(0, { each: true })
  seatCounts?: number[];

  @ApiPropertyOptional({ description: 'Lọc nhiều mức giá nhập, cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(splitNumbers)
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(0, { each: true })
  costPrices?: number[];

  @ApiPropertyOptional({ description: 'Lọc nhiều mức nhờ thu, cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(splitNumbers)
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(0, { each: true })
  collectOnDeliveries?: number[];
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

  @ApiPropertyOptional({ description: 'Lọc nhiều nhân viên (chỉ có tác dụng với Admin), cách nhau bằng dấu phẩy' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean).map(Number) : value,
  )
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  staffIds?: number[];

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
    enum: [
      'customer',
      'phone',
      'staff',
      'route',
      'partner',
      'departureTime',
      'deposit',
      'sellPrice',
      'commission',
      'message',
      ...EXTRA_COLUMNS,
    ],
    description: 'Cột cần lấy danh sách giá trị',
  })
  @Matches(
    new RegExp(
      `^(customer|phone|staff|route|partner|departureTime|deposit|sellPrice|commission|message|${EXTRA_COLUMNS.join('|')})$`,
    ),
    { message: 'column không hợp lệ' },
  )
  column: ColumnValuesKey;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm trong giá trị' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
