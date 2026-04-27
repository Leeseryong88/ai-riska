'use client';

import { ServiceIcon } from '@/config/services';

interface ServiceGlyphProps {
  icon: ServiceIcon;
  className?: string;
}

const stroke = { strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export default function ServiceGlyph({ icon, className = 'h-5 w-5' }: ServiceGlyphProps) {
  switch (icon) {
    case 'camera':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path {...stroke} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );

    case 'assessment':
      /* 위험성평가: 클립보드 + 위험도 막대 */
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          <path {...stroke} d="M9 15v3M12 12v6M15 14v4" />
        </svg>
      );

    case 'currency':
      /* 관리비: 원 안의 기호 */
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <circle {...stroke} cx="12" cy="12" r="9" />
          <path {...stroke} d="M15 9.5a3 3 0 00-3-3h-1a3 3 0 100 6h1a3 3 0 010 6h-1a3 3 0 01-3-3M12 6v2M12 16v2" />
        </svg>
      );

    case 'community':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M17 20h5V10a2 2 0 00-2-2h-4M17 20H7m10 0v-6c0-1.105-.895-2-2-2H9c-1.105 0-2 .895-2 2v6m0 0H2V10a2 2 0 012-2h4m0 0V6a2 2 0 012-2h4a2 2 0 012 2v2M9 8h6" />
        </svg>
      );

    case 'document':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );

    case 'safetyLog':
      /* 일일 안전일지: 달력 + 기록 줄 */
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
          <path {...stroke} d="M8 14h8M8 18h5" />
        </svg>
      );

    case 'workPermit':
      /* 작업허가: 방패 + 승인 체크 */
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path {...stroke} d="M9 12l2 2 4-4" />
        </svg>
      );

    case 'contractor':
      /* 협력업체: 복수 사업장·건물 실루엣 */
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18" />
          <path {...stroke} d="M6 22H4a2 2 0 01-2-2v-4a2 2 0 012-2h2" />
          <path {...stroke} d="M6 22h12" />
          <path {...stroke} d="M10 22v-4a2 2 0 012-2v0a2 2 0 012 2v4" />
          <path {...stroke} d="M14 22v-4a2 2 0 012-2v0a2 2 0 012 2v4" />
        </svg>
      );

    case 'workerFeedback':
      /* 근로자 의견: 대화·청취 */
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          <path {...stroke} d="M8 10h.01M12 10h.01M16 10h.01" />
        </svg>
      );

    case 'healthPlan':
      /* 안전보건계획서: 승인·수립된 계획 문서 */
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path {...stroke} d="M14 2v6h6" />
          <path {...stroke} d="M9 13h6M9 17h4" />
          <path {...stroke} d="M9 19l2 2 4-4" />
        </svg>
      );

    case 'checklist':
      /* 점검 체크리스트: 체크 표시가 여러개 있는 문서 */
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <path {...stroke} d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          <path {...stroke} d="M8 11l1.5 1.5L13 9M8 16l1.5 1.5L13 14" />
          <path {...stroke} d="M16 12h.5M16 17h.5" />
        </svg>
      );

    case 'meeting':
      /* 회의록: 두루마리·의사록 (Lucide ScrollText와 동일 path) */
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M15 12h-5" />
          <path {...stroke} d="M15 8h-5" />
          <path {...stroke} d="M19 17V5a2 2 0 0 0-2-2H4" />
          <path
            {...stroke}
            d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"
          />
        </svg>
      );

    case 'orgChart':
      /* 조직도: 상·하위 박스 연결 */
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <rect {...stroke} x="3" y="3" width="18" height="5" rx="1" />
          <path {...stroke} d="M12 8v2M8 10h8" />
          <rect {...stroke} x="2" y="12" width="8" height="5" rx="1" />
          <rect {...stroke} x="14" y="12" width="8" height="5" rx="1" />
        </svg>
      );

    case 'hazardousMachinery':
      /* 유해위험기계기구: 타워 크레인 */
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M3 20h10" />
          <path {...stroke} d="M8 20V8" />
          <path {...stroke} d="M8 8L19.5 3.5" />
          <path {...stroke} d="M8 8L3.5 12" />
          <path {...stroke} d="M16 4.9V16" />
          <path {...stroke} d="M15 16.5h2" />
          <path {...stroke} d="M16 16.5V19" />
        </svg>
      );

    case 'storage':
      /* 저장소: 아카이브 박스 */
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M21 8v13H3V8M1 3h22v5H1z" />
          <path {...stroke} d="M10 12h4" />
        </svg>
      );

    case 'contact':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <path {...stroke} d="M22 6l-10 7L2 6" />
        </svg>
      );

    case 'hub':
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path {...stroke} d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      );
  }
}
