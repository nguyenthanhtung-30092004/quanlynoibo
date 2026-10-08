import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';
import { UserRole } from './entities/user.entity.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

/** Quản lý tài khoản nhân viên: chỉ Admin được phép */
@ApiTags('Users')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Tạo tài khoản thành công',
      data: user,
    };
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    const result = await this.usersService.findAll({ page, limit, search });
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy danh sách tài khoản thành công',
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
      message: 'Lấy chi tiết tài khoản thành công',
      data: await this.usersService.findOne(id),
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    // Tránh Admin tự khóa / tự hạ quyền chính mình
    if (
      req.user.sub === id &&
      (dto.isActive === false ||
        (dto.role !== undefined && dto.role !== UserRole.ADMIN))
    ) {
      throw new ForbiddenException(
        'Bạn không thể tự khóa hoặc tự hạ quyền tài khoản của chính mình.',
      );
    }
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật tài khoản thành công',
      data: await this.usersService.update(id, dto),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    if (req.user.sub === id) {
      throw new ForbiddenException('Bạn không thể tự xóa tài khoản của mình.');
    }
    await this.usersService.remove(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Xóa tài khoản thành công',
    };
  }
}
