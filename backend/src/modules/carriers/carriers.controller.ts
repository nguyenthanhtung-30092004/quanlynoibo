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
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { CarriersService } from './carriers.service.js';
import { CreateCarrierDto } from './dto/create-carrier.dto.js';
import { QueryCarriersDto } from './dto/query-carriers.dto.js';
import { UpdateCarrierDto } from './dto/update-carrier.dto.js';

/** Mọi người dùng đăng nhập được xem; chỉ Admin được thêm, sửa, xóa */
@ApiTags('Carriers')
@ApiBearerAuth()
@Controller('carriers')
export class CarriersController {
  constructor(private readonly carriersService: CarriersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCarrierDto) {
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Thêm nhà xe thành công',
      data: await this.carriersService.create(dto),
    };
  }

  @Get()
  async findAll(@Query() query: QueryCarriersDto) {
    const result = await this.carriersService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy danh sách nhà xe thành công',
      data: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy chi tiết nhà xe thành công',
      data: await this.carriersService.findOne(id),
    };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCarrierDto,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật nhà xe thành công',
      data: await this.carriersService.update(id, dto),
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.carriersService.remove(id);
    return { statusCode: HttpStatus.OK, message: 'Xóa nhà xe thành công' };
  }
}
