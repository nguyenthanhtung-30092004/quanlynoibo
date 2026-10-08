import { PartialType } from '@nestjs/swagger';
import { CreateRouteDto } from './create-route.dto.js';

export class UpdateRouteDto extends PartialType(CreateRouteDto) {}
