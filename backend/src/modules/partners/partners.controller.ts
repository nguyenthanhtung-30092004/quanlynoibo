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
import { CreatePartnerDto } from './dto/create-partner.dto.js';
import { QueryPartnersDto } from './dto/query-partners.dto.js';
import { UpdatePartnerDto } from './dto/update-partner.dto.js';
import { PartnersService } from './partners.service.js';

/** Mọi người dùng đăng nhập được xem; chỉ Admin được thêm, sửa, xóa */
@ApiTags('Partners')
@ApiBearerAuth()
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePartnerDto) {
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Thêm đối tác thành công',
      data: await this.partnersService.create(dto),
    };
  }

  @Get()
  async findAll(@Query() query: QueryPartnersDto) {
    const result = await this.partnersService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy danh sách đối tác thành công',
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
      message: 'Lấy chi tiết đối tác thành công',
      data: await this.partnersService.findOne(id),
    };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePartnerDto,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật đối tác thành công',
      data: await this.partnersService.update(id, dto),
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.partnersService.remove(id);
    return { statusCode: HttpStatus.OK, message: 'Xóa đối tác thành công' };
  }
}
