import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { QueryRoutesDto } from './dto/query-routes.dto.js';
import { UpdateRouteDto } from './dto/update-route.dto.js';
import { Route } from './entities/route.entity.js';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private readonly repo: Repository<Route>,
  ) {}

  async create(dto: CreateRouteDto) {
    await this.assertNameFree(dto.name);
    return this.repo.save(
      this.repo.create({
        name: dto.name,
        origin: dto.origin,
        destination: dto.destination,
        defaultPrice: dto.defaultPrice ?? 0,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async findAll(query: QueryRoutesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.repo.createQueryBuilder('r').orderBy('r.name', 'ASC');
    if (query.search) {
      qb.andWhere(
        "(r.name ILIKE :s ESCAPE '\\' OR r.origin ILIKE :s ESCAPE '\\' OR r.destination ILIKE :s ESCAPE '\\')",
        { s: `%${escapeLike(query.search)}%` },
      );
    }
    if (query.isActive !== undefined) {
      qb.andWhere('r.isActive = :active', { active: query.isActive });
    }
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findOne(id: number) {
    const route = await this.repo.findOne({ where: { id } });
    if (!route) throw new NotFoundException('Không tìm thấy tuyến đường.');
    return route;
  }

  async update(id: number, dto: UpdateRouteDto) {
    const route = await this.findOne(id);
    if (dto.name !== undefined && dto.name !== route.name) {
      await this.assertNameFree(dto.name, id);
    }
    if (dto.name !== undefined) route.name = dto.name;
    if (dto.origin !== undefined) route.origin = dto.origin;
    if (dto.destination !== undefined) route.destination = dto.destination;
    if (dto.defaultPrice !== undefined) route.defaultPrice = dto.defaultPrice;
    if (dto.isActive !== undefined) route.isActive = dto.isActive;
    return this.repo.save(route);
  }

  async remove(id: number) {
    const route = await this.findOne(id);
    try {
      await this.repo.remove(route);
    } catch (err) {
      // 23503: foreign_key_violation (tuyến đã có đơn hàng)
      if ((err as { driverError?: { code?: string } }).driverError?.code === '23503') {
        throw new ConflictException(
          'Tuyến đã có đơn hàng, không thể xóa. Hãy tắt hoạt động của tuyến thay thế.',
        );
      }
      throw err;
    }
  }

  private async assertNameFree(name: string, exceptId?: number) {
    const existing = await this.repo
      .createQueryBuilder('r')
      .where('LOWER(r.name) = LOWER(:name)', { name })
      .getOne();
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Tên tuyến đường đã tồn tại.');
    }
  }
}
