import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { getBusinessDate } from '../orders/order-time-lock.js';
import { assertCanModify, canModifyOwnToday } from '../shared/own-today.js';
import { CreateDeliveryDto } from './dto/create-delivery.dto.js';
import { QueryDeliveriesDto } from './dto/query-deliveries.dto.js';
import { UpdateDeliveryDto } from './dto/update-delivery.dto.js';
import { Delivery } from './entities/delivery.entity.js';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');
const blankToNull = (v: string | undefined) => (v?.trim() ? v.trim() : null);

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(Delivery)
    private readonly repo: Repository<Delivery>,
  ) {}

  /** Gắn cờ canEdit theo người đang xem (nhân viên chỉ sửa/xóa đơn của mình trong ngày) */
  withPermission(delivery: Delivery, actor: JwtPayload) {
    return { ...delivery, canEdit: canModifyOwnToday(delivery, actor) };
  }

  async create(dto: CreateDeliveryDto, actor: JwtPayload) {
    return this.repo.save(
      this.repo.create({
        entryDate: getBusinessDate(),
        createdById: actor.sub,
        shipDate: dto.shipDate,
        shipTime: dto.shipTime,
        senderName: blankToNull(dto.senderName),
        senderPhone: dto.senderPhone,
        senderAddress: blankToNull(dto.senderAddress),
        receiverName: blankToNull(dto.receiverName),
        receiverPhone: dto.receiverPhone,
        receiverAddress: dto.receiverAddress,
        quantity: dto.quantity ?? 1,
        goodsType: blankToNull(dto.goodsType),
        weightKg: dto.weightKg ?? 0,
        fee: dto.fee ?? 0,
        commission: dto.commission ?? 0,
        partner: blankToNull(dto.partner),
        note: blankToNull(dto.note),
      }),
    );
  }

  async findAll(query: QueryDeliveriesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('d')
      .orderBy('d.shipDate', 'DESC')
      .addOrderBy('d.shipTime', 'DESC')
      .addOrderBy('d.id', 'DESC');
    if (query.dateFrom) qb.andWhere('d.shipDate >= :from', { from: query.dateFrom });
    if (query.dateTo) qb.andWhere('d.shipDate <= :to', { to: query.dateTo });
    if (query.search?.trim()) {
      qb.andWhere(
        `(d.senderName ILIKE :s ESCAPE '\\' OR d.senderPhone ILIKE :s ESCAPE '\\'
          OR d.senderAddress ILIKE :s ESCAPE '\\' OR d.receiverName ILIKE :s ESCAPE '\\'
          OR d.receiverPhone ILIKE :s ESCAPE '\\' OR d.receiverAddress ILIKE :s ESCAPE '\\'
          OR d.goodsType ILIKE :s ESCAPE '\\' OR d.partner ILIKE :s ESCAPE '\\')`,
        { s: `%${escapeLike(query.search.trim())}%` },
      );
    }
    qb.skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findOne(id: number) {
    const delivery = await this.repo.findOne({ where: { id } });
    if (!delivery) throw new NotFoundException('Không tìm thấy đơn giao hàng.');
    return delivery;
  }

  async update(id: number, dto: UpdateDeliveryDto, actor: JwtPayload) {
    const delivery = await this.findOne(id);
    assertCanModify(delivery, actor, 'đơn giao hàng');
    if (dto.shipDate !== undefined) delivery.shipDate = dto.shipDate;
    if (dto.shipTime !== undefined) delivery.shipTime = dto.shipTime;
    if (dto.senderName !== undefined) delivery.senderName = blankToNull(dto.senderName);
    if (dto.senderPhone !== undefined) delivery.senderPhone = dto.senderPhone;
    if (dto.senderAddress !== undefined) delivery.senderAddress = blankToNull(dto.senderAddress);
    if (dto.receiverName !== undefined) delivery.receiverName = blankToNull(dto.receiverName);
    if (dto.receiverPhone !== undefined) delivery.receiverPhone = dto.receiverPhone;
    if (dto.receiverAddress !== undefined) delivery.receiverAddress = dto.receiverAddress;
    if (dto.quantity !== undefined) delivery.quantity = dto.quantity;
    if (dto.goodsType !== undefined) delivery.goodsType = blankToNull(dto.goodsType);
    if (dto.weightKg !== undefined) delivery.weightKg = dto.weightKg;
    if (dto.fee !== undefined) delivery.fee = dto.fee;
    if (dto.commission !== undefined) delivery.commission = dto.commission;
    if (dto.partner !== undefined) delivery.partner = blankToNull(dto.partner);
    if (dto.note !== undefined) delivery.note = blankToNull(dto.note);
    return this.repo.save(delivery);
  }

  async remove(id: number, actor: JwtPayload) {
    const delivery = await this.findOne(id);
    assertCanModify(delivery, actor, 'đơn giao hàng');
    await this.repo.remove(delivery);
  }
}
