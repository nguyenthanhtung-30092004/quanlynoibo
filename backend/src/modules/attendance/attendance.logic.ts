/**
 * Chấm công theo thời gian thao tác thật trên máy tính, tại công ty.
 * Toàn bộ quy tắc nằm ở đây dưới dạng hàm thuần để kiểm thử được; service chỉ lo lưu / đọc DB.
 */

export interface AttendanceConfig {
  /** Số phút làm việc từ mức này trở lên được 1 công (mặc định 420 = 7 tiếng) */
  fullMinutes: number;
  /** Từ mức này được nửa công; 0 = không tính nửa công */
  halfMinutes: number;
  /** Vị trí công ty; null = chưa cài, khi đó không tính công cho ai */
  workplace: { lat: number | null; lng: number | null };
  /** Bán kính coi là "đang ở công ty" (mét) */
  radiusM: number;
  /** Sai số tối đa của định vị chấp nhận được (mét); định vị thô hơn mức này thì không tin */
  maxAccuracyM: number;
}

export const DEFAULT_ATTENDANCE_CONFIG: AttendanceConfig = {
  fullMinutes: 420,
  halfMinutes: 0,
  workplace: { lat: null, lng: null },
  radiusM: 150,
  maxAccuracyM: 300,
};

/** Lý do một lượt "tôi đang làm việc" được tính hoặc không */
export type BeatReason =
  | 'ok'
  | 'not_staff'
  | 'mobile'
  | 'not_configured'
  | 'no_location'
  | 'low_accuracy'
  | 'out_of_range';

export interface BeatVerdict {
  counted: boolean;
  reason: BeatReason;
  /** Khoảng cách tới công ty (mét) nếu biết cả hai vị trí */
  distanceM: number | null;
}

const num = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const coord = (value: unknown, min: number, max: number): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Chuẩn hóa cấu hình do client gửi lên hoặc đọc từ DB; thiếu thì lấy mặc định */
export function sanitizeAttendanceConfig(input: unknown): AttendanceConfig {
  const raw = obj(input);
  const def = DEFAULT_ATTENDANCE_CONFIG;
  const place = obj(raw.workplace);
  const fullMinutes = num(raw.fullMinutes, def.fullMinutes, 1, 1440);
  return {
    fullMinutes,
    halfMinutes: Math.min(fullMinutes, num(raw.halfMinutes, def.halfMinutes, 0, 1440)),
    workplace: { lat: coord(place.lat, -90, 90), lng: coord(place.lng, -180, 180) },
    radiusM: num(raw.radiusM, def.radiusM, 10, 5000),
    maxAccuracyM: num(raw.maxAccuracyM, def.maxAccuracyM, 10, 5000),
  };
}

/** Khoảng cách giữa hai điểm trên mặt đất (mét), công thức haversine */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Điện thoại / máy tính bảng (nhận biết qua User-Agent, chỉ là biện pháp hỗ trợ vì người dùng đổi được) */
export function isMobileUserAgent(userAgent: string | undefined): boolean {
  return !!userAgent && /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(userAgent);
}

/**
 * Một lượt "đang thao tác" có được tính một phút công không.
 * Phải là nhân viên, dùng máy tính, công ty đã cài vị trí, và vị trí báo lên nằm trong bán kính.
 */
export function evaluateBeat(input: {
  config: AttendanceConfig;
  role: string;
  userAgent: string | undefined;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
}): BeatVerdict {
  const { config, role, userAgent, lat, lng, accuracy } = input;
  if (role !== 'STAFF') return { counted: false, reason: 'not_staff', distanceM: null };
  if (isMobileUserAgent(userAgent)) return { counted: false, reason: 'mobile', distanceM: null };
  if (config.workplace.lat === null || config.workplace.lng === null) {
    return { counted: false, reason: 'not_configured', distanceM: null };
  }
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { counted: false, reason: 'no_location', distanceM: null };
  }
  const distanceM = Math.round(distanceMeters(lat, lng, config.workplace.lat, config.workplace.lng));
  if (typeof accuracy === 'number' && accuracy > config.maxAccuracyM) {
    return { counted: false, reason: 'low_accuracy', distanceM };
  }
  if (distanceM > config.radiusM) return { counted: false, reason: 'out_of_range', distanceM };
  return { counted: true, reason: 'ok', distanceM };
}

/** Số công của một ngày theo tổng số phút thao tác tại công ty */
export function congFromMinutes(minutes: number, config: AttendanceConfig): number {
  if (minutes >= config.fullMinutes) return 1;
  if (config.halfMinutes > 0 && minutes >= config.halfMinutes) return 0.5;
  return 0;
}

/** Ngày (YYYY-MM-DD) và phút trong ngày (0-1439) theo giờ Việt Nam; do server tính, không tin giờ máy khách */
export function vietnamClock(now: Date = new Date()): { day: string; minuteOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    minuteOfDay: Number(get('hour')) * 60 + Number(get('minute')),
  };
}
