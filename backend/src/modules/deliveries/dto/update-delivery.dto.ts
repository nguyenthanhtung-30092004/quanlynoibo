import { PartialType } from '@nestjs/swagger';
import { CreateDeliveryDto } from './create-delivery.dto.js';

export class UpdateDeliveryDto extends PartialType(CreateDeliveryDto) {}
