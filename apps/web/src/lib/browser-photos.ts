const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh'));
    };
    image.src = url;
  });
}

async function encode(image: HTMLImageElement, maxDim: number, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, maxDim / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** Nén ảnh chụp/chọn trên trình duyệt trước khi upload (giới hạn API 5 MB). */
export async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const image = await loadImage(file);
    let blob = await encode(image, 1600, 0.74);
    if (blob && blob.size > MAX_UPLOAD_BYTES) blob = await encode(image, 1200, 0.6);
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

export function photoKey(file: File, index: number): string {
  return `${index}:${file.name}:${file.size}:${file.lastModified}`;
}
