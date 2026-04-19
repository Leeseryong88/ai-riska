'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { useAuth } from '@/app/context/AuthContext';
import { db, auth } from '@/app/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { SUBSCRIPTION_PLAN_AMOUNT_WON } from '@/lib/subscription-constants';

type Step = 'idle' | 'checkout' | 'processing' | 'error';

export default function SubscriptionPage() {
  const { user, userProfile } = useAuth();
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const active = userProfile?.subscriptionActive === true;

  const runSubscribeFlow = async () => {
    if (!user) return;
    setError('');
    setStep('processing');
    try {
      await new Promise((r) => setTimeout(r, 900));
      await updateDoc(doc(db, 'users', user.uid), {
        subscriptionActive: true,
        subscriptionPlanAmount: SUBSCRIPTION_PLAN_AMOUNT_WON,
        subscriptionUpdatedAt: new Date().toISOString(),
      });
      setStep('idle');
    } catch (e: unknown) {
      console.error(e);
      setError('구독 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      setStep('error');
    }
  };

  const handleCancel = async () => {
    if (!user) return;
    if (!window.confirm('구독을 취소하시겠습니까? AI Services 이용이 제한됩니다.')) return;
    setCancelLoading(true);
    setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        subscriptionActive: false,
        subscriptionUpdatedAt: new Date().toISOString(),
      });
    } catch (e: unknown) {
      console.error(e);
      setError('취소 처리 중 오류가 발생했습니다.');
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <WorkspaceShell
      title="구독 및 결제"
      description="월 정액 구독으로 AI Services 전체를 이용할 수 있습니다. (PG 연동 전 모의 결제)"
      contentClassName="max-w-xl"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-100">모두의 안전 · 월 구독</p>
          <p className="mt-2 text-3xl font-black sm:text-4xl">
            {SUBSCRIPTION_PLAN_AMOUNT_WON.toLocaleString('ko-KR')}
            <span className="text-lg font-bold text-blue-100">원</span>
            <span className="text-base font-semibold text-blue-100"> / 월</span>
          </p>
          <p className="mt-2 text-sm text-blue-100">
            사진 분석, 위험성 평가, 안전보건계획서, 관리비 계획서, AI 결과 저장소 포함
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-600">
          <p className="font-bold text-slate-800">진행 순서 (모의)</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>요금 및 혜택 확인</li>
            <li>결제 정보 입력 단계 (PG 연동 예정 — 현재는 생략)</li>
            <li>결제 승인 시뮬레이션 후 구독 활성화</li>
          </ol>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            대시보드로
          </Link>
          {active ? (
            <button
              type="button"
              disabled={cancelLoading || step === 'processing'}
              onClick={handleCancel}
              className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              {cancelLoading ? '처리 중…' : '구독 취소하기'}
            </button>
          ) : (
            <button
              type="button"
              disabled={step === 'processing' || !auth.currentUser}
              onClick={() => {
                setError('');
                setStep('checkout');
              }}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50"
            >
              구독하기
            </button>
          )}
        </div>

        {active && (
          <p className="mt-4 text-center text-sm font-semibold text-emerald-600">
            현재 구독 중입니다. AI Services를 이용할 수 있습니다.
          </p>
        )}
      </div>

      {/* 결제 전 확인 모달 */}
      {step === 'checkout' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 className="text-lg font-black text-slate-900">구독 확인</h2>
            <p className="mt-2 text-sm text-slate-600">
              월 <strong>{SUBSCRIPTION_PLAN_AMOUNT_WON.toLocaleString('ko-KR')}원</strong>이 청구되는 구독입니다.
              실제 결제(PG)는 추후 연동 예정이며, 지금은 확인 후 바로 구독이 활성화됩니다.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setStep('idle')}
              >
                닫기
              </button>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                onClick={runSubscribeFlow}
              >
                결제 진행 (모의)
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-sm font-bold text-slate-700">결제 및 구독 처리 중…</p>
        </div>
      )}

      {step === 'error' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-sm font-bold text-slate-900">처리 실패</p>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white"
              onClick={() => {
                setStep('idle');
                setError('');
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
