import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User, UserRole } from './entities/user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException(
        `Tên đăng nhập "${dto.username}" đã tồn tại.`,
      );
    }

    await this.assertCitizenIdAvailable(dto.citizenId);

    const user = this.userRepository.create({
      username: dto.username,
      passwordHash: await bcrypt.hash(dto.password, 10),
      fullName: dto.fullName,
      phone: dto.phone ?? null,
      address: dto.address ?? null,
      citizenId: dto.citizenId,
      role: dto.role ?? UserRole.STAFF,
    });
    const saved = await this.userRepository.save(user);
    return this.findOne(saved.id);
  }

  async findAll(filters?: { page?: number; limit?: number; search?: string }) {
    const page = filters?.page ? Number(filters.page) : 1;
    const limit = filters?.limit ? Number(filters.limit) : 10;

    const query = this.userRepository
      .createQueryBuilder('user')
      .orderBy('user.username', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters?.search) {
      query.andWhere(
        '(user.username ILIKE :search OR user.fullName ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const [items, total] = await query.getManyAndCount();
    return { items, total, page, limit };
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy tài khoản với ID "${id}".`);
    }
    return user;
  }

  /** Dùng cho AuthGuard: kiểm tra tài khoản còn tồn tại / đang hoạt động và lấy vai trò hiện tại */
  async findAuthState(
    id: number,
  ): Promise<Pick<User, 'id' | 'role' | 'isActive'> | null> {
    return this.userRepository.findOne({
      where: { id },
      select: { id: true, role: true, isActive: true },
    });
  }

  /** Dùng cho đăng nhập: lấy kèm passwordHash (mặc định bị ẩn) */
  async findByUsernameWithSecrets(username: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.refreshTokenHash'])
      .where('user.username = :username', { username })
      .getOne();
  }

  /** Dùng cho refresh / đổi mật khẩu: lấy kèm các trường bí mật */
  async findByIdWithSecrets(id: number): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.refreshTokenHash'])
      .where('user.id = :id', { id })
      .getOne();
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    const patch: Partial<User> = {};

    if (dto.fullName !== undefined) patch.fullName = dto.fullName;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.address !== undefined) patch.address = dto.address;
    if (dto.citizenId !== undefined && dto.citizenId !== user.citizenId) {
      await this.assertCitizenIdAvailable(dto.citizenId);
      patch.citizenId = dto.citizenId;
    }
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    if (dto.password) {
      patch.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    // Khóa tài khoản hoặc đổi mật khẩu thì thu hồi phiên đăng nhập hiện tại
    if (dto.isActive === false || dto.password) {
      patch.refreshTokenHash = null;
    }

    await this.userRepository.update(user.id, patch);
    return this.findOne(id);
  }

  private async assertCitizenIdAvailable(citizenId?: string): Promise<void> {
    if (!citizenId) return;
    const existing = await this.userRepository.findOne({
      where: { citizenId },
    });
    if (existing) {
      throw new ConflictException(
        `Căn cước công dân "${citizenId}" đã được sử dụng.`,
      );
    }
  }

  async setRefreshTokenHash(id: number, hash: string | null): Promise<void> {
    await this.userRepository.update(id, { refreshTokenHash: hash });
  }

  async markLoggedIn(id: number, refreshTokenHash: string): Promise<void> {
    await this.userRepository.update(id, {
      refreshTokenHash,
      lastLoginAt: new Date(),
    });
  }

  async setPasswordHash(id: number, passwordHash: string): Promise<void> {
    await this.userRepository.update(id, {
      passwordHash,
      refreshTokenHash: null,
    });
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    try {
      await this.userRepository.remove(user);
    } catch (error) {
      // 23001 restrict_violation / 23503 foreign_key_violation (nhân viên đã có đơn hàng)
      if (['23001', '23503'].includes((error as any)?.driverError?.code)) {
        throw new ConflictException(
          'Nhân viên đã có đơn hàng nên không thể xóa. Hãy khóa tài khoản thay vì xóa.',
        );
      }
      throw error;
    }
  }

  async count(): Promise<number> {
    return this.userRepository.count();
  }
}
