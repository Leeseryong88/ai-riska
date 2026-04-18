'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ClipboardList, FileText, QrCode } from 'lucide-react';
import { PurposesTab } from './_components/tabs/PurposesTab';
import { LogsTab } from './_components/tabs/LogsTab';
import { QRCodesTab } from './_components/tabs/QRCodesTab';
import { cn } from './_lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') || 'purposes';

  const tabs = [
    { id: 'purposes', name: '허가서 양식 관리', icon: ClipboardList },
    { id: 'logs', name: '허가서 제출 내역', icon: FileText },
    { id: 'qrcodes', name: '접근 QR', icon: QrCode },
  ];

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.push(`/work-permit?${params.toString()}`);
  };

  return (
    <WorkspaceShell
      serviceHref="/work-permit"
      title="안전작업 허가서 관리"
      description="작업허가서 양식을 관리하고 제출된 내역을 확인합니다."
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
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
                )}
              >
                <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-blue-600" : "text-gray-400")} />
                {tab.name}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
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
              {activeTab === 'purposes' && <PurposesTab />}
              {activeTab === 'logs' && <LogsTab />}
              {activeTab === 'qrcodes' && <QRCodesTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default function WorkPermitAdminPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
