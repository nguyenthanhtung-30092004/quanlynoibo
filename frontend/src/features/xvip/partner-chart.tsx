import Link from 'next/link';
import { money } from '@/features/xvip/data';

export interface PartnerStat {
  partner: string;
  total: number;
  commission: number;
}

/** Số tiền rút gọn cho nhãn cạnh tên: 1.250.000 → 1,25tr; 850.000 → 850k */
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

/**
 * Hoa hồng và số vé theo đối tác, gọn để đặt trong một ô nhỏ: mỗi đối tác một hàng
 * (tên + hoa hồng + số vé, thanh năng lượng bên dưới dài theo hoa hồng).
 * Rê chuột vào hàng để xem số vé, hoa hồng đầy đủ và tỷ trọng.
 */
export function PartnerChart({ data }: { data: PartnerStat[] }) {
  const maxCommission = Math.max(1, ...data.map((d) => d.commission));
  const totalCommission = data.reduce((sum, d) => sum + d.commission, 0);
  const totalTickets = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
          <b className="tnum">{data.length}</b> đối tác
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
          <b className="tnum">{totalTickets.toLocaleString('vi-VN')}</b> vé
        </span>
        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
          Hoa hồng <b className="tnum">{money(totalCommission)}đ</b>
        </span>
      </div>

      <ol className="space-y-0.5" aria-label="Hoa hồng và số vé theo đối tác">
        {data.map((d, idx) => {
          const pct = (d.commission / maxCommission) * 100;
          const share = totalCommission > 0 ? Math.round((d.commission / totalCommission) * 1000) / 10 : 0;
          return (
            <li key={d.partner}>
              <Link
                href="/xvip/doi-tac"
                className="group relative block rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
              >
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-bold text-slate-800 dark:text-slate-100" title={d.partner}>
                    <span className="tnum mr-1.5 text-slate-400">{idx + 1}.</span>
                    {d.partner}
                  </span>
                  <span className="tnum shrink-0 text-slate-500 dark:text-slate-400">
                    <b className="font-black text-sky-700 dark:text-sky-300">{compactMoney(d.commission)}</b>
                    {' · '}
                    {d.total} vé
                  </span>
                </span>

                {/* Thanh năng lượng */}
                <span className="relative mt-1.5 block h-2.5 rounded-full border border-slate-200 bg-slate-100 p-px shadow-inner dark:border-slate-700 dark:bg-slate-800">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-sky-600 to-cyan-300 shadow-[0_1px_3px_rgba(14,165,233,0.45)] transition-[filter] group-hover:brightness-110"
                    style={{ width: `${d.commission > 0 ? Math.max(2, pct) : 0}%` }}
                  />

                  {/* Tooltip khi rê chuột: bám theo đầu thanh, không tràn ra ngoài ô */}
                  <span
                    className="pointer-events-none invisible absolute bottom-full z-20 mb-2 w-48 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-xs opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-900"
                    style={{ left: `clamp(6rem, ${pct}%, calc(100% - 6rem))` }}
                  >
                    <span className="mb-2 block truncate text-sm font-black text-slate-900 dark:text-white">
                      {d.partner}
                    </span>
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Số vé</span>
                      <b className="tnum text-slate-900 dark:text-white">{d.total} vé</b>
                    </span>
                    <span className="mt-1.5 flex items-center justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Hoa hồng (lãi)</span>
                      <b className="tnum text-sky-700 dark:text-sky-300">{money(d.commission)}đ</b>
                    </span>
                    <span className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <span>Tỷ trọng hoa hồng</span>
                      <b className="tnum text-slate-800 dark:text-slate-200">{share}%</b>
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
