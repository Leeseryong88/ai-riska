import { auth } from '@/app/lib/firebase';

/** AI 보호 API 호출 시 Bearer 토큰 부착 */
export async function apiAuthHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
