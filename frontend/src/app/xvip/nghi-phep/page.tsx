'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  ClockCounterClockwise,
  FloppyDisk,
  Lock,
  LockOpen,
  MagnifyingGlass,
  Money,
  SlidersHorizontal,
  Trash,
  Warning,
  X,
} from '@phosphor-icons/react';
import { ApiError } from '@/lib/api-client';
import { monthLabel, shiftMonth } from '@/lib/month';
import { getVnToday } from '@/lib/time';
import { useCurrentUser } from '@/features/auth/hooks';
import { useActiveStaff } from '@/features/users/hooks';
import {
  useLeaveHistory,
  useLeaveMonth,
  useRegisterLeave,
  useRegisterLeaveForStaff,
  useRemoveLeave,
  useSaveLeaveConfig,
  useSetDayLimit,
  useSetPayday,
} from '@/features/leave/hooks';
import type { LeaveConfig, LeaveDay, LeaveHistoryEntry } from '@/features/leave/types';
import { Modal } from '@/features/xvip/Modal';
import { useToast } from '@/features/xvip/toast';
import { Avatar, Card, PageTitle } from '@/features/xvip/ui';

// Lịch xếp thứ 2 đầu tuần: cột 0 = T2 ... cột 6 = CN
const HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_NAME = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const weekdayOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const isLateWeekDay = (day: string) => [5, 6, 0].includes(weekdayOf(day));
const columnOf = (day: string) => (weekdayOf(day) + 6) % 7;
const dayLabel = (day: string) => `${WEEKDAY_NAME[weekdayOf(day)]}, ${Number(day.slice(8))}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

/** ISO -> 'HH:mm DD/MM/YYYY' theo giờ Việt Nam */
function formatFull(iso: string): string {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')} ngày ${get('day')}/${get('month')}/${get('year')}`;
}

const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export default function LeavePage() {
  const showToast = useToast();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';
  const [month, setMonth] = useState(() => getVnToday().slice(0, 7));
  const { data, isLoading, isError, error, refetch } = useLeaveMonth(month);
  const registerLeave = useRegisterLeave();
  const registerForStaff = useRegisterLeaveForStaff();
  const { data: activeStaff = [] } = useActiveStaff(isAdmin);
  const removeLeave = useRemoveLeave();
  const saveConfig = useSaveLeaveConfig();
  const setDayLimit = useSetDayLimit();
  const setPayday = useSetPayday();

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const selected = data?.days.find((d) => d.day === selectedDay) ?? null;
  const today = data?.today ?? getVnToday();
  // Nhân viên chỉ tự đăng ký từ ngày kia (hôm nay đi làm thì không xin nghỉ ngày mai)
  const staffFirstDay = data?.staffFirstDay ?? today;
  // Ngày nhận lương trong tháng đang xem, để liệt kê ngay dưới lịch
  const paydays = data?.days.filter((d) => d.payday).map((d) => d.day) ?? [];

  // Giới hạn mặc định đang sửa (Admin)
  const [draft, setDraft] = useState<{ earlyMax: string; lateMax: string } | null>(null);
  const configKey = data ? JSON.stringify(data.config) : '';
  useEffect(() => {
    if (data) setDraft({ earlyMax: String(data.config.earlyMax), lateMax: String(data.config.lateMax) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  const draftDirty =
    !!data && !!draft && (draft.earlyMax !== String(data.config.earlyMax) || draft.lateMax !== String(data.config.lateMax));

  const saveDefaults = async () => {
    if (!draft) return;
    const config: LeaveConfig = { earlyMax: Number(draft.earlyMax), lateMax: Number(draft.lateMax) };
    if (![config.earlyMax, config.lateMax].every((n) => Number.isInteger(n) && n >= 0 && n <= 100)) {
      showToast('Lỗi: số người nghỉ phải là số nguyên từ 0 đến 100.');
      return;
    }
    try {
      await saveConfig.mutateAsync(config);
    } catch (err) {
      showToast(`Lỗi: ${errText(err, 'Không lưu được giới hạn.')}`);
    }
  };

  // Ô trống đầu tháng để ngày 1 rơi đúng cột thứ
  const leadingBlanks = data && data.days.length > 0 ? columnOf(data.days[0].day) : 0;

  const register = async (day: string) => {
    try {
      await registerLeave.mutateAsync(day);
      setSelectedDay(null);
    } catch (err) {
      showToast(`Lỗi: ${errText(err, 'Không đăng ký được.')}`);
    }
  };

  // Tổng hợp số ngày nghỉ của từng người trong tháng đang xem
  const summary = useMemo(() => {
    const byUser = new Map<
      number,
      { userId: number; fullName: string; days: number; urgent: number; dates: { day: string; urgent: boolean }[] }
    >();
    for (const d of data?.days ?? []) {
      for (const p of d.people) {
        const cur = byUser.get(p.userId) ?? { userId: p.userId, fullName: p.fullName, days: 0, urgent: 0, dates: [] };
        cur.days += 1;
        if (p.urgent) cur.urgent += 1;
        cur.dates.push({ day: d.day, urgent: p.urgent });
        byUser.set(p.userId, cur);
      }
    }
    return [...byUser.values()].sort((a, b) => b.days - a.days || a.fullName.localeCompare(b.fullName, 'vi'));
  }, [data]);
  const totalLeave = summary.reduce((n, s) => n + s.days, 0);
  const totalUrgent = summary.reduce((n, s) => n + s.urgent, 0);
  const quota = data?.quota ?? 4;
  const myDaysThisMonth = data?.days.filter((d) => d.mine).length ?? 0;

  /**
   * Admin đăng ký hộ nhiều nhân viên: gửi lần lượt từng người (máy chủ kiểm tra giới hạn theo từng lượt).
   * Trả về những người chưa đăng ký được; giữ nguyên cửa sổ để thấy ngay người vừa thêm
   */
  const registerStaff = async (day: string, userIds: number[]) => {
    const failed: number[] = [];
    let firstError = '';
    let urgent = false;
    for (const userId of userIds) {
      try {
        const res = await registerForStaff.mutateAsync({ day, userId });
        urgent = res.urgent;
      } catch (err) {
        failed.push(userId);
        firstError ||= errText(err, 'Không đăng ký được.');
      }
    }
    const done = userIds.length - failed.length;
    if (failed.length === 0) {
      showToast(urgent ? `Đã ghi nhận ${done} người nghỉ đột xuất.` : `Đã đăng ký nghỉ cho ${done} người.`);
    } else {
      showToast(`Đăng ký được ${done}/${userIds.length} người. Lỗi: ${firstError}`);
    }
    return failed;
  };

  const cancel = async (requestId: number) => {
    try {
      await removeLeave.mutateAsync(requestId);
      return true;
    } catch (err) {
      showToast(`Lỗi: ${errText(err, 'Không hủy được.')}`);
      return false;
    }
  };

  const changePayday = async (day: string, payday: boolean) => {
    try {
      await setPayday.mutateAsync({ day, payday });
      showToast(payday ? 'Đã đặt ngày nhận lương.' : 'Đã bỏ ngày nhận lương.');
    } catch (err) {
      showToast(`Lỗi: ${errText(err, 'Không lưu được ngày nhận lương.')}`);
    }
  };

  const changeLimit = async (day: string, max: number | null) => {
    try {
      await setDayLimit.mutateAsync({ day, max });
    } catch (err) {
      showToast(`Lỗi: ${errText(err, 'Không chỉnh được giới hạn.')}`);
    }
  };

  return (
    <>
      <PageTitle
        actions={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="btn-3d btn-3d-white px-2.5 py-2"
              aria-label="Tháng trước"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <span className="min-w-32 text-center text-sm font-extrabold text-slate-800 dark:text-white">
              {monthLabel(month)}
            </span>
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              className="btn-3d btn-3d-white px-2.5 py-2"
              aria-label="Tháng sau"
            >
              <CaretRight size={16} weight="bold" />
            </button>
          </div>
        }
      >
        Đăng ký nghỉ
      </PageTitle>

      <Card title={isAdmin ? 'Lịch nghỉ của nhân viên' : 'Chọn ngày muốn nghỉ'} className="mb-5">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-500">Đang tải lịch...</p>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-rose-600">
            {errText(error, 'Không tải được lịch đăng ký nghỉ.')}{' '}
            <button type="button" onClick={() => refetch()} className="font-bold underline">
              Thử lại
            </button>
          </p>
        ) : (
          <>
            {paydays.length > 0 && <PaydayBanner days={paydays} today={today} />}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {HEADERS.map((h, i) => (
                <div
                  key={h}
                  className={`pb-1 text-center text-xs font-extrabold ${
                    i >= 4 ? 'text-orange-600 dark:text-orange-400' : 'text-sky-700 dark:text-sky-400'
                  }`}
                >
                  {h}
                </div>
              ))}
              {Array.from({ length: leadingBlanks }, (_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {data?.days.map((d) => (
                <DayCell
                  key={d.day}
                  d={d}
                  dimBefore={isAdmin ? today : staffFirstDay}
                  today={today}
                  onClick={() => setSelectedDay(d.day)}
                />
              ))}
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <Legend className="bg-sky-100 ring-1 ring-sky-300 dark:bg-sky-900/40 dark:ring-sky-700" text="Đầu tuần (T2-T5)" />
                <Legend className="bg-orange-100 ring-1 ring-orange-300 dark:bg-orange-900/40 dark:ring-orange-700" text="Cuối tuần (T6-CN)" />
                <Legend className="bg-violet-100 ring-1 ring-violet-300 dark:bg-violet-900/40 dark:ring-violet-700" text="Đã có người đăng ký" />
                {!isAdmin && <Legend className="bg-violet-600" text="Ngày bạn đã đăng ký (tím đậm)" />}
                <Legend className="bg-gradient-to-br from-amber-300 to-yellow-500 ring-1 ring-amber-500" text="Ngày nhận lương" />
              </div>
              <div>
                Số <b className="text-emerald-600 dark:text-emerald-400">xanh</b> còn chỗ ·{' '}
                <b className="text-amber-600 dark:text-amber-400">vàng</b> gần đủ ·{' '}
                <b className="text-rose-600 dark:text-rose-400">đỏ</b> đã đủ người
              </div>
            </div>
          </>
        )}
      </Card>

      {isAdmin && (
        <Card title="Giới hạn số người nghỉ mỗi ngày" className="mb-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Đầu tuần (T2, T3, T4, T5) - màu xanh trời">
              <input
                type="number"
                min={0}
                max={100}
                className="input-3d !h-10"
                value={draft?.earlyMax ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, earlyMax: e.target.value } : d))}
              />
            </Field>
            <Field label="Cuối tuần (T6, T7, CN) - màu cam">
              <input
                type="number"
                min={0}
                max={100}
                className="input-3d !h-10"
                value={draft?.lateMax ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, lateMax: e.target.value } : d))}
              />
            </Field>
            <button
              type="button"
              onClick={saveDefaults}
              disabled={!draftDirty || saveConfig.isPending}
              className="btn-3d btn-3d-blue inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
            >
              <FloppyDisk size={16} weight="bold" />
              {saveConfig.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Thiếu người thì hạ số này xuống. Muốn chỉnh riêng một ngày hoặc khóa hẳn ngày đó, bấm vào ngày trên lịch.
          </p>
        </Card>
      )}

      <Card title={`Bảng tổng hợp nghỉ ${monthLabel(month).toLowerCase()}`} className="mb-5">
        {summary.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Tháng này chưa có ai đăng ký nghỉ.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <b className="tnum">{summary.length}</b> người nghỉ
              </span>
              <span className="rounded-full bg-violet-50 px-3 py-1 font-bold text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30">
                Tổng <b className="tnum">{totalLeave}</b> buổi nghỉ
              </span>
              <span className="rounded-full bg-rose-50 px-3 py-1 font-bold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30">
                Trong đó <b className="tnum">{totalUrgent}</b> buổi đột xuất
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] table-fixed text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-extrabold uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="w-[28%] py-2 text-left">Nhân viên</th>
                    <th className="w-[14%] py-2 text-center">Số buổi nghỉ</th>
                    <th className="w-[14%] py-2 text-center">Đột xuất</th>
                    <th className="py-2 text-left">Các ngày nghỉ</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => {
                    const over = s.days > quota;
                    return (
                      <tr
                        key={s.userId}
                        className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                          over ? 'bg-rose-50/60 dark:bg-rose-950/30' : ''
                        }`}
                      >
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={s.fullName} />
                            <span className="min-w-0 break-words font-bold text-slate-900 dark:text-white">{s.fullName}</span>
                          </div>
                        </td>
                        <td
                          className={`py-2 text-center font-black tnum ${
                            over ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {s.days}/{quota}
                          {over && <Warning size={14} weight="fill" className="ml-1 inline" />}
                        </td>
                        <td className="py-2 text-center">
                          {s.urgent > 0 ? (
                            <span className="inline-block rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-black tnum text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                              {s.urgent}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1.5">
                            {s.dates.map((x) => (
                              <span
                                key={x.day}
                                className={`rounded-md px-2 py-0.5 text-xs font-bold tnum ${
                                  x.urgent
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                }`}
                                title={x.urgent ? 'Nghỉ đột xuất' : undefined}
                              >
                                {x.day.slice(8)}/{x.day.slice(5, 7)}
                                {x.urgent && ' · đột xuất'}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Mỗi người được nghỉ tối đa {quota} buổi/tháng. Ai vượt sẽ được đánh dấu đỏ. Ngày nghỉ đột xuất hiện màu đỏ.
        </p>
      </Card>

      {selected && (
        <Modal title={dayLabel(selected.day)} onClose={() => setSelectedDay(null)}>
          <DayDetail
            day={selected}
            today={today}
            isAdmin={isAdmin}
            meId={me?.id}
            staffFirstDay={staffFirstDay}
            myDays={myDaysThisMonth}
            quota={quota}
            defaultLimit={isLateWeekDay(selected.day) ? data!.config.lateMax : data!.config.earlyMax}
            staff={activeStaff}
            busy={{
              leave: registerLeave.isPending || removeLeave.isPending || registerForStaff.isPending,
              limit: setDayLimit.isPending,
              payday: setPayday.isPending,
            }}
            onRegister={() => register(selected.day)}
            onRegisterStaff={(ids) => registerStaff(selected.day, ids)}
            onCancel={async (id, closeAfter) => {
              if ((await cancel(id)) && closeAfter) setSelectedDay(null);
            }}
            onChangeLimit={(max) => changeLimit(selected.day, max)}
            onSetPayday={(on) => changePayday(selected.day, on)}
          />
        </Modal>
      )}
    </>
  );
}

function Legend({ className, text }: { className: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-3 rounded ${className}`} />
      {text}
    </span>
  );
}

/** "còn 3 ngày", "HÔM NAY", "đã qua" cho ngày nhận lương */
function paydayCountdown(day: string, today: string): string {
  const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (diff === 0) return 'HÔM NAY nhận lương!';
  if (diff === 1) return 'Ngày mai nhận lương';
  if (diff > 1) return `Còn ${diff} ngày nữa nhận lương`;
  return 'Đã qua';
}

/** Băng rôn đầu lịch: ngày nhận lương trong tháng đang xem */
function PaydayBanner({ days, today }: { days: string[]; today: string }) {
  // Ưu tiên ngày lương sắp tới (hoặc hôm nay); hết rồi thì hiện ngày gần nhất đã qua
  const upcoming = days.find((d) => d >= today);
  const main = upcoming ?? days[days.length - 1];
  const isToday = main === today;
  return (
    <div
      className={`relative mb-4 overflow-hidden rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 px-4 py-3 text-amber-950 ring-2 ring-amber-400 ${
        upcoming ? 'shadow-[0_0_24px_rgba(245,158,11,0.45)]' : 'opacity-70'
      }`}
    >
      <Money size={72} weight="fill" className="absolute -right-3 -top-3 rotate-12 text-white/30" />
      <div className="relative flex items-center gap-3">
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-white/85 text-amber-600 shadow">
          {isToday && <span className="absolute inset-0 animate-ping rounded-full bg-white/70" />}
          <Money size={26} weight="fill" className="relative" />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-widest">Ngày nhận lương</div>
          <div className="text-base font-black sm:text-lg">{dayLabel(main)}</div>
          <div className="text-sm font-bold">{paydayCountdown(main, today)}</div>
          {days.length > 1 && (
            <div className="mt-0.5 text-xs font-semibold">
              Tháng này: {days.map((d) => `${Number(d.slice(8))}/${d.slice(5, 7)}`).join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DayCell({
  d,
  dimBefore,
  today,
  onClick,
}: {
  d: LeaveDay;
  dimBefore: string;
  today: string;
  onClick: () => void;
}) {
  // Ngày không đăng ký được nữa thì làm mờ: nhân viên là trước ngày kia, Admin là trước hôm nay.
  // Riêng ngày nhận lương chỉ mờ khi đã qua, để hôm nay / ngày mai nhận lương vẫn nổi bật
  const past = d.payday ? d.day < today : d.day < dimBefore;
  const locked = d.limit === 0;
  const full = d.count >= d.limit;
  const almost = !full && d.limit > 0 && d.count >= d.limit - 1;
  // Màu nền phân biệt nhóm ngày: đầu tuần (T2-T5) xanh trời, cuối tuần (T6-CN) cam
  const late = weekdayOf(d.day) === 5 || weekdayOf(d.day) === 6 || weekdayOf(d.day) === 0;
  const base = late
    ? 'bg-orange-100 text-orange-950 ring-1 ring-orange-300 dark:bg-orange-900/40 dark:text-orange-50 dark:ring-orange-700'
    : 'bg-sky-100 text-sky-950 ring-1 ring-sky-300 dark:bg-sky-900/40 dark:text-sky-50 dark:ring-sky-700';
  // Ngày đã có người đăng ký nghỉ: một màu chung, không phân đầu/cuối tuần nữa
  const taken = 'bg-violet-100 text-violet-950 ring-1 ring-violet-300 dark:bg-violet-900/40 dark:text-violet-50 dark:ring-violet-700';
  // Ngày mình đã đăng ký: cùng tông nhưng đậm hơn
  const mine = 'bg-violet-600 text-white ring-1 ring-violet-700';
  // Ngày nhận lương: vàng kim phát sáng, nổi nhất lịch
  const payday =
    'z-10 scale-[1.06] bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-amber-950 ring-2 ring-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.75)]';
  // Tình trạng chỗ trống thể hiện ở màu chữ của số lượng
  const countTone = d.payday
    ? full || locked
      ? 'bg-white/90 text-rose-600'
      : almost
        ? 'bg-white/90 text-amber-700'
        : 'bg-white/90 text-emerald-700'
    : d.mine
      ? 'text-white'
      : full || locked
        ? 'text-rose-600 dark:text-rose-400'
        : almost
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-emerald-600 dark:text-emerald-400';
  return (
    <button
      type="button"
      onClick={onClick}
      title={d.payday ? 'Ngày nhận lương' : undefined}
      className={`relative flex min-h-14 flex-col items-center justify-center rounded-lg px-1 py-1.5 transition-transform hover:scale-[1.08] sm:min-h-16 ${
        d.payday ? payday : d.mine ? mine : d.count > 0 ? taken : base
      } ${past ? 'opacity-50' : ''}`}
    >
      {d.payday && (
        <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-white text-amber-600 shadow ring-2 ring-amber-400 sm:size-6">
          {d.day === today && <span className="absolute inset-0 animate-ping rounded-full bg-amber-300" />}
          <Money size={13} weight="fill" className="relative" />
        </span>
      )}
      {/* Ngày nhận lương mà mình cũng đăng ký nghỉ: chấm tím nhỏ để vẫn nhận ra */}
      {d.payday && d.mine && <span className="absolute left-1 top-1 size-2 rounded-full bg-violet-600 ring-1 ring-white" />}
      <span className="tnum text-sm font-black sm:text-base">{Number(d.day.slice(8))}</span>
      {d.payday && <span className="text-[9px] font-black uppercase leading-none tracking-wider sm:text-[10px]">Lương</span>}
      <span className={`tnum mt-0.5 rounded px-1 text-[11px] font-extrabold leading-none sm:text-xs ${countTone}`}>
        {locked ? <Lock size={12} weight="bold" className="inline" /> : `${d.count}/${d.limit}`}
      </span>
    </button>
  );
}

/** Nhãn nghỉ đột xuất, ghi bằng chữ để ai nhìn vào cũng hiểu */
function UrgentBadge() {
  return (
    <span className="shrink-0 rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
      Nghỉ đột xuất
    </span>
  );
}

/** Bỏ dấu tiếng Việt để tìm "thanh" vẫn ra "Thành" */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

type Tone = 'violet' | 'amber' | 'slate';
const TONE: Record<Tone, { icon: string; ring: string }> = {
  violet: {
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    ring: 'border-violet-200 dark:border-violet-900/60',
  },
  amber: {
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    ring: 'border-amber-300 dark:border-amber-800/60',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    ring: 'border-slate-200 dark:border-slate-700',
  },
};

/** Một khối nội dung trong cửa sổ chi tiết ngày: biểu tượng + tiêu đề + nội dung */
function Section({
  icon,
  title,
  aside,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  aside?: React.ReactNode;
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border bg-white p-3.5 dark:bg-slate-900/40 ${TONE[tone].ring}`}>
      <header className="mb-3 flex items-center gap-2.5">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONE[tone].icon}`}>{icon}</span>
        <h3 className="min-w-0 flex-1 text-sm font-black text-slate-900 dark:text-white">{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Ô thống kê nhỏ ở đầu cửa sổ */
function StatTile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 dark:bg-slate-800/50 dark:ring-slate-700">
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`tnum text-xl font-black leading-tight ${tone}`}>{value}</div>
      {sub && <div className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

function PersonRow({ name, children, sub }: { name: string; children?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Avatar name={name} />
      <span className="min-w-0 flex-1 break-words text-sm font-bold text-slate-900 dark:text-white">
        {name}
        {sub && <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">{sub}</span>}
      </span>
      {children}
    </li>
  );
}

/** Nút xóa bấm 2 lần mới chạy, tránh bấm nhầm */
function ConfirmRemoveButton({ label, busy, onConfirm }: { label: string; busy: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      onBlur={() => setArmed(false)}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
    >
      <Trash size={13} weight="bold" />
      {armed ? 'Bấm lần nữa' : label}
    </button>
  );
}

interface DayDetailProps {
  day: LeaveDay;
  today: string;
  isAdmin: boolean;
  meId?: number;
  /** Ngày sớm nhất nhân viên được tự đăng ký */
  staffFirstDay: string;
  myDays: number;
  quota: number;
  defaultLimit: number;
  staff: Array<{ id: number; fullName: string }>;
  busy: { leave: boolean; limit: boolean; payday: boolean };
  onRegister: () => void;
  /** Trả về những người chưa đăng ký được */
  onRegisterStaff: (userIds: number[]) => Promise<number[]>;
  onCancel: (requestId: number, closeAfter: boolean) => void;
  onChangeLimit: (max: number | null) => void;
  onSetPayday: (payday: boolean) => void;
}

/** Nội dung cửa sổ khi bấm vào một ngày trên lịch */
function DayDetail(p: DayDetailProps) {
  const { day, today, isAdmin } = p;
  const past = day.day < today;
  const locked = day.limit === 0;
  const full = !locked && day.count >= day.limit;
  const almost = !full && !locked && day.count >= day.limit - 1;
  const leaveTone = locked || full ? 'text-rose-600 dark:text-rose-400' : almost ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
  const leaveSub = locked ? 'Đã khóa ngày' : full ? 'Đã đủ người' : `Còn ${day.limit - day.count} chỗ`;
  const tag = past ? 'Đã qua' : day.day === today ? 'Hôm nay' : isLateWeekDay(day.day) ? 'Cuối tuần (T6-CN)' : 'Đầu tuần (T2-T5)';

  return (
    <div className="space-y-3.5">
      {day.payday && (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 px-4 py-3.5 text-amber-950 shadow-[0_0_24px_rgba(245,158,11,0.45)] ring-2 ring-amber-400">
          <Money size={64} weight="fill" className="absolute -right-2 -top-2 rotate-12 text-white/30" />
          <div className="relative flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/80 text-amber-600 shadow">
              <Money size={26} weight="fill" />
            </span>
            <div>
              <div className="text-lg font-black uppercase tracking-wide">Ngày nhận lương</div>
              <div className="text-sm font-bold">{paydayCountdown(day.day, today)}</div>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
            past
              ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              : isLateWeekDay(day.day)
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
          }`}
        >
          {tag}
        </span>
        {day.customLimit && (
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-extrabold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
            Giới hạn chỉnh riêng
          </span>
        )}
      </div>

      <div className="flex gap-2.5">
        <StatTile
          label="Nghỉ phép"
          value={locked ? <Lock size={20} weight="bold" className="mt-1" /> : `${day.count}/${day.limit}`}
          sub={leaveSub}
          tone={leaveTone}
        />
      </div>

      <Section
        tone="violet"
        icon={<CalendarBlank size={17} weight="bold" />}
        title="Nghỉ phép"
        aside={<span className="tnum text-xs font-extrabold text-slate-500">{day.people.length} người</span>}
      >
        {isAdmin ? <AdminLeaveBlock {...p} /> : <StaffLeaveBlock {...p} />}
      </Section>

      {isAdmin && (
        <Section tone="amber" icon={<Money size={17} weight="fill" />} title="Ngày nhận lương">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">
              {day.payday
                ? 'Ngày này đang là ngày nhận lương, nhân viên thấy nổi bật trên lịch.'
                : 'Đặt làm ngày nhận lương để nhân viên thấy nổi bật trên lịch.'}
            </p>
            {day.payday ? (
              <ConfirmRemoveButton label="Bỏ ngày nhận lương" busy={p.busy.payday} onConfirm={() => p.onSetPayday(false)} />
            ) : (
              <button
                type="button"
                disabled={p.busy.payday}
                onClick={() => p.onSetPayday(true)}
                className="btn-3d btn-3d-amber inline-flex shrink-0 items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50"
              >
                <Money size={15} weight="fill" />
                Đặt làm ngày nhận lương
              </button>
            )}
          </div>
        </Section>
      )}

      {isAdmin && !past && (
        <details className="group rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900/40">
          <summary className="flex cursor-pointer list-none items-center gap-2.5">
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONE.slate.icon}`}>
              <SlidersHorizontal size={17} weight="bold" />
            </span>
            <span className="flex-1 text-sm font-black text-slate-900 dark:text-white">Giới hạn số người nghỉ ngày này</span>
            <CaretDown size={16} weight="bold" className="text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <LimitEditor day={day} defaultLimit={p.defaultLimit} busy={p.busy.limit} onChange={p.onChangeLimit} />
        </details>
      )}

      <HistoryPanel day={day.day} />
    </div>
  );
}

function StaffLeaveBlock({ day, today, staffFirstDay, meId, myDays, quota, busy, onRegister, onCancel }: DayDetailProps) {
  const [confirmOver, setConfirmOver] = useState(false);
  const full = day.count >= day.limit;
  const myRequestId = day.mine ? (day.people.find((x) => x.userId === meId)?.requestId ?? null) : null;
  const canCancel = myRequestId !== null && day.day > today;
  const wouldExceed = myDays >= quota;
  let note: string | null = null;
  if (day.mine) note = canCancel ? 'Bạn đã đăng ký nghỉ ngày này.' : 'Bạn đã đăng ký nghỉ ngày này (ngày đã tới nên không hủy được).';
  else if (day.day < today) note = 'Ngày này đã qua, không đăng ký được.';
  else if (day.day === today) note = 'Hôm nay không tự đăng ký được. Nghỉ đột xuất hãy báo quản lý để được ghi nhận.';
  else if (day.day < staffFirstDay) note = 'Hôm nay đi làm thì không xin nghỉ ngày mai được, bạn chỉ tự đăng ký từ ngày kia trở đi. Cần nghỉ gấp hãy báo quản lý.';
  else if (day.limit === 0) note = 'Quản lý đã khóa ngày này.';
  else if (full) note = 'Ngày này đã đủ người nghỉ, bạn chọn ngày khác nhé.';

  return (
    <>
      {day.people.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có ai đăng ký nghỉ ngày này.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {day.people.map((x) => (
            <PersonRow key={x.requestId ?? `auto-${x.userId}`} name={x.userId === meId ? `${x.fullName} (bạn)` : x.fullName}>
              {x.urgent && <UrgentBadge />}
            </PersonRow>
          ))}
        </ul>
      )}
      {note && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          {note}
        </p>
      )}
      {!day.mine && !note && wouldExceed && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Warning size={18} weight="fill" className="mt-0.5 shrink-0" />
          <span>
            Bạn đã đăng ký nghỉ {myDays}/{quota} ngày trong tháng này. Đăng ký thêm sẽ vượt số ngày cho phép.
          </span>
        </div>
      )}
      {(canCancel || !day.mine) && (
        <div className="mt-3 flex justify-end gap-2">
          {canCancel && myRequestId !== null && (
            <button
              type="button"
              disabled={busy.leave}
              onClick={() => onCancel(myRequestId, true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <Trash size={15} weight="bold" />
              Hủy đăng ký nghỉ
            </button>
          )}
          {!day.mine && (
            <button
              type="button"
              onClick={() => {
                if (wouldExceed && !confirmOver) {
                  setConfirmOver(true);
                  return;
                }
                onRegister();
              }}
              disabled={!!note || busy.leave}
              className="btn-3d btn-3d-blue px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {busy.leave ? 'Đang đăng ký...' : wouldExceed && confirmOver ? 'Vẫn đăng ký (vượt số ngày)' : 'Đăng ký nghỉ ngày này'}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function AdminLeaveBlock({ day, today, staff, busy, onRegisterStaff, onCancel }: DayDetailProps) {
  const past = day.day < today;
  const isToday = day.day === today;
  const registeredIds = new Set(day.people.map((x) => x.userId));
  const available = staff.filter((u) => !registeredIds.has(u.id));
  // Ngày sau hôm nay vẫn theo giới hạn số người; hôm nay là nghỉ đột xuất nên không giới hạn
  const slots = isToday ? undefined : Math.max(0, day.limit - day.count);

  return (
    <>
      {day.people.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có ai đăng ký nghỉ ngày này.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {day.people.map((x) => (
            <PersonRow
              key={x.requestId ?? `auto-${x.userId}`}
              name={x.fullName}
              sub={x.auto ? 'Không quẹt máy chấm công, hệ thống tự ghi nhận' : undefined}
            >
              {x.urgent && <UrgentBadge />}
              {x.requestId !== null && !past && (
                <ConfirmRemoveButton label="Hủy" busy={busy.leave} onConfirm={() => onCancel(x.requestId!, false)} />
              )}
            </PersonRow>
          ))}
        </ul>
      )}

      {past ? (
        <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Ngày đã qua, chỉ xem được.</p>
      ) : slots === 0 ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
          {day.limit === 0 ? 'Ngày đang khóa.' : 'Ngày đã đủ người.'} Muốn đăng ký thêm hãy nâng giới hạn ở mục bên dưới.
        </p>
      ) : (
        <StaffPicker
          tone="violet"
          title={isToday ? 'Ghi nhận nghỉ đột xuất cho nhân viên' : 'Đăng ký nghỉ hộ nhân viên'}
          candidates={available}
          max={slots}
          hint={() =>
            isToday ? (
              <span className="text-rose-600 dark:text-rose-400">
                Báo nghỉ ngay hôm nay được tính là NGHỈ ĐỘT XUẤT, kể cả khi ngày đã đủ người.
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">Còn {slots} chỗ, chọn tối đa {slots} người.</span>
            )
          }
          busy={busy.leave}
          confirmLabel={isToday ? 'Ghi nhận' : 'Đăng ký'}
          onConfirm={onRegisterStaff}
        />
      )}
    </>
  );
}

const PICKER_TONE = {
  violet: {
    box: 'bg-violet-50/60 ring-violet-100 dark:bg-violet-950/20 dark:ring-violet-900/50',
    title: 'text-violet-900 dark:text-violet-200',
    chip: 'bg-violet-600',
    rowOn: 'bg-violet-50 dark:bg-violet-950/40',
    check: 'border-violet-600 bg-violet-600',
    button: 'btn-3d-blue',
  },
} as const;

/**
 * Tìm và tích chọn nhiều nhân viên rồi bấm xác nhận một lần.
 * `onConfirm` trả về những người chưa lưu được (để giữ lại trong ô chọn cho người dùng xem lại).
 */
function StaffPicker({
  title,
  candidates,
  badgeOf,
  max,
  hint,
  tone,
  busy,
  confirmLabel,
  onConfirm,
}: {
  title: string;
  candidates: Array<{ id: number; fullName: string }>;
  /** Nhãn nhỏ cạnh tên (VD "Đang nhận ngày 15") */
  badgeOf?: (id: number) => string | undefined;
  /** Chọn tối đa bao nhiêu người (undefined = không giới hạn) */
  max?: number;
  /** Ghi chú dưới danh sách, tính theo những người đang chọn */
  hint?: (picked: number[]) => React.ReactNode;
  tone: keyof typeof PICKER_TONE;
  busy: boolean;
  confirmLabel: string;
  onConfirm: (userIds: number[]) => Promise<number[]>;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const t = PICKER_TONE[tone];
  const q = fold(query.trim());
  const shown = q ? candidates.filter((u) => fold(u.fullName).includes(q)) : candidates;
  const nameOf = new Map(candidates.map((u) => [u.id, u.fullName]));
  // Người vừa được lưu thì biến khỏi danh sách; bỏ họ khỏi ô chọn luôn
  const pickedNow = picked.filter((id) => nameOf.has(id));
  const reachedMax = max !== undefined && pickedNow.length >= max;
  const toggle = (id: number) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : reachedMax ? cur : [...cur, id]));

  return (
    <div className={`mt-3 rounded-lg p-3 ring-1 ${t.box}`}>
      <div className={`mb-2 text-xs font-bold ${t.title}`}>{title}</div>
      <div className="relative">
        <MagnifyingGlass size={16} weight="bold" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          className="input-3d !h-10 !pl-9"
          placeholder="Tìm tên nhân viên…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {pickedNow.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pickedNow.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={`inline-flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1.5 text-xs font-bold text-white ${t.chip}`}
              aria-label={`Bỏ chọn ${nameOf.get(id)}`}
            >
              {nameOf.get(id)}
              <X size={12} weight="bold" />
            </button>
          ))}
        </div>
      )}

      <ul className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {shown.length === 0 ? (
          <li className="px-3 py-3 text-center text-sm text-slate-500">
            {candidates.length === 0 ? 'Không còn nhân viên nào để chọn.' : 'Không tìm thấy nhân viên.'}
          </li>
        ) : (
          shown.map((u) => {
            const on = pickedNow.includes(u.id);
            const badge = badgeOf?.(u.id);
            const disabled = !on && reachedMax;
            return (
              <li key={u.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(u.id)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors disabled:opacity-40 ${
                    on ? t.rowOn : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${
                      on ? `${t.check} text-white` : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {on && <Check size={12} weight="bold" />}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-sm font-bold text-slate-900 dark:text-white">{u.fullName}</span>
                  {badge && (
                    <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                      {badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>

      {hint && <div className="mt-2 text-xs font-semibold">{hint(pickedNow)}</div>}
      <div className="mt-3 flex items-center justify-end gap-2">
        {pickedNow.length > 0 && (
          <button type="button" onClick={() => setPicked([])} className="btn-3d btn-3d-white px-3.5 py-2 text-sm">
            Bỏ chọn
          </button>
        )}
        <button
          type="button"
          disabled={busy || pickedNow.length === 0}
          onClick={async () => {
            const failed = await onConfirm(pickedNow);
            setPicked(failed);
            if (failed.length === 0) setQuery('');
          }}
          className={`btn-3d ${t.button} inline-flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50`}
        >
          <Check size={15} weight="bold" />
          {busy ? 'Đang lưu...' : `${confirmLabel}${pickedNow.length > 0 ? ` (${pickedNow.length})` : ''}`}
        </button>
      </div>
    </div>
  );
}

function LimitEditor({
  day,
  defaultLimit,
  busy,
  onChange,
}: {
  day: LeaveDay;
  defaultLimit: number;
  busy: boolean;
  onChange: (max: number | null) => void;
}) {
  const [text, setText] = useState(String(day.limit));
  useEffect(() => setText(String(day.limit)), [day.limit]);
  const n = Number(text);
  const valid = text.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 100;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label={`Số người nghỉ tối đa (mặc định ${defaultLimit})`}>
            <input type="number" min={0} max={100} className="input-3d !h-10" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        </div>
        <button
          type="button"
          disabled={busy || !valid}
          onClick={() => onChange(n)}
          className="btn-3d btn-3d-blue shrink-0 px-4 py-2 text-sm disabled:opacity-50"
        >
          Lưu
        </button>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={busy} onClick={() => onChange(null)} className="btn-3d btn-3d-white px-3.5 py-2 text-sm disabled:opacity-50">
          Dùng mặc định
        </button>
        {day.limit === 0 ? (
          <button
            type="button"
            disabled={busy}
            // Mở khóa = về mặc định; nếu mặc định cũng là 0 thì mở với 1 chỗ để ngày thật sự mở được
            onClick={() => onChange(defaultLimit > 0 ? null : 1)}
            className="btn-3d btn-3d-blue inline-flex items-center gap-1.5 px-3.5 py-2 text-sm disabled:opacity-50"
          >
            <LockOpen size={15} weight="bold" />
            Mở khóa ngày
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChange(0)}
            className="btn-3d btn-3d-white inline-flex items-center gap-1.5 px-3.5 py-2 text-sm disabled:opacity-50"
          >
            <Lock size={15} weight="bold" />
            Khóa ngày
          </button>
        )}
      </div>
    </div>
  );
}

function HistoryPanel({ day }: { day: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useLeaveHistory(open ? day : null);
  return (
    <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-3d btn-3d-white inline-flex items-center gap-1.5 px-3.5 py-2 text-sm"
      >
        <ClockCounterClockwise size={15} weight="bold" />
        {open ? 'Ẩn lịch sử' : 'Lịch sử'}
      </button>
      {open && (
        <div className="mt-3">
          {isLoading ? (
            <p className="py-3 text-center text-sm font-bold text-blue-600 animate-pulse">Đang tải lịch sử...</p>
          ) : isError ? (
            <p className="py-3 text-center text-sm font-semibold text-rose-600">Không tải được lịch sử.</p>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Ngày này chưa có lịch sử đăng ký / hủy.</p>
          ) : (
            <ul className="space-y-2">
              {data.map((h: LeaveHistoryEntry) => {
                const isCancel = h.action === 'CANCEL';
                const isUrgent = h.action === 'URGENT';
                const byOther = h.actorName && h.actorName !== h.userName;
                return (
                  <li
                    key={h.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {h.userName || 'Không rõ'}{' '}
                        <span
                          className={
                            isCancel || isUrgent
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {isCancel ? 'hủy nghỉ' : isUrgent ? 'nghỉ đột xuất' : 'đăng ký nghỉ'}
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{formatFull(h.createdAt)}</span>
                    </div>
                    {byOther && (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Thao tác bởi {h.actorName}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
