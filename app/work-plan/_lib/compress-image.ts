/**
 * 작업계획 API 요청 전에 첨부 이미지를 리사이즈·JPEG 압축해 본문 크기(413)를 줄입니다.
 * 브라우저에서만 호출하세요.
 */

const MAX_EDGE_PX = 1920;
const JPEG_QUALITY = 0.82;

const RASTER_MIME = /^image\/(png|jpe?g|webp|gif|bmp|pjpeg|x-ms-bmp)$/i;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 래스터 이미지는 최대 변 길이 MAX_EDGE_PX로 줄이고 JPEG로 재인코딩합니다.
 * SVG, HEIC 등은 디코딩 실패 시 원본 Data URL로 폴백합니다.
 */
export async function compressImageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return readFileAsDataUrl(file);
  }

  if (!RASTER_MIME.test(file.type) || file.type === 'image/svg+xml') {
    return readFileAsDataUrl(file);
  }

  try {
    const bitmap = await createImageBitmap(file);
    const max = Math.max(bitmap.width, bitmap.height);
    let w = bitmap.width;
    let h = bitmap.height;
    if (max > MAX_EDGE_PX) {
      const scale = MAX_EDGE_PX / max;
      w = Math.round(bitmap.width * scale);
      h = Math.round(bitmap.height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return readFileAsDataUrl(file);
    }

    if (file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch {
    return readFileAsDataUrl(file);
  }
}

const DATA_URL_IMAGE =
  /^data:image\/(png|jpe?g|webp|gif|bmp|pjpeg|x-ms-bmp);base64,([A-Za-z0-9+/=\r\n]+)$/i;

/**
 * planHtml·API 본문에 이미 넣은 Data URL을 다시 캔버스로 줄여 Firestore(약 1MB) 한도에 맞춥니다.
 */
export async function compressDataUrlToDataUrl(
  dataUrl: string,
  maxEdgePx: number,
  quality: number
): Promise<string> {
  const cleaned = dataUrl.replace(/\s/g, '');
  const m = DATA_URL_IMAGE.exec(cleaned);
  if (!m) {
    return dataUrl;
  }
  try {
    const res = await fetch(cleaned);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) {
      return dataUrl;
    }
    const bitmap = await createImageBitmap(blob);
    const max = Math.max(bitmap.width, bitmap.height);
    let w = bitmap.width;
    let h = bitmap.height;
    if (max > maxEdgePx) {
      const scale = maxEdgePx / max;
      w = Math.round(bitmap.width * scale);
      h = Math.round(bitmap.height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return dataUrl;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return dataUrl;
  }
}
