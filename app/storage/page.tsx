'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Camera, ShieldAlert, FileText, ClipboardList, Calculator, ListChecks } from 'lucide-react';
import { PhotoAnalysisTab } from './_components/tabs/PhotoAnalysisTab';
import { RiskAssessmentTab } from './_components/tabs/RiskAssessmentTab';
import { HealthSafetyPlanTab } from './_components/tabs/HealthSafetyPlanTab';
import { ManagementFeePlanTab } from './_components/tabs/ManagementFeePlanTab';
import { SafetyChecklistTab } from '@/app/storage/_components/tabs/SafetyChecklistTab';
import { cn } from '@/app/work-permit/_lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';

function StorageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') || 'photo';

  const tabs = [
    { id: 'photo', name: '사진분석', icon: Camera },
    { id: 'assessment', name: '위험성평가', icon: ShieldAlert },
    { id: 'hsp', name: '안전보건계획서', icon: FileText },
    { id: 'workplan', name: '작업계획서', icon: ClipboardList },
    { id: 'mfp', name: '관리비 계획서', icon: Calculator },
    { id: 'checklist', name: '점검 체크리스트', icon: ListChecks },
  ];

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.push(`/storage?${params.toString()}`);
  };

  return (
    <WorkspaceShell
      serviceHref="/storage"
      title="AI 서비스 결과 저장소"
      description="AI 서비스로 생성된 모든 결과물을 확인하고 관리합니다."
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-1">
          <div className="flex overflow-x-auto no-scrollbar -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap relative",
                  activeTab === tab.id
                    ? "border-amber-600 text-amber-600"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
                )}
              >
                <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-amber-600" : "text-gray-400")} />
                {tab.name}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'photo' && <PhotoAnalysisTab />}
              {activeTab === 'assessment' && <RiskAssessmentTab />}
              {activeTab === 'hsp' && <HealthSafetyPlanTab />}
              {activeTab === 'workplan' && (
                <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                  <p className="text-lg font-bold text-slate-500">구현예정</p>
                </div>
              )}
              {activeTab === 'mfp' && <ManagementFeePlanTab />}
              {activeTab === 'checklist' && <SafetyChecklistTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default function StoragePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <StorageContent />
    </Suspense>
  );
}
