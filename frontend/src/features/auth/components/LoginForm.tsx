'use client';

import { useState } from 'react';
import { Alert, Button, Form, Input } from 'antd';
import { Lock, User } from '@phosphor-icons/react';
import { ApiError } from '@/lib/api-client';
import { Brand } from '@/components/layout/Brand';
import { useLogin } from '../hooks';
import type { LoginInput } from '../types';

export function LoginForm() {
  const login = useLogin();
  const [error, setError] = useState<string | null>(null);

  const handleFinish = (values: LoginInput) => {
    setError(null);
    login.mutate(values, {
      // Điều hướng cứng để middleware nhận cookie phiên mới
      onSuccess: () => window.location.assign('/xvip'),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Đăng nhập thất bại.'),
    });
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-rail via-[#14202B] to-[#0c141c] p-4.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_6px_20px_rgba(0,0,0,0.3)] border border-rail-line/40">
        <Brand />
      </div>

      <div className="card-3d p-6">
        <h1 className="text-xl font-bold tracking-tight text-ink">Đăng nhập hệ thống</h1>
        <p className="mb-5 mt-1 text-sm text-ink-3">Sử dụng tài khoản nội bộ do quản trị viên cấp.</p>

        <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item
            name="username"
            label="Số điện thoại / Tên đăng nhập"
            rules={[{ required: true, message: 'Nhập số điện thoại hoặc tên đăng nhập' }]}
          >
            <Input
              autoFocus
              autoComplete="username"
              size="large"
              prefix={<User size={18} className="text-ink-3 mr-1" />}
              placeholder="admin hoặc email/sđt"
              className="shadow-3d-sm"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[{ required: true, message: 'Nhập mật khẩu' }]}
          >
            <Input.Password
              autoComplete="current-password"
              size="large"
              prefix={<Lock size={18} className="text-ink-3 mr-1" />}
              placeholder="••••••••"
              className="shadow-3d-sm"
            />
          </Form.Item>

          {error && <Alert type="error" showIcon message={error} className="mb-4" />}

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={login.isPending}
            className="shadow-3d-primary mt-2 h-11 text-base font-bold"
          >
            Đăng nhập ngay
          </Button>
        </Form>
      </div>
    </div>
  );
}
