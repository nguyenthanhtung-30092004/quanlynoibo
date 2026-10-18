'use client';

import { useState } from 'react';
import { Check, Copy, QrCode } from '@phosphor-icons/react';
import { useToast } from '@/features/xvip/toast';
import { Card, PageTitle } from '@/features/xvip/ui';

interface QrAccount {
  bank: string;
  number: string;
  holder: string;
  /** Mã ngân hàng theo VietQR (img.vietqr.io/image/<bank>-<số tk>-print.jpg) */
  vietqrBank: string;
}

const ACCOUNTS: QrAccount[] = [
  { bank: 'Vietcombank', number: '1314389999', holder: 'NGUYEN THI NGAN', vietqrBank: 'vietcombank' },
  {
    bank: 'Vietcombank',
    number: '7770319999',
    holder: 'Công Ty TNHH Thương Mại Và Dịch Vụ XVIP',
    vietqrBank: 'vietcombank',
  },
];

/** 1500000 -> "1.500.000" */
const formatAmount = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export default function TaoQrPage() {
  const showToast = useToast();
  const [accountIdx, setAccountIdx] = useState(0);
  const [amountText, setAmountText] = useState('');
  const [content, setContent] = useState('');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const amount = Number(amountText.replace(/\./g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Lỗi: vui lòng nhập số tiền hợp lệ.');
      return;
    }
    const acc = ACCOUNTS[accountIdx];
    const base = `https://img.vietqr.io/image/${acc.vietqrBank}-${acc.number}-print.jpg`;
    setQrUrl(`${base}?amount=${amount}&addInfo=${encodeURIComponent(content.trim())}`);
    setCopied(false);
  };

  const copyQr = async () => {
    if (!qrUrl) return;
    try {
      const blob = await (await fetch(qrUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast('Lỗi: không copy được QR (trình duyệt chặn). Bạn có thể bấm chuột phải vào ảnh để lưu.');
    }
  };

  return (
    <>
      <PageTitle>Tạo QR thanh toán</PageTitle>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card title="Thông tin chuyển khoản">
          <div className="space-y-4">
            <div>
              <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Tài khoản nhận</span>
              <div className="grid gap-3 sm:grid-cols-2">
                {ACCOUNTS.map((acc, i) => {
                  const active = i === accountIdx;
                  return (
                    <button
                      key={acc.number}
                      type="button"
                      onClick={() => {
                        setAccountIdx(i);
                        setQrUrl(null);
                      }}
                      aria-pressed={active}
                      className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                        active
                          ? 'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40'
                          : 'border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{acc.bank}</div>
                      <div className="tnum text-lg font-black text-slate-900 dark:text-white">{acc.number}</div>
                      <div className="break-words text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {acc.holder}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Số tiền (VND)</span>
              <input
                className="input-3d"
                inputMode="numeric"
                placeholder="Số tiền"
                value={amountText}
                onChange={(e) => setAmountText(formatAmount(e.target.value.replace(/\D/g, '')))}
                onKeyDown={(e) => e.key === 'Enter' && generate()}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">
                Nội dung chuyển khoản
              </span>
              <input
                className="input-3d"
                placeholder="VD: Thanh toan ve xe"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generate()}
              />
            </label>

            <button
              type="button"
              onClick={generate}
              className="btn-3d btn-3d-blue inline-flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              <QrCode size={16} weight="bold" />
              Tạo QR
            </button>
          </div>
        </Card>

        <Card title="Mã QR">
          {qrUrl ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="Mã QR thanh toán" className="mx-auto w-full max-w-xs rounded-lg bg-white" />
              <button
                type="button"
                onClick={copyQr}
                className="btn-3d btn-3d-white inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
              >
                {copied ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
                {copied ? 'Đã copy' : 'Copy QR'}
              </button>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Chọn tài khoản, nhập số tiền rồi bấm &ldquo;Tạo QR&rdquo;.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
