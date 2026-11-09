import type { StyleSpecification } from '@maplibre/maplibre-react-native';

/** Maptiles Key (không phải API Key) — dùng chung với `apps/web/.env`. */
export const GOONG_MAPTILES_KEY = 'w6RIRXmvXryNfCQ3pIgZZd5O5u6h5lc99zgkwTN0';

/** Font có sẵn trong style Goong, dùng cho nhãn số nhà. */
export const GOONG_TEXT_FONT = ['Roboto Regular'];

export type GoongLayer = 'street' | 'satellite';

const STYLE_FILES: Record<GoongLayer, string> = {
  street: 'goong_map_web.json',
  satellite: 'goong_satellite.json',
};

export function goongStyleUrl(layer: GoongLayer = 'street'): string {
  return `https://tiles.goong.io/assets/${STYLE_FILES[layer]}?api_key=${encodeURIComponent(GOONG_MAPTILES_KEY)}`;
}

/** Lớp icon địa điểm của nền Goong (nhà hàng, cửa hàng, cây xăng...) — id dạng `poi-*`. */
const POI_LAYER_ID = /^poi[-_]/;

const baseStyles = new Map<GoongLayer, Promise<StyleSpecification>>();

function fetchBaseStyle(layer: GoongLayer): Promise<StyleSpecification> {
  let promise = baseStyles.get(layer);
  if (!promise) {
    promise = fetch(goongStyleUrl(layer))
      .then((res) => {
        if (!res.ok) throw new Error(`Goong style ${res.status}`);
        return res.json() as Promise<StyleSpecification>;
      })
      .catch((err) => {
        baseStyles.delete(layer);
        throw err;
      });
    baseStyles.set(layer, promise);
  }
  return promise;
}

/**
 * Tải style Goong dạng JSON để ẩn lớp POI theo cấu hình `map.hidePoi` (MapLibre RN không
 * sửa được layer của style URL). Lỗi mạng → trả URL gốc, POI vẫn hiện, bản đồ vẫn chạy.
 */
export async function loadGoongStyle(
  hidePoi: boolean,
  layer: GoongLayer = 'street',
): Promise<string | StyleSpecification> {
  try {
    const style = await fetchBaseStyle(layer);
    if (!hidePoi) return style;
    return { ...style, layers: style.layers.filter((item) => !POI_LAYER_ID.test(item.id)) };
  } catch {
    return goongStyleUrl(layer);
  }
}
