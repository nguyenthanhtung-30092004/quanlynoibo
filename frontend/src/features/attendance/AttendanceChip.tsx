'use client';

import { useEffect, useState } from 'react';
import { Circle } from '@phosphor-icons/react';
import { durationText } from './format';
import { useMyAttendanceToday } from './hooks';

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso));

/** 11_565_000 ms -> "3:12:45" */
const clock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const congText = (c: number) => (c === 0.5 ? '0,5' : String(c));

const TONE_CLASS = {
  good: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  warn: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  off: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
} as const;

/**
 * Chip chấm công ở header của nhân viên. Công tính theo lượt quẹt trên máy chấm công, không theo đăng nhập:
 * quẹt vào thì hiện giờ vào và chạy bộ đếm, quẹt ra thì chốt ca và số công.
 * Lượt quẹt mới đến qua realtime nên không cần tự hỏi server định kỳ.
 */
export function AttendanceChip() {
  const { data, dataUpdatedAt } = useMyAttendanceToday(true);
  const [tick, setTick] = useState(() => Date.now());

  const working = data?.status === 'working';
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [working]);

  if (!data) return null;

  // Đo độ lệch giữa đồng hồ máy chủ và máy nhân viên tại lúc nhận dữ liệu để bộ đếm đúng giờ
  const skew = Date.parse(data.serverNow) - dataUpdatedAt;

  let tone: keyof typeof TONE_CLASS = 'off';
  let statusText = 'Chưa chấm công';
  let detail: string | null = null;

  if (data.status === 'working' && data.punchedInAt) {
    tone = 'good';
    statusText = `Đã chấm vào lúc ${timeOf(data.punchedInAt)}`;
    detail = clock(tick + skew - Date.parse(data.punchedInAt));
  } else if (data.status === 'done' && data.punchedInAt && data.punchedOutAt) {
    tone = data.lateMinutes > 0 || data.earlyLeaveMinutes > 0 ? 'warn' : 'good';
    statusText = `Vào ${timeOf(data.punchedInAt)} · Ra ${timeOf(data.punchedOutAt)}`;
    detail = `ca ${data.shift} · ${congText(data.cong)} công`;
  }

  const tooltip = [
    data.status === 'done'
      ? `Ca làm: ${data.shift}. Tính ${durationText(data.minutes)} trong ca → ${congText(data.cong)} công.`
      : 'Công tính theo lượt quẹt trên máy chấm công: lượt đầu là giờ vào, lượt cuối là giờ ra.',
    data.lateMinutes > 0 ? `Vào muộn ${durationText(data.lateMinutes)} so với đầu ca.` : '',
    data.earlyLeaveMinutes > 0 ? `Ra sớm ${durationText(data.earlyLeaveMinutes)} so với cuối ca.` : '',
    'Ở lại quá giờ cuối ca vẫn chỉ tính theo ca (tối đa 1 công).',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${TONE_CLASS[tone]}`}
    >
      <span className="relative flex size-2 items-center justify-center">
        {working && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <Circle size={8} weight="fill" className={tone === 'off' ? 'text-slate-400' : 'text-emerald-500'} />
      </span>
      <span>{statusText}</span>
      {detail && <span className="tnum border-l border-current/30 pl-1.5 font-black opacity-90">{detail}</span>}
    </span>
  );
}
