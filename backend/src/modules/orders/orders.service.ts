import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { Partner } from '../partners/entities/partner.entity.js';
import { Route } from '../routes/entities/route.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import {
  type ColumnValuesKey,
  KpiQueryDto,
  OrderFilterDto,
  QueryOrdersDto,
} from './dto/query-orders.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { Order } from './entities/order.entity.js';
import { OrderHistory } from './entities/order-history.entity.js';
import { MessageChannel } from './messaging/message.types.js';
import { MessagingService } from './messaging/messaging.service.js';
import type { UnlistedPartnerSummary } from './order-partner.util.js';
import { OrderFilterBuilder } from './filters/order-filter.builder.js';
import { OrdersQueryService } from './services/orders-query.service.js';
import { OrdersCommandService } from './services/orders-command.service.js';
import { OrdersReportService } from './services/orders-report.service.js';
import { OrdersColumnValuesService } from './services/orders-column-values.service.js';
import { OrdersExportService } from './services/orders-export.service.js';
import { OrdersImportService, type ImportResult } from './services/orders-import.service.js';
import { OrdersMessagingService } from './services/orders-messaging.service.js';

export type { ImportResult };

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  readonly queryService: OrdersQueryService;
  readonly commandService: OrdersCommandService;
  readonly reportService: OrdersReportService;
  readonly columnValuesService: OrdersColumnValuesService;
  readonly exportService: OrdersExportService;
  readonly importService: OrdersImportService;
  readonly messagingServiceWrapper: OrdersMessagingService;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderHistory)
    private readonly historyRepository: Repository<OrderHistory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @Optional()
    private readonly messaging?: MessagingService,
    @Optional()
    private readonly dataSource?: DataSource,
    @Optional()
    injectedQueryService?: OrdersQueryService,
    @Optional()
    injectedCommandService?: OrdersCommandService,
    @Optional()
    injectedReportService?: OrdersReportService,
    @Optional()
    injectedColumnValuesService?: OrdersColumnValuesService,
    @Optional()
    injectedExportService?: OrdersExportService,
    @Optional()
    injectedImportService?: OrdersImportService,
    @Optional()
    injectedMessagingServiceWrapper?: OrdersMessagingService,
  ) {
    this.queryService =
      injectedQueryService ??
      new OrdersQueryService(this.orderRepository, this.historyRepository, this.partnerRepository);

    this.reportService =
      injectedReportService ??
      new OrdersReportService(this.orderRepository, this.partnerRepository);

    this.columnValuesService =
      injectedColumnValuesService ??
      new OrdersColumnValuesService(this.queryService);

    this.exportService =
      injectedExportService ??
      new OrdersExportService(this.userRepository, this.queryService);

    this.commandService =
      injectedCommandService ??
      new OrdersCommandService(
        this.orderRepository,
        this.historyRepository,
        this.userRepository,
        this.routeRepository,
        this.partnerRepository,
        this.queryService,
        this.reportService,
        this.columnValuesService,
      );

    this.importService =
      injectedImportService ??
      new OrdersImportService(
        this.dataSource as any,
        this.orderRepository,
        this.historyRepository,
        this.userRepository,
        this.routeRepository,
        this.partnerRepository,
      );

    this.messagingServiceWrapper =
      injectedMessagingServiceWrapper ??
      new OrdersMessagingService(
        this.orderRepository,
        this.historyRepository,
        this.userRepository,
        this.messaging as any,
        this.queryService,
      );
  }

  clearReportsAndFilterCache(): void {
    this.commandService.clearReportsAndFilterCache();
  }

  buildListQuery(filter: OrderFilterDto, actor: JwtPayload): SelectQueryBuilder<Order> {
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.createdBy', 'staff')
      .addSelect(['staff.id', 'staff.fullName'])
      .leftJoin('order.route', 'route')
      .addSelect(['route.id', 'route.name']);

    return OrderFilterBuilder.apply(qb, filter, actor);
  }

  async create(dto: CreateOrderDto, actor: JwtPayload, options?: { entryDate?: string }) {
    return this.commandService.create(dto, actor, options);
  }

  async importExcel(buffer: Buffer, actor: JwtPayload): Promise<ImportResult> {
    return this.importService.importExcel(buffer, actor, () => {
      this.clearReportsAndFilterCache();
    });
  }

  async rollbackImport(ids: number[], actor: JwtPayload) {
    return this.importService.rollbackImport(ids, actor, () => {
      this.clearReportsAndFilterCache();
    });
  }

  async findAll(query: QueryOrdersDto, actor: JwtPayload) {
    return this.queryService.findAll(query, actor);
  }

  async findOne(id: number, actor: JwtPayload) {
    return this.queryService.findOne(id, actor);
  }

  async update(id: number, dto: UpdateOrderDto, actor: JwtPayload) {
    return this.commandService.update(id, dto, actor);
  }

  async cancel(id: number, actor: JwtPayload, reason?: string) {
    return this.commandService.cancel(id, actor, reason);
  }

  async remove(id: number, actor: JwtPayload) {
    return this.commandService.remove(id, actor);
  }

  async sendMessage(id: number, channel: MessageChannel, actor: JwtPayload) {
    return this.messagingServiceWrapper.sendMessage(id, channel, actor);
  }

  async history(id: number, actor: JwtPayload) {
    return this.queryService.history(id, actor);
  }

  async activity(actor: JwtPayload, limit = 30) {
    return this.queryService.activity(actor, limit);
  }

  async messageStatus(id: number, actor: JwtPayload) {
    return this.messagingServiceWrapper.messageStatus(id, actor);
  }

  async applyCallback(referentId: string, status: number) {
    return this.messagingServiceWrapper.applyCallback(referentId, status);
  }

  async kpi(query: KpiQueryDto, actor: JwtPayload) {
    return this.reportService.kpi(query, actor);
  }

  async kpiFilterOptions(query: KpiQueryDto, actor: JwtPayload) {
    return this.reportService.kpiFilterOptions(query, actor);
  }

  async debts(query: KpiQueryDto, actor: JwtPayload) {
    return this.reportService.debts(query, actor);
  }

  async exportDebts(query: KpiQueryDto, actor: JwtPayload) {
    return this.reportService.exportDebts(query, actor);
  }

  async exportExcel(filter: OrderFilterDto, actor: JwtPayload) {
    return this.exportService.exportExcel(filter, actor);
  }

  async columnValues(
    column: ColumnValuesKey,
    q: string | undefined,
    filter: OrderFilterDto,
    actor: JwtPayload,
  ) {
    return this.columnValuesService.columnValues(column, q, filter, actor);
  }

  async unlistedPartners(): Promise<UnlistedPartnerSummary[]> {
    return this.queryService.unlistedPartners();
  }
}
