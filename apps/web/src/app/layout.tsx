import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Tây Ninh GIS — Hệ thống Đánh số & Gắn biển số nhà',
  description: 'Next.js + NestJS + PostgreSQL/PostGIS — CSDL số nhà (Phase 2)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // data-theme do script bên dưới đặt trước khi vẽ (mặc định tối) — lệch so với HTML server
    // là cố ý, nên tắt cảnh báo hydration cho riêng thẻ này.
    <html lang="vi" className={inter.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
