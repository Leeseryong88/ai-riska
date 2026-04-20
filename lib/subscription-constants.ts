/** 사이드바 "AI Services" 블록 중 구독 없으면 UI 잠금 (저장소 /storage 는 제외) */
export const AI_SERVICE_PATH_PREFIXES = [
  '/camera',
  '/assessment',
  '/health-safety-plan',
  '/safety-management-fee',
  '/safety-checklist',
] as const;

export const SUBSCRIPTION_PLAN_AMOUNT_WON = 28900;

export function isAiServicePath(pathname: string): boolean {
  return AI_SERVICE_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
