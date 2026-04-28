import { NextRequest, NextResponse } from 'next/server';
import { FieldPath, type Query } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/server-subscription';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type CursorPayload = { e: string; i: string };

function encodeCursor(email: string, uid: string): string {
  const payload: CursorPayload = { e: email, i: uid };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string | null | undefined): CursorPayload | null {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const p = JSON.parse(json) as CursorPayload;
    if (typeof p?.e === 'string' && typeof p?.i === 'string') return p;
    return null;
  } catch {
    return null;
  }
}

function serializeSubUpdated(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (
    typeof v === 'object' &&
    v !== null &&
    'toDate' in v &&
    typeof (v as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return String(v);
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const { searchParams } = request.nextUrl;
    const rawSize = Number.parseInt(searchParams.get('pageSize') ?? '', 10);
    const pageSize = Number.isFinite(rawSize)
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize))
      : DEFAULT_PAGE_SIZE;

    const emailSearch = searchParams.get('email')?.trim() ?? '';
    const cursorRaw = searchParams.get('cursor')?.trim();

    let col: Query = getAdminFirestore().collection('users');

    if (emailSearch.length > 0) {
      col = col.where('email', '>=', emailSearch).where('email', '<=', emailSearch + '\uf8ff');
    }

    let q = col.orderBy('email').orderBy(FieldPath.documentId()).limit(pageSize + 1);

    const decoded = cursorRaw ? decodeCursor(cursorRaw) : null;
    if (cursorRaw) {
      if (!decoded) {
        return NextResponse.json({ error: '잘못된 cursor 값입니다.' }, { status: 400 });
      }
      q = q.startAfter(decoded.e, decoded.i);
    }

    const snap = await q.get();
    const hasMore = snap.docs.length > pageSize;
    const slice = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

    const users = slice.map((d) => {
      const raw = d.data();
      return {
        uid: d.id,
        email: raw.email ?? '',
        name: raw.name ?? '',
        organization: raw.organization ?? '',
        subscriptionActive: raw.subscriptionActive === true,
        subscriptionPlanAmount: raw.subscriptionPlanAmount,
        subscriptionUpdatedAt: serializeSubUpdated(raw.subscriptionUpdatedAt),
      };
    });

    let nextCursor: string | null = null;
    if (hasMore && slice.length > 0) {
      const last = slice[slice.length - 1];
      const lastEmail = last.data().email ?? '';
      nextCursor = encodeCursor(lastEmail, last.id);
    }

    return NextResponse.json({
      users,
      pagination: {
        pageSize,
        hasMore,
        nextCursor,
        emailFilter: emailSearch,
      },
    });
  } catch (e) {
    console.error('admin users GET', e);
    return NextResponse.json(
      { error: '서버 설정을 확인하세요. FIREBASE_SERVICE_ACCOUNT_JSON이 필요합니다.' },
      { status: 503 }
    );
  }
}
