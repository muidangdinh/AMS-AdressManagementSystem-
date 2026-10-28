/** Bỏ tiền tố đơn vị hành chính để so "Xã Tân Thạnh" với "Tân Thạnh". */
function normalizeLocation(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^(xã|phường|thị trấn)\s+/, '');
}

/**
 * Dòng phụ dưới lời chào Tổng quan: chức vụ — đơn vị · xã đang làm việc.
 * Nếu đơn vị trùng xã đang làm việc thì chỉ hiện một lần.
 */
export function buildDashboardSubtitle({
  position,
  unit,
  wardName,
  provinceName,
}: {
  position?: string | null;
  unit?: string | null;
  wardName?: string | null;
  provinceName?: string | null;
}) {
  const unitText = (unit ?? '').trim();
  const showUnit =
    !!unitText && (!wardName || normalizeLocation(unitText) !== normalizeLocation(wardName));
  const roleLine = [(position ?? '').trim(), showUnit ? unitText : ''].filter(Boolean).join(' — ');
  const wardLine = wardName
    ? [`Xã ${wardName}`, provinceName].filter(Boolean).join(', ')
    : (provinceName ?? '');
  return [roleLine, wardLine].filter(Boolean).join(' · ');
}
