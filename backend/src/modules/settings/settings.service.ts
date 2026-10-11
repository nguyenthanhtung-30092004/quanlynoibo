import { Injectable } from '@nestjs/common';
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
};

export type SettingsMap = typeof DEFAULT_SETTINGS;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
  ) {}

  async getAll(): Promise<SettingsMap> {
    const rows = await this.repo.find();
    const saved = new Map(rows.map((r) => [r.key, r.value]));
    const out = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SettingsMap)[]) {
      if (saved.has(key)) out[key] = saved.get(key) as string;
    }
    return out;
  }

  async update(dto: UpdateSettingsDto): Promise<SettingsMap> {
    const entries = (Object.keys(DEFAULT_SETTINGS) as (keyof SettingsMap)[])
      .filter((key) => dto[key] !== undefined)
      .map((key) => this.repo.create({ key, value: dto[key] as string }));
    if (entries.length > 0) await this.repo.save(entries);
    return this.getAll();
  }
}
