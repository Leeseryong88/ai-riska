import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

export type SubscriptionGuardResult =
  | { ok: true; uid: string }
  | { ok: false; response: NextResponse };

/** Authorization: Bearer Firebase ID 토큰 검증 후 users/{uid}의 subscriptionActive 확인. */
export async function requireActiveSubscription(
  request: NextRequest
): Promise<SubscriptionGuardResult> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }),
    };
  }
  const idToken = authHeader.slice(7);
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const snap = await getAdminFirestore().doc(`users/${uid}`).get();
    if (!snap.exists) {
      return {
        ok: false,
        response: NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 403 }),
      };
    }
    const data = snap.data();
    if (data?.subscriptionActive !== true) {
      return {
        ok: false,
        response: NextResponse.json({ error: '구독이 필요합니다.' }, { status: 403 }),
      };
    }
    return { ok: true, uid };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: '서버에 Firebase 서비스 계정이 설정되지 않았습니다.' },
          { status: 503 }
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json({ error: '유효하지 않은 인증입니다.' }, { status: 401 }),
    };
  }
}

export function parseAdminUids(): string[] {
  const raw = process.env.ADMIN_UIDS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export async function requireAdmin(request: NextRequest): Promise<
  | { ok: true; uid: string }
  | { ok: false; response: NextResponse }
> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }),
    };
  }
  const idToken = authHeader.slice(7);
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const admins = parseAdminUids();
    if (!admins.includes(decoded.uid)) {
      return {
        ok: false,
        response: NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 }),
      };
    }
    return { ok: true, uid: decoded.uid };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('FIREBASE_SERVICE_ACCOUNT_JSON')) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: '서버에 Firebase 서비스 계정이 설정되지 않았습니다.' },
          { status: 503 }
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json({ error: '유효하지 않은 인증입니다.' }, { status: 401 }),
    };
  }
}
