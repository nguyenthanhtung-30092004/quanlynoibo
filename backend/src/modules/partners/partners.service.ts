import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { assertCanModify, canModifyOwnToday } from '../shared/own-today.js';
import { UserRole } from '../users/entities/user.entity.js';
import { CreatePartnerDto } from './dto/create-partner.dto.js';
import { QueryPartnersDto } from './dto/query-partners.dto.js';
import { UpdatePartnerDto } from './dto/update-partner.dto.js';
import { Partner } from './entities/partner.entity.js';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(Partner)
    private readonly repo: Repository<Partner>,
  ) {}

  /** Gắn cờ canEdit theo người đang xem để giao diện biết có hiện nút sửa/xóa không */
  withPermission<T extends Partner>(partner: T, actor: JwtPayload) {
    // Hoa hồng mỗi vé chỉ Admin được xem: nhân viên không nhận trường này
    const { commissionPerSeat, commissionPercent, ...rest } = partner;
    return {
      ...rest,
      ...(actor.role === UserRole.ADMIN ? { commissionPerSeat, commissionPercent } : {}),
      canEdit: canModifyOwnToday(partner, actor),
    };
  }

  private readonly partnerByNameCache = new Map<string, { partner: Partner | null; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 60_000;

  clearCache() {
    this.partnerByNameCache.clear();
  }

  async create(dto: CreatePartnerDto, actor: JwtPayload) {
    await this.assertNameFree(dto.name);
    const saved = await this.repo.save(
      this.repo.create({
        name: dto.name,
        note: dto.note || null,
        commissionPerSeat: actor.role === UserRole.ADMIN ? (dto.commissionPerSeat ?? 0) : 0,
        commissionPercent: actor.role === UserRole.ADMIN ? (dto.commissionPercent ?? 0) : 0,
        createdById: actor.sub,
      }),
    );
    this.clearCache();
    return saved;
  }

  async findAll(query: QueryPartnersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.repo.createQueryBuilder('p').orderBy('p.name', 'ASC');
    if (query.search?.trim()) {
      qb.andWhere("(p.name ILIKE :s ESCAPE '\\' OR p.note ILIKE :s ESCAPE '\\')", {
        s: `%${escapeLike(query.search.trim())}%`,
      });
    }
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  /**
   * Hoa hồng gợi ý cho một đơn. Ưu tiên theo %: tổng giá vé đầy đủ x % của đối tác;
   * không có % (hoặc chưa nhập giá vé) thì dùng mức cố định mỗi vé x số vé.
   * Trả null nếu đối tác chưa đặt mức nào; không lộ % hay mức mỗi vé cho nhân viên.
   */
  async commissionQuote(name: string, seats: number, fare = 0) {
    const key = name.trim();
    if (!key || seats < 1) return { commission: null };
    const lowerKey = key.toLowerCase();
    const now = Date.now();
    const cached = this.partnerByNameCache.get(lowerKey);
    let partner: Partner | null = null;
    if (cached && cached.expiresAt > now) {
      partner = cached.partner;
    } else {
      partner = await this.repo
        .createQueryBuilder('p')
        .where('LOWER(p.name) = LOWER(:name)', { name: key })
        .getOne();
      this.partnerByNameCache.set(lowerKey, { partner, expiresAt: now + this.CACHE_TTL_MS });
    }
    if (!partner) return { commission: null };
    if (partner.commissionPercent > 0 && fare > 0) {
      return { commission: Math.round((fare * partner.commissionPercent) / 100) };
    }
    if (partner.commissionPerSeat <= 0) return { commission: null };
    return { commission: partner.commissionPerSeat * seats };
  }

  async findOne(id: number) {
    const partner = await this.repo.findOne({ where: { id } });
    if (!partner) throw new NotFoundException('Không tìm thấy đối tác.');
    return partner;
  }

  async update(id: number, dto: UpdatePartnerDto, actor: JwtPayload) {
    const partner = await this.findOne(id);
    assertCanModify(partner, actor, 'đối tác');
    if (dto.name !== undefined && dto.name !== partner.name) {
      await this.assertNameFree(dto.name, id);
    }
    if (dto.name !== undefined) partner.name = dto.name;
    if (dto.note !== undefined) partner.note = dto.note || null;
    if (dto.commissionPerSeat !== undefined && actor.role === UserRole.ADMIN) {
      partner.commissionPerSeat = dto.commissionPerSeat;
    }
    if (dto.commissionPercent !== undefined && actor.role === UserRole.ADMIN) {
      partner.commissionPercent = dto.commissionPercent;
    }
    const saved = await this.repo.save(partner);
    this.clearCache();
    return saved;
  }

  async remove(id: number, actor: JwtPayload) {
    const partner = await this.findOne(id);
    assertCanModify(partner, actor, 'đối tác');
    await this.repo.remove(partner);
    this.clearCache();
  }

  private async assertNameFree(name: string, exceptId?: number) {
    const existing = await this.repo
      .createQueryBuilder('p')
      .where('LOWER(p.name) = LOWER(:name)', { name })
      .getOne();
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Tên đối tác đã tồn tại.');
    }
  }
}
