import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCarrierDto } from './dto/create-carrier.dto.js';
import { QueryCarriersDto } from './dto/query-carriers.dto.js';
import { UpdateCarrierDto } from './dto/update-carrier.dto.js';
import { Carrier } from './entities/carrier.entity.js';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class CarriersService {
  constructor(
    @InjectRepository(Carrier)
    private readonly repo: Repository<Carrier>,
  ) {}

  async create(dto: CreateCarrierDto) {
    await this.assertNameFree(dto.name);
    return this.repo.save(
      this.repo.create({
        name: dto.name,
        phone: dto.phone || null,
        address: dto.address || null,
        note: dto.note || null,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async findAll(query: QueryCarriersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.repo.createQueryBuilder('c').orderBy('c.name', 'ASC');
    if (query.search) {
      qb.andWhere(
        "(c.name ILIKE :s ESCAPE '\\' OR c.phone ILIKE :s ESCAPE '\\')",
        { s: `%${escapeLike(query.search)}%` },
      );
    }
    if (query.isActive !== undefined) {
      qb.andWhere('c.isActive = :active', { active: query.isActive });
    }
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  private readonly carrierByIdCache = new Map<number, { carrier: Carrier; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 60_000;

  clearCache(id?: number) {
    if (id !== undefined) {
      this.carrierByIdCache.delete(id);
    } else {
      this.carrierByIdCache.clear();
    }
  }

  async findOne(id: number) {
    const now = Date.now();
    const cached = this.carrierByIdCache.get(id);
    if (cached && cached.expiresAt > now) {
      return cached.carrier;
    }
    const carrier = await this.repo.findOne({ where: { id } });
    if (!carrier) throw new NotFoundException('Không tìm thấy nhà xe.');
    this.carrierByIdCache.set(id, { carrier, expiresAt: now + this.CACHE_TTL_MS });
    return carrier;
  }

  async update(id: number, dto: UpdateCarrierDto) {
    const carrier = await this.findOne(id);
    if (dto.name !== undefined && dto.name !== carrier.name) {
      await this.assertNameFree(dto.name, id);
    }
    if (dto.name !== undefined) carrier.name = dto.name;
    if (dto.phone !== undefined) carrier.phone = dto.phone || null;
    if (dto.address !== undefined) carrier.address = dto.address || null;
    if (dto.note !== undefined) carrier.note = dto.note || null;
    if (dto.isActive !== undefined) carrier.isActive = dto.isActive;
    const saved = await this.repo.save(carrier);
    this.clearCache(id);
    return saved;
  }

  async remove(id: number) {
    const carrier = await this.findOne(id);
    await this.repo.remove(carrier);
    this.clearCache(id);
  }

  private async assertNameFree(name: string, exceptId?: number) {
    const existing = await this.repo
      .createQueryBuilder('c')
      .where('LOWER(c.name) = LOWER(:name)', { name })
      .getOne();
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Tên nhà xe đã tồn tại.');
    }
  }
}
