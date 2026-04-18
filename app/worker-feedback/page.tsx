'use client';

import React, { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FileText, Link2 } from 'lucide-react';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/app/work-permit/_lib/utils';
import { SubmissionsTab } from './_components/SubmissionsTab';
import { LinkTab } from './_components/LinkTab';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'submissions' ? 'submissions' : 'link';

  const tabs = [
    { id: 'link', name: '접수 링크', icon: Link2 },
    { id: 'submissions', name: '의견 제출 내역', icon: FileText },
  ];

  useEffect(() => {
    if (tabParam === 'template') {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'link');
      router.replace(`/worker-feedback?${params.toString()}`);
    }
  }, [tabParam, router, searchParams]);

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.push(`/worker-feedback?${params.toString()}`);
  };

  return (
    <WorkspaceShell
      serviceHref="/worker-feedback"
      title="근로자 의견청취"
      description="근로자가 안전·보건에 관한 제보·의견을 낼 수 있도록 안내 문구를 편집하고, 접수 링크로 의견을 수집합니다."
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-1">
          <div className="flex overflow-x-auto no-scrollbar -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 whitespace-nowrap border-b-2 px-6 py-4 text-sm font-bold transition-all',
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-600'
                )}
              >
                <tab.icon className={cn('h-4 w-4', activeTab === tab.id ? 'text-blue-600' : 'text-gray-400')} />
                {tab.name}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabWorkerFeedback"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'submissions' && <SubmissionsTab />}
              {activeTab === 'link' && <LinkTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default function WorkerFeedbackPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-gray-500">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
