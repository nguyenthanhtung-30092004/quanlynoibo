import { money } from '@/features/xvip/data';

export interface PartnerStat {
  partner: string;
  /** Số đơn */
  total: number;
  /** Số vé (ghế) */
  seats: number;
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
 * Hoa hồng, số đơn và số vé theo đối tác, gọn để đặt trong một ô nhỏ: mỗi đối tác một hàng
 * (tên + hoa hồng + số đơn / vé, thanh năng lượng bên dưới dài theo hoa hồng).
 */
export function PartnerChart({
  data,
  onSelect,
}: {
  data: PartnerStat[];
  /** Bấm một đối tác để xem vé của đối tác đó */
  onSelect?: (partner: string) => void;
}) {
  const maxCommission = Math.max(1, ...data.map((d) => d.commission));
  const totalCommission = data.reduce((sum, d) => sum + d.commission, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.total, 0);
  const totalTickets = data.reduce((sum, d) => sum + d.seats, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
          <b className="tnum">{data.length}</b> đối tác
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
          <b className="tnum">{totalOrders.toLocaleString('vi-VN')}</b> đơn
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
          return (
            <li key={d.partner}>
              <button
                type="button"
                onClick={() => onSelect?.(d.partner)}
                title="Bấm để xem toàn bộ vé của đối tác này"
                className="group relative block w-full cursor-pointer rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
              >
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-bold text-slate-800 dark:text-slate-100" title={d.partner}>
                    <span className="tnum mr-1.5 text-slate-400">{idx + 1}.</span>
                    {d.partner}
                  </span>
                  <span className="tnum shrink-0 text-slate-500 dark:text-slate-400">
                    <b className="font-black text-sky-700 dark:text-sky-300">{compactMoney(d.commission)}</b>
                    {' · '}
                    {d.total} đơn · {d.seats} vé
                  </span>
                </span>

                {/* Thanh năng lượng */}
                <span className="relative mt-1.5 block h-2.5 rounded-full border border-slate-200 bg-slate-100 p-px shadow-inner dark:border-slate-700 dark:bg-slate-800">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-sky-600 to-cyan-300 shadow-[0_1px_3px_rgba(14,165,233,0.45)] transition-[filter] group-hover:brightness-110"
                    style={{ width: `${d.commission > 0 ? Math.max(2, pct) : 0}%` }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
