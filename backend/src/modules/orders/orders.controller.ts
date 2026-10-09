import {
  Body,
  Controller,
  Get,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtPayload,
} from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import {
  KpiQueryDto,
  OrderFilterDto,
  QueryOrdersDto,
} from './dto/query-orders.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { MessageChannel } from './messaging/message.types.js';
import { getBusinessDate } from './order-time-lock.js';
import { OrdersService } from './orders.service.js';

/**
 * Mọi route yêu cầu đăng nhập (AuthGuard toàn cục). Việc "Staff chỉ thấy đơn
 * của mình" được thực thi trong OrdersService, không dựa vào client.
 */
@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Tạo đơn hàng thành công',
      data: await this.ordersService.create(dto, user),
    };
  }

  @Get()
  async findAll(
    @Query() query: QueryOrdersDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.ordersService.findAll(query, user);
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy danh sách đơn hàng thành công',
      data: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  // Các route cố định phải khai báo trước ':id'

  @Get('kpi')
  async kpi(@Query() query: KpiQueryDto, @CurrentUser() user: JwtPayload) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy báo cáo KPI thành công',
      data: await this.ordersService.kpi(query, user),
    };
  }

  @Get('export')
  async export(
    @Query() query: OrderFilterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const buffer = await this.ordersService.exportExcel(query, user);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="don-hang-${getBusinessDate()}.xlsx"`,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy chi tiết đơn hàng thành công',
      data: await this.ordersService.findOne(id, user),
    };
  }

  /** Admin sửa mọi đơn; nhân viên chỉ sửa được đơn của mình (service trả 404 với đơn người khác) */
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật đơn hàng thành công',
      data: await this.ordersService.update(id, dto, user),
    };
  }

  /** Hủy vé khi khách không đặt nữa; nhân viên chỉ hủy được vé của mình */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Đã hủy vé',
      data: await this.ordersService.cancel(id, user),
    };
  }

  /** Chỉ Admin được xóa đơn */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.ordersService.remove(id, user);
    return { statusCode: HttpStatus.OK, message: 'Xóa đơn hàng thành công' };
  }

  /** Tra trạng thái tin đã gửi: 0 chờ báo cáo, 1 thành công, 2 thất bại */
  @Get(':id/message-status')
  async messageStatus(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    const data = await this.ordersService.messageStatus(id, user);
    return { statusCode: HttpStatus.OK, message: 'Thành công', data };
  }

  /** Gửi tin cho khách. Body { channel: "SMS" | "ZALO" }, bỏ trống thì gửi SMS */
  @Post(':id/send-sms')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const channel = dto.channel ?? MessageChannel.SMS;
    const label = channel === MessageChannel.ZALO ? 'Zalo' : 'SMS';
    const { order, dryRun } = await this.ordersService.sendMessage(id, channel, user);
    return {
      statusCode: HttpStatus.OK,
      message: dryRun
        ? `Chế độ thử: chưa gửi ${label} thật tới khách (Sandbox hoặc chưa cấu hình nhà cung cấp).`
        : `Đã gửi tin ${label} cho khách hàng`,
      data: order,
      dryRun,
    };
  }
}
