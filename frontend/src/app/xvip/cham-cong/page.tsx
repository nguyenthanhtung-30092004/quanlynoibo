'use client';

import { useEffect, useMemo, useState } from 'react';
import { CaretLeft, CaretRight, FloppyDisk, UserCheck, Users } from '@phosphor-icons/react';
import { ApiError } from '@/lib/api-client';
import { monthLabel, shiftMonth } from '@/lib/month';
import { getVnToday } from '@/lib/time';
import { MoneyInput } from '@/features/payroll/MoneyInput';
import {
  useAttendanceMonth,
  useOnlineUsers,
  useSaveAttendanceConfig,
  useSetAttendanceOverride,
} from '@/features/attendance/hooks';
import type { AttendanceConfig, AttendanceStaff } from '@/features/attendance/types';
import { Modal } from '@/features/xvip/Modal';
import { useToast } from '@/features/xvip/toast';
import { Avatar, Card, PageTitle } from '@/features/xvip/ui';

const hm = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}g` : `${h}g${String(m).padStart(2, '0')}`;
};

const congText = (n: number) => (n === 0.5 ? '½' : String(n));
const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const formatTime = (isoString: string) => {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(d);
  } catch {
    return '—';
  }
};

interface ConfigDraft {
  fullMinutes: number;
  halfMinutes: number;
}

const toDraft = (c: AttendanceConfig): ConfigDraft => ({
  fullMinutes: c.fullMinutes,
  halfMinutes: c.halfMinutes,
});

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-slate-400">{hint}</span>}
    </label>
  );
}

export default function AttendancePage() {
  const showToast = useToast();
  const [month, setMonth] = useState(() => getVnToday().slice(0, 7));
  const { data, isLoading, isError, error, refetch } = useAttendanceMonth(month);
  const { data: onlineUsers } = useOnlineUsers();
  const saveConfig = useSaveAttendanceConfig();
  const setOverride = useSetAttendanceOverride();

  // Bản cấu hình đang sửa; chỉ đồng bộ lại khi cấu hình trên server thật sự đổi
  const [draft, setDraft] = useState<ConfigDraft | null>(null);
  const configKey = data ? JSON.stringify(data.config) : '';
  useEffect(() => {
    if (data) setDraft(toDraft(data.config));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  const draftDirty = !!data && !!draft && JSON.stringify(draft) !== JSON.stringify(toDraft(data.config));

  const save = async () => {
    if (!draft) return;
    try {
      await saveConfig.mutateAsync({
        fullMinutes: draft.fullMinutes,
        halfMinutes: draft.halfMinutes,
      });
      showToast('Đã lưu cấu hình chấm công.');
    } catch (err) {
      showToast(`Lỗi: ${err instanceof ApiError ? err.message : 'Không lưu được cấu hình.'}`);
    }
  };

  // Chỉnh tay một ô công
  const [editing, setEditing] = useState<{ staff: AttendanceStaff; day: string } | null>(null);
  const [editCong, setEditCong] = useState('auto');
  const [editNote, setEditNote] = useState('');
  const openEdit = (staff: AttendanceStaff, day: string) => {
    const cell = staff.days[day];
    setEditing({ staff, day });
    setEditCong(cell?.overridden ? String(cell.cong) : 'auto');
    setEditNote(cell?.note ?? '');
  };
  const submitEdit = async () => {
    if (!editing) return;
    try {
      await setOverride.mutateAsync({
        userId: editing.staff.id,
        day: editing.day,
        cong: editCong === 'auto' ? null : Number(editCong),
        note: editNote.trim() || undefined,
      });
      showToast(editCong === 'auto' ? 'Đã bỏ chỉnh tay, quay về số công tự tính.' : 'Đã chỉnh công.');
      setEditing(null);
    } catch (err) {
      showToast(`Lỗi: ${err instanceof ApiError ? err.message : 'Không chỉnh được công.'}`);
    }
  };

  const days = useMemo(() => {
    if (!data) return [];
    const [y, m] = data.month.split('-').map(Number);
    return Array.from({ length: data.daysInMonth }, (_, i) => {
      const d = i + 1;
      return {
        key: `${data.month}-${String(d).padStart(2, '0')}`,
        d,
        weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
      };
    });
  }, [data]);

  const today = getVnToday();
  const editingCell = editing ? editing.staff.days[editing.day] : undefined;

  return (
    <>
      <PageTitle
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              aria-label="Tháng trước"
              className="flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              aria-label="Chọn tháng"
              className="h-8 bg-transparent px-2 text-sm font-bold text-slate-800 outline-none dark:text-white"
            />
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              aria-label="Tháng sau"
              className="flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <CaretRight size={16} weight="bold" />
            </button>
          </div>
        }
      >
        Chấm công
      </PageTitle>

      {isError && (
        <Card>
          <p className="text-sm font-bold text-red-600">
            {error instanceof ApiError ? error.message : 'Không tải được bảng chấm công.'}{' '}
            <button type="button" onClick={() => refetch()} className="underline">
              Thử lại
            </button>
          </p>
        </Card>
      )}

      {/* Khối tài khoản đang online */}
      <Card
        className="mb-5"
        title={`Đang online (${onlineUsers?.length ?? 0})`}
        action={
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Trực tiếp (SSE)</span>
          </div>
        }
      >
        {!onlineUsers || onlineUsers.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Hiện chưa có tài khoản nào đang online.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {onlineUsers.map((u) => (
              <div
                key={u.userId}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <Avatar name={u.fullName} />
                    <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                      {u.fullName}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold">{u.role === 'ADMIN' ? 'Quản trị' : 'Nhân viên'}</span>
                      <span>·</span>
                      <span>Vào lúc {formatTime(u.onlineSince)}</span>
                      {u.connections > 1 && (
                        <span className="rounded bg-slate-200 px-1 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {u.connections} tab
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-blue-600 dark:text-blue-400">
                    {hm(u.todayMinutes)}
                  </div>
                  <div className="text-[10px] font-medium text-slate-400">online hôm nay</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quy tắc chấm công */}
      <Card title="Quy tắc tính công theo giờ online">
        {draft ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Hệ thống tự động tính công theo thời gian nhân viên đăng nhập và thao tác trong ngày (chuột, bàn phím, chuyển tab
              trong 5 phút gần nhất). Không bắt buộc định vị, dùng máy tính hay điện thoại đều được tính.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                <Field
                  label="Số phút để được 1 công"
                  hint={`Hiện tại: ${draft.fullMinutes} phút = ${(draft.fullMinutes / 60).toFixed(1).replace('.0', '')} giờ`}
                >
                  <MoneyInput
                    className="!h-10"
                    ariaLabel="Số phút để được 1 công"
                    value={draft.fullMinutes}
                    onChange={(fullMinutes) => setDraft({ ...draft, fullMinutes: Math.min(1440, fullMinutes) })}
                  />
                </Field>
                <div className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  👉 Đủ {(draft.fullMinutes / 60).toFixed(1).replace('.0', '')} giờ = 1 công
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                <Field
                  label="Số phút để được nửa công (0,5 công)"
                  hint={`Hiện tại: ${draft.halfMinutes} phút = ${(draft.halfMinutes / 60).toFixed(1).replace('.0', '')} giờ (đặt 0 nếu tắt)`}
                >
                  <MoneyInput
                    className="!h-10"
                    ariaLabel="Số phút để được nửa công"
                    value={draft.halfMinutes}
                    onChange={(halfMinutes) => setDraft({ ...draft, halfMinutes: Math.min(1440, halfMinutes) })}
                  />
                </Field>
                <div className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  👉 Đủ {(draft.halfMinutes / 60).toFixed(1).replace('.0', '')} giờ = 0,5 công
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={!draftDirty || saveConfig.isPending}
              className="btn-3d btn-3d-blue flex items-center gap-2 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
            >
              <FloppyDisk size={18} weight="bold" />
              {saveConfig.isPending ? 'Đang lưu...' : draftDirty ? 'Lưu cấu hình' : 'Đã lưu'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Đang tải...</p>
        )}
      </Card>

      {/* Bảng công cả tháng */}
      <Card
        className="mt-5 !p-0 overflow-hidden"
        title={`Bảng chấm công ${monthLabel(month).toLowerCase()}`}
        action={
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Bấm vào một ô để xem giờ online hoặc chỉnh tay · ô viền xanh là công đã chỉnh tay
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="border-collapse text-center">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-48 bg-slate-100 px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Nhân viên
                </th>
                {days.map((d) => (
                  <th
                    key={d.key}
                    className={`min-w-9 border-l border-slate-200 px-1 py-1 text-[11px] font-bold dark:border-slate-700 ${
                      d.weekday === 0
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    } ${d.key === today ? 'underline decoration-blue-500 decoration-2 underline-offset-2' : ''}`}
                  >
                    <div>{d.d}</div>
                    <div className="font-medium opacity-70">{WEEKDAY[d.weekday]}</div>
                  </th>
                ))}
                <th className="min-w-20 border-l-2 border-slate-300 bg-emerald-50 px-3 py-2 text-xs font-black uppercase text-emerald-800 dark:border-slate-600 dark:bg-emerald-950/30 dark:text-emerald-300">
                  Tổng công
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={days.length + 2} className="p-8 text-center text-sm font-bold text-blue-600 animate-pulse">
                    Đang tải bảng chấm công...
                  </td>
                </tr>
              ) : !data || data.staff.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 2} className="p-8 text-center text-sm font-semibold text-slate-500">
                    Chưa có nhân viên nào.
                  </td>
                </tr>
              ) : (
                data.staff.map((s) => (
                  <tr key={s.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 text-left dark:bg-[#111d35]">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.fullName} />
                        <span className="whitespace-nowrap text-sm font-extrabold text-slate-900 dark:text-white">
                          {s.fullName}
                        </span>
                      </div>
                    </td>
                    {days.map((d) => {
                      const cell = s.days[d.key];
                      const has = !!cell && (cell.cong > 0 || cell.minutes > 0 || cell.overridden);
                      const tone = !cell
                        ? 'text-slate-300 dark:text-slate-600'
                        : cell.cong > 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : cell.minutes > 0 || cell.overridden
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                            : 'text-slate-300 dark:text-slate-600';
                      const title = cell
                        ? `${s.fullName} · ${String(d.d).padStart(2, '0')}/${data.month.slice(5)}\n${hm(cell.minutes)} online có thao tác → tự tính ${cell.autoCong} công${
                            cell.overridden ? `\nĐã chỉnh tay: ${cell.cong} công${cell.note ? ` (${cell.note})` : ''}` : ''
                          }`
                        : `${s.fullName} · ${String(d.d).padStart(2, '0')}/${data.month.slice(5)}\nChưa có dữ liệu`;
                      return (
                        <td key={d.key} className="border-l border-slate-100 p-0.5 dark:border-slate-800">
                          <button
                            type="button"
                            title={title}
                            onClick={() => openEdit(s, d.key)}
                            className={`tnum flex h-8 w-full min-w-8 items-center justify-center rounded-md text-xs font-black transition-colors hover:ring-2 hover:ring-blue-400 ${tone} ${
                              cell?.overridden ? 'ring-2 ring-blue-500' : ''
                            }`}
                          >
                            {has ? congText(cell.cong) : '·'}
                          </button>
                        </td>
                      );
                    })}
                    <td className="tnum border-l-2 border-slate-300 bg-emerald-50/60 px-3 py-2 text-base font-black text-emerald-800 dark:border-slate-600 dark:bg-emerald-950/20 dark:text-emerald-300">
                      {s.totalCong}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Số công này được tự động điền vào ô Công thực tế ở trang Bảng lương (hoặc có thể bấm nút &ldquo;Điền công từ chấm công&rdquo; để điền lại thủ công).
        </p>
      </Card>

      {editing && data && (
        <Modal
          title={`Công ${String(Number(editing.day.slice(8)))}/${editing.day.slice(5, 7)} · ${editing.staff.fullName}`}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800/50">
              {editingCell ? (
                <>
                  Online có thao tác <b className="tnum">{hm(editingCell.minutes)}</b> → hệ thống tự tính{' '}
                  <b>{congText(editingCell.autoCong)} công</b>.
                </>
              ) : (
                'Ngày này chưa có dữ liệu chấm công.'
              )}
            </div>
            <Field label="Số công của ngày này">
              <select className="input-3d !h-10" value={editCong} onChange={(e) => setEditCong(e.target.value)}>
                <option value="auto">Tự tính theo giờ làm (không chỉnh tay)</option>
                <option value="0">0 công</option>
                <option value="0.5">½ công</option>
                <option value="1">1 công</option>
                <option value="1.5">1,5 công</option>
                <option value="2">2 công</option>
              </select>
            </Field>
            <Field label="Ghi chú (lý do chỉnh)">
              <input
                className="input-3d !h-10"
                maxLength={200}
                placeholder="VD: Mất mạng buổi sáng, đã xác nhận với quản lý"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </Field>
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button type="button" onClick={() => setEditing(null)} className="btn-3d btn-3d-white px-4 py-2 text-sm">
                Hủy
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={setOverride.isPending}
                className="btn-3d btn-3d-blue px-5 py-2 text-sm disabled:opacity-50"
              >
                {setOverride.isPending ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
