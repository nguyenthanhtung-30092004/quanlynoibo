import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async create(dto: CreatePartnerDto) {
    await this.assertNameFree(dto.name);
    return this.repo.save(
      this.repo.create({ name: dto.name, note: dto.note || null }),
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

  async update(id: number, dto: UpdatePartnerDto) {
    const partner = await this.findOne(id);
    if (dto.name !== undefined && dto.name !== partner.name) {
      await this.assertNameFree(dto.name, id);
    }
    if (dto.name !== undefined) partner.name = dto.name;
    if (dto.note !== undefined) partner.note = dto.note || null;
    return this.repo.save(partner);
  }

  async remove(id: number) {
    const partner = await this.findOne(id);
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
