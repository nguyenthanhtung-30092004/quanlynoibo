import { Body, Controller, Get, HttpStatus, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { AttendanceService } from './attendance.service.js';
import {
  AttendanceMonthQueryDto,
  AttendanceOverrideDto,
  HeartbeatDto,
  SaveAttendanceConfigDto,
} from './dto/attendance.dto.js';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /** Nhân viên báo "đang online / thao tác"; mọi người dùng đăng nhập gọi được, server tự quyết có tính công không */
  @Post('heartbeat')
  async heartbeat(
    @Body() dto: HeartbeatDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Đã ghi nhận',
      data: await this.attendanceService.heartbeat(user, dto),
    };
  }

  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy chấm công hôm nay thành công',
      data: await this.attendanceService.today(user),
    };
  }

  @Get()
  @Roles(UserRole.ADMIN)
  async month(@Query() query: AttendanceMonthQueryDto) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy bảng chấm công thành công',
      data: await this.attendanceService.month(query.month),
    };
  }

  @Put('config')
  @Roles(UserRole.ADMIN)
  async saveConfig(@Body() dto: SaveAttendanceConfigDto) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lưu cấu hình chấm công thành công',
      data: await this.attendanceService.saveConfig(dto.config),
    };
  }

  @Put('override')
  @Roles(UserRole.ADMIN)
  async override(@Body() dto: AttendanceOverrideDto, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Đã chỉnh công',
      data: await this.attendanceService.setOverride(user.sub, dto.userId, dto.day, dto.cong ?? null, dto.note),
    };
  }
}
