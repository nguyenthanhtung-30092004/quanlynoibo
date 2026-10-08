'use client';

import { App, Button, Form, Input, Modal } from 'antd';
import { ApiError } from '@/lib/api-client';
import { useUiStore } from '@/stores/ui-store';
import { useChangePassword } from '../hooks';
import type { ChangePasswordInput } from '../types';

export function ChangePasswordModal() {
  const { message } = App.useApp();
  const [form] = Form.useForm<ChangePasswordInput>();
  const open = useUiStore((s) => s.changePasswordOpen);
  const setOpen = useUiStore((s) => s.setChangePasswordOpen);
  const changePassword = useChangePassword();

  const close = () => {
    form.resetFields();
    setOpen(false);
  };

  const handleFinish = (values: ChangePasswordInput) => {
    changePassword.mutate(values, {
      onSuccess: () => {
        message.success('Đã đổi mật khẩu thành công.');
        close();
      },
      onError: (err) => message.error(err instanceof ApiError ? err.message : 'Đổi mật khẩu thất bại.'),
    });
  };

  return (
    <Modal
      open={open}
      onCancel={close}
      title={
        <div className="flex items-center gap-2 text-base font-bold text-ink">
          <div className="size-2 rounded-full bg-accent" />
          <span>Đổi mật khẩu tài khoản</span>
        </div>
      }
      width={460}
      centered
      destroyOnHidden
      footer={
        <div className="flex justify-end gap-2.5 pt-2 border-t border-line">
          <Button onClick={close}>Hủy</Button>
          <Button
            type="primary"
            htmlType="submit"
            form="change-password-form"
            loading={changePassword.isPending}
            className="shadow-3d-primary"
          >
            Lưu mật khẩu mới
          </Button>
        </div>
      }
    >
      <Form
        id="change-password-form"
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={handleFinish}
        className="pt-2"
      >
        <Form.Item
          name="oldPassword"
          label="Mật khẩu hiện tại"
          rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}
        >
          <Input.Password autoComplete="current-password" className="shadow-3d-sm" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="Mật khẩu mới"
          rules={[
            { required: true, message: 'Nhập mật khẩu mới' },
            { min: 6, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' },
          ]}
        >
          <Input.Password autoComplete="new-password" className="shadow-3d-sm" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="Nhập lại mật khẩu mới"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Nhập lại mật khẩu mới' },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || getFieldValue('newPassword') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error('Mật khẩu nhập lại không khớp')),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" className="shadow-3d-sm" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
