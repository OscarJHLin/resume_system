/** Max decoded photo size accepted by the API (matches Rust/Node). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Soft target before we try canvas compress/resize. */
const COMPRESS_IF_OVER = 1_500_000;
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.88;

export type PreparedPhoto = {
  dataBase64: string;
  mime: string;
  previewUrl: string;
};

/**
 * Read a user-selected image for profile photo: optional downscale/JPEG
 * compress so typical phone ID shots stay under the API body limit.
 */
export async function prepareProfilePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error('请选择 JPG / PNG / WebP 图片');
  }

  const mime =
    file.type ||
    (/\.png$/i.test(file.name)
      ? 'image/png'
      : /\.webp$/i.test(file.name)
        ? 'image/webp'
        : 'image/jpeg');

  if (file.size <= COMPRESS_IF_OVER) {
    const dataUrl = await readFileAsDataUrl(file);
    assertDecodedUnderLimit(dataUrl);
    return { dataBase64: dataUrl, mime, previewUrl: dataUrl };
  }

  try {
    const compressed = await compressImageFile(file);
    assertDecodedUnderLimit(compressed.dataUrl);
    return {
      dataBase64: compressed.dataUrl,
      mime: compressed.mime,
      previewUrl: compressed.dataUrl,
    };
  } catch {
    // Fall back to original if canvas compress fails (e.g. exotic codec).
    if (file.size > MAX_PHOTO_BYTES) {
      throw new Error('上传内容过大（照片请小于 5MB）');
    }
    const dataUrl = await readFileAsDataUrl(file);
    return { dataBase64: dataUrl, mime, previewUrl: dataUrl };
  }
}

function assertDecodedUnderLimit(dataUrl: string): void {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  // base64 length * 3/4 ≈ decoded bytes
  const approx = Math.floor((b64.length * 3) / 4);
  if (approx > MAX_PHOTO_BYTES) {
    throw new Error('上传内容过大（照片请小于 5MB）');
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('读取照片失败'));
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(
  file: File,
): Promise<{ dataUrl: string; mime: string }> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const mime = 'image/jpeg';
    const dataUrl = canvas.toDataURL(mime, JPEG_QUALITY);
    return { dataUrl, mime };
  } finally {
    bitmap.close();
  }
}
