'use client';

import { useAuth } from '@/app/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // 인증 없이 접근 가능한 경로 확인
  const isPublicPath = (path: string) => {
    return path === '/' || path === '/login' || path.startsWith('/work-permit/v/');
  };

  useEffect(() => {
    if (!loading) {
      if (pathname === '/login') {
        // 로그인 페이지에서는 유저와 프로필이 모두 있을 때만 대시보드로 이동
        if (user && userProfile) {
          router.push('/');
        }
      } else if (!isPublicPath(pathname)) {
        // 그 외 비공개 페이지에서는 유저가 없거나 프로필이 없으면 로그인 페이지로 이동
        if (!user || !userProfile) {
          router.push('/login');
        }
      }
    }
  }, [user, userProfile, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 인증이 필요 없는 페이지거나 로그인이 된 경우 자식 컴포넌트 렌더링
  if (isPublicPath(pathname) || (user && userProfile)) {
    return <>{children}</>;
  }

  // 인증이 필요한 페이지인데 로그인이 안 된 경우 아무것도 렌더링하지 않음 (useEffect에서 리다이렉트 처리)
  return null;
}
