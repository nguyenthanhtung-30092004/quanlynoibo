'use client';

import { useEffect, useMemo, useState } from 'react';
import { CaretLeft, CaretRight, ClockCounterClockwise, FloppyDisk, Lock, LockOpen, Trash, Warning } from '@phosphor-icons/react';
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

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const selected = data?.days.find((d) => d.day === selectedDay) ?? null;
  const today = data?.today ?? getVnToday();

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

  /** Admin đăng ký hộ nhân viên; giữ nguyên cửa sổ để thấy ngay người vừa thêm */
  const registerStaff = async (day: string, userId: number) => {
    try {
      const res = await registerForStaff.mutateAsync({ day, userId });
      const name = activeStaff.find((u) => u.id === userId)?.fullName ?? 'nhân viên';
      showToast(res.urgent ? `Đã ghi nhận ${name} nghỉ đột xuất.` : `Đã đăng ký nghỉ cho ${name}.`);
    } catch (err) {
      showToast(`Lỗi: ${errText(err, 'Không đăng ký được.')}`);
    }
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
                <DayCell key={d.day} d={d} today={today} onClick={() => setSelectedDay(d.day)} />
              ))}
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <Legend className="bg-sky-100 ring-1 ring-sky-300 dark:bg-sky-900/40 dark:ring-sky-700" text="Đầu tuần (T2-T5)" />
                <Legend className="bg-orange-100 ring-1 ring-orange-300 dark:bg-orange-900/40 dark:ring-orange-700" text="Cuối tuần (T6-CN)" />
                <Legend className="bg-violet-100 ring-1 ring-violet-300 dark:bg-violet-900/40 dark:ring-violet-700" text="Đã có người đăng ký" />
                {!isAdmin && <Legend className="bg-violet-600" text="Ngày bạn đã đăng ký (tím đậm)" />}
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
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800/50">
              {selected.limit === 0 ? (
                <b>Ngày này không nhận đăng ký nghỉ.</b>
              ) : (
                <>
                  Đã có <b className="tnum">{selected.count}</b> / <b className="tnum">{selected.limit}</b> người nghỉ
                  {selected.customLimit && <span className="text-blue-600 dark:text-blue-400"> (đã chỉnh riêng)</span>}.
                </>
              )}
            </div>

            {isAdmin ? (
              <AdminDayPanel
                day={selected}
                today={today}
                staff={activeStaff}
                onRegisterStaff={(userId) => registerStaff(selected.day, userId)}
                busy={removeLeave.isPending || setDayLimit.isPending || registerForStaff.isPending}
                defaultLimit={isLateWeekDay(selected.day) ? data!.config.lateMax : data!.config.earlyMax}
                onCancel={cancel}
                onChangeLimit={changeLimit}
              />
            ) : (
              <StaffDayPanel
                day={selected}
                today={today}
                busy={registerLeave.isPending || removeLeave.isPending}
                myDays={myDaysThisMonth}
                quota={quota}
                meId={me?.id}
                onRegister={() => register(selected.day)}
                onCancel={async (id) => {
                  if (await cancel(id)) setSelectedDay(null);
                }}
              />
            )}
            <HistoryPanel day={selected.day} />
          </div>
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

function DayCell({ d, today, onClick }: { d: LeaveDay; today: string; onClick: () => void }) {
  // Hôm nay và các ngày đã qua đều không đăng ký được nên làm mờ như nhau
  const past = d.day <= today;
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
  // Tình trạng chỗ trống thể hiện ở màu chữ của số lượng
  const countTone = d.mine
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
      className={`flex min-h-14 flex-col items-center justify-center rounded-lg px-1 py-1.5 transition-transform hover:scale-[1.04] sm:min-h-16 ${
        d.mine ? mine : d.count > 0 ? taken : base
      } ${past ? 'opacity-50' : ''}`}
    >
      <span className="tnum text-sm font-black sm:text-base">{Number(d.day.slice(8))}</span>
      <span className={`tnum text-[11px] font-extrabold leading-none sm:text-xs ${countTone}`}>
        {locked ? <Lock size={12} weight="bold" className="inline" /> : `${d.count}/${d.limit}`}
      </span>
    </button>
  );
}

function StaffDayPanel({
  day,
  today,
  busy,
  myDays,
  quota,
  meId,
  onRegister,
  onCancel,
}: {
  day: LeaveDay;
  today: string;
  busy: boolean;
  /** Số ngày bạn đã đăng ký nghỉ trong tháng đang xem */
  myDays: number;
  quota: number;
  meId?: number;
  onRegister: () => void;
  onCancel: (requestId: number) => void;
}) {
  const [confirmOver, setConfirmOver] = useState(false);
  const full = day.count >= day.limit;
  const myRequest = day.mine ? day.people.find((p) => p.userId === meId) : undefined;
  const myRequestId = myRequest?.requestId ?? null;
  const canCancel = myRequestId !== null && day.day > today;
  const wouldExceed = myDays >= quota;
  let note: string | null = null;
  if (day.mine) note = canCancel ? 'Bạn đã đăng ký nghỉ ngày này.' : 'Bạn đã đăng ký nghỉ ngày này (ngày đã tới nên không hủy được).';
  else if (day.day < today) note = 'Ngày này đã qua, không đăng ký được.';
  else if (day.day === today) note = 'Bạn chỉ tự đăng ký nghỉ được từ ngày mai trở đi. Nếu báo nghỉ đột xuất hôm nay, hãy báo quản lý để được ghi nhận.';
  else if (day.limit === 0) note = 'Quản lý đã khóa ngày này.';
  else if (full) note = 'Ngày này đã đủ người nghỉ, bạn chọn ngày khác nhé.';

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Người đăng ký nghỉ ({day.people.length})
        </div>
        {day.people.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có ai đăng ký nghỉ ngày này.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {day.people.map((p) => (
              <li key={p.requestId ?? `auto-${p.userId}`} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={p.fullName} />
                <span className="min-w-0 flex-1 break-words text-sm font-bold text-slate-900 dark:text-white">
                  {p.fullName}
                </span>
                {p.urgent && <UrgentBadge />}
              </li>
            ))}
          </ul>
        )}
      </div>
      {note && <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{note}</p>}
      {!day.mine && !note && wouldExceed && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Warning size={18} weight="fill" className="mt-0.5 shrink-0" />
          <span>
            Cảnh báo: bạn đã đăng ký nghỉ {myDays}/{quota} ngày trong tháng này. Đăng ký thêm sẽ vượt số ngày cho phép.
          </span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        {canCancel && myRequestId !== null && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCancel(myRequestId)}
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
            disabled={!!note || busy}
            className="btn-3d btn-3d-blue px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {busy ? 'Đang đăng ký...' : wouldExceed && confirmOver ? 'Vẫn đăng ký (vượt số ngày)' : 'Đăng ký nghỉ ngày này'}
          </button>
        )}
      </div>
    </div>
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

function AdminDayPanel({
  day,
  today,
  staff,
  onRegisterStaff,
  busy,
  defaultLimit,
  onCancel,
  onChangeLimit,
}: {
  day: LeaveDay;
  today: string;
  /** Nhân viên đang hoạt động để Admin chọn đăng ký hộ */
  staff: Array<{ id: number; fullName: string }>;
  onRegisterStaff: (userId: number) => void;
  busy: boolean;
  /** Giới hạn mặc định của nhóm ngày này (đầu tuần / cuối tuần) */
  defaultLimit: number;
  onCancel: (requestId: number) => void;
  onChangeLimit: (day: string, max: number | null) => void;
}) {
  const [limitText, setLimitText] = useState(String(day.limit));
  useEffect(() => setLimitText(String(day.limit)), [day.limit]);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [pickId, setPickId] = useState('');
  const people = day.people;
  const registeredIds = new Set(people.map((p) => p.userId));
  const available = staff.filter((u) => !registeredIds.has(u.id));
  const isToday = day.day === today;
  const parsed = Number(limitText);
  const validLimit = limitText.trim() !== '' && Number.isInteger(parsed) && parsed >= 0 && parsed <= 100;

  return (
    <>
      <div>
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Người đăng ký nghỉ ({people.length})
        </div>
        {people.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có ai đăng ký nghỉ ngày này.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {people.map((p) => {
              const requestId = p.requestId;
              return (
                <li key={requestId ?? `auto-${p.userId}`} className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={p.fullName} />
                  <span className="min-w-0 flex-1 break-words text-sm font-bold text-slate-900 dark:text-white">
                    {p.fullName}
                    {p.auto && (
                      <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Không quẹt máy chấm công, hệ thống tự ghi nhận
                      </span>
                    )}
                  </span>
                  {p.urgent && <UrgentBadge />}
                  {requestId !== null && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (confirmId === requestId) {
                          setConfirmId(null);
                          onCancel(requestId);
                        } else {
                          setConfirmId(requestId);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                    >
                      <Trash size={14} weight="bold" />
                      {confirmId === requestId ? 'Bấm lần nữa để hủy' : 'Hủy'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {day.day >= today && (
        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <Field label={isToday ? 'Đăng ký nghỉ đột xuất cho nhân viên' : 'Đăng ký nghỉ cho nhân viên'}>
            <select className="input-3d !h-10" value={pickId} onChange={(e) => setPickId(e.target.value)}>
              <option value="">Chọn nhân viên…</option>
              {available.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </Field>
          {isToday && (
            <p className="mt-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
              Nhân viên báo nghỉ ngay hôm nay sẽ được ghi nhận là NGHỈ ĐỘT XUẤT, kể cả khi ngày đã đủ người.
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={busy || !pickId}
              onClick={() => {
                onRegisterStaff(Number(pickId));
                setPickId('');
              }}
              className="btn-3d btn-3d-blue px-4 py-2 text-sm disabled:opacity-50"
            >
              {isToday ? 'Ghi nhận nghỉ đột xuất' : 'Đăng ký nghỉ'}
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
        <Field label="Số người được nghỉ tối đa riêng cho ngày này">
          <input
            type="number"
            min={0}
            max={100}
            className="input-3d !h-10"
            value={limitText}
            onChange={(e) => setLimitText(e.target.value)}
          />
        </Field>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChangeLimit(day.day, null)}
            className="btn-3d btn-3d-white px-3.5 py-2 text-sm disabled:opacity-50"
          >
            Dùng mặc định
          </button>
          {day.limit === 0 ? (
            <button
              type="button"
              disabled={busy}
              // Mở khóa = về giới hạn mặc định; nếu mặc định cũng là 0 thì mở với 1 chỗ để ngày thật sự mở được
              onClick={() =>
                defaultLimit > 0
                  ? onChangeLimit(day.day, null)
                  : onChangeLimit(day.day, 1)
              }
              className="btn-3d btn-3d-blue inline-flex items-center gap-1.5 px-3.5 py-2 text-sm disabled:opacity-50"
            >
              <LockOpen size={15} weight="bold" />
              Mở khóa ngày
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onChangeLimit(day.day, 0)}
              className="btn-3d btn-3d-white inline-flex items-center gap-1.5 px-3.5 py-2 text-sm disabled:opacity-50"
            >
              <Lock size={15} weight="bold" />
              Khóa ngày
            </button>
          )}
          <button
            type="button"
            disabled={busy || !validLimit}
            onClick={() => onChangeLimit(day.day, parsed)}
            className="btn-3d btn-3d-blue px-4 py-2 text-sm disabled:opacity-50"
          >
            Lưu giới hạn
          </button>
        </div>
      </div>
    </>
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
