import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { AppSetting } from './entities/app-setting.entity.js';

/** Giá trị mặc định khi chưa ai lưu cài đặt */
export const DEFAULT_SETTINGS = {
  companyName: 'CÔNG TY TNHH TM & DV XVIP',
  hotline: '1900 6868',
  email: 'dieuhanh@xvip.vn',
  address: 'Số 12 Bến xe Mỹ Đình, Từ Liêm, Hà Nội',
  smsTemplate:
    'XVIP xac nhan ve xe: {tenKhach} ({sdt}) di {tuyenDuong}, gio chay {gioChay}, nha xe {nhaXe}. Gia ve: {giaVe}d. Hotline ho tro: {hotline}. Chuc quy khach thuong lo binh an!',
  /** Tài khoản nhận tiền của trang Tạo QR, lưu dạng JSON: [{ bank, number, holder, vietqrBank }] */
  qrAccounts: JSON.stringify([
    {
      bank: 'Vietcombank',
      number: '7770319999',
      holder: 'Công Ty TNHH Thương Mại Và Dịch Vụ XVIP',
      vietqrBank: 'vietcombank',
    },
  ]),
};

export type SettingsMap = typeof DEFAULT_SETTINGS;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
  ) {}

  private cachedSettings: { data: SettingsMap; expiresAt: number } | null = null;
  private readonly SETTINGS_TTL_MS = 60_000;

  async getAll(): Promise<SettingsMap> {
    const now = Date.now();
    if (this.cachedSettings && this.cachedSettings.expiresAt > now) {
      return this.cachedSettings.data;
    }
    const rows = await this.repo.find();
    const saved = new Map(rows.map((r) => [r.key, r.value]));
    const out = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SettingsMap)[]) {
      if (saved.has(key)) out[key] = saved.get(key) as string;
    }
    this.cachedSettings = { data: out, expiresAt: now + this.SETTINGS_TTL_MS };
    return out;
  }

  /** qrAccounts phải là JSON mảng 1-5 tài khoản hợp lệ, tránh lưu dữ liệu làm hỏng trang Tạo QR */
  private assertValidQrAccounts(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Danh sách tài khoản QR không hợp lệ');
    }
    const ok =
      Array.isArray(parsed) &&
      parsed.length >= 1 &&
      parsed.length <= 5 &&
      parsed.every(
        (a) =>
          a &&
          typeof a.bank === 'string' &&
          a.bank.trim() !== '' &&
          typeof a.holder === 'string' &&
          a.holder.trim() !== '' &&
          typeof a.number === 'string' &&
          /^\d{6,20}$/.test(a.number) &&
          typeof a.vietqrBank === 'string' &&
          /^[a-z0-9]{2,30}$/i.test(a.vietqrBank),
      );
    if (!ok) {
      throw new BadRequestException(
        'Tài khoản QR không hợp lệ: số tài khoản chỉ gồm 6-20 chữ số, tên ngân hàng/chủ tài khoản/mã VietQR không được để trống',
      );
    }
  }

  async update(dto: UpdateSettingsDto): Promise<SettingsMap> {
    if (dto.qrAccounts !== undefined) this.assertValidQrAccounts(dto.qrAccounts);
    const entries = (Object.keys(DEFAULT_SETTINGS) as (keyof SettingsMap)[])
      .filter((key) => dto[key] !== undefined)
      .map((key) => this.repo.create({ key, value: dto[key] as string }));
    if (entries.length > 0) await this.repo.save(entries);
    this.cachedSettings = null;
    return this.getAll();
  }
}
