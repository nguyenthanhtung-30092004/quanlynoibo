import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from '../../settings/entities/app-setting.entity.js';

const TOKEN_URL = 'https://oauth.zaloapp.com/v4/oa/access_token';

const KEY_ACCESS = 'zalo_access_token';
const KEY_REFRESH = 'zalo_refresh_token';
const KEY_EXPIRES = 'zalo_token_expires_at';

/** Làm mới sớm 2 phút để không dùng phải token sắp hết hạn */
const SKEW_MS = 120_000;

/**
 * Giữ access token Zalo OA luôn còn hạn.
 *
 * Access token sống ~1 giờ; refresh token chỉ dùng được MỘT lần và mỗi lần làm mới Zalo trả
 * refresh token mới, nên cặp token mới nhất được lưu vào bảng app_settings. Lần đầu (chưa có
 * trong DB) lấy refresh token từ biến môi trường ZALO_REFRESH_TOKEN.
 */
@Injectable()
export class ZaloTokenService {
  private inflight: Promise<string> | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AppSetting)
    private readonly settings: Repository<AppSetting>,
  ) {}

  /** Có đủ khóa để lấy token chưa */
  hasCredentials(): boolean {
    return !!this.config.get<string>('ZALO_APP_ID') && !!this.config.get<string>('ZALO_APP_SECRET');
  }

  async getAccessToken(): Promise<string> {
    const [access, expires] = await Promise.all([this.read(KEY_ACCESS), this.read(KEY_EXPIRES)]);
    if (access && Number(expires) - Date.now() > SKEW_MS) return access;
    // Gộp các lần gọi đồng thời để không dùng refresh token (chỉ dùng được 1 lần) hai lần
    this.inflight ??= this.refresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async refresh(): Promise<string> {
    const refreshToken =
      (await this.read(KEY_REFRESH)) || this.config.get<string>('ZALO_REFRESH_TOKEN')?.trim();
    if (!refreshToken) {
      throw new BadGatewayException(
        'Chưa có refresh token Zalo. Hãy cấp quyền cho ứng dụng và điền ZALO_REFRESH_TOKEN trong backend/.env.',
      );
    }

    let res: Response;
    try {
      res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          secret_key: this.config.getOrThrow<string>('ZALO_APP_SECRET'),
        },
        body: new URLSearchParams({
          app_id: this.config.getOrThrow<string>('ZALO_APP_ID'),
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('Không kết nối được Zalo để làm mới token. Vui lòng thử lại sau.');
    }

    const json = (await res.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: string | number;
      error?: number;
      error_name?: string;
      error_reason?: string;
    } | null;

    if (!json?.access_token || !json.refresh_token) {
      const why = json?.error_reason ?? json?.error_name;
      throw new BadGatewayException(
        `Làm mới token Zalo thất bại${why ? `: ${why}` : ''}. Có thể refresh token đã hết hạn hoặc đã bị dùng, hãy cấp quyền lại và cập nhật ZALO_REFRESH_TOKEN.`,
      );
    }

    const expiresAt = Date.now() + Number(json.expires_in ?? 3600) * 1000;
    await this.settings.save([
      this.settings.create({ key: KEY_ACCESS, value: json.access_token }),
      this.settings.create({ key: KEY_REFRESH, value: json.refresh_token }),
      this.settings.create({ key: KEY_EXPIRES, value: String(expiresAt) }),
    ]);
    return json.access_token;
  }

  private async read(key: string): Promise<string | undefined> {
    const row = await this.settings.findOne({ where: { key } });
    return row?.value || undefined;
  }
}
