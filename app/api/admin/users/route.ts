import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-subscription';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const snap = await getAdminFirestore().collection('users').get();
    const users = snap.docs.map((d) => ({
      uid: d.id,
      email: d.data().email ?? '',
      name: d.data().name ?? '',
      organization: d.data().organization ?? '',
      subscriptionActive: d.data().subscriptionActive === true,
      subscriptionPlanAmount: d.data().subscriptionPlanAmount,
      subscriptionUpdatedAt: d.data().subscriptionUpdatedAt ?? null,
    }));

    return NextResponse.json({ users });
  } catch (e) {
    console.error('admin users GET', e);
    return NextResponse.json(
      { error: '서버 설정을 확인하세요. FIREBASE_SERVICE_ACCOUNT_JSON이 필요합니다.' },
      { status: 503 }
    );
  }
}
