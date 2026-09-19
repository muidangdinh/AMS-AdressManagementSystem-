'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type HealthResponse = {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  checks: {
    api: 'up' | 'down';
    database: 'up' | 'down';
    postgis: 'enabled' | 'unknown';
  };
  postgisVersion: string | null;
  error: string | null;
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className="relative inline-flex w-2.5 h-2.5">
      {ok && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
      )}
      <span className={`relative inline-flex rounded-full w-2.5 h-2.5 ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
    </span>
  );
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function fetchHealth() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/health`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHealth(await res.json());
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Không kết nối được API');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
  }, []);

  const dbUp = health?.checks.database === 'up';
  const postgisOk = health?.checks.postgis === 'enabled';

  return (
    <main className="min-h-screen flex items-center justify-center bg-app-shell p-6 relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-blue-100/60 blur-3xl"
      />

      <div className="w-full max-w-lg bg-white/90 backdrop-blur rounded-2xl shadow-soft border border-slate-200/70 overflow-hidden relative">
        <div className="px-7 pt-7 pb-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-soft shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-5.5 h-5.5 text-white">
              <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Tây Ninh GIS</h1>
            <p className="text-xs text-slate-500">Kiểm tra luồng Next.js → NestJS → PostgreSQL/PostGIS</p>
          </div>
        </div>

        <div className="px-7 pb-7 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
              <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
              Đang kiểm tra kết nối…
            </div>
          )}

          {errorMsg && !loading && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3.5 text-sm">
              <strong>Không gọi được API</strong> ({API_URL}/api/health): {errorMsg}
              <br />
              Hãy chắc chắn backend đang chạy trên cổng 3001.
            </div>
          )}

          {health && !loading && (
            <>
              <div
                className={`rounded-xl p-3.5 text-sm font-semibold ${
                  health.status === 'ok'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                Trạng thái tổng: {health.status === 'ok' ? '✅ Hoạt động tốt' : '⚠️ Suy giảm'}
              </div>

              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-white">
                <li className="flex items-center justify-between px-4 py-3">
                  <span className="flex items-center gap-2.5 text-sm text-slate-700">
                    <StatusDot ok={health.checks.api === 'up'} /> Backend API (NestJS)
                  </span>
                  <span className="font-mono text-xs text-slate-400">{health.checks.api}</span>
                </li>
                <li className="flex items-center justify-between px-4 py-3">
                  <span className="flex items-center gap-2.5 text-sm text-slate-700">
                    <StatusDot ok={dbUp} /> Database (PostgreSQL)
                  </span>
                  <span className="font-mono text-xs text-slate-400">{health.checks.database}</span>
                </li>
                <li className="flex items-center justify-between px-4 py-3">
                  <span className="flex items-center gap-2.5 text-sm text-slate-700">
                    <StatusDot ok={postgisOk} /> Tiện ích không gian (PostGIS)
                  </span>
                  <span className="font-mono text-xs text-slate-400">{health.checks.postgis}</span>
                </li>
              </ul>

              {health.postgisVersion && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] font-mono text-slate-500 break-words">
                  {health.postgisVersion}
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                Cập nhật: {new Date(health.timestamp).toLocaleString('vi-VN')}
              </p>
            </>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              onClick={fetchHealth}
              className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              Kiểm tra lại
            </button>
            <a
              href="/houses"
              className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold transition shadow-soft"
            >
              Vào hệ thống →
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
