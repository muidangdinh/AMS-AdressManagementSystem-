'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Printer,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { CaseAttachment } from '@tayninh/shared';
import { ApiError } from '@/lib/api';
import { casesApi } from '@/lib/cases-api';
import { ButtonSpinner } from '@/components/ui';

type DocKind = 'pdf' | 'docx' | 'image' | 'unsupported';

function kindOf(fileName: string): DocKind {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') return 'image';
  return 'unsupported';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(fileName: string) {
  const kind = kindOf(fileName);
  if (kind === 'image') return ImageIcon;
  if (kind === 'pdf' || kind === 'docx') return FileText;
  if (/\.(xlsx?|csv)$/i.test(fileName)) return FileSpreadsheet;
  return FileText;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"]/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch,
  );
}

export default function AttachmentViewerModal({
  caseId,
  attachments,
  activeId,
  onSelect,
  onClose,
  onDownload,
}: {
  caseId: string;
  attachments: CaseAttachment[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onDownload: (attachment: CaseAttachment) => void;
}) {
  const active = attachments.find((a) => a.id === activeId) ?? null;
  const activeName = active?.fileName ?? '';
  const kind = kindOf(activeName);

  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const blobCache = useRef(new Map<string, Blob>());
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    setZoom(1);
    setViewError(null);
  }, [activeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current = [];
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const container = contentRef.current;
    if (!container) return;

    let cancelled = false;
    container.innerHTML = '';
    setViewError(null);

    const docKind = kindOf(active.fileName);
    if (docKind === 'unsupported') {
      setLoading(false);
      return;
    }

    setLoading(true);

    void (async () => {
      try {
        let blob = blobCache.current.get(active.id);
        if (!blob) {
          blob = await casesApi.downloadAttachment(caseId, active.id);
          blobCache.current.set(active.id, blob);
        }
        if (cancelled || !contentRef.current) return;

        if (docKind === 'image') {
          const url = URL.createObjectURL(blob);
          objectUrls.current.push(url);
          const img = document.createElement('img');
          img.src = url;
          img.alt = active.fileName;
          img.className = 'mx-auto block max-w-full bg-white';
          container.appendChild(img);
        } else if (docKind === 'pdf') {
          const pdfjs = await import('pdfjs-dist');
          // Worker chép sẵn vào public/ — Terser của Next không xử lý được file .mjs phát ra từ node_modules.
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          const data = new Uint8Array(await blob.arrayBuffer());
          const doc = await pdfjs.getDocument({ data }).promise;
          if (cancelled) {
            void doc.destroy();
            return;
          }
          for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
            if (cancelled) break;
            const page = await doc.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.className = 'mx-auto mb-4 block h-auto max-w-full bg-white shadow-lg';
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Không tạo được khung vẽ PDF');
            await page.render({ canvasContext: context, viewport }).promise;
            if (!cancelled) container.appendChild(canvas);
          }
          void doc.destroy();
        } else {
          const { renderAsync } = await import('docx-preview');
          await renderAsync(blob, container, undefined, {
            inWrapper: true,
            breakPages: true,
            ignoreWidth: false,
            ignoreHeight: false,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setViewError(err instanceof ApiError ? err.message : 'Không xem được tài liệu này');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeName, caseId]);

  function handlePrint() {
    if (!active || kind === 'unsupported') return;
    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) {
      setViewError('Trình duyệt đã chặn cửa sổ in. Hãy cho phép popup rồi thử lại.');
      return;
    }
    let body = '';
    if (kind === 'pdf') {
      body = Array.from(contentRef.current?.querySelectorAll('canvas') ?? [])
        .map((canvas) => `<img src="${canvas.toDataURL('image/png')}" alt="">`)
        .join('');
    } else if (kind === 'image') {
      const img = contentRef.current?.querySelector('img');
      if (img) body = `<img src="${img.src}" alt="">`;
    } else {
      body = contentRef.current?.innerHTML ?? '';
    }
    if (!body) {
      win.close();
      return;
    }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
      active.fileName,
    )}</title><style>
      @page { margin: 12mm }
      body { margin: 0; background: #fff }
      img { max-width: 100%; display: block; margin: 0 auto 12px; page-break-after: always }
      .docx-wrapper { background: #fff !important; padding: 0 !important }
      .docx-wrapper > section.docx { box-shadow: none !important; margin: 0 auto 12px !important }
    </style></head><body>${body}</body></html>`);
    win.document.close();
    win.focus();
    win.setTimeout(() => win.print(), 400);
  }

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-2 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-[94vh] w-[98vw] max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-soft"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Xem tài liệu đính kèm"
      >
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-shell px-3 py-2 sm:px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg" title={activeName}>
              {activeName || 'Tài liệu đính kèm'}
            </p>
            {active && (
              <p className="text-[11px] text-fg-subtle">
                {formatFileSize(active.size)} • {active.uploadedBy?.fullName ?? '—'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              disabled={zoom <= 0.5 || kind === 'unsupported'}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-40"
              title="Thu nhỏ"
              aria-label="Thu nhỏ"
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              disabled={kind === 'unsupported'}
              className="min-w-[48px] rounded-lg px-1 py-1 text-xs font-semibold text-fg-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-40"
              title="Đặt lại 100%"
            >
              {zoomPercent}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
              disabled={zoom >= 3 || kind === 'unsupported'}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-40"
              title="Phóng to"
              aria-label="Phóng to"
            >
              <ZoomIn size={16} />
            </button>
            <span className="mx-1 h-5 w-px bg-line" />
            <button
              type="button"
              onClick={() => active && onDownload(active)}
              disabled={!active}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-accent transition hover:bg-accent/10 disabled:opacity-40"
              title="Tải về"
            >
              <Download size={15} /> Tải về
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={kind === 'unsupported' || loading}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-fg-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-40"
              title="In"
            >
              <Printer size={15} /> In
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition hover:bg-danger/15 hover:text-danger"
              title="Đóng (Esc)"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>

          <select
            value={activeId}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-fg sm:hidden"
            aria-label="Chọn tài liệu"
          >
            {attachments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fileName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface sm:flex">
            <p className="sticky top-0 z-10 border-b border-line bg-surface px-3 py-2 text-[11px] font-bold uppercase text-fg-subtle">
              Tài liệu ({attachments.length})
            </p>
            {attachments.map((a) => {
              const Icon = iconFor(a.fileName);
              const isActive = a.id === activeId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelect(a.id)}
                  className={`flex w-full items-start gap-2 border-b border-line/60 px-3 py-2 text-left transition ${
                    isActive ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:bg-surface-2'
                  }`}
                >
                  <Icon size={16} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold" title={a.fileName}>
                      {a.fileName}
                    </span>
                    <span className="block text-[10px] text-fg-subtle">{formatFileSize(a.size)}</span>
                  </span>
                </button>
              );
            })}
            {attachments.length === 0 && (
              <p className="p-3 text-xs text-fg-subtle">Chưa có tài liệu</p>
            )}
          </aside>

          <div className="relative min-w-0 flex-1 overflow-auto bg-surface-2 p-3 sm:p-5">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-2/70">
                <span className="flex items-center gap-2 text-sm text-fg-muted">
                  <ButtonSpinner /> Đang mở tài liệu…
                </span>
              </div>
            )}

            {viewError && (
              <div className="mb-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                {viewError}
              </div>
            )}

            {kind === 'unsupported' ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <FileText size={40} className="text-fg-subtle" />
                <p className="max-w-sm text-sm text-fg-muted">
                  Chưa hỗ trợ xem trước định dạng này. Vui lòng tải tệp về để mở bằng ứng dụng
                  tương ứng.
                </p>
                {active && (
                  <button
                    type="button"
                    onClick={() => onDownload(active)}
                    className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
                  >
                    <Download size={16} /> Tải về
                  </button>
                )}
              </div>
            ) : (
              <div
                ref={contentRef}
                style={{ zoom }}
                className="mx-auto min-h-full max-w-[1000px] text-left"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
