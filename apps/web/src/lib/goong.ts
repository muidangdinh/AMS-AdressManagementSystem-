import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Nền bản đồ Goong (vector, vẽ bằng MapLibre GL) — dùng khi `NEXT_PUBLIC_MAP_PROVIDER=goong`.
 * Cần **Maptiles Key** (không phải "API Key" dùng cho REST API — dùng nhầm sẽ bị 403), tạo ở
 * account.goong.io/keys; nên giới hạn key theo domain vì key nằm lộ trong JS phía trình duyệt.
 * Goong tính phí theo lượt tải bản đồ (map load), KHÔNG theo số marker vẽ lên.
 * Tài liệu: https://help.goong.io/kb/website-javascrip-api/maplibre/tich-hop-goong-map-sdk-vao-trang-web/
 */
export const GOONG_MAPTILES_KEY = process.env.NEXT_PUBLIC_GOONG_MAPTILES_KEY ?? '';

export type GoongLayer = 'street' | 'satellite';

const STYLE_FILES: Record<GoongLayer, string> = {
  street: 'goong_map_web.json',
  satellite: 'goong_satellite.json',
};

export function goongStyleUrl(layer: GoongLayer): string {
  return `https://tiles.goong.io/assets/${STYLE_FILES[layer]}?api_key=${encodeURIComponent(GOONG_MAPTILES_KEY)}`;
}

/**
 * Font chữ để vẽ nhãn (số nhà, A/B…) — lấy từ chính style Goong đang nạp vì server glyph chỉ
 * phục vụ đúng các font style đó khai báo (hiện có Roboto Regular/Medium, OpenSans Bold). Ưu tiên
 * font đậm cho dễ đọc trên chấm tròn nhỏ. Style không có lớp chữ nào → null (bỏ lớp nhãn).
 */
export function findStyleTextFont(map: MapLibreMap): string[] | null {
  const fonts: string[][] = [];
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const font = layer.layout?.['text-font'];
    if (Array.isArray(font) && font.every((f) => typeof f === 'string')) fonts.push(font as string[]);
  }
  const weight = (font: string[]) => (/bold/i.test(font[0]) ? 2 : /medium/i.test(font[0]) ? 1 : 0);
  return fonts.sort((a, b) => weight(b) - weight(a))[0] ?? null;
}

/**
 * Lớp icon địa điểm của style Goong (nhà hàng, cửa hàng, công viên, ga, sân bay, núi, cây…) — đều
 * có id `poi-*`. Tên đường/tên làng xã là lớp khác nên vẫn giữ khi ẩn.
 */
const POI_LAYER_ID = /^poi[-_]/;

/** Ẩn/hiện các lớp icon địa điểm của nền Goong — gọi lại sau mỗi `style.load` (setStyle nạp lại lớp gốc). */
export function setPoiLayersVisible(map: MapLibreMap, visible: boolean) {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (POI_LAYER_ID.test(layer.id)) map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
  }
}

/** Bỏ 1 lớp/nguồn nếu đang có — dùng trước khi thêm lại sau `setStyle` hoặc khi dọn dẹp. */
export function removeLayers(map: MapLibreMap, layerIds: string[], sourceIds: string[]) {
  for (const id of layerIds) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of sourceIds) if (map.getSource(id)) map.removeSource(id);
}
