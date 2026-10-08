import { PartialType } from '@nestjs/swagger';
import { CreatePartnerDto } from './create-partner.dto.js';

export class UpdatePartnerDto extends PartialType(CreatePartnerDto) {}
