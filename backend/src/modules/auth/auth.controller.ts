import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /auth/register: tạo Admin đầu tiên (chỉ khi hệ thống chưa có user) */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Khởi tạo tài khoản Admin thành công.',
      data: await this.authService.register(dto),
    };
  }

  /** POST /auth/login */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Đăng nhập thành công.',
      data: await this.authService.login(dto),
    };
  }

  /** POST /auth/refresh */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Làm mới token thành công.',
      data: await this.authService.refresh(dto.refreshToken),
    };
  }

  /** POST /auth/change-password */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('sub') userId: number,
    @Body() dto: ChangePasswordDto,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Đổi mật khẩu thành công.',
      data: await this.authService.changePassword(userId, dto),
    };
  }

  /** POST /auth/logout */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('sub') userId: number) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Đăng xuất thành công.',
      data: await this.authService.logout(userId),
    };
  }

  /** GET /auth/me (alias /auth/profile): thông tin tài khoản hiện tại */
  @Get(['me', 'profile'])
  async getProfile(@CurrentUser('sub') userId: number) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy thông tin tài khoản hiện tại thành công.',
      data: await this.authService.getProfile(userId),
    };
  }
}
