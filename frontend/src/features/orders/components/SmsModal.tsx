'use client';

import { App, Button, Modal } from 'antd';
import { Copy, PaperPlaneTilt } from '@phosphor-icons/react';
import { ApiError } from '@/lib/api-client';
import { useUiStore } from '@/stores/ui-store';
import { useSendSms } from '../hooks';

export function SmsModal() {
  const { message } = App.useApp();
  const order = useUiStore((s) => s.smsOrder);
  const setSmsOrder = useUiStore((s) => s.setSmsOrder);
  const sendSms = useSendSms();

  const close = () => setSmsOrder(null);

  const handleCopy = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.smsContent);
      message.success('Đã sao chép nội dung tin nhắn.');
    } catch {
      message.error('Trình duyệt không cho phép sao chép.');
    }
  };

  const handleSend = () => {
    if (!order) return;
    sendSms.mutate(order.id, {
      onSuccess: () => {
        message.success(`Đã gửi tin nhắn cho ${order.customerName || order.phone}.`);
        close();
      },
      onError: (err) => message.error(err instanceof ApiError ? err.message : 'Gửi tin nhắn thất bại.'),
    });
  };

  return (
    <Modal
      open={!!order}
      onCancel={close}
      title={
        <div className="flex items-center gap-2 text-base font-bold text-ink">
          <div className="size-2 rounded-full bg-accent" />
          <span>Gửi tin nhắn xác nhận cho khách</span>
        </div>
      }
      width={560}
      centered
      destroyOnHidden
      footer={
        <div className="flex justify-between gap-2.5 pt-2 border-t border-line">
          <Button icon={<Copy size={16} />} onClick={handleCopy} className="shadow-3d-secondary">
            Sao chép tin nhắn
          </Button>
          <div className="flex gap-2">
            <Button onClick={close}>Hủy</Button>
            <Button
              type="primary"
              icon={<PaperPlaneTilt size={16} weight="bold" />}
              loading={sendSms.isPending}
              onClick={handleSend}
              className="shadow-3d-primary"
            >
              Gửi 1 chạm (SMS / Zalo)
            </Button>
          </div>
        </div>
      }
    >
      {order && (
        <div className="space-y-4 pt-2">
          <div className="rounded-xl border border-line bg-surface-2/60 p-3.5 shadow-3d-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-ink-3">Khách hàng:</dt>
              <dd className="font-semibold text-ink">{order.customerName || 'Khách vãng lai'}</dd>
              <dt className="text-ink-3">Số điện thoại:</dt>
              <dd className="tnum font-bold text-ink">{order.phone}</dd>
              <dt className="text-ink-3">Tuyến & Giờ đón:</dt>
              <dd className="font-semibold text-ink">{order.route?.name} • {order.departureTime} ngày {order.departureDate}</dd>
            </dl>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">
              Mẫu tin nhắn tự động (hệ thống tự điền theo đơn)
            </p>
            <div className="relative rounded-xl border border-line bg-gradient-to-b from-[#FAF9F6] to-[#F3F2EE] p-4 shadow-3d-inset">
              <blockquote className="text-sm leading-relaxed text-ink font-medium select-all whitespace-pre-wrap">
                {order.smsContent}
              </blockquote>
              <div className="mt-2.5 flex items-center justify-between border-t border-line/60 pt-2 text-xs text-ink-3">
                <span>Tổng đài CSKH: 1900 1977</span>
                <span className="tnum font-semibold">{order.smsContent.length} ký tự</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
