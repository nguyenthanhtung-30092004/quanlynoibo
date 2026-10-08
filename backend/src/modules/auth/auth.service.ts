import { createHash, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import type { JwtPayload } from './decorators/current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

const INVALID_CREDENTIALS = 'Tên đăng nhập hoặc mật khẩu không chính xác.';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Đăng ký tài khoản Admin đầu tiên (bootstrap).
   * Chỉ cho phép khi hệ thống chưa có tài khoản nào; các nhân viên về sau
   * do Admin tạo qua POST /users.
   */
  async register(dto: RegisterDto) {
    if ((await this.usersService.count()) > 0) {
      throw new ForbiddenException(
        'Hệ thống đã được khởi tạo. Vui lòng liên hệ Admin để được cấp tài khoản.',
      );
    }
    return this.usersService.create({ ...dto, role: UserRole.ADMIN });
  }

  /** Đăng nhập và cấp cặp Access/Refresh Token */
  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsernameWithSecrets(
      dto.username,
    );
    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị khóa hoặc tạm ngưng.',
      );
    }

    const tokens = await this.issueTokens(user);
    await this.usersService.markLoggedIn(
      user.id,
      this.hashToken(tokens.refreshToken),
    );

    return { ...tokens, user: this.toProfile(user) };
  }

  /** Cấp lại Access Token (và xoay vòng Refresh Token) */
  async refresh(refreshToken: string) {
    let sub: number;
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: number }>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>(
            'auth.jwtRefreshSecret',
          ),
        },
      );
      sub = Number(payload.sub);
    } catch {
      throw new UnauthorizedException(
        'Mã làm mới (Refresh Token) không hợp lệ hoặc đã hết hạn.',
      );
    }

    const user = await this.usersService.findByIdWithSecrets(sub);
    if (
      !user ||
      !user.isActive ||
      !user.refreshTokenHash ||
      !this.safeEqual(user.refreshTokenHash, this.hashToken(refreshToken))
    ) {
      throw new UnauthorizedException(
        'Mã làm mới (Refresh Token) không hợp lệ hoặc tài khoản đã bị khóa.',
      );
    }

    const tokens = await this.issueTokens(user);
    await this.usersService.setRefreshTokenHash(
      user.id,
      this.hashToken(tokens.refreshToken),
    );
    return tokens;
  }

  /** Đăng xuất: thu hồi refresh token */
  async logout(userId: number) {
    await this.usersService.setRefreshTokenHash(userId, null);
    return { success: true };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const { oldPassword, newPassword, confirmPassword } = dto;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException(
        'Mật khẩu xác nhận không khớp với mật khẩu mới.',
      );
    }

    const user = await this.usersService.findByIdWithSecrets(userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin tài khoản.');
    }

    if (!(await bcrypt.compare(oldPassword, user.passwordHash))) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác.');
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng với mật khẩu hiện tại.',
      );
    }

    // Đổi mật khẩu đồng thời thu hồi refresh token ở các thiết bị khác
    await this.usersService.setPasswordHash(
      user.id,
      await bcrypt.hash(newPassword, 10),
    );
    return { success: true };
  }

  async getProfile(userId: number) {
    return this.usersService.findOne(userId);
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('auth.jwtSecret'),
      expiresIn: this.configService.getOrThrow<string>(
        'auth.jwtExpiresIn',
      ) as any,
    });

    // jwtid đảm bảo mỗi refresh token là duy nhất (xoay vòng không bị trùng)
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: this.configService.getOrThrow<string>('auth.jwtRefreshSecret'),
        expiresIn: this.configService.getOrThrow<string>(
          'auth.jwtRefreshExpiresIn',
        ) as any,
        jwtid: createHash('sha256')
          .update(`${user.id}:${Date.now()}:${Math.random()}`)
          .digest('hex')
          .slice(0, 16),
      },
    );

    return { accessToken, refreshToken };
  }

  private toProfile(user: User) {
    const {
      passwordHash: _passwordHash,
      refreshTokenHash: _refreshTokenHash,
      ...profile
    } = user;
    return profile;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}
