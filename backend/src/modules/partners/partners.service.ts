import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/decorators/current-user.decorator.js';
import { assertCanModify, canModifyOwnToday } from '../shared/own-today.js';
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
    return { ...partner, canEdit: canModifyOwnToday(partner, actor) };
  }

  async create(dto: CreatePartnerDto, actor: JwtPayload) {
    await this.assertNameFree(dto.name);
    return this.repo.save(
      this.repo.create({ name: dto.name, note: dto.note || null, createdById: actor.sub }),
    );
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
    return this.repo.save(partner);
  }

  async remove(id: number, actor: JwtPayload) {
    const partner = await this.findOne(id);
    assertCanModify(partner, actor, 'đối tác');
    await this.repo.remove(partner);
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
