'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Globe } from 'lucide-react';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ username, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-app-shell p-6 relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-info/20 blur-3xl"
      />

      <div className="w-full max-w-sm glass !rounded-2xl overflow-hidden relative">
        <div className="px-7 pt-8 pb-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow-accent mb-4">
            <Globe className="w-6 h-6 text-white" strokeWidth={1.8} />
          </div>
          <h1 className="text-lg font-bold text-fg">Tây Ninh</h1>
          <p className="text-xs text-fg-muted mt-1">Hệ thống Đánh số &amp; Gắn biển số nhà</p>
        </div>

        <form onSubmit={handleSubmit} className="px-7 pb-8 space-y-4">
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-fg-muted uppercase tracking-wide mb-1.5">
              Tên đăng nhập
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full border border-line rounded-xl px-3.5 py-2.5 text-sm bg-surface-2/60 text-fg placeholder:text-fg-subtle focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-fg-muted uppercase tracking-wide mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-line rounded-xl px-3.5 py-2.5 pr-10 text-sm bg-surface-2/60 text-fg placeholder:text-fg-subtle focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg text-xs font-semibold"
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-gradient hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 shadow-glow-accent flex items-center justify-center gap-2"
          >
            {loading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </main>
  );
}
