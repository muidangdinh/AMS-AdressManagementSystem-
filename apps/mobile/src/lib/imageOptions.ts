import type { CameraOptions } from 'react-native-image-picker';

/**
 * Tuỳ chọn chụp/chọn ảnh hồ sơ — thư viện tự thu nhỏ + nén JPEG ngay khi chụp/chọn, nên file lưu
 * vào bản nháp và upload lên server đã là bản nhỏ. Ảnh gốc camera (3–8MB/tấm) vừa chậm/tốn 4G ở
 * hiện trường, vừa vượt giới hạn 5MB/file của API (apps/api/src/houses/multer.config.ts).
 * Cạnh dài tối đa 1600px, JPEG 0.7 → thường ~200–500KB/tấm, vẫn đọc rõ số nhà/biển số.
 */
export const PHOTO_PICKER_OPTIONS: CameraOptions = {
  mediaType: 'photo',
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.7,
};
