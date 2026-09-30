'use client';

import { useState } from 'react';
import { USER_ROLE_LABELS, UserRole } from '@tayninh/shared';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { ButtonSpinner, FIELD_CLASS, FormField, PageHeader } from '@/components/ui';

/**
 * Trang "Tài khoản" — xem thông tin của chính người đang đăng nhập + tự đổi mật khẩu.
 * Khác `/houses/users` (chỉ ADMIN, quản lý người khác): trang này mở cho mọi vai trò, chỉ đọc
 * `useAuth().user` có sẵn (không gọi API để lấy thông tin), và đổi mật khẩu phải xác minh mật
 * khẩu hiện tại (API riêng `/api/auth/me/password`, khác `usersApi.update` của ADMIN).
 */
export default function AccountPage() {
  const { user, changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới nhập lại không khớp');
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không đổi được mật khẩu');
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="h-full overflow-auto p-6 space-y-4 max-w-lg">
      <PageHeader title="Tài khoản" subtitle="Thông tin tài khoản đang đăng nhập" />

      <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5 space-y-3 text-sm">
        <Row label="Họ tên" value={user.fullName} />
        <Row label="Tên đăng nhập" value={user.username} />
        <Row label="Vai trò" value={USER_ROLE_LABELS[user.role as UserRole]} />
        <Row label="Đơn vị" value={user.unit ?? '—'} />
        <Row label="Chức vụ" value={user.position ?? '—'} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 shadow-card p-5 space-y-3"
      >
        <h3 className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
          Đổi mật khẩu
        </h3>
        <FormField label="Mật khẩu hiện tại" required>
          <PasswordInput
            value={currentPassword}
            onChange={setCurrentPassword}
            visible={showCurrent}
            onToggleVisible={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
          />
        </FormField>
        <FormField label="Mật khẩu mới" required>
          <PasswordInput
            value={newPassword}
            onChange={setNewPassword}
            visible={showNew}
            onToggleVisible={() => setShowNew((v) => !v)}
            minLength={6}
            placeholder="Tối thiểu 6 ký tự"
            autoComplete="new-password"
          />
        </FormField>
        <FormField label="Xác nhận mật khẩu mới" required>
          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={showConfirm}
            onToggleVisible={() => setShowConfirm((v) => !v)}
            minLength={6}
            autoComplete="new-password"
          />
        </FormField>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-2.5 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-2.5 text-sm">
            Đổi mật khẩu thành công.
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
        >
          {saving && <ButtonSpinner light />}
          Đổi mật khẩu
        </button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

/** Ô mật khẩu có nút "Hiện/Ẩn" — cùng kiểu với ô mật khẩu ở trang đăng nhập. */
function PasswordInput({
  value,
  onChange,
  visible,
  onToggleVisible,
  minLength,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  minLength?: number;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${FIELD_CLASS} pr-12`}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        tabIndex={-1}
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        {visible ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.24A9.96 9.96 0 0112 4c5 0 9.27 3.11 11 7.5a11.9 11.9 0 01-3.16 4.57M6.61 6.61A11.9 11.9 0 001 11.5C2.73 15.89 7 19 12 19c1.35 0 2.64-.22 3.84-.63"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M1 11.5C2.73 7.11 7 4 12 4s9.27 3.11 11 7.5C21.27 15.89 17 19 12 19S2.73 15.89 1 11.5z"
            />
            <circle cx="12" cy="11.5" r="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
