'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

type DialogState =
  | { kind: 'confirm'; message: string; confirmLabel: string }
  | { kind: 'prompt'; message: string; expected: string; value: string };

type PendingDialog =
  | { kind: 'confirm'; resolve: (value: boolean) => void }
  | { kind: 'prompt'; resolve: (value: string | null) => void };

interface ConfirmDialogContextValue {
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>;
  prompt: (message: string, expected: string) => Promise<string | null>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const pending = useRef<PendingDialog | null>(null);

  const cancelPending = useCallback(() => {
    const active = pending.current;
    pending.current = null;
    if (!active) return;
    if (active.kind === 'confirm') active.resolve(false);
    else active.resolve(null);
  }, []);

  const confirm = useCallback((message: string, confirmLabel = 'Xóa') => {
    return new Promise<boolean>((resolve) => {
      cancelPending();
      pending.current = { kind: 'confirm', resolve };
      setDialog({ kind: 'confirm', message, confirmLabel });
    });
  }, [cancelPending]);

  const prompt = useCallback((message: string, expected: string) => {
    return new Promise<string | null>((resolve) => {
      cancelPending();
      pending.current = { kind: 'prompt', resolve };
      setDialog({ kind: 'prompt', message, expected, value: '' });
    });
  }, [cancelPending]);

  const close = useCallback((value: boolean | string | null) => {
    const active = pending.current;
    pending.current = null;
    setDialog(null);
    if (!active) return;
    if (active.kind === 'confirm') active.resolve(typeof value === 'boolean' && value);
    else active.resolve(typeof value === 'string' ? value : null);
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(dialog.kind === 'confirm' ? false : null);
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [dialog, close]);

  const isPrompt = dialog?.kind === 'prompt';
  const canSubmit = !isPrompt || dialog.value === dialog.expected;

  return (
    <ConfirmDialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close(dialog.kind === 'confirm' ? false : null);
          }}
        >
          <section
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-soft"
            role={dialog.kind === 'confirm' ? 'alertdialog' : 'dialog'}
          >
            <header className="flex items-start gap-3 border-b border-line bg-shell px-5 py-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                {dialog.kind === 'confirm' ? <Trash2 size={18} /> : <AlertTriangle size={18} />}
              </span>
              <div className="min-w-0">
                <h2 id="confirm-dialog-title" className="text-sm font-bold text-fg">
                  {dialog.kind === 'confirm' ? 'Xác nhận xóa' : 'Xác nhận thao tác'}
                </h2>
                <p id="confirm-dialog-message" className="mt-1 whitespace-pre-line text-sm leading-6 text-fg-muted">
                  {dialog.message}
                </p>
              </div>
            </header>
            {dialog.kind === 'prompt' && (
              <div className="px-5 pt-4">
                <p className="mb-2 text-xs text-fg-subtle">
                  Nhập chính xác <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-danger">{dialog.expected}</code> để tiếp tục.
                </p>
                <input
                  autoFocus
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-accent"
                  onChange={(event) => setDialog({ ...dialog, value: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canSubmit) close(dialog.value);
                  }}
                  value={dialog.value}
                />
              </div>
            )}
            <footer className="flex justify-end gap-2 px-5 py-4">
              <button
                className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg-muted transition hover:bg-surface-2"
                onClick={() => close(dialog.kind === 'confirm' ? false : null)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canSubmit}
                onClick={() => close(dialog.kind === 'confirm' ? true : dialog.value)}
                type="button"
              >
                {dialog.kind === 'confirm' ? dialog.confirmLabel : 'Xác nhận'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  return context;
}
