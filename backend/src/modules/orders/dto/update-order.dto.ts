import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto.js';

/** Sửa đơn: mọi trường tùy chọn; không đổi được nhân viên phụ trách */
export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ['staffId'] as const),
) {}
