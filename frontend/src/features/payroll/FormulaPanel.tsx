'use client';

import type { ReactNode } from 'react';
import { ArrowCounterClockwise, Plus, Trash } from '@phosphor-icons/react';
import { MoneyInput } from './MoneyInput';
import { standardDays } from './calc';
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
};

const SMALL_INPUT = '!h-9 !py-1 !px-2.5 text-sm';

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/30">
      <h3 className="text-sm font-black text-slate-900 dark:text-white">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function Line({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-slate-700 dark:text-slate-300">
      {children}
    </div>
  );
}

const unit = 'text-xs font-semibold text-slate-500 dark:text-slate-400';

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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Block title="1. Lương cứng theo bậc" hint="Chọn bậc cho từng nhân viên ở bảng bên dưới.">
          {config.levels.map((lv, i) => (
            <Line key={i}>
              <input
                className={`input-3d w-24 ${SMALL_INPUT}`}
                value={lv.label}
                aria-label={`Tên bậc ${i + 1}`}
                onChange={(e) =>
                  set({ levels: config.levels.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                }
              />
              <input
                className={`input-3d min-w-0 flex-1 ${SMALL_INPUT}`}
                value={lv.note}
                placeholder="Ghi chú (VD: làm trên 1 năm)"
                aria-label={`Ghi chú bậc ${i + 1}`}
                onChange={(e) =>
                  set({ levels: config.levels.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })
                }
              />
              <MoneyInput
                className={`w-32 ${SMALL_INPUT}`}
                ariaLabel={`Lương cứng ${lv.label}`}
                value={lv.base}
                onChange={(base) => set({ levels: config.levels.map((x, j) => (j === i ? { ...x, base } : x)) })}
              />
              <span className={unit}>đ/tháng</span>
              <button
                type="button"
                disabled={config.levels.length <= 1}
                onClick={() => set({ levels: config.levels.filter((_, j) => j !== i) })}
                title="Xóa bậc này"
                aria-label={`Xóa ${lv.label}`}
                className="flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-950/40"
              >
                <Trash size={15} />
              </button>
            </Line>
          ))}
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
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline disabled:opacity-40 dark:text-blue-400"
          >
            <Plus size={13} weight="bold" /> Thêm bậc
          </button>
        </Block>

        <div className="space-y-3">
          <Block
            title="2. Ngày công"
            hint="Lương cứng thực nhận = lương cứng ÷ công chuẩn × công thực tế (làm hơn công chuẩn thì được hơn)."
          >
            <Line>
              <span>Công chuẩn = số ngày trong tháng −</span>
              <MoneyInput
                className={`w-16 ${SMALL_INPUT}`}
                ariaLabel="Số ngày trừ để ra công chuẩn"
                value={config.standardDaysOffset}
                onChange={(standardDaysOffset) => set({ standardDaysOffset: Math.min(28, standardDaysOffset) })}
              />
              <span className={unit}>ngày</span>
            </Line>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tháng đang xem có {daysInMonth} ngày → <b className="text-slate-800 dark:text-slate-200">{std} công</b>{' '}
              (31 ngày = 27, 30 ngày = 26, 29 ngày = 25, 28 ngày = 24 khi trừ 4).
            </p>
          </Block>

          <Block title="3. Mốc lương cứng cao" hint="Đạt mốc thì lương cứng của tháng đó lấy mức này, thay cho lương theo bậc.">
            <Line>
              <span>Hoa hồng tháng từ</span>
              <MoneyInput
                className={`w-32 ${SMALL_INPUT}`}
                ariaLabel="Mốc đạt lương cứng cao"
                value={config.topBase.threshold}
                onChange={(threshold) => set({ topBase: { ...config.topBase, threshold } })}
              />
              <span>→ lương cứng</span>
              <MoneyInput
                className={`w-32 ${SMALL_INPUT}`}
                ariaLabel="Lương cứng khi đạt mốc"
                value={config.topBase.base}
                onChange={(base) => set({ topBase: { ...config.topBase, base } })}
              />
              <span className={unit}>đ</span>
            </Line>
          </Block>
        </div>

        <Block title="4. Thưởng ngày" hint="Mỗi ngày chỉ tính một mốc cao nhất đạt được (không cộng dồn các mốc).">
          {config.dailyBonuses.map((t, i) => (
            <Line key={i}>
              <span>Ngày đạt từ</span>
              <MoneyInput
                className={`w-32 ${SMALL_INPUT}`}
                ariaLabel={`Mốc thưởng ngày ${i + 1}`}
                value={t.threshold}
                onChange={(threshold) =>
                  set({ dailyBonuses: config.dailyBonuses.map((x, j) => (j === i ? { ...x, threshold } : x)) })
                }
              />
              <span>→ thưởng</span>
              <MoneyInput
                className={`w-28 ${SMALL_INPUT}`}
                ariaLabel={`Tiền thưởng ngày ${i + 1}`}
                value={t.bonus}
                onChange={(bonus) =>
                  set({ dailyBonuses: config.dailyBonuses.map((x, j) => (j === i ? { ...x, bonus } : x)) })
                }
              />
              <span className={unit}>đ</span>
              <button
                type="button"
                onClick={() => set({ dailyBonuses: config.dailyBonuses.filter((_, j) => j !== i) })}
                title="Xóa mốc này"
                aria-label={`Xóa mốc thưởng ngày ${i + 1}`}
                className="flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
              >
                <Trash size={15} />
              </button>
            </Line>
          ))}
          <button
            type="button"
            disabled={config.dailyBonuses.length >= 10}
            onClick={() => set({ dailyBonuses: [...config.dailyBonuses, { threshold: 0, bonus: 0 }] })}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline disabled:opacity-40 dark:text-blue-400"
          >
            <Plus size={13} weight="bold" /> Thêm mốc thưởng ngày
          </button>
        </Block>

        <div className="space-y-3">
          <Block title="5. Thưởng tháng">
            <Line>
              <span>Tổng hoa hồng cả tháng đạt từ</span>
              <MoneyInput
                className={`w-32 ${SMALL_INPUT}`}
                ariaLabel="Mốc thưởng tháng"
                value={config.monthlyBonus.threshold}
                onChange={(threshold) => set({ monthlyBonus: { ...config.monthlyBonus, threshold } })}
              />
              <span>→ thưởng</span>
              <MoneyInput
                className={`w-28 ${SMALL_INPUT}`}
                ariaLabel="Tiền thưởng tháng"
                value={config.monthlyBonus.bonus}
                onChange={(bonus) => set({ monthlyBonus: { ...config.monthlyBonus, bonus } })}
              />
              <span className={unit}>đ</span>
            </Line>
          </Block>

          <Block title="6. Doanh số vượt mốc" hint="Ai vượt mốc thì được một tỷ lệ % trên phần vượt.">
            <Line>
              <span>Hoa hồng vượt</span>
              <MoneyInput
                className={`w-32 ${SMALL_INPUT}`}
                ariaLabel="Mốc doanh số vượt"
                value={config.overRate.threshold}
                onChange={(threshold) => set({ overRate: { ...config.overRate, threshold } })}
              />
              <span>→ được</span>
              <MoneyInput
                className={`w-16 ${SMALL_INPUT}`}
                ariaLabel="Phần trăm trên phần vượt"
                value={config.overRate.percent}
                onChange={(percent) => set({ overRate: { ...config.overRate, percent: Math.min(100, percent) } })}
              />
              <span className={unit}>% phần vượt</span>
            </Line>
          </Block>
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
