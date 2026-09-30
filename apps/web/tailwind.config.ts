import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -8px rgb(15 23 42 / 0.10)',
        card: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
      },
      backgroundImage: {
        'app-shell': 'radial-gradient(circle at top left, #eff6ff 0%, #f8fafc 45%, #f8fafc 100%)',
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
