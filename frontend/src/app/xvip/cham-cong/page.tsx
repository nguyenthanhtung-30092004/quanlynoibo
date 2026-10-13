'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CaretLeft, CaretRight, CrosshairSimple, FloppyDisk, MapPin } from '@phosphor-icons/react';
import { ApiError } from '@/lib/api-client';
import { monthLabel, shiftMonth } from '@/lib/month';
import { getVnToday } from '@/lib/time';
import { MoneyInput } from '@/features/payroll/MoneyInput';
import { useAttendanceMonth, useSaveAttendanceConfig, useSetAttendanceOverride } from '@/features/attendance/hooks';
import type { AttendanceConfig, AttendanceStaff } from '@/features/attendance/types';
import { Modal } from '@/features/xvip/Modal';
import { useToast } from '@/features/xvip/toast';
import { Avatar, Card, PageTitle } from '@/features/xvip/ui';

const hm = (minutes: number) => `${Math.floor(minutes / 60)}g${String(minutes % 60).padStart(2, '0')}`;
const congText = (n: number) => (n === 0.5 ? '½' : String(n));
const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

interface ConfigDraft {
  lat: string;
  lng: string;
  radiusM: number;
  maxAccuracyM: number;
  fullMinutes: number;
  halfMinutes: number;
}

const toDraft = (c: AttendanceConfig): ConfigDraft => ({
  lat: c.workplace.lat === null ? '' : String(c.workplace.lat),
  lng: c.workplace.lng === null ? '' : String(c.workplace.lng),
  radiusM: c.radiusM,
  maxAccuracyM: c.maxAccuracyM,
  fullMinutes: c.fullMinutes,
  halfMinutes: c.halfMinutes,
});

/** Chuỗi nhập tay → số toạ độ; rỗng = chưa cài; sai khoảng = lỗi */
function parseCoord(text: string, min: number, max: number): number | null | 'invalid' {
  const s = text.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= min && n <= max ? n : 'invalid';
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
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
  const saveConfig = useSaveAttendanceConfig();
  const setOverride = useSetAttendanceOverride();

  // Bản cấu hình đang sửa; chỉ đồng bộ lại khi cấu hình trên server thật sự đổi (đổi tháng không làm mất phần đang sửa)
  const [draft, setDraft] = useState<ConfigDraft | null>(null);
  const configKey = data ? JSON.stringify(data.config) : '';
  useEffect(() => {
    if (data) setDraft(toDraft(data.config));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  const draftDirty = !!data && !!draft && JSON.stringify(draft) !== JSON.stringify(toDraft(data.config));
  const configured = !!data && data.config.workplace.lat !== null && data.config.workplace.lng !== null;

  const [locating, setLocating] = useState(false);
  const [locateInfo, setLocateInfo] = useState('');

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      showToast('Lỗi: Trình duyệt này không hỗ trợ định vị.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft((d) =>
          d ? { ...d, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) } : d,
        );
        setLocateInfo(`Đã lấy vị trí của bạn (sai số khoảng ${Math.round(pos.coords.accuracy)} mét). Bấm Lưu để áp dụng.`);
        setLocating(false);
      },
      (err) => {
        showToast(
          err.code === err.PERMISSION_DENIED
            ? 'Lỗi: Trình duyệt đang chặn vị trí. Hãy cho phép Vị trí cho trang này rồi thử lại.'
            : 'Lỗi: Không lấy được vị trí, thử lại sau.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  };

  const save = async () => {
    if (!draft) return;
    const lat = parseCoord(draft.lat, -90, 90);
    const lng = parseCoord(draft.lng, -180, 180);
    if (lat === 'invalid' || lng === 'invalid') {
      showToast('Lỗi: Vĩ độ phải từ -90 đến 90 và kinh độ từ -180 đến 180.');
      return;
    }
    if ((lat === null) !== (lng === null)) {
      showToast('Lỗi: Cần nhập đủ cả vĩ độ và kinh độ (hoặc để trống cả hai).');
      return;
    }
    try {
      await saveConfig.mutateAsync({
        fullMinutes: draft.fullMinutes,
        halfMinutes: draft.halfMinutes,
        workplace: { lat, lng },
        radiusM: draft.radiusM,
        maxAccuracyM: draft.maxAccuracyM,
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

      {data && !configured && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Chưa cài vị trí công ty nên hiện <b>chưa ai được tính công</b>. Hãy cài vị trí ở khung bên dưới.
        </div>
      )}

      {/* Quy tắc + vị trí công ty */}
      <Card title="Quy tắc và vị trí công ty">
        {draft ? (
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Nhân viên dùng <b>máy tính</b>, <b>có thao tác</b> chuột hoặc bàn phím (trong 3 phút gần nhất) và đang ở trong
              bán kính công ty thì mỗi phút đó được tính. Cuối ngày đủ số phút bên dưới thì được 1 công. Điện thoại và máy
              tính bảng không tính.
            </p>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/30">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-white">
                  <MapPin size={16} weight="fill" className="text-blue-600" /> Vị trí công ty
                </h3>
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                  className="btn-3d btn-3d-white flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  <CrosshairSimple size={14} weight="bold" />
                  {locating ? 'Đang lấy vị trí...' : 'Lấy vị trí hiện tại của tôi'}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Vĩ độ (lat)">
                  <input
                    className="input-3d !h-10 tnum"
                    inputMode="decimal"
                    placeholder="VD: 21.028511"
                    value={draft.lat}
                    onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
                  />
                </Field>
                <Field label="Kinh độ (lng)">
                  <input
                    className="input-3d !h-10 tnum"
                    inputMode="decimal"
                    placeholder="VD: 105.804817"
                    value={draft.lng}
                    onChange={(e) => setDraft({ ...draft, lng: e.target.value })}
                  />
                </Field>
                <Field label="Bán kính cho phép (mét)" hint="Cách công ty không quá mức này mới tính.">
                  <MoneyInput
                    className="!h-10"
                    ariaLabel="Bán kính cho phép"
                    value={draft.radiusM}
                    onChange={(radiusM) => setDraft({ ...draft, radiusM })}
                  />
                </Field>
                <Field label="Sai số định vị tối đa (mét)" hint="Định vị thô hơn mức này thì không tin.">
                  <MoneyInput
                    className="!h-10"
                    ariaLabel="Sai số định vị tối đa"
                    value={draft.maxAccuracyM}
                    onChange={(maxAccuracyM) => setDraft({ ...draft, maxAccuracyM })}
                  />
                </Field>
              </div>
              {locateInfo && <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{locateInfo}</p>}
              {draft.lat && draft.lng && parseCoord(draft.lat, -90, 90) !== 'invalid' && parseCoord(draft.lng, -180, 180) !== 'invalid' && (
                <a
                  href={`https://www.google.com/maps?q=${draft.lat.trim().replace(',', '.')},${draft.lng.trim().replace(',', '.')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Xem vị trí này trên bản đồ
                </a>
              )}
              <p className="mt-2 text-[11px] leading-snug text-slate-400">
                Mẹo: ngồi tại công ty, dùng máy tính có Wi-Fi rồi bấm &ldquo;Lấy vị trí hiện tại của tôi&rdquo;. Định vị trên máy
                tính dựa vào Wi-Fi và mạng nên thường lệch vài chục đến vài trăm mét, đừng đặt bán kính quá nhỏ.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Số phút để được 1 công" hint={`${hm(draft.fullMinutes)} (420 phút = 7 tiếng)`}>
                <MoneyInput
                  className="!h-10"
                  ariaLabel="Số phút để được 1 công"
                  value={draft.fullMinutes}
                  onChange={(fullMinutes) => setDraft({ ...draft, fullMinutes: Math.min(1440, fullMinutes) })}
                />
              </Field>
              <Field label="Số phút để được nửa công" hint="Để trống / 0 nếu không tính nửa công.">
                <MoneyInput
                  className="!h-10"
                  ariaLabel="Số phút để được nửa công"
                  value={draft.halfMinutes}
                  onChange={(halfMinutes) => setDraft({ ...draft, halfMinutes: Math.min(1440, halfMinutes) })}
                />
              </Field>
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
            Bấm vào một ô để xem giờ làm hoặc chỉnh tay · ô viền xanh là công đã chỉnh tay
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
                        ? `${s.fullName} · ${String(d.d).padStart(2, '0')}/${data.month.slice(5)}\n${hm(cell.minutes)} có thao tác tại công ty → tự tính ${cell.autoCong} công${
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
          Số công này điền thẳng vào Bảng lương được bằng nút &ldquo;Điền công từ chấm công&rdquo; ở trang Bảng lương.
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
                  Có thao tác tại công ty <b className="tnum">{hm(editingCell.minutes)}</b> → hệ thống tự tính{' '}
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
