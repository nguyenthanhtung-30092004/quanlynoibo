import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User, UserRole } from './entities/user.entity.js';
import { decryptPassword, encryptPassword } from './password-vault.js';

/** Mật khẩu khởi tạo khi Admin tạo nhân viên mà không nhập mật khẩu */
const DEFAULT_STAFF_PASSWORD = '123456';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    // Nhân viên đăng nhập bằng số điện thoại
    const username = dto.username ?? dto.phone;
    if (!username) {
      throw new BadRequestException('Cần nhập số điện thoại để làm tên đăng nhập.');
    }
    await this.assertUsernameAvailable(username);
    const deviceEmployeeNo = dto.deviceEmployeeNo || null;
    if (deviceEmployeeNo) await this.assertDeviceEmployeeNoAvailable(deviceEmployeeNo);

    const password = dto.password ?? DEFAULT_STAFF_PASSWORD;
    const user = this.userRepository.create({
      username,
      passwordHash: await bcrypt.hash(password, 10),
      passwordEnc: encryptPassword(password),
      fullName: dto.fullName,
      phone: dto.phone ?? null,
      address: dto.address ?? null,
      deviceEmployeeNo,
      role: dto.role ?? UserRole.STAFF,
    });
    const saved = await this.userRepository.save(user);
    // Nhân viên không nhập mã chấm công thì mã mặc định là ID tài khoản (nhập thẳng vào máy làm Employee ID)
    if (!deviceEmployeeNo && saved.role === UserRole.STAFF) {
      await this.userRepository.update(saved.id, { deviceEmployeeNo: String(saved.id) });
    }
    return this.findOne(saved.id);
  }

  async findAll(filters?: { page?: number; limit?: number; search?: string }) {
    const page = filters?.page ? Number(filters.page) : 1;
    const limit = filters?.limit ? Number(filters.limit) : 10;

    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.deletedAt IS NULL')
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
    const user = await this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy tài khoản với ID "${id}".`);
    }
    return user;
  }

  private readonly authStateCache = new Map<
    number,
    { data: Pick<User, 'id' | 'role' | 'isActive'> | null; expiresAt: number }
  >();
  private readonly AUTH_STATE_TTL_MS = 30_000;
  private readonly AUTH_STATE_MAX_ENTRIES = 2_000;

  /** Xóa cache trạng thái tài khoản (gọi khi khóa/đổi vai trò/xóa) */
  invalidateAuthState(id?: number): void {
    if (id !== undefined) {
      this.authStateCache.delete(id);
    } else {
      this.authStateCache.clear();
    }
  }

  /** Dùng cho AuthGuard: kiểm tra tài khoản còn tồn tại / đang hoạt động và lấy vai trò hiện tại (có cache bộ nhớ ~30s) */
  async findAuthState(
    id: number,
  ): Promise<Pick<User, 'id' | 'role' | 'isActive'> | null> {
    const now = Date.now();
    const cached = this.authStateCache.get(id);
    if (cached) {
      if (cached.expiresAt > now) {
        // Làm mới vị trí LRU
        this.authStateCache.delete(id);
        this.authStateCache.set(id, cached);
        return cached.data;
      }
      this.authStateCache.delete(id);
    }

    const data = await this.userRepository.findOne({
      where: { id, deletedAt: IsNull() },
      select: { id: true, role: true, isActive: true },
    });

    if (this.authStateCache.size >= this.AUTH_STATE_MAX_ENTRIES) {
      const oldestKey = this.authStateCache.keys().next().value;
      if (oldestKey !== undefined) this.authStateCache.delete(oldestKey);
    }
    this.authStateCache.set(id, { data, expiresAt: now + this.AUTH_STATE_TTL_MS });

    return data;
  }

  /** Dùng cho đăng nhập: lấy kèm passwordHash (mặc định bị ẩn) */
  async findByUsernameWithSecrets(username: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.refreshTokenHash'])
      .where('user.username = :username', { username })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
  }

  /** Dùng cho refresh / đổi mật khẩu: lấy kèm các trường bí mật */
  async findByIdWithSecrets(id: number): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.refreshTokenHash'])
      .where('user.id = :id', { id })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    const patch: Partial<User> = {};

    if (dto.fullName !== undefined) patch.fullName = dto.fullName;
    if (dto.phone !== undefined) {
      patch.phone = dto.phone;
      // Tài khoản đang đăng nhập bằng SĐT cũ thì đổi theo SĐT mới
      if (dto.phone !== user.phone && user.phone && user.username === user.phone) {
        await this.assertUsernameAvailable(dto.phone);
        patch.username = dto.phone;
        patch.refreshTokenHash = null;
      }
    }
    if (dto.address !== undefined) patch.address = dto.address;
    if (dto.deviceEmployeeNo !== undefined) {
      patch.deviceEmployeeNo = dto.deviceEmployeeNo || null;
      if (patch.deviceEmployeeNo) await this.assertDeviceEmployeeNoAvailable(patch.deviceEmployeeNo, user.id);
    }
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    if (dto.password) {
      patch.passwordHash = await bcrypt.hash(dto.password, 10);
      patch.passwordEnc = encryptPassword(dto.password);
    }
    // Khóa tài khoản hoặc đổi mật khẩu thì thu hồi phiên đăng nhập hiện tại
    if (dto.isActive === false || dto.password) {
      patch.refreshTokenHash = null;
    }

    await this.userRepository.update(user.id, patch);
    this.invalidateAuthState(user.id);
    return this.findOne(id);
  }

  /** Mỗi mã trên máy chỉ gắn với một tài khoản (tài khoản xóa mềm đã nhả mã) */
  private async assertDeviceEmployeeNoAvailable(deviceEmployeeNo: string, exceptId?: number): Promise<void> {
    const existing = await this.userRepository.findOne({ where: { deviceEmployeeNo } });
    if (existing && existing.id !== exceptId) {
      throw new BadRequestException(`Mã chấm công "${deviceEmployeeNo}" đã gắn với nhân viên khác.`);
    }
  }

  private async assertUsernameAvailable(username: string): Promise<void> {
    // Tài khoản đã xóa vẫn giữ username (đã đổi tên) nên cũng được tính là trùng
    const existing = await this.userRepository.findOne({ where: { username } });
    if (existing) {
      throw new ConflictException(`Tên đăng nhập "${username}" đã tồn tại.`);
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

  /** Đặt mật khẩu mới (lưu cả bản băm để đăng nhập và bản mã hóa để Admin xem) */
  async setPassword(id: number, password: string): Promise<void> {
    await this.userRepository.update(id, {
      passwordHash: await bcrypt.hash(password, 10),
      passwordEnc: encryptPassword(password),
      refreshTokenHash: null,
    });
    this.invalidateAuthState(id);
  }

  /** Mật khẩu hiện tại của tài khoản, null nếu chưa lưu được (tài khoản cũ) */
  async revealPassword(id: number): Promise<string | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordEnc')
      .where('user.id = :id', { id })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
    if (!user) throw new NotFoundException(`Không tìm thấy tài khoản với ID "${id}".`);
    return decryptPassword(user.passwordEnc);
  }

  /**
   * Xóa mềm: tài khoản biến mất khỏi danh sách và không đăng nhập được nữa,
   * nhưng bản ghi vẫn còn để các đơn hàng đã tạo giữ nguyên tên nhân viên.
   * Tên đăng nhập / CCCD được nhả ra để có thể tạo lại tài khoản mới cùng SĐT.
   */
  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.update(user.id, {
      deletedAt: new Date(),
      isActive: false,
      refreshTokenHash: null,
      username: user.username.slice(0, 35) + `#xoa${user.id}`,
      citizenId: null,
      deviceEmployeeNo: null,
    });
    this.invalidateAuthState(user.id);
  }

  async count(): Promise<number> {
    return this.userRepository.count();
  }
}
