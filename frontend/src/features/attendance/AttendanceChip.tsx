'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPinLine } from '@phosphor-icons/react';
import { attendanceApi } from './api';
import { useMyAttendanceToday } from './hooks';
import type { BeatReason, HeartbeatResult } from './types';

/** Gửi một lượt "đang thao tác" mỗi 30 giây; server gộp theo phút nên gửi nhiều hơn cũng không nhanh hơn giờ thật */
const HEARTBEAT_MS = 30_000;
/** Chỉ tính là đang làm nếu có thao tác chuột / bàn phím trong chừng này thời gian */
const ACTIVE_WINDOW_MS = 3 * 60_000;
/** Làm mới vị trí định kỳ; vị trí cũ hơn mức này thì coi như chưa có */
const GEO_REFRESH_MS = 2 * 60_000;
const GEO_MAX_AGE_MS = 5 * 60_000;

const INTERACTION_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'wheel', 'click'] as const;

type GeoState = 'pending' | 'granted' | 'denied' | 'unavailable';
type Phase = 'working' | 'idle' | 'hidden';

interface Position {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

/** Điện thoại và máy tính bảng không tính công (server cũng chặn theo User-Agent) */
function detectMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData?.mobile) return true;
  if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua)) return true;
  // iPad mới giả danh Mac: có màn hình cảm ứng đa điểm
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

const hm = (minutes: number) => `${Math.floor(minutes / 60)}g${String(minutes % 60).padStart(2, '0')}`;

const REASON_TEXT: Record<BeatReason, { text: string; tone: 'warn' | 'bad' | 'off' }> = {
  ok: { text: '', tone: 'off' },
  not_staff: { text: 'Tài khoản quản trị không chấm công', tone: 'off' },
  mobile: { text: 'Điện thoại không tính công', tone: 'off' },
  not_configured: { text: 'Công ty chưa cài vị trí', tone: 'warn' },
  no_location: { text: 'Chưa lấy được vị trí', tone: 'warn' },
  low_accuracy: { text: 'Định vị chưa đủ chính xác', tone: 'warn' },
  out_of_range: { text: 'Ngoài khu vực công ty', tone: 'bad' },
};

const TONE_CLASS = {
  good: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  warn: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  bad: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
  off: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
} as const;

/**
 * Chấm công cho nhân viên: theo dõi thao tác thật + vị trí ở máy tính, báo lên server mỗi 30 giây,
 * và hiện trạng thái ở đầu trang để nhân viên biết mình có đang được tính công không.
 * Mở ra là trình duyệt hỏi quyền vị trí (tức "lúc đăng nhập"); phải cho phép thì mới tính công.
 */
export function AttendanceChip() {
  const [mobile] = useState(detectMobile);
  const [geo, setGeo] = useState<GeoState>('pending');
  const [phase, setPhase] = useState<Phase>('working');
  const [result, setResult] = useState<HeartbeatResult | null>(null);

  const { data: today } = useMyAttendanceToday(!mobile);
  const lastInteraction = useRef(Date.now());
  const position = useRef<Position | null>(null);

  // Ghi nhận thao tác thật (chuột, bàn phím, cuộn)
  useEffect(() => {
    if (mobile) return;
    const mark = () => {
      lastInteraction.current = Date.now();
    };
    for (const e of INTERACTION_EVENTS) window.addEventListener(e, mark, { passive: true });
    return () => {
      for (const e of INTERACTION_EVENTS) window.removeEventListener(e, mark);
    };
  }, [mobile]);

  // Lấy và làm mới vị trí
  useEffect(() => {
    if (mobile) return;
    if (!('geolocation' in navigator)) {
      setGeo('unavailable');
      return;
    }
    const locate = () =>
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          position.current = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            at: Date.now(),
          };
          setGeo('granted');
        },
        (err) => {
          // Mã 1 = người dùng từ chối quyền; lỗi khác (mất tín hiệu, hết thời gian) thì thử lại lần sau
          setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
        },
        { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 },
      );
    locate();
    const timer = setInterval(locate, GEO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [mobile]);

  const beat = useCallback(async () => {
    const visible = document.visibilityState === 'visible';
    const active = Date.now() - lastInteraction.current < ACTIVE_WINDOW_MS;
    setPhase(!visible ? 'hidden' : active ? 'working' : 'idle');
    // Không thao tác hoặc tab đang ẩn thì không báo gì: phút đó không được tính
    if (!visible || !active) return;
    const pos = position.current && Date.now() - position.current.at < GEO_MAX_AGE_MS ? position.current : null;
    try {
      setResult(
        await attendanceApi.heartbeat(pos ? { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy } : {}),
      );
    } catch {
      // Mất mạng hoặc server lỗi: bỏ qua, lượt sau thử lại
    }
  }, []);

  useEffect(() => {
    if (mobile) return;
    const first = setTimeout(beat, 4_000); // chờ định vị lần đầu xong
    const timer = setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => void beat();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [mobile, beat]);

  const status = result ?? today ?? null;
  const minutes = status?.minutesToday ?? 0;
  const full = status?.fullMinutes ?? 420;

  let tone: keyof typeof TONE_CLASS = 'off';
  let text = 'Đang kiểm tra...';
  let detail = '';
  if (mobile) {
    text = 'Điện thoại không tính công';
  } else if (geo === 'denied') {
    tone = 'warn';
    text = 'Hãy cho phép định vị để tính công';
    detail = 'Trình duyệt đang chặn vị trí. Bấm biểu tượng ổ khóa cạnh địa chỉ web, chọn Cho phép Vị trí rồi tải lại trang.';
  } else if (phase === 'hidden') {
    text = 'Tạm dừng · đang ở tab khác';
  } else if (phase === 'idle') {
    text = 'Tạm dừng · chưa thao tác';
    detail = 'Cần có thao tác chuột hoặc bàn phím trong vòng 3 phút gần nhất.';
  } else if (result) {
    if (result.counted) {
      tone = 'good';
      text = 'Đang tính công';
    } else {
      const r = REASON_TEXT[result.reason];
      tone = r.tone;
      text = r.text;
      if (result.reason === 'out_of_range' && result.distanceM !== null) {
        detail = `Bạn đang cách vị trí công ty khoảng ${result.distanceM} mét.`;
      }
    }
  } else if (geo === 'unavailable') {
    tone = 'warn';
    text = 'Chưa lấy được vị trí';
  }

  const tooltip = [
    `Hôm nay: ${hm(minutes)} / ${hm(full)} (từ ${hm(full)} được 1 công)`,
    detail,
    'Chỉ tính phút có thao tác thật, trên máy tính, tại công ty.',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${TONE_CLASS[tone]}`}
    >
      <MapPinLine size={14} weight="fill" aria-hidden />
      <span>{text}</span>
      {!mobile && (
        <span className="tnum border-l border-current/30 pl-1.5 font-black opacity-90">
          {hm(minutes)}/{hm(full)}
        </span>
      )}
    </span>
  );
}
