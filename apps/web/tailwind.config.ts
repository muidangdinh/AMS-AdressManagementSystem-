import type { Config } from 'tailwindcss';

/** Màu theo token CSS (kênh RGB) — đổi theme sáng/tối chỉ cần đổi biến ở globals.css. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  // Theme do thuộc tính data-theme trên <html> quyết định (xem app/layout.tsx + lib/theme.tsx).
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: token('canvas'),
        shell: token('shell'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        line: token('line'),
        fg: token('fg'),
        'fg-muted': token('fg-muted'),
        'fg-subtle': token('fg-subtle'),
        brand: token('brand'),
        accent: token('accent'),
        ok: token('ok'),
        warn: token('warn'),
        danger: token('danger'),
        info: token('info'),
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -8px rgb(15 23 42 / 0.10)',
        card: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
        'glow-accent': '0 0 0 1px rgb(var(--accent) / 0.35), 0 0 16px -2px rgb(var(--accent) / 0.55)',
        'glow-ok': '0 0 10px -1px rgb(var(--ok) / 0.7)',
        'glow-warn': '0 0 10px -1px rgb(var(--warn) / 0.7)',
        'glow-danger': '0 0 10px -1px rgb(var(--danger) / 0.7)',
        'glow-info': '0 0 10px -1px rgb(var(--info) / 0.7)',
      },
      backgroundImage: {
        'app-shell':
          'radial-gradient(circle at top left, rgb(var(--accent) / 0.08) 0%, rgb(var(--canvas)) 40%, rgb(var(--canvas)) 100%)',
        'brand-gradient': 'linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--accent)) 100%)',
      },
      keyframes: {
        // Từng mục của menu điều hướng trượt nhẹ từ trái vào, lệch thời gian nhau (xem NavItem ở
        // houses/layout.tsx). Phần chiều cao/nền của menu dùng transition CSS, không cần keyframe.
        'item-in': {
          from: { opacity: '0', transform: 'translateX(-14px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'item-in': 'item-in 300ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
      },
    },
  },
  plugins: [],
};

export default config;
