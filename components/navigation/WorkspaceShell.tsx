'use client';

import Link from 'next/link';
import { isAiServicePath } from '@/lib/subscription-constants';
import { ReactNode, Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  getRelatedServices,
  getServiceByHref,
  isServiceActive,
  serviceCategories,
  services,
} from '@/config/services';
import ServiceGlyph from '@/components/navigation/ServiceGlyph';
import TopBar from '@/app/components/TopBar';
import ContactModal from '@/app/components/ContactModal';
import { useAuth } from '@/app/context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

interface WorkspaceShellProps {
  serviceHref?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
  /** 메인 영역 제목·본문 가운데 정렬 (예: 구독 페이지) */
  centerContent?: boolean;
}

function ShellServiceLinks({
  filterIds,
  serviceHref,
  counts = {},
}: {
  filterIds: string[];
  serviceHref?: string;
  counts?: Record<string, number>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return (
    <>
      {services
        .filter((service) => filterIds.includes(service.id))
        .sort((a, b) => filterIds.indexOf(a.id) - filterIds.indexOf(b.id))
        .map((service) => {
          const isActive =
            isServiceActive(service, pathname, search) ||
            (!!serviceHref && service.href === serviceHref);
          const count = counts[service.id];
          return (
            <Link
              key={service.id}
              href={service.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <ServiceGlyph icon={service.icon} className="h-4 w-4" />
              <span className="flex-1 truncate">{service.shortTitle}</span>
              {count > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-sm shadow-red-200">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          );
        })}
    </>
  );
}

function ShellServiceLinksFallback({
  filterIds,
  serviceHref,
}: {
  filterIds: string[];
  serviceHref?: string;
}) {
  return (
    <>
      {services
        .filter((service) => filterIds.includes(service.id))
        .sort((a, b) => filterIds.indexOf(a.id) - filterIds.indexOf(b.id))
        .map((service) => {
          const isActive = !!serviceHref && service.href === serviceHref;
          return (
            <Link
              key={service.id}
              href={service.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <ServiceGlyph icon={service.icon} className="h-4 w-4" />
              <span className="flex-1 truncate">{service.shortTitle}</span>
            </Link>
          );
        })}
    </>
  );
}

export default function WorkspaceShell({
  serviceHref,
  title,
  description,
  children,
  contentClassName = '',
  centerContent = false,
}: WorkspaceShellProps) {
  const { user, userProfile } = useAuth();
  const pathname = usePathname();
  const aiServicesLocked =
    !!user &&
    isAiServicePath(pathname) &&
    userProfile?.subscriptionActive !== true;
  const currentService = getServiceByHref(serviceHref);
  const currentCategory = currentService ? serviceCategories[currentService.category] : undefined;
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);
  const [unsignedPermitCount, setUnsignedPermitCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Fetch unread feedback count
    const feedbackQuery = query(
      collection(db, 'worker_feedback_submissions'),
      where('managerId', '==', user.uid)
    );

    const unsubscribeFeedback = onSnapshot(feedbackQuery, (snapshot) => {
      const unreadCount = snapshot.docs.filter(doc => !doc.data().acknowledged).length;
      setUnreadFeedbackCount(unreadCount);
    });

    // Fetch unsigned work permit count
    const permitQuery = query(
      collection(db, 'logs'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribePermits = onSnapshot(permitQuery, (snapshot) => {
      // Filter unsigned permits client-side because adminSignature field might be missing
      const unsignedCount = snapshot.docs.filter(doc => !doc.data().adminSignature).length;
      setUnsignedPermitCount(unsignedCount);
    });

    return () => {
      unsubscribeFeedback();
      unsubscribePermits();
    };
  }, [user]);

  const sidebarCounts = {
    'worker-feedback': unreadFeedbackCount,
    'work-permit': unsignedPermitCount,
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900">
      <div className="flex h-screen overflow-hidden">
        {/* Fixed Left Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="flex h-full min-h-0 flex-col p-4">
            <Link
              href="/"
              className="mb-5 flex min-w-0 items-center gap-2.5 px-2 sm:gap-3"
            >
              <img
                src="/icon.png"
                alt="모두의 안전"
                width={128}
                height={128}
                className="h-[2.8rem] w-[2.8rem] shrink-0 object-contain sm:h-14 sm:w-14"
                decoding="async"
              />
              <span className="min-w-0 text-[1.3125rem] font-black leading-tight tracking-tight text-blue-700 sm:text-[1.575rem]">
                모두의 안전
              </span>
            </Link>

            <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-1">
              <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-50/50 py-1 rounded-md w-fit">
                Main Menu
              </p>
              <Link
                href="/"
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
                  !serviceHref
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <ServiceGlyph icon="hub" className="h-4 w-4" />
                <span>대시보드</span>
              </Link>

              <div className="mt-8 mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 bg-indigo-50/50 py-1 rounded-md w-fit">
                Safety Docs
              </div>
              <Suspense
                fallback={
                  <ShellServiceLinksFallback
                    filterIds={[
                      'safety-manager-todo',
                      'safety-log',
                      'meeting-minutes',
                      'contractor-partners',
                      'work-permit',
                      'worker-feedback',
                    ]}
                    serviceHref={serviceHref}
                  />
                }
              >
                <ShellServiceLinks
                  filterIds={[
                    'safety-manager-todo',
                    'safety-log',
                    'meeting-minutes',
                    'contractor-partners',
                    'work-permit',
                    'worker-feedback',
                  ]}
                  serviceHref={serviceHref}
                  counts={sidebarCounts}
                />
              </Suspense>

              <div className="mt-8 mb-2 flex items-center justify-between">
                <div className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 bg-blue-50/50 py-1 rounded-md w-fit">
                  AI Services
                </div>
                <Link
                  href="/storage"
                  className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${
                    pathname === '/storage'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                  }`}
                  title="저장소"
                >
                  <ServiceGlyph icon="storage" className="h-4 w-4" />
                </Link>
              </div>
              <Suspense
                fallback={
                  <ShellServiceLinksFallback
                    filterIds={['camera', 'assessment', 'health-safety-plan', 'safety-management-fee', 'safety-checklist']}
                    serviceHref={serviceHref}
                  />
                }
              >
                <ShellServiceLinks
                  filterIds={['camera', 'assessment', 'health-safety-plan', 'safety-management-fee', 'safety-checklist']}
                  serviceHref={serviceHref}
                />
              </Suspense>
            </nav>

            <div className="mt-auto pt-4 border-t border-slate-50">
              <button
                onClick={() => setIsContactModalOpen(true)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm font-bold text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900"
              >
                <ServiceGlyph icon="contact" className="h-4 w-4" />
                <span>문의하기</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden bg-white">
          <Suspense fallback={<div className="sticky top-0 z-40 h-16 border-b border-slate-100 bg-white/80 backdrop-blur-xl lg:h-20" />}>
            <TopBar onOpenContact={() => setIsContactModalOpen(true)} />
          </Suspense>
          
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="relative mx-auto min-h-[12rem] max-w-6xl">
              <div
                className={aiServicesLocked ? 'pointer-events-none select-none' : ''}
                aria-hidden={aiServicesLocked ? true : undefined}
              >
                {(title || description) && (
                  <header className={`mb-8 ${centerContent ? 'mx-auto max-w-lg text-center' : ''}`}>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                      {title || currentService?.title}
                    </h1>
                    {description || currentService?.description ? (
                      <p className="mt-2 text-sm font-medium text-slate-500 sm:text-base">
                        {description || currentService?.description}
                      </p>
                    ) : null}
                  </header>
                )}

                <div className={contentClassName}>{children}</div>
              </div>

              {aiServicesLocked && (
                <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-white/75 p-6 backdrop-blur-[2px]">
                  <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl shadow-slate-200/80">
                    <p className="text-base font-black text-slate-900">구독이 필요합니다</p>
                    <p className="mt-2 text-sm text-slate-600">
                      AI Services는 구독 회원만 이용할 수 있습니다. 구독 후 모든 기능을 사용해 보세요.
                    </p>
                    <Link
                      href="/subscription"
                      className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700"
                    >
                      구독하러 가기
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />
    </div>
  );
}
