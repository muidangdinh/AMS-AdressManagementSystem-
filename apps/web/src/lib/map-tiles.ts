import L from 'leaflet';

/**
 * Lớp nền bản đồ dùng chung (Esri, không cần key). Giữ cố định ở cả theme sáng lẫn tối —
 * nền tối CartoDB đòi API key nên không dùng.
 */
export function createStreetLayer(): L.TileLayer {
  // World_Street_Map (vector) không phủ chi tiết đều khắp thế giới như ảnh vệ tinh — tỉnh/thị trấn
  // nhỏ như Tây Ninh thường hết dữ liệu thật ở zoom sâu, Esri trả về tile "Map data not yet
  // available". `maxNativeZoom` giới hạn đúng mức zoom server còn dữ liệu thật; `maxZoom` vẫn cao
  // hơn — Leaflet tự phóng to tile cuối cùng còn dữ liệu thay vì hiện tile lỗi.
  return L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, maxNativeZoom: 15, attribution: 'Tiles &copy; Esri' },
  );
}

export function createSatelliteLayer(): L.TileLayer {
  return L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, maxNativeZoom: 18, attribution: 'Tiles &copy; Esri' },
  );
}
