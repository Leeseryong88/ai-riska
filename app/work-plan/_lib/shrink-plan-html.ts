import { compressDataUrlToDataUrl } from './compress-image';

/**
 * Firestore 문서(필드)당 약 1,048,487바이트 제한 — planHtml에 data URL이 많으면 초과합니다.
 * UTF-8 바이트 기준으로 목표 이하가 될 때까지 이미지 Data URL을 재압축합니다.
 */
const DATA_URL_IN_HTML =
  /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s\r\n]+/g;

export function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function collapseDataUrlWhitespace(html: string): string {
  return html.replace(
    /(data:image\/[a-zA-Z0-9+.-]+;base64,)([A-Za-z0-9+/=\s\r\n]+)/g,
    (_, head: string, b64: string) => head + b64.replace(/\s/g, '')
  );
}

const PASSES: { edge: number; q: number }[] = [
  { edge: 1200, q: 0.7 },
  { edge: 900, q: 0.62 },
  { edge: 640, q: 0.52 },
  { edge: 480, q: 0.45 },
  { edge: 400, q: 0.38 },
];

const TINY_GIF =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

async function recompressDataUrlsInHtml(
  html: string,
  maxEdge: number,
  quality: number
): Promise<string> {
  const normalized = collapseDataUrlWhitespace(html);
  const seen = new Set<string>();
  const matches = normalized.match(new RegExp(DATA_URL_IN_HTML.source, 'gi')) || [];
  for (const m of matches) {
    const u = m.replace(/\s/g, '');
    if (u.startsWith('data:image/')) {
      seen.add(u);
    }
  }

  const map = new Map<string, string>();
  for (const u of seen) {
    map.set(u, await compressDataUrlToDataUrl(u, maxEdge, quality));
  }

  let out = normalized;
  for (const [from, to] of map) {
    if (from !== to) {
      out = out.split(from).join(to);
    }
  }
  return out;
}

/**
 * @param maxBytes planHtml만의 목표(UTF-8). 나머지 필드·메타를 위해 950KB 이하 권장.
 */
export async function shrinkHtmlDataUrlsForFirestore(
  html: string,
  maxBytes = 950_000
): Promise<string> {
  let out = collapseDataUrlWhitespace(html);
  if (utf8ByteLength(out) <= maxBytes) {
    return out;
  }

  for (const { edge, q } of PASSES) {
    if (utf8ByteLength(out) <= maxBytes) {
      return out;
    }
    out = await recompressDataUrlsInHtml(out, edge, q);
  }

  if (utf8ByteLength(out) <= maxBytes) {
    return out;
  }

  // Data URL이 남아 있으면 1×1 투명 GIF로 치환(저장은 되도록, 썸네일은 누락)
  out = out.replace(
    new RegExp(DATA_URL_IN_HTML.source, 'gi'),
    TINY_GIF
  );
  if (utf8ByteLength(out) <= maxBytes) {
    return out;
  }

  throw new Error(
    '문서가 Firestore 한도(약 1MB)를 넘습니다. 본문을 줄이거나, 이미지·첨부를 나누어 저장하세요.'
  );
}
