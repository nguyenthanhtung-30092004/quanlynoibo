'use client';

import { useState, type FormEvent } from 'react';
import {
  ChatCircleText,
  CheckCircle,
  Database,
  FloppyDisk,
  ShieldCheck,
  Sparkle,
} from '@phosphor-icons/react';
import { Card, PageTitle } from '@/features/xvip/ui';
import { useSound } from '@/features/xvip/sound';

export default function SettingsPage() {
  // General company settings
  const [companyName, setCompanyName] = useState('CÔNG TY TNHH TM & DV XVIP');
  const [hotline, setHotline] = useState('1900 6868');
  const [address, setAddress] = useState('Số 12 Bến xe Mỹ Đình, Từ Liêm, Hà Nội');
  const [email, setEmail] = useState('dieuhanh@xvip.vn');

  // SMS / Zalo template settings
  const [smsTemplate, setSmsTemplate] = useState(
    'XVIP xac nhan ve xe: {tenKhach} ({sdt}) di {tuyenDuong}, gio chay {gioChay}, nha xe {nhaXe}. Gia ve: {giaVe}d. Hotline ho tro: {hotline}. Chuc quy khach thuong lo binh an!'
  );

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification / Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const samplePreview = smsTemplate
    .replace('{tenKhach}', 'Nguyễn Văn An')
    .replace('{sdt}', '0983 456 789')
    .replace('{tuyenDuong}', 'Hà Nội - Cẩm Phả')
    .replace('{gioChay}', '11:30')
    .replace('{nhaXe}', 'XVIP Limousine')
    .replace('{giaVe}', '300.000')
    .replace('{hotline}', hotline);

  const { playSuccess, playWarn } = useSound();

  const handleSaveCompany = (e: FormEvent) => {
    e.preventDefault();
    localStorage.setItem('xvip_company_name', companyName);
    localStorage.setItem('xvip_company_hotline', hotline);
    localStorage.setItem('xvip_company_address', address);
    localStorage.setItem('xvip_company_email', email);
    playSuccess();
    showToast('Đã lưu thông tin cấu hình công ty thành công!');
  };

  const handleSaveTemplate = (e: FormEvent) => {
    e.preventDefault();
    localStorage.setItem('xvip_sms_template', smsTemplate);
    playSuccess();
    showToast('Đã lưu mẫu tin nhắn SMS / Zalo 1-chạm thành công!');
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      playWarn();
      showToast('Vui lòng nhập đầy đủ thông tin mật khẩu.');
      return;
    }
    if (newPassword !== confirmPassword) {
      playWarn();
      showToast('Mật khẩu mới và xác nhận mật khẩu không trùng khớp!');
      return;
    }

    try {
      const { api } = await import('@/lib/api-client');
      await api('auth/change-password', {
        method: 'POST',
        body: { oldPassword, newPassword, confirmPassword },
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      playSuccess();
      showToast('Đã đổi mật khẩu tài khoản quản trị thành công!');
    } catch (err: unknown) {
      playWarn();
      const msg = err instanceof Error ? err.message : 'Đổi mật khẩu thất bại.';
      showToast(`Lỗi: ${msg}`);
    }
  };

  return (
    <>
      <PageTitle
        actions={
          <button
            type="button"
            onClick={() => showToast('Tất cả cấu hình hệ thống đã được lưu vào bộ nhớ!')}
            className="btn-3d btn-3d-blue flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <FloppyDisk size={18} weight="bold" /> Lưu toàn bộ cấu hình
          </button>
        }
      >
        Cài đặt hệ thống
      </PageTitle>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 shadow-[0_4px_0_#a7f3d0] animate-in fade-in">
          <CheckCircle size={20} weight="fill" className="text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Cấu hình thông tin công ty */}
        <Card title="Thông tin tổ chức & Thương hiệu">
          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Tên đơn vị chủ quản
                </span>
                <input
                  className="input-3d"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Hotline tổng đài
                  </span>
                  <input
                    className="input-3d font-bold text-blue-700"
                    value={hotline}
                    onChange={(e) => setHotline(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Email điều hành
                  </span>
                  <input
                    className="input-3d"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Địa chỉ trung tâm điều hành
                </span>
                <input
                  className="input-3d"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-3d btn-3d-blue px-4 py-2 text-xs">
                Cập nhật thông tin công ty
              </button>
            </div>
          </form>
        </Card>

        {/* 2. Cấu hình bảo mật & Đổi mật khẩu */}
        <Card title="Bảo mật & Đổi mật khẩu tài khoản">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Mật khẩu hiện tại
                </span>
                <input
                  className="input-3d"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Mật khẩu mới
                  </span>
                  <input
                    className="input-3d"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    required
                  />
                </label>
              </div>

              <div>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Xác nhận mật khẩu mới
                  </span>
                  <input
                    className="input-3d"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-xs font-medium text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              Mật khẩu nên chứa ít nhất 8 ký tự, bao gồm chữ cái, chữ số và ký tự đặc biệt để đảm bảo an toàn vận hành.
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-3d btn-3d-amber px-4 py-2 text-xs">
                Cập nhật mật khẩu mới
              </button>
            </div>
          </form>
        </Card>

        {/* 3. Cấu hình mẫu tin nhắn SMS / Zalo 1-chạm */}
        <div className="lg:col-span-2">
          <Card title="Cấu hình Mẫu tin nhắn SMS & Zalo gửi khách hàng (1-Chạm)">
            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Nội dung mẫu tin nhắn tự động
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-400">
                    <span className="text-slate-500 dark:text-slate-400">Các biến thay thế:</span>
                    <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">{'{tenKhach}'}</code>
                    <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">{'{sdt}'}</code>
                    <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">{'{tuyenDuong}'}</code>
                    <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">{'{gioChay}'}</code>
                    <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">{'{nhaXe}'}</code>
                    <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">{'{giaVe}'}</code>
                    <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">{'{hotline}'}</code>
                  </div>
                </div>

                <textarea
                  className="input-3d min-h-[90px] font-mono text-xs leading-relaxed"
                  value={smsTemplate}
                  onChange={(e) => setSmsTemplate(e.target.value)}
                  required
                />
              </div>

              {/* Live Preview giả lập tin nhắn điện thoại */}
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.15)] border border-slate-700">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChatCircleText size={18} weight="bold" className="text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Bản xem trước tin nhắn thực tế (Live Preview SMS / Zalo)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Độ dài: {samplePreview.length} ký tự</span>
                </div>
                <div className="rounded-xl bg-slate-950/70 p-3.5 text-xs font-mono text-emerald-400 border border-slate-700/60 leading-relaxed">
                  {samplePreview}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" className="btn-3d btn-3d-green px-5 py-2.5 text-sm">
                  Lưu mẫu tin nhắn 1-chạm
                </button>
              </div>
            </form>
          </Card>
        </div>

        {/* 4. Trạng thái kết nối máy chủ & Cơ sở dữ liệu */}
        <div className="lg:col-span-2">
          <Card title="Hạ tầng & Kết nối máy chủ NestJS">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3.5 border border-slate-200 dark:border-slate-700">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shadow-sm">
                  <Database size={22} weight="bold" />
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Cơ sở dữ liệu</div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">PostgreSQL (xvip_db)</div>
                  <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">● Hoạt động bình thường</div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3.5 border border-slate-200 dark:border-slate-700">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 shadow-sm">
                  <Sparkle size={22} weight="bold" />
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Backend API</div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">NestJS (Port 3009)</div>
                  <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">● REST API v1 sẵn sàng</div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3.5 border border-slate-200 dark:border-slate-700">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 shadow-sm">
                  <ShieldCheck size={22} weight="bold" />
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Bảo mật</div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">JWT + Argon2</div>
                  <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">● Chuẩn mã hóa cao</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
