/**
 * BR-74 — hạn xử lý là một NGÀY; hạn thực tế là 23:59:59 giờ Việt Nam (UTC+7) của ngày đó.
 * API lưu ngày ở dạng ISO (00:00 UTC) nên chỉ lấy phần "YYYY-MM-DD" để so sánh, tránh lệch múi giờ.
 */
export function isOverdue(dueDate?: string | null, now: number = Date.now()): boolean {
  if (!dueDate) return false;
  return Date.parse(`${dueDate.slice(0, 10)}T23:59:59.999+07:00`) < now;
}

/** Ngày hạn hiển thị theo định dạng Việt Nam, không bị lệch ngày do múi giờ trình duyệt. */
export function formatDueDate(dueDate: string): string {
  const [y, m, d] = dueDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
