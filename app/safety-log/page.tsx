'use client';

import React, { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { SafetyTodoTab } from './_components/SafetyTodoTab';

function SafetyTodoPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'log') {
      router.replace('/safety-log/daily');
      return;
    }
    if (tab === 'todo') {
      router.replace('/safety-log', { scroll: false });
    }
  }, [searchParams, router]);

  return (
    <WorkspaceShell
      serviceHref="/safety-log"
      title="TO DO LIST"
      description="기한과 메모를 활용해 안전관리 할 일을 한곳에서 확인합니다."
    >
      <SafetyTodoTab />
    </WorkspaceShell>
  );
}

export default function SafetyLogPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SafetyTodoPageContent />
    </Suspense>
  );
}
