'use client';

import { useEffect } from 'react';
import { App, Button, DatePicker, Form, Input, InputNumber, Modal, Radio, Select, TimePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useActiveRoutes } from '@/features/routes/hooks';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import { useUiStore } from '@/stores/ui-store';
import { useUpdateOrder } from '../hooks';
import { SeatZone, SEAT_ZONE_LABELS } from '../types';

interface FormValues {
  customerName?: string;
  phone: string;
  routeId: number;
  departureTime: Dayjs;
  departureDate: Dayjs;
  vehicleType?: string;
  seatZone?: SeatZone;
  seatCount: number;
  sellPrice?: number;
  costPrice?: number;
  deposit?: number;
  collectOnDelivery?: number;
  commission?: number;
  partner?: string;
  note?: string;
}

const FORM_ID = 'edit-order-form';

export function EditOrderModal() {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const order = useUiStore((s) => s.editingOrder);
  const setOrder = useUiStore((s) => s.setEditingOrder);

  const { data: routes = [], isPending: routesLoading } = useActiveRoutes(!!order);
  const updateOrder = useUpdateOrder();

  const close = () => {
    form.resetFields();
    setOrder(null);
  };

  useEffect(() => {
    if (!order) return;
    form.setFieldsValue({
      customerName: order.customerName ?? undefined,
      phone: order.phone,
      routeId: order.route?.id,
      departureDate: dayjs(order.departureDate),
      departureTime: dayjs(order.departureTime, 'HH:mm'),
      vehicleType: order.vehicleType ?? undefined,
      seatZone: order.seatZone ?? undefined,
      seatCount: order.seatCount ?? 1,
      sellPrice: order.sellPrice,
      costPrice: order.costPrice,
      deposit: order.deposit,
      collectOnDelivery: order.collectOnDelivery,
      commission: order.commission,
      partner: order.partner ?? undefined,
      note: order.note ?? undefined,
    });
  }, [order, form]);

  const handleFinish = (values: FormValues) => {
    if (!order) return;
    updateOrder.mutate(
      {
        id: order.id,
        input: {
          customerName: values.customerName?.trim() || undefined,
          phone: values.phone.replace(/\s+/g, ''),
          routeId: values.routeId,
          departureTime: values.departureTime.format('HH:mm'),
          departureDate: values.departureDate.format('YYYY-MM-DD'),
          vehicleType: values.vehicleType?.trim() || undefined,
          seatZone: values.seatZone,
          seatCount: values.seatCount ?? 1,
          sellPrice: values.sellPrice,
          costPrice: values.costPrice,
          deposit: values.deposit,
          collectOnDelivery: values.collectOnDelivery,
          commission: values.commission,
          partner: values.partner?.trim() || undefined,
          note: values.note?.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          message.success('Cập nhật đơn hàng thành công.');
          close();
        },
        onError: (err) =>
          message.error(err instanceof ApiError ? err.message : 'Cập nhật thất bại.'),
      },
    );
  };

  return (
    <Modal
      open={!!order}
      onCancel={close}
      title={
        <div className="flex items-center gap-2 text-base font-bold text-ink">
          <div className="size-2 rounded-full bg-accent" />
          <span>Sửa đơn hàng: #{order?.id} - {order?.customerName || order?.phone}</span>
        </div>
      }
      width={720}
      centered
      destroyOnHidden
      footer={
        <div className="flex justify-end gap-2.5 pt-2 border-t border-line">
          <Button onClick={close}>Hủy</Button>
          <Button
            type="primary"
            htmlType="submit"
            form={FORM_ID}
            loading={updateOrder.isPending}
            className="shadow-3d-primary"
          >
            Lưu thay đổi
          </Button>
        </div>
      }
    >
      <Form
        id={FORM_ID}
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={handleFinish}
        className="pt-2 max-h-[75vh] overflow-y-auto pr-1"
      >
        <div className="mb-4 rounded-xl border border-line bg-surface-2/60 p-3.5 shadow-3d-sm">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">1. Khách hàng</h4>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
            <Form.Item name="customerName" label="Tên khách hàng">
              <Input placeholder="Tên khách hàng" maxLength={100} />
            </Form.Item>
            <Form.Item
              name="phone"
              label="Số điện thoại"
              rules={[
                { required: true, message: 'Nhập số điện thoại' },
                {
                  pattern: /^(0|\+84)\d{9,10}$/,
                  transform: (v: string) => v?.replace(/\s+/g, ''),
                  message: 'Số điện thoại không hợp lệ',
                },
              ]}
            >
              <Input inputMode="tel" />
            </Form.Item>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-line bg-surface-2/60 p-3.5 shadow-3d-sm">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">2. Lịch trình & Xe</h4>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
            <Form.Item
              name="routeId"
              label="Tuyến đường"
              className="sm:col-span-2"
              rules={[{ required: true, message: 'Chọn tuyến đường' }]}
            >
              <Select
                showSearch
                loading={routesLoading}
                optionFilterProp="label"
                options={routes.map((r) => ({
                  value: r.id,
                  label: `${r.name} ${r.defaultPrice ? `(${formatVND(r.defaultPrice)})` : ''}`,
                }))}
              />
            </Form.Item>

            <Form.Item name="departureDate" label="Ngày đi" rules={[{ required: true, message: 'Chọn ngày' }]}>
              <DatePicker format="DD/MM/YYYY" className="w-full" allowClear={false} />
            </Form.Item>

            <Form.Item name="departureTime" label="Giờ đón" rules={[{ required: true, message: 'Chọn giờ' }]}>
              <TimePicker format="HH:mm" className="w-full" allowClear={false} minuteStep={5} />
            </Form.Item>

            <Form.Item name="vehicleType" label="Loại hình xe">
              <Input maxLength={100} />
            </Form.Item>

            <Form.Item name="seatCount" label="Số ghế" rules={[{ required: true, min: 1 }]}>
              <InputNumber min={1} max={60} className="w-full" />
            </Form.Item>

            <Form.Item name="seatZone" label="Vị trí ghế" className="sm:col-span-2">
              <Radio.Group className="w-full">
                <Radio.Button value={undefined}>Không chọn</Radio.Button>
                <Radio.Button value={SeatZone.FRONT}>{SEAT_ZONE_LABELS[SeatZone.FRONT]}</Radio.Button>
                <Radio.Button value={SeatZone.MIDDLE}>{SEAT_ZONE_LABELS[SeatZone.MIDDLE]}</Radio.Button>
                <Radio.Button value={SeatZone.BACK}>{SEAT_ZONE_LABELS[SeatZone.BACK]}</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-line bg-surface-2/60 p-3.5 shadow-3d-sm">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">3. Cước phí & Tài chính</h4>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-3">
            <Form.Item name="sellPrice" label="Giá bán (Cước)">
              <InputNumber<number>
                className="tnum w-full"
                precision={0}
                min={0}
                step={10000}
                formatter={(val) => `${val ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(val) => Number(val?.replace(/\./g, '') ?? 0)}
              />
            </Form.Item>

            <Form.Item name="deposit" label="Đã cọc">
              <InputNumber<number>
                className="tnum w-full"
                precision={0}
                min={0}
                step={10000}
                formatter={(val) => `${val ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(val) => Number(val?.replace(/\./g, '') ?? 0)}
              />
            </Form.Item>

            <Form.Item name="collectOnDelivery" label="Nhờ thu (COD)">
              <InputNumber<number>
                className="tnum w-full"
                precision={0}
                min={0}
                step={10000}
                formatter={(val) => `${val ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(val) => Number(val?.replace(/\./g, '') ?? 0)}
              />
            </Form.Item>

            <Form.Item name="costPrice" label="Giá nhập">
              <InputNumber<number>
                className="tnum w-full"
                precision={0}
                min={0}
                step={10000}
                formatter={(val) => `${val ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(val) => Number(val?.replace(/\./g, '') ?? 0)}
              />
            </Form.Item>

            <Form.Item name="commission" label="Hoa hồng">
              <InputNumber<number>
                className="tnum w-full"
                precision={0}
                min={0}
                step={5000}
                formatter={(val) => `${val ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(val) => Number(val?.replace(/\./g, '') ?? 0)}
              />
            </Form.Item>

            <Form.Item name="partner" label="Đối tác">
              <Input maxLength={100} />
            </Form.Item>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface-2/60 p-3.5 shadow-3d-sm">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">4. Ghi chú đón khách</h4>
          <Form.Item name="note">
            <Input.TextArea rows={2} maxLength={1000} placeholder="Ghi chú đón trả khách" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
