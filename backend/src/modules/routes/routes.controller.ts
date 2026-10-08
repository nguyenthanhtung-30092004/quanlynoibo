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
import { CreateRouteDto } from './dto/create-route.dto.js';
import { QueryRoutesDto } from './dto/query-routes.dto.js';
import { UpdateRouteDto } from './dto/update-route.dto.js';
import { RoutesService } from './routes.service.js';

/** Mọi người dùng đăng nhập được xem; chỉ Admin được thêm, sửa, xóa */
@ApiTags('Routes')
@ApiBearerAuth()
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRouteDto) {
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Thêm tuyến đường thành công',
      data: await this.routesService.create(dto),
    };
  }

  @Get()
  async findAll(@Query() query: QueryRoutesDto) {
    const result = await this.routesService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy danh sách tuyến đường thành công',
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
      message: 'Lấy chi tiết tuyến đường thành công',
      data: await this.routesService.findOne(id),
    };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRouteDto,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật tuyến đường thành công',
      data: await this.routesService.update(id, dto),
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.routesService.remove(id);
    return { statusCode: HttpStatus.OK, message: 'Xóa tuyến đường thành công' };
  }
}
