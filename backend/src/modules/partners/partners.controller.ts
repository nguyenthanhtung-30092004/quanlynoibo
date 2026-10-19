import {
  Body,
  Controller,
  DefaultValuePipe,
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
import { CreatePartnerDto } from './dto/create-partner.dto.js';
import { QueryPartnersDto } from './dto/query-partners.dto.js';
import { UpdatePartnerDto } from './dto/update-partner.dto.js';
import { PartnersService } from './partners.service.js';

/** Mọi người dùng đăng nhập được xem và thêm; nhân viên chỉ sửa/xóa bản ghi do mình tạo trong ngày, Admin không giới hạn */
@ApiTags('Partners')
@ApiBearerAuth()
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreatePartnerDto, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Thêm đối tác thành công',
      data: this.partnersService.withPermission(await this.partnersService.create(dto, user), user),
    };
  }

  @Get()
  async findAll(@Query() query: QueryPartnersDto, @CurrentUser() user: JwtPayload) {
    const result = await this.partnersService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy danh sách đối tác thành công',
      data: result.items.map((item) => this.partnersService.withPermission(item, user)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /** Hoa hồng gợi ý cho form nhập vé (mọi người dùng; không trả mức hoa hồng mỗi vé) */
  @Get('commission-quote')
  async commissionQuote(
    @Query('name') name = '',
    @Query('seats', new DefaultValuePipe(0), ParseIntPipe) seats: number,
    @Query('fare', new DefaultValuePipe(0), ParseIntPipe) fare: number,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Tính hoa hồng thành công',
      data: await this.partnersService.commissionQuote(name, seats, Math.max(0, fare)),
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy chi tiết đối tác thành công',
      data: this.partnersService.withPermission(await this.partnersService.findOne(id), user),
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePartnerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật đối tác thành công',
      data: this.partnersService.withPermission(await this.partnersService.update(id, dto, user), user),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    await this.partnersService.remove(id, user);
    return { statusCode: HttpStatus.OK, message: 'Xóa đối tác thành công' };
  }
}
