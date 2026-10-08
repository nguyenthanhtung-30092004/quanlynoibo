'use client';

import { App, Button, DatePicker, Form, Input, InputNumber, Modal, Radio, Select, TimePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCurrentUser } from '@/features/auth/hooks';
import { useActiveRoutes } from '@/features/routes/hooks';
import { useActiveStaff } from '@/features/users/hooks';
import { ApiError } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import { getVnToday } from '@/lib/time';
import { useUiStore } from '@/stores/ui-store';
import { useCreateOrder } from '../hooks';
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
  staffId?: number;
  note?: string;
}

const FORM_ID = 'create-order-form';

export function CreateOrderModal() {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const open = useUiStore((s) => s.createOrderOpen);
  const setOpen = useUiStore((s) => s.setCreateOrderOpen);
  const { data: user } = useCurrentUser();
  const isAdmin = user?.role === 'ADMIN';

  const { data: routes = [], isPending: routesLoading } = useActiveRoutes(open);
  const { data: staff = [] } = useActiveStaff(isAdmin && open);
  const createOrder = useCreateOrder();

  const close = () => {
    form.resetFields();
    setOpen(false);
  };

  const handleRouteChange = (routeId: number) => {
    const selected = routes.find((r) => r.id === routeId);
    if (selected?.defaultPrice) {
      const currentPrice = form.getFieldValue('sellPrice');
      if (!currentPrice) {
        form.setFieldValue('sellPrice', selected.defaultPrice);
      }
    }
  };

  const handleFinish = (values: FormValues) => {
    createOrder.mutate(
      {
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
        staffId: isAdmin ? values.staffId : undefined,
      },
      {
        onSuccess: () => {
          message.success('Đã tạo đơn hàng thành công.');
          close();
        },
        onError: (err) => message.error(err instanceof ApiError ? err.message : 'Tạo đơn thất bại.'),
      },
    );
  };

  return (
    <Modal
      open={open}
      onCancel={close}
      title={
        <div className="flex items-center gap-2 text-base font-bold text-ink">
          <div className="size-2 rounded-full bg-accent" />
          <span>Tạo đơn đặt xe mới</span>
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
            loading={createOrder.isPending}
            className="shadow-3d-primary"
          >
            Xác nhận tạo đơn
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
        initialValues={{
          departureDate: dayjs(getVnToday()),
          departureTime: dayjs('08:30', 'HH:mm'),
          seatCount: 1,
          vehicleType: 'Limousine 9 chỗ',
        }}
        className="pt-2 max-h-[75vh] overflow-y-auto pr-1"
      >
        {/* Khối 1: Thông tin khách hàng */}
        <div className="mb-4 rounded-xl border border-line bg-surface-2/60 p-3.5 shadow-3d-sm">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">1. Thông tin khách hàng</h4>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
            <Form.Item
              name="customerName"
              label="Tên khách hàng"
              rules={[{ whitespace: true, message: 'Nhập tên khách hàng' }]}
            >
              <Input placeholder="Ví dụ: Nguyễn Văn Hải" maxLength={100} autoFocus />
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
              <Input inputMode="tel" placeholder="0912 345 678" />
            </Form.Item>
          </div>
        </div>

        {/* Khối 2: Chuyến xe & Lịch trình */}
        <div className="mb-4 rounded-xl border border-line bg-surface-2/60 p-3.5 shadow-3d-sm">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">2. Lịch trình & Chỗ ngồi</h4>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
            <Form.Item
              name="routeId"
              label="Tuyến đường"
              className="sm:col-span-2"
              rules={[{ required: true, message: 'Vui lòng chọn tuyến đường' }]}
            >
              <Select
                showSearch
                loading={routesLoading}
                placeholder="Chọn tuyến đường"
                optionFilterProp="label"
                onChange={handleRouteChange}
                options={routes.map((r) => ({
                  value: r.id,
                  label: `${r.name} ${r.defaultPrice ? `(${formatVND(r.defaultPrice)})` : ''}`,
                }))}
              />
            </Form.Item>

            <Form.Item name="departureDate" label="Ngày đi" rules={[{ required: true, message: 'Chọn ngày đi' }]}>
              <DatePicker format="DD/MM/YYYY" className="w-full" allowClear={false} />
            </Form.Item>

            <Form.Item name="departureTime" label="Giờ đón" rules={[{ required: true, message: 'Chọn giờ đón' }]}>
              <TimePicker format="HH:mm" className="w-full" allowClear={false} minuteStep={5} />
            </Form.Item>

            <Form.Item name="vehicleType" label="Loại hình xe">
              <Input placeholder="Ví dụ: Xe limousine 9 chỗ, Xe ghép" maxLength={100} />
            </Form.Item>

            <Form.Item name="seatCount" label="Số ghế" rules={[{ required: true, min: 1, message: 'Ít nhất 1 ghế' }]}>
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

        {/* Khối 3: Cước phí & Đối tác */}
        <div className="mb-4 rounded-xl border border-line bg-surface-2/60 p-3.5 shadow-3d-sm">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">3. Cước phí & Tài chính</h4>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-3">
            <Form.Item name="sellPrice" label="Giá bán (Cước phí)">
              <InputNumber<number>
                className="tnum w-full"
                precision={0}
                min={0}
                step={10000}
                formatter={(val) => `${val ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(val) => Number(val?.replace(/\./g, '') ?? 0)}
                placeholder="300.000"
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
                placeholder="0"
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
                placeholder="0"
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
                placeholder="0"
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
                placeholder="0"
              />
            </Form.Item>

            <Form.Item name="partner" label="Đối tác vận chuyển">
              <Input placeholder="Tên đối tác / nhà xe" maxLength={100} />
            </Form.Item>
          </div>
        </div>

        {/* Khối 4: Ghi chú & Nhân viên phụ trách */}
        <div className="rounded-xl border border-line bg-surface-2/60 p-3.5 shadow-3d-sm">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">4. Ghi chú & Điều phối</h4>
          <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
            {isAdmin && (
              <Form.Item name="staffId" label="Nhân viên phụ trách (chỉ Admin)" className="sm:col-span-2">
                <Select
                  allowClear
                  placeholder="Mặc định: Bạn là người tạo"
                  options={staff.map((u) => ({ value: u.id, label: u.fullName }))}
                />
              </Form.Item>
            )}

            <Form.Item name="note" label="Ghi chú đón khách" className="sm:col-span-2">
              <Input.TextArea rows={2} maxLength={1000} placeholder="Điểm đón chi tiết, lưu ý hành lý, yêu cầu của khách" />
            </Form.Item>
          </div>
        </div>
      </Form>
    </Modal>
  );
}
