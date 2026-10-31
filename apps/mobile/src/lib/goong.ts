import type { StyleSpecification } from '@maplibre/maplibre-react-native';

/** Maptiles Key (không phải API Key) — dùng chung với `apps/web/.env`. */
export const GOONG_MAPTILES_KEY = 'w6RIRXmvXryNfCQ3pIgZZd5O5u6h5lc99zgkwTN0';

/** Font có sẵn trong style Goong, dùng cho nhãn số nhà. */
export const GOONG_TEXT_FONT = ['Roboto Regular'];

const STYLE_FILE = 'goong_map_web.json';

export function goongStyleUrl(): string {
  return `https://tiles.goong.io/assets/${STYLE_FILE}?api_key=${encodeURIComponent(GOONG_MAPTILES_KEY)}`;
}

/** Lớp icon địa điểm của nền Goong (nhà hàng, cửa hàng, cây xăng...) — id dạng `poi-*`. */
const POI_LAYER_ID = /^poi[-_]/;

let baseStyle: Promise<StyleSpecification> | null = null;

function fetchBaseStyle(): Promise<StyleSpecification> {
  if (!baseStyle) {
    baseStyle = fetch(goongStyleUrl())
      .then((res) => {
        if (!res.ok) throw new Error(`Goong style ${res.status}`);
        return res.json() as Promise<StyleSpecification>;
      })
      .catch((err) => {
        baseStyle = null;
        throw err;
      });
  }
  return baseStyle;
}

/**
 * Tải style Goong dạng JSON để ẩn lớp POI theo cấu hình `map.hidePoi` (MapLibre RN không
 * sửa được layer của style URL). Lỗi mạng → trả URL gốc, POI vẫn hiện, bản đồ vẫn chạy.
 */
export async function loadGoongStyle(hidePoi: boolean): Promise<string | StyleSpecification> {
  try {
    const style = await fetchBaseStyle();
    if (!hidePoi) return style;
    return { ...style, layers: style.layers.filter((layer) => !POI_LAYER_ID.test(layer.id)) };
  } catch {
    return goongStyleUrl();
  }
}
