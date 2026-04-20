'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, Users2, MessagesSquare, LayoutList, FileText, ShieldAlert } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { cn } from './_lib/utils';
import { MeetingStorageTab } from './_components/MeetingStorageTab';
import { TemplatesTab } from './_components/TemplatesTab';
import { CycleBoard } from './_components/CycleBoard';
import type { MeetingMinute, MeetingType } from './_lib/types';

type TabId = MeetingType | 'templates' | 'cycle';
type FetchError = null | 'permission' | 'network' | 'unknown';

const TABS: { id: TabId; name: string; icon: any; description: string }[] = [
  { id: 'oshc', name: '산업안전보건위원회', icon: Users2, description: '분기당 1회' },
  { id: 'partner_council', name: '협력업체 협의체회의', icon: MessagesSquare, description: '월 1회' },
  { id: 'other', name: '기타 회의', icon: CalendarClock, description: '주기 없음' },
  { id: 'templates', name: '양식', icon: FileText, description: '회의록 양식 모음' },
  { id: 'cycle', name: '회의록 주기표', icon: LayoutList, description: '한눈에 보기' },
];

function MeetingMinutesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const activeTab = (searchParams.get('tab') as TabId) || 'oshc';
  const [meetings, setMeetings] = useState<MeetingMinute[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<FetchError>(null);

  const fetchMeetings = useCallback(async () => {
    if (!user || !db) return;
    setLoading(true);
    setFetchError(null);
    try {
      // orderBy 를 제거하고 where 단일 쿼리로 수행 → 복합 색인 불필요
      const q = query(collection(db, 'meeting_minutes'), where('managerId', '==', user.uid));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MeetingMinute[];
      // 클라이언트에서 date 내림차순 정렬
      list.sort((a, b) => (a.date < b.date ? 1 : -1));
      setMeetings(list);
    } catch (e: any) {
      const code: string | undefined = e?.code;
      // 노이즈를 줄이기 위해 에러 코드만 warn 출력
      console.warn('[meeting_minutes] fetch failed:', code || e?.message || e);

      if (code === 'permission-denied' || code === 'permission_denied') {
        setFetchError('permission');
      } else if (code === 'unavailable' || code === 'failed-precondition') {
        setFetchError('network');
      } else {
        setFetchError('unknown');
      }
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    fetchMeetings();
  }, [authLoading, fetchMeetings]);

  const handleTabChange = (tabId: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.push(`/meeting-minutes?${params.toString()}`);
  };

  return (
    <WorkspaceShell
      serviceHref="/meeting-minutes"
      title="회의록 관리"
      description="산업안전보건위원회, 협력업체 협의체회의 등 법정 회의록을 주기별로 기록·관리합니다."
    >
      <div className="space-y-6">
        {/* Error Banner */}
        {fetchError && <ErrorBanner kind={fetchError} onRetry={fetchMeetings} />}

        {/* Tab Navigation */}
        <div className="border-b border-slate-100">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'relative flex shrink-0 items-center gap-2 whitespace-nowrap px-5 py-3.5 text-sm font-bold transition-all',
                    isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'
                  )}
                >
                  <tab.icon className={cn('h-4 w-4', isActive ? 'text-blue-600' : 'text-slate-400')} />
                  <span>{tab.name}</span>
                  <span
                    className={cn(
                      'hidden rounded-full px-1.5 py-0.5 text-[10px] font-black sm:inline-block',
                      isActive ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                    )}
                  >
                    {tab.description}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="meetingActiveTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'templates' ? (
              <TemplatesTab onSaved={fetchMeetings} />
            ) : activeTab === 'cycle' ? (
              <CycleBoard meetings={meetings} onChanged={fetchMeetings} />
            ) : (
              <MeetingStorageTab
                type={activeTab as MeetingType}
                meetings={meetings}
                loading={loading}
                onChanged={fetchMeetings}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </WorkspaceShell>
  );
}

const ErrorBanner: React.FC<{ kind: Exclude<FetchError, null>; onRetry: () => void }> = ({ kind, onRetry }) => {
  if (kind === 'permission') {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:flex-row sm:items-start">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-amber-900">
            회의록 보안 규칙이 아직 배포되지 않았습니다.
          </p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-amber-800">
            새로 추가된 <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">meeting_minutes</code> 컬렉션을 사용하려면,
            Firebase 콘솔 또는 아래 명령으로 <b>firestore.rules</b> 와 <b>storage.rules</b> 를 배포해야 합니다.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-amber-900/90 px-3 py-2 text-[11px] font-mono text-amber-50">
firebase deploy --only firestore:rules,storage
          </pre>
          <p className="mt-2 text-[11px] font-medium text-amber-700">
            규칙 배포 전까지는 양식 · 인쇄 기능은 사용 가능하지만, 회의록 파일 저장/불러오기는 비활성화됩니다.
          </p>
        </div>
        <button
          onClick={onRetry}
          className="shrink-0 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-black text-amber-800 transition hover:bg-amber-100"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (kind === 'network') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black text-slate-800">네트워크 또는 서버 상태를 확인해주세요.</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            일시적인 연결 문제로 회의록을 불러오지 못했습니다.
          </p>
        </div>
        <button
          onClick={onRetry}
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
        <ShieldAlert className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-black text-red-800">회의록을 불러오는 중 오류가 발생했습니다.</p>
        <p className="mt-1 text-xs font-medium text-red-700">
          잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의하세요.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="shrink-0 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-50"
      >
        다시 시도
      </button>
    </div>
  );
};

export default function MeetingMinutesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <MeetingMinutesContent />
    </Suspense>
  );
}
