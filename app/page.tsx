'use client';

import React from 'react';
import { useAuth } from '@/app/context/AuthContext';
import ServiceHub from '@/components/navigation/ServiceHub';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import LandingPage from './_components/LandingPage';

export default function HomePage() {
  const { user, loading } = useAuth();

  // 인증 정보를 확인하는 동안 로딩 표시
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-bold">인증 정보 확인 중...</p>
        </div>
      </div>
    );
  }

  // 로그인하지 않은 경우 랜딩 페이지 표시
  if (!user) {
    return <LandingPage />;
  }

  // 로그인한 경우 대시보드(ServiceHub) 표시
  return (
    <WorkspaceShell>
      <ServiceHub />
    </WorkspaceShell>
  );
}
