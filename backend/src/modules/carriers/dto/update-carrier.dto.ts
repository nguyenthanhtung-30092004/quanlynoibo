import { PartialType } from '@nestjs/swagger';
import { CreateCarrierDto } from './create-carrier.dto.js';

export class UpdateCarrierDto extends PartialType(CreateCarrierDto) {}
