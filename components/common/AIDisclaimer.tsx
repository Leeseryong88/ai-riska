'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export type AIDisclaimerAccent = 'blue' | 'rose' | 'indigo' | 'emerald' | 'amber' | 'sky' | 'violet';

interface AIDisclaimerProps {
  onAgree: () => void;
  onDecline?: () => void;
  accentColor?: AIDisclaimerAccent;
  serviceName?: string;
  agreeLabel?: string;
  declineLabel?: string;
  /**
   * When true (default), renders its own outer card container (max-width, padding, white card).
   * Set to false when embedding inside an existing white-card wrapper.
   */
  standalone?: boolean;
}

const ACCENT_MAP: Record<AIDisclaimerAccent, { bg: string; hover: string; shadow: string }> = {
  blue: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', shadow: 'shadow-blue-200' },
  rose: { bg: 'bg-rose-600', hover: 'hover:bg-rose-700', shadow: 'shadow-rose-200' },
  indigo: { bg: 'bg-indigo-600', hover: 'hover:bg-indigo-700', shadow: 'shadow-indigo-200' },
  emerald: { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', shadow: 'shadow-emerald-200' },
  amber: { bg: 'bg-amber-600', hover: 'hover:bg-amber-700', shadow: 'shadow-amber-200' },
  sky: { bg: 'bg-sky-600', hover: 'hover:bg-sky-700', shadow: 'shadow-sky-200' },
  violet: { bg: 'bg-violet-600', hover: 'hover:bg-violet-700', shadow: 'shadow-violet-200' },
};

export default function AIDisclaimer({
  onAgree,
  onDecline,
  accentColor = 'blue',
  serviceName,
  agreeLabel = '위 내용을 확인했으며, 이에 동의합니다',
  declineLabel = '동의하지 않음 (메인으로 이동)',
  standalone = true,
}: AIDisclaimerProps) {
  const router = useRouter();
  const accent = ACCENT_MAP[accentColor];

  const handleDecline = () => {
    if (onDecline) onDecline();
    else router.push('/');
  };

  const inner = (
    <div className="text-left">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800">서비스 이용 전 유의사항</h2>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 mb-8 text-amber-900 leading-relaxed text-sm md:text-base">
        <p className="mb-4 font-bold text-lg">⚠️ 필독: 인공지능(AI) 생성물 이용 관련 안내</p>
        <p className="mb-3">
          본 서비스는 인공지능(AI) 기술을 활용하여{' '}
          <strong>
            {serviceName ? `${serviceName} 작성을 보조하는 참고 자료` : '결과물 작성을 보조하는 참고 자료'}
          </strong>
          를 생성하는 도구입니다.
        </p>
        <p className="mb-3">
          AI가 생성한 결과물은 사용자가 입력한 데이터를 바탕으로 한 일반적인 가이드라인이며,{' '}
          <strong>실제 현장 조건이나 법적 요구사항을 완벽하게 반영하지 못할 수 있습니다.</strong>
        </p>
        <p className="mb-3">
          따라서, 본 서비스로 생성된 결과물을 실제 업무에 활용하거나 외부 기관에 제출함에 있어 발생하는{' '}
          <strong>모든 책임은 사용자 본인에게 있음</strong>을 알려드립니다.
        </p>
        <p className="font-semibold text-amber-700">
          반드시 전문가의 검토를 거쳐 실제 상황에 맞게 수정 및 보완하여 사용하시기 바랍니다.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={onAgree}
          className={`w-full py-4 ${accent.bg} text-white font-bold rounded-xl ${accent.hover} shadow-lg ${accent.shadow} transition-all text-lg`}
        >
          {agreeLabel}
        </button>
        <button
          onClick={handleDecline}
          className="w-full py-4 bg-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-200 transition-all"
        >
          {declineLabel}
        </button>
      </div>
    </div>
  );

  if (!standalone) return inner;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">{inner}</div>
    </div>
  );
}
