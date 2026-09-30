/**
 * BR-74 — `dueDate` là một NGÀY (DTO nhận "YYYY-MM-DD", lưu ở 00:00 UTC). Hạn thực tế là
 * 23:59:59.999 giờ Việt Nam (UTC+7) của ngày đó, tức 16:59:59.999 UTC cùng ngày.
 */
export function effectiveDeadline(dueDate: Date): Date {
  return new Date(
    Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate(), 16, 59, 59, 999),
  );
}

/** Ngày hiện tại theo giờ Việt Nam, dạng "YYYY-MM-DD" — dùng làm khoá chống nhắc trùng theo ngày. */
export function todayVn(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function dueDateKey(dueDate: Date): string {
  return dueDate.toISOString().slice(0, 10);
}
