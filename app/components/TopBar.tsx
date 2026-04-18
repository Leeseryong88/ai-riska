'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getServiceByHref, primaryServices, services } from '@/config/services';
import ServiceGlyph from '@/components/navigation/ServiceGlyph';
import { useAuth } from '@/app/context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '@/app/lib/firebase';

function isActivePath(pathname: string, href: string) {
  return pathname === href;
}

interface TopBarProps {
  onOpenContact?: () => void;
}

export default function TopBar({ onOpenContact }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const currentService = getServiceByHref(pathname);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Close mobile menu when pathname changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevent scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      <header className={`sticky top-0 border-b border-slate-100 bg-white/80 backdrop-blur-xl lg:bg-transparent lg:border-none transition-all duration-300 z-40`}>
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 lg:hidden active:scale-95 transition-transform"
              aria-label="Toggle Menu"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Mobile Logo Only */}
            <Link href="/" className="flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-200">
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">AI Safety</span>
            </Link>

            {/* Desktop Breadcrumb/Title Area */}
            <div className="hidden items-center gap-4 lg:flex">
              <div className="h-6 w-[1px] bg-slate-200" />
              <p className="text-sm font-bold text-slate-400">
                {currentService ? currentService.title : '대시보드'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/board"
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition-all active:scale-95 ${
                pathname === '/board'
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
              <span className="hidden sm:inline">게시판</span>
            </Link>
            
            {user && (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-blue-200 transition-all"
                >
                  <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    {userProfile?.name?.[0] || user.email?.[0]?.toUpperCase()}
                  </div>
                  <span className="hidden sm:inline">{userProfile?.name || '사용자'}님</span>
                </button>
                
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-xl border border-slate-100 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-50">
                      <p className="text-xs text-slate-400 font-medium">소속: {userProfile?.organization || '미지정'}</p>
                      <p className="text-xs text-slate-400 font-medium truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer Menu */}
      <div className={`fixed inset-y-0 left-0 z-[110] w-[280px] bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex h-full flex-col bg-white overflow-hidden">
          {/* Menu Header */}
          <div className="flex items-center justify-between border-b border-slate-50 px-6 py-5 shrink-0">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md">
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-sm font-black uppercase tracking-wider text-blue-600">AI Safety</span>
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400 active:bg-slate-100"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Menu Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 bg-white">
            <div className="space-y-8">
              <section>
                <p className="mb-4 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-50 py-1 rounded-md w-fit">
                  Main Menu
                </p>
                <Link
                  href="/"
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-bold transition-all ${
                    pathname === '/'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                      : 'text-slate-600 active:bg-slate-50'
                  }`}
                >
                  <ServiceGlyph icon="hub" className={`h-5 w-5 ${pathname === '/' ? 'text-white' : 'text-slate-400'}`} />
                  <span>대시보드</span>
                </Link>
              </section>

              <section>
                <p className="mb-4 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 bg-indigo-50 py-1 rounded-md w-fit">
                  Safety Docs
                </p>
                <div className="space-y-1">
                  {services
                    .filter((service) => ['work-permit', 'safety-log'].includes(service.id))
                    .map((service) => {
                      const isActive = service.href === pathname;
                      return (
                        <Link
                          key={service.id}
                          href={service.href}
                          className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-bold transition-all ${
                            isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-600 active:bg-slate-50'
                          }`}
                        >
                          <ServiceGlyph icon={service.icon} className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span className="flex-1 truncate">{service.shortTitle}</span>
                        </Link>
                      );
                    })}
                </div>
              </section>

              <section>
                <p className="mb-4 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 bg-blue-50 py-1 rounded-md w-fit">
                  AI Services
                </p>
                <div className="space-y-1">
                  {services
                    .filter((service) => ['camera', 'assessment', 'health-safety-plan', 'safety-management-fee'].includes(service.id))
                    .map((service) => {
                      const isActive = service.href === pathname;
                      return (
                        <Link
                          key={service.id}
                          href={service.href}
                          className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-bold transition-all ${
                            isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-600 active:bg-slate-50'
                          }`}
                        >
                          <ServiceGlyph icon={service.icon} className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span className="flex-1 truncate">{service.shortTitle}</span>
                        </Link>
                      );
                    })}
                </div>
              </section>

              <section>
                <p className="mb-4 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 bg-amber-50 py-1 rounded-md w-fit">
                  Archives
                </p>
                <div className="space-y-1">
                  {services
                    .filter((service) => ['storage'].includes(service.id))
                    .map((service) => {
                      const isActive = service.href === pathname;
                      return (
                        <Link
                          key={service.id}
                          href={service.href}
                          className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-base font-bold transition-all ${
                            isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-600 active:bg-slate-50'
                          }`}
                        >
                          <ServiceGlyph icon={service.icon} className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span className="flex-1 truncate">{service.shortTitle}</span>
                        </Link>
                      );
                    })}
                </div>
              </section>
            </div>
          </div>

          {/* Menu Footer */}
          <div className="border-t border-slate-50 p-6 bg-slate-50/50 shrink-0">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenContact?.();
              }}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 py-4 text-sm font-black text-white shadow-xl active:scale-95 transition-transform"
            >
              <svg className="h-5 w-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              문의하기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
