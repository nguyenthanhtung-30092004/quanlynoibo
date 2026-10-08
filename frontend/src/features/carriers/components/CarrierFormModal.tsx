'use client';

import { useEffect } from 'react';
import { App, Button, Form, Input, Modal, Switch } from 'antd';
import { ApiError } from '@/lib/api-client';
import { useCreateCarrier, useUpdateCarrier } from '../hooks';
import type { Carrier } from '../types';

interface FormValues {
  name: string;
  phone?: string;
  address?: string;
  note?: string;
  isActive: boolean;
}

interface CarrierFormModalProps {
  open: boolean;
  carrier: Carrier | null;
  onClose: () => void;
}

const FORM_ID = 'carrier-form';

export function CarrierFormModal({ open, carrier, onClose }: CarrierFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const createCarrier = useCreateCarrier();
  const updateCarrier = useUpdateCarrier();
  const isEdit = carrier !== null;
  const pending = createCarrier.isPending || updateCarrier.isPending;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (carrier) {
      form.setFieldsValue({
        name: carrier.name,
        phone: carrier.phone,
        address: carrier.address,
        note: carrier.note,
        isActive: carrier.isActive,
      });
    } else {
      form.setFieldsValue({ isActive: true });
    }
  }, [open, carrier, form]);

  const handleFinish = (values: FormValues) => {
    if (carrier) {
      updateCarrier.mutate(
        {
          id: carrier.id,
          input: {
            name: values.name.trim(),
            phone: values.phone?.trim() || undefined,
            address: values.address?.trim() || undefined,
            note: values.note?.trim() || undefined,
            isActive: values.isActive,
          },
        },
        {
          onSuccess: () => {
            message.success('Đã cập nhật nhà xe.');
            onClose();
          },
          onError: (err) =>
            message.error(err instanceof ApiError ? err.message : 'Cập nhật nhà xe thất bại.'),
        },
      );
    } else {
      createCarrier.mutate(
        {
          name: values.name.trim(),
          phone: values.phone?.trim() || undefined,
          address: values.address?.trim() || undefined,
          note: values.note?.trim() || undefined,
          isActive: values.isActive,
        },
        {
          onSuccess: () => {
            message.success('Đã thêm nhà xe mới.');
            onClose();
          },
          onError: (err) =>
            message.error(err instanceof ApiError ? err.message : 'Thêm nhà xe thất bại.'),
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
          <span>{isEdit ? `Sửa nhà xe: ${carrier.name}` : 'Thêm nhà xe đối tác mới'}</span>
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
            {isEdit ? 'Lưu thay đổi' : 'Thêm nhà xe'}
          </Button>
        </div>
      }
    >
      <Form id={FORM_ID} form={form} layout="vertical" requiredMark={false} onFinish={handleFinish} className="pt-2">
        <Form.Item
          name="name"
          label="Tên nhà xe"
          rules={[{ required: true, whitespace: true, message: 'Nhập tên nhà xe' }]}
        >
          <Input placeholder="Ví dụ: Sao Việt, Hải Âu, XVIP Limousine" maxLength={100} autoFocus />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Số điện thoại tổng đài / điều hành"
          rules={[{ pattern: /^(0|\+84)\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}
        >
          <Input placeholder="0912 345 678" inputMode="tel" maxLength={15} />
        </Form.Item>

        <Form.Item name="address" label="Địa chỉ văn phòng / bến đỗ">
          <Input placeholder="Ví dụ: Bến xe Giáp Bát, Hà Nội" maxLength={255} />
        </Form.Item>

        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} maxLength={1000} placeholder="Ghi chú về tần suất xe, người liên hệ..." />
        </Form.Item>

        <Form.Item name="isActive" label="Trạng thái hợp tác" valuePropName="checked">
          <Switch checkedChildren="Đang hợp tác" unCheckedChildren="Tạm dừng" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
