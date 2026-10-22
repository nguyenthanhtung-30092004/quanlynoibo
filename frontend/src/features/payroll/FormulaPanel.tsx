'use client';

import type { ReactNode } from 'react';
import { ArrowCounterClockwise, Plus, Trash } from '@phosphor-icons/react';
import { money } from '@/features/xvip/data';
import { MoneyInput } from './MoneyInput';
import { dayBonus, standardDays } from './calc';
import type { PayrollConfig } from './types';

export const DEFAULT_CONFIG: PayrollConfig = {
  levels: [
    { label: 'Bậc 1', note: 'Làm việc dưới 1 năm', base: 4_200_000 },
    { label: 'Bậc 2', note: 'Làm việc trên 1 năm', base: 4_400_000 },
    { label: 'Bậc 3', note: 'Làm việc trên 2 năm', base: 4_600_000 },
    { label: 'Bậc 4', note: 'Làm việc trên 3 năm', base: 4_800_000 },
  ],
  standardDaysOffset: 4,
  topBase: { threshold: 55_000_000, base: 5_000_000 },
  dailyBonuses: [
    { threshold: 2_000_000, bonus: 50_000 },
    { threshold: 2_500_000, bonus: 100_000 },
  ],
  monthlyBonus: { threshold: 30_000_000, bonus: 100_000 },
  overRate: { threshold: 30_000_000, percent: 10 },
  latePenaltyPerMinute: 0,
  overtimePerHour: 25_000,
};

const vnd = (n: number) => `${money(Math.round(n))}đ`;

/** Một quy chế: số thứ tự, tên, mô tả một câu, phần điền số và ví dụ tính ngay bằng số đang nhập */
function Rule({
  no,
  title,
  desc,
  example,
  children,
}: {
  no: number;
  title: string;
  desc: string;
  example?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
          {no}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-black text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-0.5 text-sm leading-snug text-slate-600 dark:text-slate-300">{desc}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
      {example && (
        <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          <b>Ví dụ:</b> {example}
        </p>
      )}
    </section>
  );
}

/** Ô nhập có nhãn phía trên, để nhìn vào biết ô đó là gì */
function Field({ label, unit, children }: { label: string; unit?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">
        {label}
        {unit && <span className="ml-1 font-medium text-slate-400">({unit})</span>}
      </span>
      {children}
    </label>
  );
}

const COL_HEAD = 'text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const DEL_BTN =
  'flex size-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-950/40';
const ADD_BTN =
  'mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30';

/** Bảng công thức tính lương: mọi mốc, mức thưởng, tỷ lệ đều điền tay được */
export function FormulaPanel({
  config,
  onChange,
  daysInMonth,
}: {
  config: PayrollConfig;
  onChange: (next: PayrollConfig) => void;
  daysInMonth: number;
}) {
  const set = (patch: Partial<PayrollConfig>) => onChange({ ...config, ...patch });
  const std = standardDays(daysInMonth, config.standardDaysOffset);

  // Số dùng cho các ví dụ
  const sample = config.levels[0];
  const sampleWork = Math.max(0, std - 2);
  const topDaily = config.dailyBonuses.reduce((m, t) => Math.max(m, t.threshold), 0);
  const sampleOverCommission = config.overRate.threshold + 5_000_000;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        {/* 1. Lương cứng theo bậc */}
        <Rule
          no={1}
          title="Lương cứng theo bậc"
          desc="Mỗi nhân viên thuộc một bậc, bậc quyết định lương cứng cả tháng. Chọn bậc cho từng người ở bảng lương bên dưới."
          example={
            sample && (
              <>
                {sample.label} có lương cứng {vnd(sample.base)}, tháng này {std} công. Làm {sampleWork}/{std} công thì
                lương cứng = {money(sample.base)} ÷ {std} × {sampleWork} = <b>{vnd((sample.base / std) * sampleWork)}</b>.
              </>
            )
          }
        >
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_9rem_2.25rem] items-end gap-x-2 gap-y-2">
            <span className={COL_HEAD}>Tên bậc</span>
            <span className={COL_HEAD}>Điều kiện (ghi chú)</span>
            <span className={COL_HEAD}>Lương cứng / tháng</span>
            <span />
            {config.levels.map((lv, i) => (
              <div key={i} className="contents">
                <input
                  className="input-3d !h-10"
                  value={lv.label}
                  aria-label={`Tên bậc ${i + 1}`}
                  onChange={(e) =>
                    set({ levels: config.levels.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                  }
                />
                <input
                  className="input-3d !h-10"
                  value={lv.note}
                  placeholder="VD: Làm việc trên 1 năm"
                  aria-label={`Điều kiện ${lv.label}`}
                  onChange={(e) =>
                    set({ levels: config.levels.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })
                  }
                />
                <MoneyInput
                  className="!h-10"
                  ariaLabel={`Lương cứng ${lv.label}`}
                  value={lv.base}
                  onChange={(base) => set({ levels: config.levels.map((x, j) => (j === i ? { ...x, base } : x)) })}
                />
                <button
                  type="button"
                  disabled={config.levels.length <= 1}
                  onClick={() => set({ levels: config.levels.filter((_, j) => j !== i) })}
                  title="Xóa bậc này"
                  aria-label={`Xóa ${lv.label}`}
                  className={DEL_BTN}
                >
                  <Trash size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={config.levels.length >= 10}
            onClick={() =>
              set({
                levels: [
                  ...config.levels,
                  { label: `Bậc ${config.levels.length + 1}`, note: '', base: config.levels.at(-1)?.base ?? 0 },
                ],
              })
            }
            className={ADD_BTN}
          >
            <Plus size={13} weight="bold" /> Thêm bậc
          </button>
        </Rule>

        <div className="space-y-4">
          {/* 2. Ngày công */}
          <Rule
            no={2}
            title="Công chuẩn của tháng"
            desc="Công chuẩn là số công đi làm đủ để nhận trọn lương cứng. Làm nhiều hơn công chuẩn thì được nhiều hơn."
            example={
              <>
                Tháng {daysInMonth} ngày − {config.standardDaysOffset} ngày nghỉ = <b>{std} công</b>. Các tháng khác:{' '}
                {[31, 30, 29, 28]
                  .filter((d) => d !== daysInMonth)
                  .map((d) => `${d} ngày → ${standardDays(d, config.standardDaysOffset)} công`)
                  .join(', ')}
                .
              </>
            }
          >
            <div className="max-w-xs">
              <Field label="Số ngày trừ đi (ngày nghỉ) để ra công chuẩn" unit="ngày">
                <MoneyInput
                  className="!h-10"
                  ariaLabel="Số ngày trừ để ra công chuẩn"
                  value={config.standardDaysOffset}
                  onChange={(standardDaysOffset) => set({ standardDaysOffset: Math.min(28, standardDaysOffset) })}
                />
              </Field>
            </div>
          </Rule>

          {/* 3. Mốc lương cứng cao */}
          <Rule
            no={3}
            title="Đạt doanh số cao thì được lương cứng cao"
            desc="Tháng nào hoa hồng đạt mốc này thì lương cứng của tháng đó lấy mức bên dưới, thay cho lương theo bậc."
            example={
              <>
                Hoa hồng tháng đạt {vnd(config.topBase.threshold)} trở lên → lương cứng <b>{vnd(config.topBase.base)}</b>{' '}
                (không phân biệt bậc).
              </>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Hoa hồng cả tháng đạt từ" unit="đ">
                <MoneyInput
                  className="!h-10"
                  ariaLabel="Mốc đạt lương cứng cao"
                  value={config.topBase.threshold}
                  onChange={(threshold) => set({ topBase: { ...config.topBase, threshold } })}
                />
              </Field>
              <Field label="Thì lương cứng của tháng là" unit="đ">
                <MoneyInput
                  className="!h-10"
                  ariaLabel="Lương cứng khi đạt mốc"
                  value={config.topBase.base}
                  onChange={(base) => set({ topBase: { ...config.topBase, base } })}
                />
              </Field>
            </div>
          </Rule>
        </div>

        {/* 4. Thưởng ngày */}
        <Rule
          no={4}
          title="Thưởng theo ngày"
          desc="Ngày nào hoa hồng đạt mốc thì được thưởng thêm. Một ngày chỉ nhận một mốc cao nhất, không cộng dồn."
          example={
            topDaily > 0 && (
              <>
                Một ngày hoa hồng {vnd(topDaily)} → thưởng <b>{vnd(dayBonus(topDaily, config.dailyBonuses))}</b>
                {config.dailyBonuses.length > 1 && ' (chỉ tính mốc cao nhất, không cộng mốc thấp hơn)'}.
              </>
            )
          }
        >
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-end gap-x-2 gap-y-2">
            <span className={COL_HEAD}>Hoa hồng trong ngày từ (đ)</span>
            <span className={COL_HEAD}>Thì thưởng (đ)</span>
            <span />
            {config.dailyBonuses.map((t, i) => (
              <div key={i} className="contents">
                <MoneyInput
                  className="!h-10"
                  ariaLabel={`Mốc thưởng ngày ${i + 1}`}
                  value={t.threshold}
                  onChange={(threshold) =>
                    set({ dailyBonuses: config.dailyBonuses.map((x, j) => (j === i ? { ...x, threshold } : x)) })
                  }
                />
                <MoneyInput
                  className="!h-10"
                  ariaLabel={`Tiền thưởng ngày ${i + 1}`}
                  value={t.bonus}
                  onChange={(bonus) =>
                    set({ dailyBonuses: config.dailyBonuses.map((x, j) => (j === i ? { ...x, bonus } : x)) })
                  }
                />
                <button
                  type="button"
                  onClick={() => set({ dailyBonuses: config.dailyBonuses.filter((_, j) => j !== i) })}
                  title="Xóa mốc này"
                  aria-label={`Xóa mốc thưởng ngày ${i + 1}`}
                  className={DEL_BTN}
                >
                  <Trash size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={config.dailyBonuses.length >= 10}
            onClick={() => set({ dailyBonuses: [...config.dailyBonuses, { threshold: 0, bonus: 0 }] })}
            className={ADD_BTN}
          >
            <Plus size={13} weight="bold" /> Thêm mốc thưởng ngày
          </button>
        </Rule>

        <div className="space-y-4">
          {/* 5. Thưởng tháng */}
          <Rule
            no={5}
            title="Thưởng theo tháng"
            desc="Tổng hoa hồng cả tháng đạt mốc thì được thưởng thêm một khoản cố định."
            example={
              <>
                Cả tháng đạt {vnd(config.monthlyBonus.threshold)} → thưởng <b>{vnd(config.monthlyBonus.bonus)}</b>.
              </>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Tổng hoa hồng cả tháng đạt từ" unit="đ">
                <MoneyInput
                  className="!h-10"
                  ariaLabel="Mốc thưởng tháng"
                  value={config.monthlyBonus.threshold}
                  onChange={(threshold) => set({ monthlyBonus: { ...config.monthlyBonus, threshold } })}
                />
              </Field>
              <Field label="Thì thưởng" unit="đ">
                <MoneyInput
                  className="!h-10"
                  ariaLabel="Tiền thưởng tháng"
                  value={config.monthlyBonus.bonus}
                  onChange={(bonus) => set({ monthlyBonus: { ...config.monthlyBonus, bonus } })}
                />
              </Field>
            </div>
          </Rule>

          {/* 6. Vượt mốc */}
          <Rule
            no={6}
            title="Thưởng phần doanh số vượt mốc"
            desc="Hoa hồng cả tháng vượt qua mốc này thì nhân viên được hưởng một tỷ lệ % trên chính phần vượt."
            example={
              <>
                Hoa hồng tháng {vnd(sampleOverCommission)} → vượt {vnd(5_000_000)} → được {config.overRate.percent}% ={' '}
                <b>{vnd((5_000_000 * config.overRate.percent) / 100)}</b>.
              </>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Mốc doanh số (hoa hồng cả tháng)" unit="đ">
                <MoneyInput
                  className="!h-10"
                  ariaLabel="Mốc doanh số vượt"
                  value={config.overRate.threshold}
                  onChange={(threshold) => set({ overRate: { ...config.overRate, threshold } })}
                />
              </Field>
              <Field label="Được hưởng trên phần vượt" unit="%">
                <MoneyInput
                  className="!h-10"
                  ariaLabel="Phần trăm trên phần vượt"
                  value={config.overRate.percent}
                  onChange={(percent) => set({ overRate: { ...config.overRate, percent: Math.min(100, percent) } })}
                />
              </Field>
            </div>
          </Rule>

          {/* 7. Trừ tiền vào muộn */}
          <Rule
            no={7}
            title="Trừ tiền khi vào muộn"
            desc="Quẹt vào sau giờ bắt đầu ca thì bị trừ tiền theo từng phút muộn. Số phút lấy từ máy chấm công, cộng dồn cả tháng. Để 0 là không trừ."
            example={
              config.latePenaltyPerMinute > 0 ? (
                <>
                  Cả tháng muộn 90 phút × {vnd(config.latePenaltyPerMinute)}/phút ={' '}
                  <b>−{vnd(90 * config.latePenaltyPerMinute)}</b> trừ vào tổng lương.
                </>
              ) : (
                <>Đang để 0đ/phút nên chưa trừ tiền vào muộn.</>
              )
            }
          >
            <div className="max-w-xs">
              <Field label="Mỗi phút vào muộn bị trừ" unit="đ / phút">
                <MoneyInput
                  className="!h-10"
                  ariaLabel="Tiền trừ mỗi phút vào muộn"
                  value={config.latePenaltyPerMinute}
                  onChange={(latePenaltyPerMinute) => set({ latePenaltyPerMinute })}
                />
              </Field>
            </div>
          </Rule>

          {/* 8. Tiền tăng ca */}
          <Rule
            no={8}
            title="Tiền tăng ca"
            desc="Quẹt ra sau giờ kết thúc ca từ 1 tiếng trở lên thì được tính tăng ca theo mốc 0,5 giờ: 1g15 tính 1 giờ, 1g30 tính 1,5 giờ, 1g45 vẫn tính 1,5 giờ (luôn làm tròn xuống)... tối đa 3 giờ mỗi ngày. Để 0 là không tính."
            example={
              config.overtimePerHour > 0 ? (
                <>
                  Cả tháng tăng ca 6,5 giờ × {vnd(config.overtimePerHour)}/giờ ={' '}
                  <b>+{vnd(6.5 * config.overtimePerHour)}</b> cộng vào tổng lương.
                </>
              ) : (
                <>Đang để 0đ/giờ nên chưa tính tiền tăng ca.</>
              )
            }
          >
            <div className="max-w-xs">
              <Field label="Mỗi giờ tăng ca được" unit="đ / giờ">
                <MoneyInput
                  className="!h-10"
                  ariaLabel="Tiền tăng ca mỗi giờ"
                  value={config.overtimePerHour}
                  onChange={(overtimePerHour) => set({ overtimePerHour })}
                />
              </Field>
            </div>
          </Rule>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange(DEFAULT_CONFIG)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowCounterClockwise size={14} weight="bold" /> Khôi phục công thức theo quy chế ban đầu
      </button>
    </div>
  );
}
