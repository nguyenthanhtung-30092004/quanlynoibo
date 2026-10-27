import { Body, Controller, Get, HttpStatus, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { PayrollQueryDto, SavePayrollDto } from './dto/save-payroll.dto.js';
import { PayrollService } from './payroll.service.js';

/** Bảng lương chứa doanh số và tiền lương của mọi nhân viên: chỉ Admin (riêng `GET /payroll/me` cho nhân viên xem của mình) */
@ApiTags('Payroll')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  /** Nhân viên xem lương của chính mình (chỉ xem, không sửa được) */
  @Get('me')
  @Roles(UserRole.STAFF)
  async mine(@Query() query: PayrollQueryDto, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy lương của bạn thành công',
      data: await this.payrollService.getMine(query.month, user.sub),
    };
  }

  @Get()
  async get(@Query() query: PayrollQueryDto) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy bảng lương thành công',
      data: await this.payrollService.get(query.month),
    };
  }

  @Put()
  async save(@Body() dto: SavePayrollDto) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lưu bảng lương thành công',
      data: await this.payrollService.save(dto.month, dto.config, dto.entries),
    };
  }
}
