import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-subscription';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const body = await request.json();
    const { subscriptionActive } = body as { subscriptionActive?: boolean };

    if (typeof subscriptionActive !== 'boolean') {
      return NextResponse.json(
        { error: 'subscriptionActive(boolean)가 필요합니다.' },
        { status: 400 }
      );
    }

    const ref = getAdminFirestore().doc(`users/${params.userId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    await ref.update({
      subscriptionActive,
      subscriptionUpdatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('admin PATCH user', e);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 503 });
  }
}
