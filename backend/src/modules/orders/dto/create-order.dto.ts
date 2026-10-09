import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { SeatZone } from '../entities/order.entity.js';

const stripSpaces = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, '') : value;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const MONEY_MAX = 2_000_000_000;

/**
 * Ngày vào sổ và nhân viên (NV) KHÔNG nằm ở đây: server tự điền
 * theo thời điểm tạo và người đang đăng nhập.
 */
export class CreateOrderDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn Hải' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 100, { message: 'Tên khách hàng không được dài quá 100 ký tự' })
  customerName?: string;

  @ApiProperty({ example: '0912345678' })
  @Transform(stripSpaces)
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @Matches(/^(0|\+84)\d{9,10}$/, { message: 'Số điện thoại không hợp lệ' })
  phone: string;

  @ApiProperty({ description: 'Id tuyến đường (chọn từ /routes)', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Tuyến đi không hợp lệ' })
  @Min(1, { message: 'Tuyến đi không hợp lệ' })
  routeId: number;

  @ApiProperty({ description: 'Giờ đi HH:mm', example: '13:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Giờ đi phải có dạng HH:mm',
  })
  departureTime: string;

  @ApiProperty({ description: 'Ngày khởi hành YYYY-MM-DD', example: '2026-10-08' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày khởi hành phải có dạng YYYY-MM-DD',
  })
  departureDate: string;

  @ApiPropertyOptional({ description: 'Loại hình', example: 'Xe limousine 9 chỗ' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 100, { message: 'Loại hình không được dài quá 100 ký tự' })
  vehicleType?: string;

  @ApiPropertyOptional({ enum: SeatZone, description: 'Đầu / Giữa / Cuối' })
  @IsOptional()
  @IsEnum(SeatZone, { message: 'Vị trí ghế phải là FRONT, MIDDLE hoặc BACK' })
  seatZone?: SeatZone;

  @ApiPropertyOptional({ description: 'Số ghế đầu', example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số ghế đầu phải là số nguyên' })
  @Min(0, { message: 'Số ghế đầu không được âm' })
  @Max(60, { message: 'Số ghế đầu quá lớn' })
  seatFront?: number;

  @ApiPropertyOptional({ description: 'Số ghế giữa', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số ghế giữa phải là số nguyên' })
  @Min(0, { message: 'Số ghế giữa không được âm' })
  @Max(60, { message: 'Số ghế giữa quá lớn' })
  seatMiddle?: number;

  @ApiPropertyOptional({ description: 'Số ghế cuối', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số ghế cuối phải là số nguyên' })
  @Min(0, { message: 'Số ghế cuối không được âm' })
  @Max(60, { message: 'Số ghế cuối quá lớn' })
  seatBack?: number;

  @ApiPropertyOptional({ description: 'Số ghế (độc lập với đầu/giữa/cuối; có thể để 0 nếu nhà xe chỉ tính theo vị trí)', default: 1, example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số ghế phải là số nguyên' })
  @Min(0, { message: 'Số ghế không được âm' })
  @Max(60, { message: 'Số ghế quá lớn' })
  seatCount?: number;

  @ApiPropertyOptional({ description: 'Giá nhập (VNĐ)', example: 250000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Giá nhập phải là số nguyên' })
  @Min(0, { message: 'Giá nhập không được âm' })
  @Max(MONEY_MAX, { message: 'Giá nhập quá lớn' })
  costPrice?: number;

  @ApiPropertyOptional({ description: 'Giá bán (VNĐ)', example: 300000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Giá bán phải là số nguyên' })
  @Min(0, { message: 'Giá bán không được âm' })
  @Max(MONEY_MAX, { message: 'Giá bán quá lớn' })
  sellPrice?: number;

  @ApiPropertyOptional({ description: 'Đã cọc (VNĐ)', example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Tiền cọc phải là số nguyên' })
  @Min(0, { message: 'Tiền cọc không được âm' })
  @Max(MONEY_MAX, { message: 'Tiền cọc quá lớn' })
  deposit?: number;

  @ApiPropertyOptional({ description: 'Nhờ thu (VNĐ)', example: 200000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Tiền nhờ thu phải là số nguyên' })
  @Min(0, { message: 'Tiền nhờ thu không được âm' })
  @Max(MONEY_MAX, { message: 'Tiền nhờ thu quá lớn' })
  collectOnDelivery?: number;

  @ApiPropertyOptional({ description: 'Hoa hồng (VNĐ)', example: 20000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Hoa hồng phải là số nguyên' })
  @Min(0, { message: 'Hoa hồng không được âm' })
  @Max(MONEY_MAX, { message: 'Hoa hồng quá lớn' })
  commission?: number;

  @ApiPropertyOptional({ description: 'Đối tác', example: 'Hải Phòng - Tuyên Quang' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 100, { message: 'Đối tác không được dài quá 100 ký tự' })
  partner?: string;

  @ApiPropertyOptional({ description: 'Điểm đón', example: 'Ngõ 280 Cổ Nhuế, Bắc Từ Liêm' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 255, { message: 'Điểm đón không được dài quá 255 ký tự' })
  pickupPoint?: string;

  @ApiPropertyOptional({ description: 'Điểm trả', example: 'Bến xe Cẩm Phả' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 255, { message: 'Điểm trả không được dài quá 255 ký tự' })
  dropoffPoint?: string;

  @ApiPropertyOptional({ description: 'Ghi chú', example: 'Khách có 2 vali lớn' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 1000, { message: 'Ghi chú không được dài quá 1000 ký tự' })
  note?: string;

  @ApiPropertyOptional({
    description: 'Nhân viên phụ trách (chỉ Admin được chỉ định; Staff luôn là chính mình)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  staffId?: number;
}
