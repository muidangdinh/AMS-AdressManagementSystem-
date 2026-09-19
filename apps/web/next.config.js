/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Xuất standalone để đóng gói Docker gọn nhẹ (profile "full")
  output: 'standalone',
  // @tayninh/shared là package TS nguồn (chưa build) trong monorepo —
  // cần Next transpile trực tiếp thay vì mong đợi JS đã biên dịch sẵn.
  transpilePackages: ['@tayninh/shared'],
};

module.exports = nextConfig;
