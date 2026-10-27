'use client';

import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight, DownloadSimple } from '@phosphor-icons/react';
import { ApiError } from '@/lib/api-client';
import { monthLabel, shiftMonth } from '@/lib/month';
import { getVnToday } from '@/lib/time';
import { useCurrentUser } from '@/features/auth/hooks';
import { attendanceApi } from '@/features/attendance/api';
import {
  useAttendanceMonth,
  useDayLog,
  useSetAttendanceOverride,
  useSetShiftOverride,
} from '@/features/attendance/hooks';
import { durationText } from '@/features/attendance/format';
import { ShiftSelect } from '@/features/attendance/ShiftSelect';
import type { AttendanceDayCell, AttendanceStaff, ShiftOption } from '@/features/attendance/types';
import { useRealtimeConnected } from '@/features/realtime/RealtimeProvider';
import { Modal } from '@/features/xvip/Modal';
import { matchesAllWords } from '@/features/xvip/search-rank';
import { StaffSearch } from '@/features/xvip/StaffSearch';
import { useToast } from '@/features/xvip/toast';
import { Avatar, Card, PageTitle } from '@/features/xvip/ui';

const hm = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}g` : `${h}g${String(m).padStart(2, '0')}`;
};

const congText = (n: number) => (n === 0.5 ? '½' : String(n));

/** So sánh theo tên (từ cuối của họ tên), trùng tên thì so cả họ tên */
const byName = (a: string, b: string) => {
  const given = (s: string) => s.trim().split(/\s+/).pop() ?? '';
  return given(a).localeCompare(given(b), 'vi') || a.localeCompare(b, 'vi');
};

/** Người đang làm lên đầu, còn lại xếp theo tên */
function sortWorkingFirst<T>(list: T[], isWorking: (item: T) => boolean, nameOf: (item: T) => string): T[] {
  return [...list].sort((a, b) => Number(isWorking(b)) - Number(isWorking(a)) || byName(nameOf(a), nameOf(b)));
}

/** Mô tả một ô công: vào / ra lúc nào, ca nào, số phút được tính, muộn hay sớm */
function cellSummary(cell: AttendanceDayCell): string {
  if (cell.status === 'auto_out') {
    return `Vào lúc ${formatTime(cell.firstAt!)}, quên quẹt ra nên hệ thống tự chấm ra lúc 23:59 và không tính công. Admin chỉnh tay nếu cần.`;
  }
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
/** Lịch trên điện thoại bắt đầu từ thứ Hai */
const WEEKDAY_MON_FIRST = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

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

/** Một dòng "nhãn ... giá trị" trong khung chi tiết ô công */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <span className="tnum text-right text-sm font-bold text-slate-900 dark:text-white">{children}</span>
    </div>
  );
}

/** Chi tiết một ô công trong form chỉnh tay: mỗi thông tin một dòng, kết quả tự tính nằm riêng ở cuối */
function CellDetail({ cell }: { cell: AttendanceDayCell }) {
  const noShiftData = ['auto_out', 'missing_out', 'working', 'not_in'].includes(cell.status);
  const detailed = !noShiftData && !!cell.shift && !!cell.firstAt && !!cell.lastAt;
  const late = lateText(cell.lateMinutes, cell.earlyLeaveMinutes);
  return (
    <div className="rounded-xl bg-slate-50 px-3.5 py-1 dark:bg-slate-800/50">
      {detailed ? (
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          <InfoRow label="Giờ vào">{formatTime(cell.firstAt!)}</InfoRow>
          <InfoRow label="Giờ ra">{formatTime(cell.lastAt!)}</InfoRow>
          <InfoRow label="Ca làm">{cell.shift}</InfoRow>
          <InfoRow label="Thời gian tính">{durationText(cell.minutes)}</InfoRow>
          {late && (
            <div className="py-2 text-sm font-bold text-amber-600 dark:text-amber-400">{late}</div>
          )}
        </div>
      ) : (
        <p className="py-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{cellSummary(cell)}</p>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 py-2.5 dark:border-slate-700">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Hệ thống tự tính</span>
        <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-sm font-black text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
          {congText(cell.autoCong)} công
        </span>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-slate-400">{hint}</span>}
    </label>
  );
}

/** Admin chọn ca thật của một ngày: bấm Lưu thì hệ thống mới tính lại vào muộn / ra sớm / công theo ca này */
function ShiftPicker({
  shifts,
  shiftStart,
  source,
  disabled,
  onChange,
}: {
  shifts: ShiftOption[];
  shiftStart: number | null;
  source: 'auto' | 'default' | 'forced' | null;
  disabled: boolean;
  onChange: (shiftStart: number | null) => Promise<void>;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
      <span>Ca làm</span>
      <ShiftSelect
        shifts={shifts}
        value={source === 'forced' && shiftStart !== null ? String(shiftStart) : 'auto'}
        autoLabel="Tự đoán / ca mặc định"
        ariaLabel="Chọn ca làm của ngày này"
        disabled={disabled}
        onSave={(v) => onChange(v === 'auto' ? null : Number(v))}
      />
      {source === 'forced' && (
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          Admin đã chọn tay, chọn &ldquo;Tự đoán&rdquo; rồi Lưu để về như máy tính
        </span>
      )}
    </div>
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
  const staffToday = useMemo(
    () => sortWorkingFirst(dayLog?.staff ?? [], (s) => s.status === 'working', (s) => s.fullName),
    [dayLog],
  );
  const workingIds = useMemo(
    () => new Set(staffToday.filter((s) => s.status === 'working').map((s) => s.userId)),
    [staffToday],
  );
  const monthStaff = useMemo(
    () => sortWorkingFirst(data?.staff ?? [], (s) => workingIds.has(s.id), (s) => s.fullName),
    [data, workingIds],
  );
  // Ô tìm nhân viên theo tên: lọc cả thẻ "Hôm nay" lẫn bảng tháng; số liệu tổng vẫn tính trên mọi người
  const [search, setSearch] = useState('');
  const matchesSearch = (name: string) => !search.trim() || matchesAllWords(name, search);
  const visibleToday = staffToday.filter((u) => matchesSearch(u.fullName));
  const visibleMonthStaff = monthStaff.filter((s) => matchesSearch(s.fullName));
  const workingCount = staffToday.filter((s) => s.status === 'working').length;
  const doneCount = staffToday.filter((s) => s.status === 'done').length;
  const setOverride = useSetAttendanceOverride();
  const setShift = useSetShiftOverride();
  const shiftOptions = data?.shifts ?? dayLog?.shifts ?? [];
  const changeShift = async (userId: number, day: string, shiftStart: number | null) => {
    try {
      await setShift.mutateAsync({ userId, day, shiftStart });
      showToast(shiftStart === null ? 'Đã bỏ chọn ca, quay về tự đoán.' : 'Đã đổi ca, hệ thống đã tính lại.');
    } catch (err) {
      showToast(`Lỗi: ${err instanceof ApiError ? err.message : 'Không đổi được ca.'}`);
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

  // Chi tiết cả ngày: bấm vào tiêu đề cột ngày để xem mọi nhân viên vào/ra ca nào, muộn hay không
  const [dayDetail, setDayDetail] = useState<string | null>(null);
  const dayRows = useMemo(() => {
    if (!dayDetail) return [];
    return monthStaff
      .map((s) => ({ staff: s, cell: s.days[dayDetail] as AttendanceDayCell | undefined }))
      .sort((a, b) => Number(!!b.cell?.firstAt) - Number(!!a.cell?.firstAt));
  }, [dayDetail, monthStaff]);

  // Xuất bảng chấm công của tháng đang xem ra Excel
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await attendanceApi.exportMonth(month);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất bảng chấm công ra file Excel.');
    } catch (err) {
      showToast(`Lỗi: ${err instanceof ApiError ? err.message : 'Không xuất được bảng chấm công.'}`);
    } finally {
      setExporting(false);
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
  // Ngày 1 rơi vào thứ mấy (thứ Hai = 0) để lịch trên điện thoại chừa đúng số ô trống đầu tháng
  const leadingBlanks = days[0] ? (days[0].weekday + 6) % 7 : 0;

  /** Màu, nhãn và chú thích của một ô công; dùng chung cho bảng (máy tính) và lịch (điện thoại) */
  const cellInfo = (s: AttendanceStaff, key: string, day: number) => {
    const cell = s.days[key] as AttendanceDayCell | undefined;
    // Quên quẹt ra: hiện "?" để Admin thấy và chỉnh tay
    const noOut = !!cell && (cell.status === 'missing_out' || cell.status === 'auto_out') && !cell.overridden;
    const has = !!cell && (cell.cong > 0 || cell.minutes > 0 || cell.overridden);
    const tone = !cell
      ? 'text-slate-300 dark:text-slate-600'
      : cell.cong > 0
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
        : cell.minutes > 0 || cell.overridden || noOut
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
          : 'text-slate-300 dark:text-slate-600';
    const head = `${s.fullName} · ${String(day).padStart(2, '0')}/${data?.month.slice(5) ?? ''}`;
    const title = cell
      ? `${head}\n${cellSummary(cell)}${
          cell.overridden ? `\nĐã chỉnh tay: ${cell.cong} công${cell.note ? ` (${cell.note})` : ''}` : ''
        }`
      : `${head}\nChưa có dữ liệu`;
    // Giờ vào luôn có khi đã quẹt; giờ ra chỉ có khi thật sự quẹt ra (quên quẹt ra thì hệ thống tự chấm 23:59, không phải giờ thật)
    const inTime = cell?.firstAt ? formatTime(cell.firstAt) : null;
    const hasRealOut = !!cell?.lastAt && !['auto_out', 'missing_out', 'working'].includes(cell.status);
    const outTime = cell && hasRealOut && cell.lastAt ? formatTime(cell.lastAt) : null;
    return { cell, noOut, has, tone, title, inTime, outTime };
  };

  return (
    <>
      <PageTitle
        actions={
          <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || isLoading || !data}
              className="btn-3d btn-3d-white flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              <DownloadSimple size={16} weight="bold" />
              {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
          )}
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

      {/* Nhân viên thường chỉ thấy công của chính mình nên không cần ô tìm */}
      {isAdmin && (
        <div className="mb-5">
          <StaffSearch
            value={search}
            onChange={setSearch}
            shown={visibleMonthStaff.length}
            total={monthStaff.length}
          />
        </div>
      )}

      {/* Bảng công cả tháng */}
      <Card
        className="mt-5 !p-0 overflow-hidden"
        title={`Bảng chấm công ${monthLabel(month).toLowerCase()}`}
        action={
          <>
            <span className="hidden text-xs font-medium text-slate-500 dark:text-slate-400 md:inline">
              {isAdmin
                ? 'Bấm vào một ô để xem giờ vào ra hoặc chỉnh tay · ô viền xanh là công đã chỉnh tay · dấu ? là quên quẹt ra'
                : 'Rê chuột vào một ô để xem giờ vào ra · ô viền xanh là công Admin đã chỉnh · dấu ? là quên quẹt ra'}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 md:hidden">
              {isAdmin ? 'Chạm vào ngày để chỉnh công' : 'Chạm vào ngày để xem chi tiết'} · trong ô: giờ vào ở trên, giờ ra
              ở dưới · viền xanh là công đã chỉnh · ? là quên quẹt ra
            </span>
          </>
        }
      >
        {/* Máy tính: bảng 31 cột ngày */}
        <div className="hidden overflow-x-auto md:block">
          <table className="border-collapse text-center">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-48 bg-slate-100 px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Nhân viên
                </th>
                {days.map((d) => (
                  <th
                    key={d.key}
                    className={`min-w-16 border-l border-slate-200 px-1 py-1 text-[11px] font-bold dark:border-slate-700 ${
                      d.weekday === 0
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    } ${d.key === today ? 'underline decoration-blue-500 decoration-2 underline-offset-2' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setDayDetail(d.key)}
                      title="Bấm để xem chi tiết cả ngày"
                      className="w-full cursor-pointer rounded-md py-0.5 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                    >
                      <div>{d.d}</div>
                      <div className="font-medium opacity-70">{WEEKDAY[d.weekday]}</div>
                    </button>
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
              ) : !data || visibleMonthStaff.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 2} className="p-8 text-center text-sm font-semibold text-slate-500">
                    {!data || monthStaff.length === 0
                      ? 'Chưa có nhân viên nào.'
                      : `Không tìm thấy nhân viên "${search.trim()}".`}
                  </td>
                </tr>
              ) : (
                visibleMonthStaff.map((s) => (
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
                      const { cell, noOut, has, tone, title, inTime, outTime } = cellInfo(s, d.key, d.d);
                      return (
                        <td key={d.key} className="border-l border-slate-100 p-0.5 dark:border-slate-800">
                          <button
                            type="button"
                            title={title}
                            onClick={isAdmin ? () => openEdit(s, d.key) : undefined}
                            className={`tnum flex h-14 w-full min-w-16 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-black leading-none transition-colors ${
                              isAdmin ? 'hover:ring-2 hover:ring-blue-400' : 'cursor-default'
                            } ${tone} ${
                              cell?.overridden ? 'ring-2 ring-blue-500' : ''
                            }`}
                          >
                            <span className="text-sm">{cell && has ? congText(cell.cong) : noOut ? '?' : '·'}</span>
                            {inTime && <span className="text-[10px] font-semibold opacity-80">vào {inTime}</span>}
                            {outTime && <span className="text-[10px] font-semibold opacity-80">ra {outTime}</span>}
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

        {/* Điện thoại: mỗi nhân viên một lịch tháng 7 cột, chạm vào ngày để xem hoặc chỉnh */}
        <div className="space-y-3 p-3 md:hidden">
          {isLoading ? (
            <p className="p-6 text-center text-sm font-bold text-blue-600 animate-pulse">Đang tải bảng chấm công...</p>
          ) : !data || visibleMonthStaff.length === 0 ? (
            <p className="p-6 text-center text-sm font-semibold text-slate-500">
              {!data || monthStaff.length === 0
                ? 'Chưa có nhân viên nào.'
                : `Không tìm thấy nhân viên "${search.trim()}".`}
            </p>
          ) : (
            visibleMonthStaff.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60"
              >
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={s.fullName} />
                    <span className="truncate text-sm font-extrabold text-slate-900 dark:text-white">{s.fullName}</span>
                  </div>
                  <div className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <span className="tnum text-base font-black">{s.totalCong}</span>
                    <span className="ml-1 text-[10px] font-bold uppercase">công</span>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAY_MON_FIRST.map((w) => (
                    <div
                      key={w}
                      className={`pb-0.5 text-[10px] font-bold ${w === 'CN' ? 'text-rose-500' : 'text-slate-400'}`}
                    >
                      {w}
                    </div>
                  ))}
                  {Array.from({ length: leadingBlanks }, (_, i) => (
                    <div key={`blank-${i}`} />
                  ))}
                  {days.map((d) => {
                    const { cell, noOut, has, tone, inTime, outTime } = cellInfo(s, d.key, d.d);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => (isAdmin ? openEdit(s, d.key) : setDayDetail(d.key))}
                        aria-label={`${s.fullName} ngày ${d.d}`}
                        className={`flex ${
                          inTime ? 'h-[4.5rem]' : 'h-11'
                        } flex-col items-center justify-center rounded-lg leading-none ${
                          tone.includes('bg-') ? '' : 'bg-slate-50 dark:bg-slate-800/40'
                        } ${tone} ${cell?.overridden ? 'ring-2 ring-blue-500' : ''} ${
                          d.key === today ? 'outline outline-2 outline-offset-1 outline-blue-500' : ''
                        }`}
                      >
                        <span className={`text-[9px] font-semibold ${d.weekday === 0 ? 'text-rose-500' : 'opacity-60'}`}>
                          {d.d}
                        </span>
                        <span className="tnum mt-0.5 text-sm font-black">
                          {cell && has ? congText(cell.cong) : noOut ? '?' : '·'}
                        </span>
                        {/* Giờ vào ở trên, giờ ra ở dưới */}
                        {inTime && <span className="tnum mt-1 text-[9px] font-bold opacity-80">{inTime}</span>}
                        {outTime && <span className="tnum mt-0.5 text-[9px] font-bold opacity-80">{outTime}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        {isAdmin && (
          <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Số công này được tự động điền vào ô Công thực tế ở trang Bảng lương cho nhân viên chưa có công đã lưu.
          </p>
        )}
      </Card>

      {/* Tình hình đi làm hôm nay theo lượt quẹt máy chấm công: chưa quẹt, đang làm, đã quẹt ra */}
      <Card
        className="mt-5"
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
        {visibleToday.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {staffToday.length === 0 ? 'Chưa có nhân viên nào.' : `Không tìm thấy nhân viên "${search.trim()}".`}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleToday.map((u) => {
              const dot =
                u.status === 'working'
                  ? 'bg-emerald-500'
                  : u.status === 'done'
                    ? 'bg-slate-400'
                    : u.status === 'auto_out' || u.status === 'missing_out'
                      ? 'bg-amber-500'
                      : 'bg-rose-400';
              const label =
                u.status === 'working'
                  ? `Đang làm · vào lúc ${formatTime(u.firstAt!)}`
                  : u.status === 'done'
                    ? `Vào ${formatTime(u.firstAt!)} · ra ${formatTime(u.lastAt!)}`
                    : u.status === 'auto_out'
                      ? `Vào ${formatTime(u.firstAt!)} · quên quẹt ra, tự chấm ra 23:59`
                      : u.status === 'missing_out'
                        ? `Vào ${formatTime(u.firstAt!)} · quên quẹt ra`
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
                          {u.status === 'working'
                            ? 'chưa chốt công'
                            : u.status === 'auto_out' || u.status === 'missing_out'
                              ? '0 công (quên quẹt ra)'
                              : '0 công'}
                        </div>
                      )}
                    </div>
                  </div>
                  {late && (
                    <div className="mt-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">{late}</div>
                  )}
                  {isAdmin && u.status === 'done' && (
                    <ShiftPicker
                      shifts={shiftOptions}
                      shiftStart={u.shiftStart}
                      source={u.shiftSource}
                      disabled={setShift.isPending}
                      onChange={(v) => changeShift(u.userId, dayLog!.day, v)}
                    />
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
      <Card className="mt-5" title="Quy tắc tính công theo ca">
        <div className="space-y-4">
            <div className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <p>
                Công tính theo lượt quẹt trên máy chấm công, không dựa vào đăng nhập. Lượt quẹt đầu trong ngày là giờ
                vào, lượt quẹt tiếp theo là giờ ra; quẹt lại trong vòng 15 phút chỉ tính một lượt. <b>Đã chấm ra rồi
                thì quẹt thêm không tính nữa</b>, hôm sau mới tính lại. Hết ngày lúc 23:59, ai quên quẹt ra sẽ được hệ
                thống tự chấm ra và <b>không tính công</b> ngày đó (Admin vẫn chỉnh tay được).
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
                  Có mặt đủ cả khung giờ của ca (ra đúng hoặc sau giờ kết thúc). Vào muộn dưới 30 phút vẫn đủ công,
                  chỉ bị trừ tiền theo phút muộn. Không trừ nghỉ trưa.
                </p>
                <div className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  👉 Đủ cả ca = 1 công
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">0,5 công</span>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Vào muộn từ 30 phút trở lên (không trừ tiền vào muộn nữa), hoặc ra sớm, nhưng có mặt từ một nửa độ dài của ca trở lên (ca 6h - 15h30
                  dài 9g30 thì cần từ 4g45). Ít hơn một nửa ca thì 0 công.
                </p>
                <div className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  👉 Đủ nửa ca = 0,5 công
                </div>
              </div>
            </div>
          </div>
      </Card>

      {dayDetail && (
        <Modal
          title={`Chấm công ngày ${Number(dayDetail.slice(8))}/${dayDetail.slice(5, 7)}/${dayDetail.slice(0, 4)}`}
          onClose={() => setDayDetail(null)}
        >
          <div className="max-h-[70vh] space-y-2 overflow-y-auto">
            {dayRows.map(({ staff, cell }) => {
              const late = cell ? lateText(cell.lateMinutes, cell.earlyLeaveMinutes) : '';
              const hasPunch = !!cell?.firstAt;
              return (
                <div
                  key={staff.id}
                  className={`rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40 ${
                    hasPunch ? '' : 'opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={staff.fullName} />
                      <span className="truncate text-sm font-extrabold text-slate-900 dark:text-white">
                        {staff.fullName}
                      </span>
                    </div>
                    {cell && cell.cong > 0 && (
                      <span className="shrink-0 text-xs font-black text-blue-600 dark:text-blue-400">
                        {congText(cell.cong)} công
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                    {cell ? cellSummary(cell) : 'Không có dữ liệu chấm công.'}
                  </div>
                  {hasPunch && cell && cell.shift && (
                    <div
                      className={`mt-1 text-xs font-bold ${
                        late ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {late || 'Đúng giờ, không đi muộn'}
                    </div>
                  )}
                  {isAdmin && cell && cell.status === 'done' && cell.shift && (
                    <ShiftPicker
                      shifts={shiftOptions}
                      shiftStart={cell.shiftStart}
                      source={cell.shiftSource}
                      disabled={setShift.isPending}
                      onChange={(v) => changeShift(staff.id, dayDetail, v)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {isAdmin && editing && data && (
        <Modal
          title={`Công ${String(Number(editing.day.slice(8)))}/${editing.day.slice(5, 7)} · ${editing.staff.fullName}`}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            {editingCell ? (
              <CellDetail cell={editingCell} />
            ) : (
              <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm dark:bg-slate-800/50">
                Ngày này chưa có dữ liệu chấm công.
              </div>
            )}
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
