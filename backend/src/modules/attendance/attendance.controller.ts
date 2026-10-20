import { timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, type JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { AttendanceService } from './attendance.service.js';
import { parseHikvisionPunch } from './hikvision-event.js';
import {
  AttendanceDayQueryDto,
  AttendanceMonthQueryDto,
  AttendanceOverrideDto,
  SaveAttendanceConfigDto,
} from './dto/attendance.dto.js';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  private readonly logger = new Logger(AttendanceController.name);

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Máy chấm công Hikvision đẩy sự kiện về đây (cấu hình "HTTP Listening" trên máy).
   * Máy không gửi được token đăng nhập nên mã bí mật nằm ngay trong đường dẫn:
   * /attendance/hik-event/<HIKVISION_SECRET>. Luôn trả 200 để máy không gửi lại dồn dập.
   */
  @Public()
  @ApiExcludeEndpoint()
  @Post('hik-event/:secret')
  @HttpCode(HttpStatus.OK)
  async hikvisionEvent(@Param('secret') secret: string, @Req() req: Request) {
    const expected = this.config.get<string>('HIKVISION_SECRET');
    if (!expected || !safeEqual(secret, expected)) throw new ForbiddenException();

    const contentType = req.headers['content-type'] ?? '';
    // JSON đã được Express parse sẵn; multipart / XML thì đọc thô từ luồng
    const parsed = req.body && Object.keys(req.body as object).length > 0 ? req.body : await readRawBody(req);
    const punch = parseHikvisionPunch(parsed, contentType);
    if (!punch) return { statusCode: HttpStatus.OK, message: 'Bỏ qua (không phải lượt quẹt của nhân viên)' };

    const result = await this.attendanceService.recordPunch(punch);
    if (result === 'unknown_employee') {
      this.logger.warn(`Máy chấm công gửi mã nhân viên "${punch.employeeNo}" chưa gắn với tài khoản nào`);
    }
    return { statusCode: HttpStatus.OK, message: result };
  }

  /** Chấm công hôm nay của chính người đăng nhập: đã quẹt vào lúc nào, ca nào, công tạm tính */
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy chấm công hôm nay thành công',
      data: await this.attendanceService.today(user),
    };
  }

  /** Ai đã quẹt vào, ai chưa, ca nào, các lượt quẹt trong ngày. Admin thấy mọi nhân viên, nhân viên chỉ thấy chính mình */
  @Get('day-log')
  async dayLog(@Query() query: AttendanceDayQueryDto, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy các lượt quẹt trong ngày thành công',
      data: await this.attendanceService.dayLog(query.day, user),
    };
  }

  /** Bảng chấm công cả tháng. Admin thấy mọi nhân viên, nhân viên chỉ thấy chính mình */
  @Get()
  async month(@Query() query: AttendanceMonthQueryDto, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy bảng chấm công thành công',
      data: await this.attendanceService.month(query.month, user),
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

/** So sánh hằng thời gian để không lộ secret qua độ trễ phản hồi */
function safeEqual(a: unknown, b: string): boolean {
  if (typeof a !== 'string') return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const MAX_EVENT_BYTES = 5 * 1024 * 1024; // gói kèm ảnh khuôn mặt thường dưới 1MB

async function readRawBody(req: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buf.length;
    if (size > MAX_EVENT_BYTES) break;
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}
