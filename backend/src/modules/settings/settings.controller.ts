import { Body, Controller, Get, HttpStatus, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

/** Mọi người dùng đăng nhập được xem (tên công ty hiện ở đầu trang); chỉ Admin được sửa */
@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async get() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy cài đặt thành công',
      data: await this.settingsService.getAll(),
    };
  }

  @Put()
  @Roles(UserRole.ADMIN)
  async update(@Body() dto: UpdateSettingsDto) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lưu cài đặt thành công',
      data: await this.settingsService.update(dto),
    };
  }
}
