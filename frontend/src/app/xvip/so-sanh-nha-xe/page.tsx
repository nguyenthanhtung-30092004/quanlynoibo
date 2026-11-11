'use client';

import { useState } from 'react';
import { ArrowsLeftRight, CaretDown, CaretRight, FileXls } from '@phosphor-icons/react';
import { ticketCompareApi } from '@/features/ticket-compare/api';
import type { PhoneDiff, TicketCompareResult, TicketDetail } from '@/features/ticket-compare/types';
import { useToast } from '@/features/xvip/toast';
import { Card, PageTitle, TD, TH } from '@/features/xvip/ui';

function FilePicker({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="flex flex-1 cursor-pointer flex-col gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:border-xv-blue dark:border-slate-700 dark:bg-slate-900/40">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
        <FileXls className="size-5 text-emerald-600" weight="fill" />
        {file ? file.name : 'Chọn file Excel (.xlsx)'}
      </span>
      <input
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-xl font-extrabold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

/** Một vé cụ thể: tuyến + ngày giờ đi + mã vé (nếu file có), để biết đúng vé nào chứ không chỉ con số */
function TicketLine({ ticket }: { ticket: TicketDetail }) {
  return (
    <div className="text-xs text-slate-700 dark:text-slate-300">
      {ticket.quantity > 1 && <span className="font-bold">{ticket.quantity} vé · </span>}
      {ticket.route ?? 'Không rõ tuyến'}
      {ticket.departure && <span className="text-slate-500 dark:text-slate-400"> · {ticket.departure}</span>}
      {ticket.ticketId && <span className="text-slate-400 dark:text-slate-500"> · #{ticket.ticketId}</span>}
    </div>
  );
}

function DiffRow({ row, labelA, labelB }: { row: PhoneDiff; labelA: string; labelB: string }) {
  const [open, setOpen] = useState(false);
  const hasDetail = row.ticketsA.length > 0 || row.ticketsB.length > 0;
  return (
    <>
      <tr
        className={hasDetail ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40' : undefined}
        onClick={() => hasDetail && setOpen((v) => !v)}
      >
        <td className={TD}>
          <span className="flex items-center gap-1.5">
            {hasDetail &&
              (open ? (
                <CaretDown className="size-3.5 text-slate-400" />
              ) : (
                <CaretRight className="size-3.5 text-slate-400" />
              ))}
            {row.phone}
          </span>
        </td>
        <td className={TD}>{row.customerName ?? '—'}</td>
        <td className={TD}>{row.countA}</td>
        <td className={TD}>{row.countB}</td>
        <td className={`${TD} font-bold ${row.delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {row.delta > 0 ? `+${row.delta}` : row.delta}
        </td>
      </tr>
      {open && (
        <tr>
          <td className={`${TD} bg-slate-50 dark:bg-slate-800/30`} colSpan={5}>
            <div className="grid grid-cols-1 gap-4 py-1 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                  Vé trong {labelA} ({row.ticketsA.length})
                </div>
                {row.ticketsA.length === 0 ? (
                  <div className="text-xs text-slate-400">Không có</div>
                ) : (
                  row.ticketsA.map((t, i) => <TicketLine key={i} ticket={t} />)
                )}
              </div>
              <div>
                <div className="mb-1 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                  Vé trong {labelB} ({row.ticketsB.length})
                </div>
                {row.ticketsB.length === 0 ? (
                  <div className="text-xs text-slate-400">Không có</div>
                ) : (
                  row.ticketsB.map((t, i) => <TicketLine key={i} ticket={t} />)
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DiffTable({ title, rows, labelA, labelB }: { title: string; rows: PhoneDiff[]; labelA: string; labelB: string }) {
  return (
    <Card title={`${title} (${rows.length})`} className="!p-0">
      {rows.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Không có chênh lệch</div>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0">
              <tr>
                <th className={TH}>Số điện thoại</th>
                <th className={TH}>Tên khách</th>
                <th className={TH}>{labelA}</th>
                <th className={TH}>{labelB}</th>
                <th className={TH}>Lệch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <DiffRow key={r.phone} row={r} labelA={labelA} labelB={labelB} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function TicketComparePage() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TicketCompareResult | null>(null);
  const showToast = useToast();

  const handleCompare = async () => {
    if (!fileA || !fileB) {
      showToast('Vui lòng chọn đủ 2 file Excel.', 'error');
      return;
    }
    setLoading(true);
    try {
      setResult(await ticketCompareApi.compare(fileA, fileB));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'So sánh thất bại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageTitle>So sánh nhà xe</PageTitle>

      <Card title="Chọn 2 file để so sánh">
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Hệ thống đối chiếu theo số điện thoại: số nào chỉ có ở 1 file, và số nào có ở cả 2 file nhưng
          tổng số vé khác nhau (gộp các dòng cùng số điện thoại lại trước khi so). File có thể là file nội
          bộ hay file nhà xe tự xuất, miễn có cột số điện thoại.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <FilePicker label="File A" file={fileA} onChange={setFileA} />
          <FilePicker label="File B" file={fileB} onChange={setFileB} />
        </div>
        <button
          type="button"
          disabled={loading || !fileA || !fileB}
          onClick={handleCompare}
          className="mt-4 flex items-center gap-2 rounded-lg bg-xv-blue px-5 py-2.5 text-sm font-bold text-white shadow-[0_2px_0_#1d4ed8] transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowsLeftRight className="size-5" />
          {loading ? 'Đang so sánh...' : 'So sánh'}
        </button>
      </Card>

      {result && (
        <>
          <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="SĐT khớp" value={result.matchedPhones} />
            <SummaryStat label="Chỉ có ở A" value={result.onlyInA.length} />
            <SummaryStat label="Chỉ có ở B" value={result.onlyInB.length} />
            <SummaryStat label="Lệch số vé" value={result.mismatched.length} />
            <SummaryStat label="SĐT file A" value={result.totalPhonesA} />
            <SummaryStat label="SĐT file B" value={result.totalPhonesB} />
            <SummaryStat label="Tổng vé file A" value={result.totalTicketsA} />
            <SummaryStat label="Tổng vé file B" value={result.totalTicketsB} />
          </div>
          {(result.cancelledCountA > 0 || result.cancelledCountB > 0) && (
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Đã bỏ qua vé có trạng thái &quot;hủy&quot;: {result.cancelledCountA} vé ở file A,{' '}
              {result.cancelledCountB} vé ở file B.
            </p>
          )}
          <div className="flex flex-col gap-5">
            <DiffTable title="Chỉ có ở file A" rows={result.onlyInA} labelA="File A" labelB="File B" />
            <DiffTable title="Chỉ có ở file B" rows={result.onlyInB} labelA="File A" labelB="File B" />
            <DiffTable title="Lệch số lượng vé" rows={result.mismatched} labelA="File A" labelB="File B" />
          </div>
        </>
      )}
    </>
  );
}
