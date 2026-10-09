'use client';

import { useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Eye, EyeSlash, Lock, LockKey, ShieldCheck, User, Van } from '@phosphor-icons/react';
import { ApiError } from '@/lib/api-client';
import { authApi } from '../api';
import { useLogin } from '../hooks';

type Mode = 'login' | 'change';

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  icon: 'lock' | 'key';
}) {
  const [show, setShow] = useState(false);
  const Icon = icon === 'lock' ? Lock : LockKey;
  return (
    <div className="lg-field">
      <Icon size={20} className="ico" />
      <input
        className="lg-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
      <button type="button" className="lg-eye" onClick={() => setShow((s) => !s)} aria-label="Hiện/ẩn mật khẩu">
        {show ? <EyeSlash size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function LoginForm() {
  const login = useLogin();
  const stageRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tilt = (e: MouseEvent) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
  };
  const untilt = () => {
    if (stageRef.current) stageRef.current.style.transform = '';
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    login.mutate(
      { username, password },
      {
        // Điều hướng cứng để middleware nhận cookie phiên mới
        onSuccess: () => window.location.assign('/xvip'),
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Đăng nhập thất bại.'),
      },
    );
  };

  /** Đổi mật khẩu ngay tại trang đăng nhập: xác thực bằng mật khẩu cũ, đổi xong đăng xuất để vào lại bằng mật khẩu mới */
  const handleChange = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (newPassword.length < 8) return setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
    if (newPassword !== confirmPassword) return setError('Mật khẩu nhập lại không khớp.');
    setBusy(true);
    try {
      await authApi.login({ username, password });
      try {
        await authApi.changePassword({ oldPassword: password, newPassword, confirmPassword });
      } finally {
        await authApi.logout().catch(() => undefined);
      }
      switchMode('login');
      setNotice('Đổi mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đổi mật khẩu thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <div ref={stageRef} className="lg-stage" onMouseMove={tilt} onMouseLeave={untilt}>
      <div className="lg-card">
        <div className="lg-logo">
          <Van size={38} weight="fill" />
        </div>
        <h1 className="lg-title">{isLogin ? 'Chào mừng trở lại' : 'Đổi mật khẩu'}</h1>
        <p className="lg-sub">
          {isLogin ? 'Đăng nhập hệ thống điều hành đặt xe nội bộ' : 'Nhập mật khẩu hiện tại để đặt mật khẩu mới'}
        </p>

        {error && (
          <div className="lg-msg err" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="lg-msg ok" role="status">
            {notice}
          </div>
        )}

        <form onSubmit={isLogin ? handleLogin : handleChange}>
          <div className="lg-field">
            <User size={20} className="ico" />
            <input
              className="lg-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tên đăng nhập / số điện thoại"
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder={isLogin ? 'Mật khẩu' : 'Mật khẩu hiện tại'}
            autoComplete="current-password"
            icon="lock"
          />
          {!isLogin && (
            <>
              <PasswordField
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
                autoComplete="new-password"
                icon="key"
              />
              <PasswordField
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
                icon="key"
              />
            </>
          )}

          <button type="submit" className="lg-btn" disabled={isLogin ? login.isPending : busy}>
            {isLogin
              ? login.isPending
                ? 'Đang đăng nhập...'
                : 'Đăng nhập'
              : busy
                ? 'Đang xử lý...'
                : 'Xác nhận đổi mật khẩu'}
          </button>
        </form>

        <button type="button" className="lg-link" onClick={() => switchMode(isLogin ? 'change' : 'login')}>
          {isLogin ? (
            <>
              <ShieldCheck size={15} weight="bold" style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
              Đổi mật khẩu
            </>
          ) : (
            '← Quay lại đăng nhập'
          )}
        </button>
      </div>
    </div>
  );
}
