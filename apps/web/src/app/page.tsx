import { redirect } from 'next/navigation';

/**
 * Trang chủ "/" không hiển thị gì — vào thẳng hệ thống ngay khi load dự án.
 * `houses/layout.tsx` tự bounce sang `/login` nếu chưa đăng nhập, nên redirect
 * thẳng ở đây là đủ, không cần kiểm tra auth lại lần nữa.
 */
export default function HomePage() {
  redirect('/houses/dashboard');
}
