'use client';

import { useEffect, useMemo, useState } from 'react';
import { CaretLeft, CaretRight, FloppyDisk, Lock, Trash } from '@phosphor-icons/react';
import { ApiError } from '@/lib/api-client';
import { monthLabel, shiftMonth } from '@/lib/month';
import { getVnToday } from '@/lib/time';
import { useCurrentUser } from '@/features/auth/hooks';
import {
  useLeaveMonth,
  useRegisterLeave,
  useRemoveLeave,
  useSaveLeaveConfig,
  useSetDayLimit,
} from '@/features/leave/hooks';
import type { LeaveConfig, LeaveDay } from '@/features/leave/types';
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

const errText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export default function LeavePage() {
  const showToast = useToast();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';
  const [month, setMonth] = useState(() => getVnToday().slice(0, 7));
  const { data, isLoading, isError, error, refetch } = useLeaveMonth(month);
  const registerLeave = useRegisterLeave();
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
      showToast('Đã lưu giới hạn số người nghỉ.');
    } catch (err) {
      showToast(`Lỗi: ${errText(err, 'Không lưu được giới hạn.')}`);
    }
  };

  // Ô trống đầu tháng để ngày 1 rơi đúng cột thứ
  const leadingBlanks = data && data.days.length > 0 ? columnOf(data.days[0].day) : 0;

  const register = async (day: string) => {
    try {
      await registerLeave.mutateAsync(day);
      showToast(`Đã đăng ký nghỉ ${dayLabel(day)}.`);
      setSelectedDay(null);
    } catch (err) {
      showToast(`Lỗi: ${errText(err, 'Không đăng ký được.')}`);
    }
  };

  const cancel = async (requestId: number, name: string) => {
    try {
      await removeLeave.mutateAsync(requestId);
      showToast(`Đã hủy ngày nghỉ của ${name}.`);
    } catch (err) {
      showToast(`Lỗi: ${errText(err, 'Không hủy được.')}`);
    }
  };

  const changeLimit = async (day: string, max: number | null, okMessage: string) => {
    try {
      await setDayLimit.mutateAsync({ day, max });
      showToast(okMessage);
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

      {isAdmin && (
        <Card title="Giới hạn số người nghỉ mỗi ngày" className="mb-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Đầu tuần (T2, T3, T4, T5)">
              <input
                type="number"
                min={0}
                max={100}
                className="input-3d !h-10"
                value={draft?.earlyMax ?? ''}
                onChange={(e) => setDraft((d) => (d ? { ...d, earlyMax: e.target.value } : d))}
              />
            </Field>
            <Field label="Cuối tuần (T6, T7, CN)">
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

      <Card title={isAdmin ? 'Lịch nghỉ của nhân viên' : 'Chọn ngày muốn nghỉ'}>
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
              {HEADERS.map((h) => (
                <div key={h} className="pb-1 text-center text-xs font-extrabold text-slate-500 dark:text-slate-400">
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
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Legend className="bg-emerald-100 dark:bg-emerald-900/40" text="Còn chỗ" />
              <Legend className="bg-amber-100 dark:bg-amber-900/40" text="Gần đủ" />
              <Legend className="bg-rose-100 dark:bg-rose-900/40" text="Đủ người / khóa" />
              {!isAdmin && <Legend className="bg-blue-500" text="Ngày bạn đã đăng ký" />}
            </div>
          </>
        )}
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
                busy={removeLeave.isPending || setDayLimit.isPending}
                onCancel={cancel}
                onChangeLimit={changeLimit}
              />
            ) : (
              <StaffDayPanel
                day={selected}
                today={today}
                busy={registerLeave.isPending}
                onRegister={() => register(selected.day)}
              />
            )}
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
  const past = d.day < today;
  const locked = d.limit === 0;
  const full = d.count >= d.limit;
  const almost = !full && d.limit > 0 && d.count >= d.limit - 1;
  const tone = d.mine
    ? 'bg-blue-500 text-white ring-2 ring-blue-300 dark:ring-blue-700'
    : full || locked
      ? 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100'
      : almost
        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
        : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 flex-col items-center justify-center rounded-lg px-1 py-1.5 transition-transform hover:scale-[1.04] sm:min-h-16 ${tone} ${
        past ? 'opacity-50' : ''
      } ${d.day === today ? 'outline outline-2 outline-offset-1 outline-slate-900 dark:outline-white' : ''}`}
    >
      <span className="tnum text-sm font-black sm:text-base">{Number(d.day.slice(8))}</span>
      <span className="tnum text-[11px] font-bold leading-none sm:text-xs">
        {locked ? <Lock size={12} weight="bold" className="inline" /> : `${d.count}/${d.limit}`}
      </span>
    </button>
  );
}

function StaffDayPanel({
  day,
  today,
  busy,
  onRegister,
}: {
  day: LeaveDay;
  today: string;
  busy: boolean;
  onRegister: () => void;
}) {
  const past = day.day < today;
  const full = day.count >= day.limit;
  let note: string | null = null;
  if (day.mine) note = 'Bạn đã đăng ký nghỉ ngày này. Cần hủy thì báo quản lý.';
  else if (past) note = 'Ngày này đã qua, không đăng ký được.';
  else if (day.limit === 0) note = 'Quản lý đã khóa ngày này.';
  else if (full) note = 'Ngày này đã đủ người nghỉ, bạn chọn ngày khác nhé.';

  return (
    <div className="space-y-3">
      {note && <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{note}</p>}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRegister}
          disabled={!!note || busy}
          className="btn-3d btn-3d-blue px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {busy ? 'Đang đăng ký...' : 'Đăng ký nghỉ ngày này'}
        </button>
      </div>
    </div>
  );
}

function AdminDayPanel({
  day,
  busy,
  onCancel,
  onChangeLimit,
}: {
  day: LeaveDay;
  busy: boolean;
  onCancel: (requestId: number, name: string) => void;
  onChangeLimit: (day: string, max: number | null, okMessage: string) => void;
}) {
  const [limitText, setLimitText] = useState(String(day.limit));
  useEffect(() => setLimitText(String(day.limit)), [day.limit]);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const people = useMemo(() => day.people ?? [], [day.people]);
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
            {people.map((p) => (
              <li key={p.requestId} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={p.fullName} />
                <span className="min-w-0 flex-1 break-words text-sm font-bold text-slate-900 dark:text-white">
                  {p.fullName}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (confirmId === p.requestId) {
                      setConfirmId(null);
                      onCancel(p.requestId, p.fullName);
                    } else {
                      setConfirmId(p.requestId);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <Trash size={14} weight="bold" />
                  {confirmId === p.requestId ? 'Bấm lần nữa để hủy' : 'Hủy'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
            onClick={() => onChangeLimit(day.day, null, 'Ngày này đã quay về giới hạn mặc định.')}
            className="btn-3d btn-3d-white px-3.5 py-2 text-sm disabled:opacity-50"
          >
            Dùng mặc định
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onChangeLimit(day.day, 0, 'Đã khóa ngày này, không nhận đăng ký nghỉ.')}
            className="btn-3d btn-3d-white px-3.5 py-2 text-sm disabled:opacity-50"
          >
            Khóa ngày
          </button>
          <button
            type="button"
            disabled={busy || !validLimit}
            onClick={() => onChangeLimit(day.day, parsed, 'Đã chỉnh giới hạn cho ngày này.')}
            className="btn-3d btn-3d-blue px-4 py-2 text-sm disabled:opacity-50"
          >
            Lưu giới hạn
          </button>
        </div>
      </div>
    </>
  );
}
