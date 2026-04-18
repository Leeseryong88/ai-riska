'use client';

import Link from 'next/link';
import { ReactNode, Suspense, useState } from 'react';
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

interface WorkspaceShellProps {
  serviceHref?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
}

function ShellServiceLinks({
  filterIds,
  serviceHref,
}: {
  filterIds: string[];
  serviceHref?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return (
    <>
      {services
        .filter((service) => filterIds.includes(service.id))
        .map((service) => {
          const isActive =
            isServiceActive(service, pathname, search) ||
            (!!serviceHref && service.href === serviceHref);
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
}: WorkspaceShellProps) {
  const currentService = getServiceByHref(serviceHref);
  const currentCategory = currentService ? serviceCategories[currentService.category] : undefined;
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900">
      <div className="flex h-screen overflow-hidden">
        {/* Fixed Left Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="flex h-full flex-col p-4">
            <Link href="/" className="mb-8 flex items-center gap-3 px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">AI Safety</p>
            </Link>

            <nav className="flex-1 space-y-1">
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
                      'work-permit',
                      'safety-manager-todo',
                      'safety-log',
                      'contractor-partners',
                      'worker-feedback',
                    ]}
                    serviceHref={serviceHref}
                  />
                }
              >
                <ShellServiceLinks
                  filterIds={[
                    'work-permit',
                    'safety-manager-todo',
                    'safety-log',
                    'contractor-partners',
                    'worker-feedback',
                  ]}
                  serviceHref={serviceHref}
                />
              </Suspense>

              <div className="mt-8 mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 bg-blue-50/50 py-1 rounded-md w-fit">
                AI Services
              </div>
              <Suspense
                fallback={
                  <ShellServiceLinksFallback
                    filterIds={['camera', 'assessment', 'health-safety-plan', 'safety-management-fee']}
                    serviceHref={serviceHref}
                  />
                }
              >
                <ShellServiceLinks
                  filterIds={['camera', 'assessment', 'health-safety-plan', 'safety-management-fee']}
                  serviceHref={serviceHref}
                />
              </Suspense>

              <div className="mt-8 mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 bg-amber-50/50 py-1 rounded-md w-fit">
                Archives
              </div>
              <Suspense
                fallback={
                  <ShellServiceLinksFallback filterIds={['storage']} serviceHref={serviceHref} />
                }
              >
                <ShellServiceLinks filterIds={['storage']} serviceHref={serviceHref} />
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
            <div className="mx-auto max-w-6xl">
              {(title || description) && (
                <header className="mb-8">
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
          </main>
        </div>
      </div>

      <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />
    </div>
  );
}
