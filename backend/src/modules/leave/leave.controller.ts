import { Body, Controller, Delete, Get, HttpStatus, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import {
  AdminRegisterLeaveDto,
  LeaveDayQueryDto,
  LeaveMonthQueryDto,
  RegisterLeaveDto,
  SaveLeaveConfigDto,
  SetDayLimitDto,
} from './dto/leave.dto.js';
import { LeaveService } from './leave.service.js';

@ApiTags('Leave')
@ApiBearerAuth()
@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  /** Lịch nghỉ cả tháng: mọi người dùng xem được số lượng; chỉ Admin thấy tên người nghỉ */
  @Get()
  async month(@Query() query: LeaveMonthQueryDto, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy lịch đăng ký nghỉ thành công',
      data: await this.leaveService.month(query.month, user),
    };
  }

  /** Nhân viên đăng ký nghỉ một ngày (có hiệu lực ngay nếu còn chỗ) */
  @Post()
  async register(@Body() dto: RegisterLeaveDto, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Đã đăng ký nghỉ',
      data: await this.leaveService.register(user, dto.day),
    };
  }

  /** Admin đăng ký nghỉ hộ nhân viên; ngày hôm nay được đánh dấu nghỉ đột xuất */
  @Post('admin')
  @Roles(UserRole.ADMIN)
  async registerForStaff(@Body() dto: AdminRegisterLeaveDto, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Đã đăng ký nghỉ cho nhân viên',
      data: await this.leaveService.registerForStaff(user, dto.userId, dto.day),
    };
  }

  @Put('config')
  @Roles(UserRole.ADMIN)
  async saveConfig(@Body() dto: SaveLeaveConfigDto) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Đã lưu giới hạn số người nghỉ',
      data: await this.leaveService.saveConfig(dto),
    };
  }

  @Put('day-limit')
  @Roles(UserRole.ADMIN)
  async setDayLimit(@Body() dto: SetDayLimitDto) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Đã chỉnh giới hạn cho ngày này',
      data: await this.leaveService.setDayLimit(dto.day, dto.max),
    };
  }

  /** Lịch sử đăng ký / hủy nghỉ của một ngày: mọi người dùng đều xem được */
  @Get('history')
  async history(@Query() query: LeaveDayQueryDto) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy lịch sử đăng ký nghỉ thành công',
      data: await this.leaveService.historyOfDay(query.day),
    };
  }

  /** Admin hủy mọi lượt; nhân viên chỉ hủy lượt của mình khi ngày nghỉ chưa tới */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Đã hủy lượt đăng ký nghỉ',
      data: await this.leaveService.remove(id, user),
    };
  }
}
