import Link from 'next/link';
import { money } from '@/features/xvip/data';

export interface PartnerStat {
  partner: string;
  total: number;
  revenue: number;
  commission: number;
}

const GRID_LINES = 4;

/** Rút gọn số tiền cho nhãn trục và đầu cột: 1.250.000 → 1,25tr; 850.000 → 850k */
function compactMoney(n: number): string {
  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}tr`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString('vi-VN')}k`;
  return `${n}`;
}

/** Làm tròn trần trục tung lên số "đẹp" (1, 2, 2,5, 5 × 10^n) để các vạch chia đều, dễ đọc */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Biểu đồ cột đôi (doanh thu + hoa hồng) theo đối tác; rê chuột vào một cột để xem số vé, tiền, tỷ lệ */
export function PartnerChart({ data }: { data: PartnerStat[] }) {
  const maxValue = niceCeil(Math.max(1, ...data.map((d) => Math.max(d.revenue, d.commission))));
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  const totalCommission = data.reduce((sum, d) => sum + d.commission, 0);
  const totalTickets = data.reduce((sum, d) => sum + d.total, 0);
  const ticks = Array.from({ length: GRID_LINES + 1 }, (_, i) => (maxValue / GRID_LINES) * (GRID_LINES - i));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
            {data.length} đối tác · <span className="tnum">{totalTickets.toLocaleString('vi-VN')}</span> vé
          </span>
          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            Doanh thu <b className="tnum">{money(totalRevenue)}đ</b>
          </span>
          <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            Hoa hồng <b className="tnum">{money(totalCommission)}đ</b>
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-gradient-to-t from-blue-700 to-blue-400" /> Doanh thu
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-gradient-to-t from-amber-600 to-amber-300" /> Hoa hồng (lãi)
          </span>
        </div>
      </div>

      <div className="flex" role="img" aria-label="Biểu đồ cột doanh thu và hoa hồng theo đối tác">
        {/* Trục tung cố định bên trái */}
        <div className="relative h-72 w-12 shrink-0">
          {ticks.map((t, i) => (
            <span
              key={t}
              className="tnum absolute right-2 -translate-y-1/2 text-[11px] font-semibold text-slate-400"
              style={{ top: `${(i / GRID_LINES) * 100}%` }}
            >
              {compactMoney(t)}
            </span>
          ))}
        </div>

        {/* Vùng vẽ: nhiều đối tác thì mỗi nhóm cột giữ bề rộng tối thiểu và cuộn ngang */}
        <div className="min-w-0 flex-1 overflow-x-auto pb-1">
          <div style={{ minWidth: `${data.length * 5.5}rem` }}>
            <div className="relative h-72">
              {ticks.map((t, i) => (
                <div
                  key={t}
                  className={`absolute inset-x-0 border-t ${
                    i === GRID_LINES
                      ? 'border-slate-300 dark:border-slate-600'
                      : 'border-dashed border-slate-200 dark:border-slate-800'
                  }`}
                  style={{ top: `${(i / GRID_LINES) * 100}%` }}
                />
              ))}

              <div className="absolute inset-0 flex">
                {data.map((d, idx) => {
                  const margin = d.revenue > 0 ? Math.round((d.commission / d.revenue) * 1000) / 10 : 0;
                  const share = totalRevenue > 0 ? Math.round((d.revenue / totalRevenue) * 1000) / 10 : 0;
                  // Nhóm đầu / cuối: tooltip neo mép để không bị cắt khi cuộn
                  const tipPos =
                    data.length > 1 && idx === 0
                      ? 'left-1'
                      : data.length > 1 && idx === data.length - 1
                        ? 'right-1'
                        : 'left-1/2 -translate-x-1/2';
                  return (
                    <Link
                      key={d.partner}
                      href="/xvip/doi-tac"
                      className="group relative flex min-w-0 flex-1 items-end justify-center gap-1 rounded-t-lg px-2 transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                    >
                      <span
                        className="w-full max-w-10 rounded-t-md bg-gradient-to-t from-blue-700 to-blue-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)] transition-[filter] group-hover:brightness-110"
                        style={{ height: `${d.revenue > 0 ? Math.max(1.5, (d.revenue / maxValue) * 100) : 0}%` }}
                      />
                      <span
                        className="w-full max-w-10 rounded-t-md bg-gradient-to-t from-amber-600 to-amber-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)] transition-[filter] group-hover:brightness-110"
                        style={{ height: `${d.commission > 0 ? Math.max(1.5, (d.commission / maxValue) * 100) : 0}%` }}
                      />

                      {/* Tooltip khi rê chuột */}
                      <div
                        className={`pointer-events-none invisible absolute top-2 z-20 w-56 rounded-xl border border-slate-200 bg-white p-3 text-xs opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-900 ${tipPos}`}
                      >
                        <div className="mb-2 truncate text-sm font-black text-slate-900 dark:text-white">
                          {d.partner}
                        </div>
                        <dl className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-slate-500 dark:text-slate-400">Số vé</dt>
                            <dd className="tnum font-black text-slate-900 dark:text-white">{d.total} vé</dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                              <span className="size-2 rounded-sm bg-blue-500" /> Doanh thu
                            </dt>
                            <dd className="tnum font-black text-blue-700 dark:text-blue-300">{money(d.revenue)}đ</dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                              <span className="size-2 rounded-sm bg-amber-400" /> Hoa hồng (lãi)
                            </dt>
                            <dd className="tnum font-black text-amber-700 dark:text-amber-300">
                              {money(d.commission)}đ
                            </dd>
                          </div>
                        </dl>
                        <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                          <span>
                            Lãi / doanh thu <b className="tnum text-slate-800 dark:text-slate-200">{margin}%</b>
                          </span>
                          <span>
                            Tỷ trọng <b className="tnum text-slate-800 dark:text-slate-200">{share}%</b>
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Tên đối tác + số vé dưới trục hoành */}
            <div className="flex">
              {data.map((d) => (
                <div key={d.partner} className="min-w-0 flex-1 px-1 pt-2 text-center">
                  <div className="truncate text-xs font-bold text-slate-700 dark:text-slate-200" title={d.partner}>
                    {d.partner}
                  </div>
                  <div className="tnum text-[11px] font-medium text-slate-400">{d.total} vé</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
