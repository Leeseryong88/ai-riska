'use client';

import React from 'react';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';

export default function HazardousMachineryPage() {
  return (
    <WorkspaceShell
      serviceHref="/hazardous-machinery"
      title="유해위험기계기구"
      description="유해·위험기계기구 관리 기능을 제공할 예정입니다."
    >
      <div className="flex min-h-[min(60vh,28rem)] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
        <p className="text-lg font-bold text-slate-500">구현예정</p>
      </div>
    </WorkspaceShell>
  );
}
