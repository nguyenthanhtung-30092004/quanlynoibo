'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, UserCheck } from '@phosphor-icons/react';
import { attendanceApi } from './api';
import { useMyAttendanceToday } from './hooks';
import type { HeartbeatResult } from './types';

/** Gửi một lượt báo online mỗi 60 giây (server gộp theo phút) */
const HEARTBEAT_MS = 60_000;
/** Coi là đang làm việc nếu có thao tác trong vòng 5 phút gần nhất */
const ACTIVE_WINDOW_MS = 5 * 60_000;

const INTERACTION_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'wheel',
  'click',
  'touchstart',
  'touchend',
] as const;

type Phase = 'working' | 'idle' | 'hidden';

const hm = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}g` : `${h}g${String(m).padStart(2, '0')}`;
};

const congText = (c: number) => (c === 0.5 ? '0,5' : String(c));

const TONE_CLASS = {
  good: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  warn: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  off: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
} as const;

export function AttendanceChip() {
  const [phase, setPhase] = useState<Phase>('working');
  const [result, setResult] = useState<HeartbeatResult | null>(null);

  const { data: today } = useMyAttendanceToday(true);
  const lastInteraction = useRef(Date.now());

  // Ghi nhận thao tác thật của người dùng (chuột, bàn phím, cuộn, chạm màn hình)
  useEffect(() => {
    const mark = () => {
      lastInteraction.current = Date.now();
    };
    for (const e of INTERACTION_EVENTS) window.addEventListener(e, mark, { passive: true });
    return () => {
      for (const e of INTERACTION_EVENTS) window.removeEventListener(e, mark);
    };
  }, []);

  const beat = useCallback(async () => {
    const visible = document.visibilityState === 'visible';
    const active = Date.now() - lastInteraction.current < ACTIVE_WINDOW_MS;
    setPhase(!visible ? 'hidden' : active ? 'working' : 'idle');

    try {
      setResult(await attendanceApi.heartbeat({ active: visible && active }));
    } catch {
      // Mất mạng hoặc lỗi server: bỏ qua, không báo lỗi lớn cho người dùng
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(beat, 2_000);
    const timer = setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => void beat();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [beat]);

  const status = result ?? today ?? null;
  const minutes = status?.minutesToday ?? 0;
  const full = status?.fullMinutes ?? 480;
  const half = status?.halfMinutes ?? 240;
  const cong = status?.congToday ?? 0;

  const targetMoc = minutes < half && half > 0 ? half : full;
  const mocProgress = `${hm(minutes)} / ${hm(targetMoc)} · ${congText(cong)} công`;

  let tone: keyof typeof TONE_CLASS = 'good';
  let statusText = 'Đang online';
  let detail = '';

  if (phase === 'hidden') {
    tone = 'off';
    statusText = 'Tạm dừng · tab khác';
    detail = 'Trình duyệt đang ở tab khác nên tạm dừng tính giờ.';
  } else if (phase === 'idle') {
    tone = 'warn';
    statusText = 'Tạm dừng · chưa thao tác';
    detail = 'Cần có thao tác chuột hoặc bàn phím trong vòng 5 phút gần nhất để tính giờ.';
  } else if (result && !result.counted) {
    if (result.reason === 'not_staff') {
      tone = 'off';
      statusText = 'Quản trị viên';
    } else {
      tone = 'warn';
      statusText = 'Chưa tính';
    }
  }

  const tooltip = [
    `Thời gian online hôm nay: ${hm(minutes)}`,
    `Mốc tính công: đủ ${hm(half)} = 0,5 công · đủ ${hm(full)} = 1 công (hiện đạt ${congText(cong)} công)`,
    detail,
    'Hệ thống tự động tính công khi có thao tác thật trong 5 phút gần nhất.',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${TONE_CLASS[tone]}`}
    >
      <span className="relative flex size-2 items-center justify-center">
        {tone === 'good' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <Circle
          size={8}
          weight="fill"
          className={
            tone === 'good' ? 'text-emerald-500' : tone === 'warn' ? 'text-amber-500' : 'text-slate-400'
          }
        />
      </span>
      <span>{statusText}</span>
      <span className="tnum border-l border-current/30 pl-1.5 font-black opacity-90">
        {mocProgress}
      </span>
    </span>
  );
}
