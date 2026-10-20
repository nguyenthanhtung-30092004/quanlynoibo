'use client';

import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { ApiError } from '@/lib/api-client';
import { monthLabel, shiftMonth } from '@/lib/month';
import { getVnToday } from '@/lib/time';
import { useCurrentUser } from '@/features/auth/hooks';
import { useAttendanceMonth, useDayLog, useSetAttendanceOverride } from '@/features/attendance/hooks';
import { durationText } from '@/features/attendance/format';
import type { AttendanceDayCell, AttendanceStaff } from '@/features/attendance/types';
import { useRealtimeConnected } from '@/features/realtime/RealtimeProvider';
import { Modal } from '@/features/xvip/Modal';
import { useToast } from '@/features/xvip/toast';
import { Avatar, Card, PageTitle } from '@/features/xvip/ui';

const hm = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}g` : `${h}g${String(m).padStart(2, '0')}`;
};

const congText = (n: number) => (n === 0.5 ? '½' : String(n));

/** Mô tả một ô công: vào / ra lúc nào, ca nào, số phút được tính, muộn hay sớm */
function cellSummary(cell: AttendanceDayCell): string {
  if (cell.status === 'missing_out') {
    return `Chỉ quẹt một lần lúc ${formatTime(cell.firstAt!)}, thiếu lượt ra nên chưa tính công. Admin chỉnh tay nếu cần.`;
  }
  if (cell.status === 'working') return `Vào lúc ${formatTime(cell.firstAt!)}, chưa quẹt ra.`;
  if (cell.status === 'not_in') return 'Chưa quẹt máy chấm công.';
  if (!cell.shift || !cell.firstAt || !cell.lastAt) return `Công cũ tính theo đăng nhập: ${hm(cell.minutes)}`;
  const late = lateText(cell.lateMinutes, cell.earlyLeaveMinutes);
  return `Vào ${formatTime(cell.firstAt)} · ra ${formatTime(cell.lastAt)} · ca ${cell.shift} · tính ${durationText(cell.minutes)}${late ? ` (${late})` : ''}`;
}

/** Ghi chú vào muộn / ra sớm, rỗng nếu đúng giờ */
const lateText = (lateMinutes: number, earlyLeaveMinutes: number) =>
  [
    lateMinutes > 0 ? `vào muộn ${durationText(lateMinutes)}` : '',
    earlyLeaveMinutes > 0 ? `ra sớm ${durationText(earlyLeaveMinutes)}` : '',
  ]
    .filter(Boolean)
    .join(', ');

/** Các ca làm việc (khớp SHIFTS ở backend/attendance.logic.ts) để hiển thị cho Admin */
const SHIFT_LABELS = ['5h - 13h30', '6h - 15h30', '7h - 16h30', '8h - 17h30', '9h - 18h30', '10h - 19h30', '12h - 21h', '13h30 - 22h'];
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
  const live = useRealtimeConnected();
  // Nhân viên chỉ xem (và chỉ thấy công của chính mình, server đã lọc); chỉ Admin được chỉnh công
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'ADMIN';
  const [month, setMonth] = useState(() => getVnToday().slice(0, 7));
  const { data, isLoading, isError, error, refetch } = useAttendanceMonth(month);
  const { data: dayLog } = useDayLog();
  const staffToday = dayLog?.staff ?? [];
  const workingCount = staffToday.filter((s) => s.status === 'working').length;
  const doneCount = staffToday.filter((s) => s.status === 'done').length;
  const setOverride = useSetAttendanceOverride();

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

      {/* Tình hình đi làm hôm nay theo lượt quẹt máy chấm công: chưa quẹt, đang làm, đã quẹt ra */}
      <Card
        className="mb-5"
        title={`Hôm nay · đang làm ${workingCount} · đã ra ca ${doneCount} · ${staffToday.length} nhân viên`}
        action={
          <div
            className={`flex items-center gap-1.5 text-xs font-bold ${
              live ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            <span className={`size-2 rounded-full ${live ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{live ? 'Trực tiếp' : 'Mất kết nối, đang tải lại mỗi phút'}</span>
          </div>
        }
      >
        {!dayLog || dayLog.staff.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có nhân viên nào.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dayLog.staff.map((u) => {
              const dot =
                u.status === 'working' ? 'bg-emerald-500' : u.status === 'done' ? 'bg-slate-400' : 'bg-rose-400';
              const label =
                u.status === 'working'
                  ? `Đang làm · vào lúc ${formatTime(u.firstAt!)}`
                  : u.status === 'done'
                    ? `Vào ${formatTime(u.firstAt!)} · ra ${formatTime(u.lastAt!)}`
                    : 'Chưa quẹt máy chấm công hôm nay';
              const late = lateText(u.lateMinutes, u.earlyLeaveMinutes);
              return (
                <div
                  key={u.userId}
                  className={`rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40 ${
                    u.status === 'not_in' ? 'opacity-70' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative">
                        <Avatar name={u.fullName} />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white dark:border-slate-900 ${dot}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                          {u.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {u.status === 'done' ? (
                        <>
                          <div className="text-xs font-black text-blue-600 dark:text-blue-400">
                            {congText(u.cong)} công
                          </div>
                          <div className="text-[10px] font-medium text-slate-400">ca {u.shift}</div>
                        </>
                      ) : (
                        <div className="text-[10px] font-medium text-slate-400">
                          {u.status === 'working' ? 'chưa chốt công' : '0 công'}
                        </div>
                      )}
                    </div>
                  </div>
                  {late && (
                    <div className="mt-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">{late}</div>
                  )}
                  {u.punches.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-200 pt-2 text-[10px] font-bold dark:border-slate-800">
                      {u.punches.map((at, i) => {
                        const isIn = i === 0;
                        const isOut = i === u.punches.length - 1 && u.punches.length > 1;
                        return (
                          <span
                            key={at}
                            className={`tnum rounded px-1.5 py-0.5 ${
                              isIn
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : isOut
                                  ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800/60'
                            }`}
                          >
                            {formatTime(at)} {isIn ? 'vào' : isOut ? 'ra' : 'quẹt'}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quy tắc chấm công */}
      <Card title="Quy tắc tính công theo ca">
        <div className="space-y-4">
            <div className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <p>
                Công tính theo lượt quẹt trên máy chấm công, không dựa vào đăng nhập. Lượt quẹt đầu trong ngày là giờ
                vào, lượt cuối là giờ ra; quẹt lại trong vòng 2 phút chỉ tính một lượt.
              </p>
              <p>
                Ca được đoán từ giờ ra: chọn ca có giờ kết thúc gần giờ ra nhất. Chỉ tính phần giờ nằm trong ca, vào
                sớm thì tính từ đầu ca, ở lại quá cuối ca vẫn chỉ tính hết ca (tối đa 1 công). Vào muộn hoặc ra sớm dù
                một phút thì chưa đủ ca.
              </p>
              <p className="flex flex-wrap gap-1.5">
                {SHIFT_LABELS.map((s) => (
                  <span
                    key={s}
                    className="tnum rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {s}
                  </span>
                ))}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">1 công</span>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Có mặt đủ cả khung giờ của ca (vào đúng hoặc trước giờ bắt đầu, ra đúng hoặc sau giờ kết thúc). Không
                  trừ nghỉ trưa.
                </p>
                <div className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  👉 Đủ cả ca = 1 công
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">0,5 công</span>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Chưa đủ cả ca nhưng có mặt từ một nửa độ dài của ca trở lên (ca 6h - 15h30 dài 9g30 thì cần từ 4g45).
                  Ít hơn một nửa ca thì 0 công.
                </p>
                <div className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  👉 Đủ nửa ca = 0,5 công
                </div>
              </div>
            </div>
          </div>
      </Card>

      {/* Bảng công cả tháng */}
      <Card
        className="mt-5 !p-0 overflow-hidden"
        title={`Bảng chấm công ${monthLabel(month).toLowerCase()}`}
        action={
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isAdmin
              ? 'Bấm vào một ô để xem giờ vào ra hoặc chỉnh tay · ô viền xanh là công đã chỉnh tay · dấu ? là quên quẹt ra'
              : 'Rê chuột vào một ô để xem giờ vào ra · ô viền xanh là công Admin đã chỉnh · dấu ? là quên quẹt ra'}
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
                      // Quên quẹt ra: hiện "?" để Admin thấy và chỉnh tay
                      const noOut = !!cell && cell.status === 'missing_out' && !cell.overridden;
                      const has = !!cell && (cell.cong > 0 || cell.minutes > 0 || cell.overridden);
                      const tone = !cell
                        ? 'text-slate-300 dark:text-slate-600'
                        : cell.cong > 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : cell.minutes > 0 || cell.overridden || noOut
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                            : 'text-slate-300 dark:text-slate-600';
                      const title = cell
                        ? `${s.fullName} · ${String(d.d).padStart(2, '0')}/${data.month.slice(5)}\n${cellSummary(cell)}${
                            cell.overridden ? `\nĐã chỉnh tay: ${cell.cong} công${cell.note ? ` (${cell.note})` : ''}` : ''
                          }`
                        :`${s.fullName} · ${String(d.d).padStart(2, '0')}/${data.month.slice(5)}\nChưa có dữ liệu`;
                      return (
                        <td key={d.key} className="border-l border-slate-100 p-0.5 dark:border-slate-800">
                          <button
                            type="button"
                            title={title}
                            onClick={isAdmin ? () => openEdit(s, d.key) : undefined}
                            className={`tnum flex h-8 w-full min-w-8 items-center justify-center rounded-md text-xs font-black transition-colors ${
                              isAdmin ? 'hover:ring-2 hover:ring-blue-400' : 'cursor-default'
                            } ${tone} ${
                              cell?.overridden ? 'ring-2 ring-blue-500' : ''
                            }`}
                          >
                            {has ? congText(cell.cong) : noOut ? '?' : '·'}
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
        {isAdmin && (
          <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Số công này được tự động điền vào ô Công thực tế ở trang Bảng lương (hoặc có thể bấm nút &ldquo;Điền công từ chấm công&rdquo; để điền lại thủ công).
          </p>
        )}
      </Card>

      {isAdmin && editing && data && (
        <Modal
          title={`Công ${String(Number(editing.day.slice(8)))}/${editing.day.slice(5, 7)} · ${editing.staff.fullName}`}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800/50">
              {editingCell ? (
                <>
                  {cellSummary(editingCell)} → hệ thống tự tính <b>{congText(editingCell.autoCong)} công</b>.
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
