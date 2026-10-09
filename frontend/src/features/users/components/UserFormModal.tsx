'use client';

import { useEffect } from 'react';
import { App, Button, Form, Input, Modal, Select } from 'antd';
import type { UserRole } from '@/features/auth/types';
import { ApiError } from '@/lib/api-client';
import { useCreateUser, useUpdateUser } from '../hooks';
import type { User } from '../types';

interface FormValues {
  username: string;
  password?: string;
  fullName: string;
  phone?: string;
  address?: string;
  role: UserRole;
}

interface UserFormModalProps {
  open: boolean;
  /** null = tạo mới; có user = chỉnh sửa */
  user: User | null;
  /** Đang sửa chính tài khoản của mình: không cho tự hạ vai trò */
  isSelf: boolean;
  onClose: () => void;
}

const FORM_ID = 'user-form';

/** Chuỗi rỗng -> undefined để không gửi lên server */
const blank = (value?: string) => value?.trim() || undefined;

export function UserFormModal({ open, user, isSelf, onClose }: UserFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const isEdit = user !== null;
  const pending = createUser.isPending || updateUser.isPending;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (user) {
      form.setFieldsValue({
        username: user.username,
        fullName: user.fullName,
        phone: user.phone ?? undefined,
        address: user.address ?? undefined,
        role: user.role,
      });
    } else {
      form.setFieldsValue({ role: 'STAFF' });
    }
  }, [open, user, form]);

  const handleError = (err: unknown) =>
    message.error(err instanceof ApiError ? err.message : 'Thao tác thất bại.');

  const handleFinish = (values: FormValues) => {
    if (user) {
      updateUser.mutate(
        {
          id: user.id,
          input: {
            fullName: values.fullName.trim(),
            phone: blank(values.phone),
            address: blank(values.address),
            role: values.role,
            password: blank(values.password),
          },
        },
        {
          onSuccess: () => {
            message.success('Đã cập nhật thông tin tài khoản.');
            onClose();
          },
          onError: handleError,
        },
      );
      return;
    }

    createUser.mutate(
      {
        username: values.username.trim(),
        password: values.password ?? '',
        fullName: values.fullName.trim(),
        phone: blank(values.phone),
        address: blank(values.address),
        role: values.role,
      },
      {
        onSuccess: () => {
          message.success('Đã tạo tài khoản nhân viên mới.');
          onClose();
        },
        onError: handleError,
      },
    );
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div className="flex items-center gap-2 text-base font-bold text-ink">
          <div className="size-2 rounded-full bg-accent" />
          <span>{isEdit ? `Sửa tài khoản: ${user.fullName}` : 'Tạo tài khoản nhân viên mới'}</span>
        </div>
      }
      width={640}
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
            {isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </Button>
        </div>
      }
    >
      <Form id={FORM_ID} form={form} layout="vertical" requiredMark={false} onFinish={handleFinish} className="pt-2">
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item
            name="username"
            label="Tên đăng nhập"
            rules={[
              { required: true, message: 'Nhập tên đăng nhập' },
              { min: 3, max: 50, message: 'Tên đăng nhập phải từ 3 đến 50 ký tự' },
            ]}
          >
            <Input disabled={isEdit} autoComplete="off" autoFocus={!isEdit} className="shadow-3d-sm" />
          </Form.Item>
          <Form.Item
            name="password"
            label={isEdit ? 'Mật khẩu mới (tùy chọn)' : 'Mật khẩu khởi tạo'}
            tooltip={isEdit ? 'Để trống nếu không đổi. Đổi mật khẩu sẽ đăng xuất tài khoản này khỏi các thiết bị.' : undefined}
            rules={[
              { required: !isEdit, message: 'Nhập mật khẩu' },
              { min: 8, max: 100, message: 'Mật khẩu phải từ 8 đến 100 ký tự' },
            ]}
          >
            <Input.Password autoComplete="new-password" className="shadow-3d-sm" />
          </Form.Item>

          <Form.Item
            name="fullName"
            label="Họ và tên"
            rules={[{ required: true, whitespace: true, message: 'Nhập họ và tên' }]}
          >
            <Input maxLength={100} className="shadow-3d-sm" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[{ pattern: /^(0|\+84)\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}
          >
            <Input maxLength={15} inputMode="tel" className="shadow-3d-sm" />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select
              disabled={isSelf}
              className="shadow-3d-sm"
              options={[
                { value: 'STAFF', label: 'Nhân viên (chỉ lên đơn)' },
                { value: 'ADMIN', label: 'Quản trị viên (toàn quyền)' },
              ]}
            />
          </Form.Item>

          <Form.Item name="address" label="Địa chỉ" className="sm:col-span-2">
            <Input maxLength={255} className="shadow-3d-sm" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
