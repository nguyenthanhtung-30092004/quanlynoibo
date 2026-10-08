'use client';

import { useEffect } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Switch } from 'antd';
import { ApiError } from '@/lib/api-client';
import { useCreateRoute, useUpdateRoute } from '../hooks';
import type { Route } from '../types';

interface FormValues {
  name: string;
  origin: string;
  destination: string;
  defaultPrice?: number;
  isActive: boolean;
}

interface RouteFormModalProps {
  open: boolean;
  route: Route | null;
  onClose: () => void;
}

const FORM_ID = 'route-form';

export function RouteFormModal({ open, route, onClose }: RouteFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const createRoute = useCreateRoute();
  const updateRoute = useUpdateRoute();
  const isEdit = route !== null;
  const pending = createRoute.isPending || updateRoute.isPending;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (route) {
      form.setFieldsValue({
        name: route.name,
        origin: route.origin,
        destination: route.destination,
        defaultPrice: route.defaultPrice,
        isActive: route.isActive,
      });
    } else {
      form.setFieldsValue({ isActive: true });
    }
  }, [open, route, form]);

  const handleFinish = (values: FormValues) => {
    if (route) {
      updateRoute.mutate(
        {
          id: route.id,
          input: {
            name: values.name.trim(),
            origin: values.origin.trim(),
            destination: values.destination.trim(),
            defaultPrice: values.defaultPrice,
            isActive: values.isActive,
          },
        },
        {
          onSuccess: () => {
            message.success('Đã cập nhật tuyến đường.');
            onClose();
          },
          onError: (err) =>
            message.error(err instanceof ApiError ? err.message : 'Cập nhật tuyến thất bại.'),
        },
      );
    } else {
      createRoute.mutate(
        {
          name: values.name.trim(),
          origin: values.origin.trim(),
          destination: values.destination.trim(),
          defaultPrice: values.defaultPrice,
          isActive: values.isActive,
        },
        {
          onSuccess: () => {
            message.success('Đã thêm tuyến đường mới.');
            onClose();
          },
          onError: (err) =>
            message.error(err instanceof ApiError ? err.message : 'Thêm tuyến thất bại.'),
        },
      );
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div className="flex items-center gap-2 text-base font-bold text-ink">
          <div className="size-2 rounded-full bg-accent" />
          <span>{isEdit ? `Sửa tuyến đường: ${route.name}` : 'Thêm tuyến đường mới'}</span>
        </div>
      }
      width={540}
      centered
      destroyOnHidden
      footer={
        <div className="flex justify-end gap-2.5 pt-2 border-t border-line">
          <Button onClick={onClose}>Hủy</Button>
          <Button
            type="primary"
            htmlType="submit"
            form={FORM_ID}
            loading={pending}
            className="shadow-3d-primary"
          >
            {isEdit ? 'Lưu thay đổi' : 'Thêm tuyến đường'}
          </Button>
        </div>
      }
    >
      <Form id={FORM_ID} form={form} layout="vertical" requiredMark={false} onFinish={handleFinish} className="pt-2">
        <Form.Item
          name="name"
          label="Tên tuyến đường"
          rules={[{ required: true, whitespace: true, message: 'Nhập tên tuyến đường' }]}
        >
          <Input placeholder="Ví dụ: Hà Nội - Cẩm Phả" maxLength={255} autoFocus />
        </Form.Item>

        <div className="grid grid-cols-2 gap-3">
          <Form.Item
            name="origin"
            label="Điểm đi (Xuất phát)"
            rules={[{ required: true, whitespace: true, message: 'Nhập điểm đi' }]}
          >
            <Input placeholder="Hà Nội" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="destination"
            label="Điểm đến"
            rules={[{ required: true, whitespace: true, message: 'Nhập điểm đến' }]}
          >
            <Input placeholder="Cẩm Phả" maxLength={100} />
          </Form.Item>
        </div>

        <Form.Item name="defaultPrice" label="Giá vé mặc định (VNĐ)">
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

        <Form.Item name="isActive" label="Trạng thái hoạt động" valuePropName="checked">
          <Switch checkedChildren="Đang chạy" unCheckedChildren="Tạm dừng" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
