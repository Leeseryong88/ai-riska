/** 클라이언트에서 관리자 메뉴 노출 여부만 판별. 실제 권한은 API에서 ADMIN_UIDS로 검증합니다. */
export function isAdminUid(uid: string | undefined): boolean {
  if (!uid) return false;
  const raw = process.env.NEXT_PUBLIC_ADMIN_UIDS || '';
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return ids.includes(uid);
}
