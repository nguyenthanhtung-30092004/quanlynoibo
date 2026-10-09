'use client';

import { CaretLeft, CaretRight } from '@phosphor-icons/react';

/** Dãy số trang gọn: 1 … 4 5 [6] 7 8 … 20 */
function pageList(current: number, pages: number): (number | 'gap')[] {
  const keep = new Set([1, pages, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => keep.add(p));
  if (current >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((p) => keep.add(p));
  const sorted = [...keep].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const BTN =
  'flex size-9 items-center justify-center rounded-lg border text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
        Hiển thị {from}-{to} / {total} đơn
      </p>
      {pages > 1 && (
        <nav aria-label="Phân trang" className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Trang trước"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            className={`${BTN} border-slate-300 bg-white text-slate-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
          >
            <CaretLeft size={14} weight="bold" />
          </button>
          {pageList(page, pages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-slate-400" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onChange(p)}
                className={`${BTN} ${
                  p === page
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="Trang sau"
            disabled={page >= pages}
            onClick={() => onChange(page + 1)}
            className={`${BTN} border-slate-300 bg-white text-slate-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
          >
            <CaretRight size={14} weight="bold" />
          </button>
        </nav>
      )}
    </div>
  );
}
