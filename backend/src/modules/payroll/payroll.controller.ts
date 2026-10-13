import { Body, Controller, Get, HttpStatus, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { PayrollQueryDto, SavePayrollDto } from './dto/save-payroll.dto.js';
import { PayrollService } from './payroll.service.js';

/** Bảng lương chứa doanh số và tiền lương của mọi nhân viên: chỉ Admin */
@ApiTags('Payroll')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

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
