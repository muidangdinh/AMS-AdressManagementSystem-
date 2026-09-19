import * as path from 'path';

/**
 * Thư mục lưu file upload TRÊN HOST (ảnh hiện trạng số nhà...).
 * UPLOAD_DIR trong .env là đường dẫn tương đối so với cwd lúc chạy API
 * (khi chạy `node dist/main.js` trong apps/api, cwd = apps/api).
 */
export function getUploadRoot(): string {
  const configured = process.env.UPLOAD_DIR ?? './uploads';
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

export function getHousePhotosDir(): string {
  return path.join(getUploadRoot(), 'houses');
}

/** Ảnh chụp hiện trường sau khi gắn biển số (Phase 8 — mobile nhóm 7.5). */
export function getPlatePhotosDir(): string {
  return path.join(getUploadRoot(), 'plates');
}
