import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { DeliveriesService } from './deliveries.service.js';
import { CreateDeliveryDto } from './dto/create-delivery.dto.js';
import { QueryDeliveriesDto } from './dto/query-deliveries.dto.js';
import { UpdateDeliveryDto } from './dto/update-delivery.dto.js';

/** Mọi người dùng đăng nhập được xem và thêm; nhân viên chỉ sửa/xóa đơn do mình tạo trong ngày, Admin không giới hạn */
@ApiTags('Deliveries')
@ApiBearerAuth()
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly service: DeliveriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateDeliveryDto, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Thêm đơn giao hàng thành công',
      data: this.service.withPermission(await this.service.create(dto, user), user),
    };
  }

  @Get()
  async findAll(@Query() query: QueryDeliveriesDto, @CurrentUser() user: JwtPayload) {
    const result = await this.service.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy danh sách đơn giao hàng thành công',
      data: result.items.map((item) => this.service.withPermission(item, user)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeliveryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật đơn giao hàng thành công',
      data: this.service.withPermission(await this.service.update(id, dto, user), user),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    await this.service.remove(id, user);
    return { statusCode: HttpStatus.OK, message: 'Xóa đơn giao hàng thành công' };
  }
}
