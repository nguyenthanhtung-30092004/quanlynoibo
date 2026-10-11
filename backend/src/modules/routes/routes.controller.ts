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
import { CreateRouteDto } from './dto/create-route.dto.js';
import { QueryRoutesDto } from './dto/query-routes.dto.js';
import { UpdateRouteDto } from './dto/update-route.dto.js';
import { RoutesService } from './routes.service.js';

/** Mọi người dùng đăng nhập được xem và thêm; nhân viên chỉ sửa/xóa bản ghi do mình tạo trong ngày, Admin không giới hạn */
@ApiTags('Routes')
@ApiBearerAuth()
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRouteDto, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Thêm tuyến đường thành công',
      data: this.routesService.withPermission(await this.routesService.create(dto, user), user),
    };
  }

  @Get()
  async findAll(@Query() query: QueryRoutesDto, @CurrentUser() user: JwtPayload) {
    const result = await this.routesService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy danh sách tuyến đường thành công',
      data: result.items.map((item) => this.routesService.withPermission(item, user)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy chi tiết tuyến đường thành công',
      data: this.routesService.withPermission(await this.routesService.findOne(id), user),
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRouteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật tuyến đường thành công',
      data: this.routesService.withPermission(await this.routesService.update(id, dto, user), user),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    await this.routesService.remove(id, user);
    return { statusCode: HttpStatus.OK, message: 'Xóa tuyến đường thành công' };
  }
}
