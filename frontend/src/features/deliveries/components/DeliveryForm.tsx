'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '@/lib/api-client';
import { getVnToday } from '@/lib/time';
import { partnersApi } from '@/features/partners/api';
import { AutoGrowInput } from '@/features/xvip/AutoGrowInput';
import { DateInput, TimeInput } from '@/features/xvip/PickerInput';
import { SuggestInput } from '@/features/xvip/SuggestInput';
import { useCreateDelivery, useUpdateDelivery } from '../hooks';
import type { Delivery, DeliveryInput } from '../types';

interface FormState {
  shipDate: string;
  shipTime: string;
  partner: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  quantity: number;
  goodsType: string;
  weightKg: number;
  fee: number;
  commission: number;
  note: string;
}

type Errors = Partial<Record<'shipDate' | 'shipTime' | 'senderPhone' | 'receiverPhone' | 'receiverAddress' | 'quantity', string>>;

const emptyState = (): FormState => ({
  shipDate: getVnToday(),
  shipTime: '',
  partner: '',
  senderName: '',
  senderPhone: '',
  senderAddress: '',
  receiverName: '',
  receiverPhone: '',
  receiverAddress: '',
  quantity: 1,
  goodsType: '',
  weightKg: 0,
  fee: 0,
  commission: 0,
  note: '',
});

const fromDelivery = (d: Delivery): FormState => ({
  shipDate: d.shipDate.slice(0, 10),
  shipTime: d.shipTime,
  partner: d.partner ?? '',
  senderName: d.senderName ?? '',
  senderPhone: d.senderPhone,
  senderAddress: d.senderAddress ?? '',
  receiverName: d.receiverName ?? '',
  receiverPhone: d.receiverPhone,
  receiverAddress: d.receiverAddress,
  quantity: d.quantity,
  goodsType: d.goodsType ?? '',
  weightKg: d.weightKg,
  fee: d.fee,
  commission: d.commission,
  note: d.note ?? '',
});

function Field({
  label,
  required,
  error,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="mt-1.5 block text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
        <span className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white shadow-[0_2px_0_#1e3a8a]">
          {step}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

const inputErr = (e?: string) =>
  e ? '!border-red-500 !shadow-[0_0_0_3px_rgba(239,68,68,0.2)]' : '';

/** Số nguyên (hoặc thập phân) nhập tự do; ô trống = 0 */
function NumBox({
  value,
  onChange,
  step,
  className = 'input-3d',
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  className?: string;
}) {
  return (
    <input
      className={className}
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      value={value || ''}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      onWheel={(e) => e.currentTarget.blur()}
    />
  );
}

export function DeliveryForm({
  editing,
  partnerSuggestions,
  onDone,
  onCancel,
  showToast,
}: {
  editing?: Delivery | null;
  partnerSuggestions: string[];
  onDone: () => void;
  onCancel: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [form, setForm] = useState<FormState>(() => (editing ? fromDelivery(editing) : emptyState()));
  const [errors, setErrors] = useState<Errors>({});
  const [quoteNote, setQuoteNote] = useState('');
  // Đã sửa tay hoa hồng thì không tự tính đè nữa (đơn đang sửa coi như đã có số riêng)
  const commissionTouched = useRef(!!editing);
  const create = useCreateDelivery();
  const update = useUpdateDelivery();
  const saving = create.isPending || update.isPending;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  // Gợi ý hoa hồng theo đối tác và cước phí
  useEffect(() => {
    if (commissionTouched.current || !form.partner.trim()) {
      setQuoteNote('');
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      partnersApi
        .commissionQuote(form.partner, 1, form.fee, ctrl.signal, 'delivery')
        .then((commission) => {
          if (commission === null) {
            setQuoteNote('Đối tác này chưa có hoa hồng giao hàng, bạn nhập tay');
            return;
          }
          setForm((f) => (commissionTouched.current ? f : { ...f, commission }));
          setQuoteNote('Tự tính theo hoa hồng giao hàng của đối tác');
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setQuoteNote('Không tự tính được hoa hồng, bạn nhập tay');
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [form.partner, form.fee]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const er: Errors = {};
    if (!form.shipDate) er.shipDate = 'Chọn ngày.';
    if (!form.shipTime) er.shipTime = 'Nhập giờ.';
    if (!form.senderPhone.trim()) er.senderPhone = 'Nhập số điện thoại người gửi.';
    if (!form.receiverPhone.trim()) er.receiverPhone = 'Nhập số điện thoại người nhận.';
    if (!form.receiverAddress.trim()) er.receiverAddress = 'Nhập địa chỉ người nhận.';
    if (form.quantity < 1) er.quantity = 'Ít nhất 1.';
    if (Object.keys(er).length > 0) {
      setErrors(er);
      showToast('Vui lòng điền đầy đủ các thông tin bắt buộc.', 'error');
      return;
    }
    const input: DeliveryInput = {
      shipDate: form.shipDate,
      shipTime: form.shipTime,
      senderName: form.senderName.trim(),
      senderPhone: form.senderPhone.trim(),
      senderAddress: form.senderAddress.trim(),
      receiverName: form.receiverName.trim(),
      receiverPhone: form.receiverPhone.trim(),
      receiverAddress: form.receiverAddress.trim(),
      quantity: form.quantity,
      goodsType: form.goodsType.trim(),
      weightKg: form.weightKg,
      fee: form.fee,
      commission: form.commission,
      partner: form.partner.trim(),
      note: form.note.trim(),
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input });
        showToast('Đã cập nhật đơn giao hàng.', 'success');
      } else {
        await create.mutateAsync(input);
        showToast('Đã thêm đơn giao hàng.', 'success');
      }
      onDone();
    } catch (err) {
      showToast(`Lỗi: ${err instanceof ApiError ? err.message : 'Không lưu được đơn giao hàng.'}`, 'error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Section step={1} title="Thời gian & đối tác">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Ngày" required error={errors.shipDate}>
                <DateInput value={form.shipDate} onChange={(v) => set('shipDate', v)} invalid={!!errors.shipDate} />
              </Field>
              <Field label="Giờ" required error={errors.shipTime}>
                <TimeInput value={form.shipTime} onChange={(v) => set('shipTime', v)} invalid={!!errors.shipTime} />
              </Field>
              <Field label="Đối tác" className="sm:col-span-2">
                <SuggestInput
                  options={partnerSuggestions}
                  value={form.partner}
                  onChange={(v) => set('partner', v)}
                  maxLength={100}
                  allowFree
                />
              </Field>
            </div>
          </Section>

          <Section step={2} title="Người gửi">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Tên người gửi">
                <AutoGrowInput value={form.senderName} onChange={(v) => set('senderName', v)} maxLength={100} />
              </Field>
              <Field label="Số điện thoại" required error={errors.senderPhone}>
                <input
                  className={`input-3d font-mono font-bold ${inputErr(errors.senderPhone)}`}
                  inputMode="tel"
                  value={form.senderPhone}
                  maxLength={30}
                  onChange={(e) => set('senderPhone', e.target.value)}
                />
              </Field>
              <Field label="Địa chỉ người gửi" className="sm:col-span-2">
                <AutoGrowInput value={form.senderAddress} onChange={(v) => set('senderAddress', v)} maxLength={255} />
              </Field>
            </div>
          </Section>

          <Section step={3} title="Người nhận">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Tên người nhận">
                <AutoGrowInput value={form.receiverName} onChange={(v) => set('receiverName', v)} maxLength={100} />
              </Field>
              <Field label="Số điện thoại" required error={errors.receiverPhone}>
                <input
                  className={`input-3d font-mono font-bold ${inputErr(errors.receiverPhone)}`}
                  inputMode="tel"
                  value={form.receiverPhone}
                  maxLength={30}
                  onChange={(e) => set('receiverPhone', e.target.value)}
                />
              </Field>
              <Field label="Địa chỉ người nhận" required error={errors.receiverAddress} className="sm:col-span-2">
                <AutoGrowInput
                  invalid={!!errors.receiverAddress}
                  value={form.receiverAddress}
                  onChange={(v) => set('receiverAddress', v)}
                  maxLength={255}
                />
              </Field>
            </div>
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <Section step={4} title="Hàng hóa">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Số lượng" required error={errors.quantity}>
                <NumBox
                  value={form.quantity}
                  onChange={(n) => set('quantity', n)}
                  className={`input-3d font-bold ${inputErr(errors.quantity)}`}
                />
              </Field>
              <Field label="Cân nặng (kg)">
                <NumBox value={form.weightKg} onChange={(n) => set('weightKg', n)} step={0.1} className="input-3d font-bold" />
              </Field>
              <Field label="Loại hàng hóa" className="sm:col-span-2">
                <AutoGrowInput value={form.goodsType} onChange={(v) => set('goodsType', v)} maxLength={255} />
              </Field>
            </div>
          </Section>

          <Section step={5} title="Cước phí & hoa hồng">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="Cước phí (VNĐ)">
                <NumBox value={form.fee} onChange={(n) => set('fee', n)} className="input-3d font-bold" />
              </Field>
              <Field label="Hoa hồng (VNĐ)">
                <NumBox
                  value={form.commission}
                  onChange={(n) => {
                    commissionTouched.current = true;
                    set('commission', n);
                  }}
                  className="input-3d font-bold"
                />
                {quoteNote && (
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{quoteNote}</span>
                )}
              </Field>
              <Field label="Ghi chú" className="sm:col-span-2">
                <AutoGrowInput value={form.note} onChange={(v) => set('note', v)} maxLength={1000} />
              </Field>
            </div>
          </Section>
        </div>
      </div>

      <div className="flex justify-end gap-2.5">
        <button type="button" onClick={onCancel} className="btn-3d btn-3d-white px-5 py-2 text-sm">
          Hủy
        </button>
        <button type="submit" disabled={saving} className="btn-3d btn-3d-blue px-5 py-2 text-sm disabled:opacity-60">
          {saving ? 'Đang lưu…' : editing ? 'Cập nhật đơn' : 'Lưu đơn giao hàng'}
        </button>
      </div>
    </form>
  );
}
