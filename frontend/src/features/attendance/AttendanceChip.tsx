'use client';

import { useCallback, useEffect, useState } from 'react';
import { Circle } from '@phosphor-icons/react';
import { attendanceApi } from './api';
import { useMyAttendanceToday } from './hooks';
import type { HeartbeatResult } from './types';

/** Gửi một lượt báo online mỗi 60 giây (server gộp theo phút) */
const HEARTBEAT_MS = 60_000;

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
  const [result, setResult] = useState<HeartbeatResult | null>(null);

  const { data: today } = useMyAttendanceToday(true);

  const beat = useCallback(async () => {
    try {
      setResult(await attendanceApi.heartbeat());
    } catch {
      // Mất mạng hoặc lỗi server: bỏ qua, không báo lỗi lớn cho người dùng
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(beat, 2_000);
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
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

  if (result && !result.counted) {
    tone = 'off';
    statusText = 'Quản trị viên';
  }

  const tooltip = [
    `Thời gian online hôm nay: ${hm(minutes)}`,
    `Mốc tính công: đủ ${hm(half)} = 0,5 công · đủ ${hm(full)} = 1 công (hiện đạt ${congText(cong)} công)`,
    'Giờ tính từ lần đăng nhập đầu tiên trong ngày; đăng nhập/đăng xuất nhiều lần vẫn tính từ lần đầu.',
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
          className={tone === 'good' ? 'text-emerald-500' : 'text-slate-400'}
        />
      </span>
      <span>{statusText}</span>
      <span className="tnum border-l border-current/30 pl-1.5 font-black opacity-90">
        {mocProgress}
      </span>
    </span>
  );
}
