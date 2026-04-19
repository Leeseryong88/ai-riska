'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Menu, Users, X, ShieldCheck, ClipboardCheck, FileCheck, HardHat, Loader2 } from 'lucide-react';
import Link from 'next/link';
import ServiceGlyph from '@/components/navigation/ServiceGlyph';
import { services, type ServiceDefinition } from '@/config/services';

const serviceGroups = [
  {
    id: 'safety-docs',
    anchor: 'safety-docs',
    eyebrow: 'Safety Docs',
    title: '현장 서류·기록',
    tagline: '일지·허가·협력업체 등 현장 서류를 우리 사업장 기준으로 정리합니다.',
    serviceIds: [
      'safety-manager-todo',
      'safety-log',
      'work-permit',
      'contractor-partners',
      'worker-feedback',
    ],
    surfaceClass: 'from-indigo-50 via-white to-slate-50',
    borderClass: 'border-indigo-100',
    badgeClass: 'bg-indigo-100 text-indigo-700',
  },
  {
    id: 'ai-services',
    anchor: 'ai-services',
    eyebrow: 'AI Services',
    title: 'AI 분석·문서 초안',
    tagline: '인터넷 샘플이 아니라, 입력한 내용을 바탕으로 위험성평가·계획서 초안을 만듭니다.',
    serviceIds: ['camera', 'assessment', 'health-safety-plan', 'safety-management-fee', 'storage'],
    surfaceClass: 'from-blue-50 via-white to-cyan-50',
    borderClass: 'border-blue-100',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
];

const serviceLookup = new Map<string, ServiceDefinition>(services.map((service) => [service.id, service]));

const groupedServices = serviceGroups.map((group) => ({
  ...group,
  items: group.serviceIds
    .map((id) => serviceLookup.get(id))
    .filter((service): service is ServiceDefinition => Boolean(service)),
}));

const samples = [
  {
    id: 'assessment',
    title: '위험성평가',
    icon: <ShieldCheck className="h-6 w-6" />,
    heading: 'AI가 분석하는\n우리 현장 위험 요소',
    description: '현장의 사진과 작업 내용을 입력하면 AI가 위험요인과 대책을 분석하여 표준 양식의 위험성평가표 초안을 만들어줍니다. 복잡한 서류 작성 대신 핵심 위험 관리에 집중할 수 있습니다.',
    image: '/sample-assessment.png',
  },
  {
    id: 'plan',
    title: '안전보건계획서',
    icon: <FileCheck className="h-6 w-6" />,
    heading: '법적 기준을 준수하는\n완성도 높은 계획서',
    description: '공사 개요와 주요 공종 정보를 입력하여, 현장에 꼭 필요한 안전보건계획서를 빠르게 구성하고 문서화할 수 있습니다. 법적 기준을 준수하면서도 실무에 바로 적용 가능한 수준으로 작성됩니다.',
    image: '/sample-plan.png',
  },
  {
    id: 'permit',
    title: '작업허가서',
    icon: <ClipboardCheck className="h-6 w-6" />,
    heading: '현장에서 실시간으로\n확인하고 승인하세요',
    description: '고소작업, 화기작업 등 위험 작업 전 체크리스트를 확인하고 모바일로 간편하게 승인 및 보관이 가능합니다. 현장에서 실시간으로 확인하고 기록할 수 있어 누락 없는 안전 관리가 가능해집니다.',
    image: '/sample-permit.png',
  },
  {
    id: 'log',
    title: '안전일지',
    icon: <HardHat className="h-6 w-6" />,
    heading: '매일의 안전 기록을\n데이터로 관리하세요',
    description: '매일 수행하는 점검 항목과 현장 특이사항을 기록하고, 협력업체와 공유하여 이력을 체계적으로 관리합니다. 사진과 텍스트를 통해 현장 상황을 생생하게 기록하고 보관할 수 있습니다.',
    image: '/sample-log.png',
  },
];

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(samples[0].id);
  const [isSampleLoading, setIsSampleLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isModalImageLoading, setIsModalImageLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceDefinition | null>(null);

  const activeSample = samples.find((s) => s.id === activeTab) || samples[0];

  const handleTabChange = (id: string) => {
    if (id !== activeTab) {
      setIsSampleLoading(true);
      setActiveTab(id);
    }
  };

  const handleOpenModal = (image: string) => {
    setIsModalImageLoading(true);
    setSelectedImage(image);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <nav className="fixed top-0 z-50 w-full border-b border-slate-100 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-4 py-2 sm:min-h-24 sm:px-6 sm:py-3 lg:px-8">
          <Link href="/" className="flex items-center gap-3 sm:gap-4">
            <img
              src="/icon.png"
              alt="모두의 안전"
              width={128}
              height={128}
              className="h-16 w-16 shrink-0 object-contain sm:h-20 sm:w-20"
              decoding="async"
            />
            <span className="text-3xl font-black leading-tight tracking-tight text-blue-700 sm:text-4xl">
              모두의 안전
            </span>
          </Link>

          <div className="hidden items-center gap-6 text-sm font-bold text-slate-600 md:flex">
            <a href="#services-grid" className="transition-colors hover:text-blue-600">
              주요 서비스 안내
            </a>
            <a href="#samples" className="transition-colors hover:text-blue-600">
              서류 예시
            </a>
            <Link
              href="/login"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-white shadow-md shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95"
            >
              시작하기
            </Link>
          </div>

          <button
            className="p-2 text-slate-600 md:hidden"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label="메뉴 열기"
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden border-b border-slate-100 bg-white px-4 py-4 shadow-lg md:hidden"
            >
              <a href="#services-grid" onClick={() => setIsMenuOpen(false)} className="block py-2 font-bold text-slate-800">
                주요 서비스 안내
              </a>
              <a href="#samples" onClick={() => setIsMenuOpen(false)} className="block py-2 font-bold text-slate-800">
                서류 예시
              </a>
              <Link href="/login" className="block rounded-xl bg-blue-600 py-3 text-center font-bold text-white">
                로그인 / 시작하기
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero — 제목 → 배지 → 이미지 → 부가 본문 */}
      <section className="bg-white pb-12 pt-28 sm:pb-16 sm:pt-36 lg:pt-40">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8 sm:mb-12"
          >
            <h1 className="text-3xl font-black leading-snug tracking-tight sm:text-4xl lg:text-5xl">
              <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                클릭 한번으로 안전관리 서류를 직접 만드세요
              </span>
            </h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/50 shadow-sm ring-1 ring-slate-100"
          >
            <img
              src="/landing-hero.png"
              alt="모두의 안전 — 안전 서류를 직접 만드는 서비스 소개"
              className="mx-auto block h-auto w-full max-w-full object-contain"
              decoding="async"
              fetchPriority="high"
            />
            {/* CTA: 히어로 이미지 하단 중앙 오버레이 */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-slate-900/35 via-slate-900/10 to-transparent px-3 pb-4 pt-10 sm:px-4 sm:pb-5 sm:pt-14">
              <div className="pointer-events-auto flex w-full max-w-xl flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
                <Link
                  href="/login"
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-blue-900/30 transition hover:bg-blue-700 sm:px-8 sm:py-4 sm:text-base"
                >
                  무료로 시작하기
                  <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 sm:h-5 sm:w-5" />
                </Link>
                  <a
                    href="#services-grid"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/90 bg-white/95 px-6 py-3.5 text-sm font-black text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-white sm:px-8 sm:py-4 sm:text-base"
                  >
                    어떤 서류가 되나요
                  </a>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="mx-auto mt-6 max-w-6xl px-4 text-center sm:mt-8 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
          >
            <div className="mx-auto mt-0 flex w-full justify-center overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <p className="whitespace-nowrap px-2 text-base font-medium text-slate-600 sm:text-lg">
                외주 컨설팅 대신, AI와 실무 도구로 우리 정보에 맞는 계획서·평가·일지·허가 초안을 만듭니다.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 기능 서비스 통합 섹션 */}
      <section id="services-grid" className="scroll-mt-20 border-t border-slate-100 bg-slate-50/50 py-16 sm:py-24 sm:scroll-mt-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black text-slate-900 sm:text-4xl">주요 서비스 안내</h2>
            <p className="mt-8 text-lg font-medium text-slate-500 sm:text-xl">
              중대재해처벌법이 요구하는 안전보건관리체계 구축의 모든 과정을<br className="hidden sm:block" />
              법령 기반 템플릿으로 제공하여 안전시스템을 구축하고 운영할 수 있습니다.
            </p>
          </div>
          
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              {groupedServices.map((group) => (
                <div key={group.id} className="flex flex-col">
                  <div className="mb-6 flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black sm:text-xs ${group.badgeClass}`}>
                      {group.eyebrow}
                    </span>
                    <h3 className="text-xl font-black text-slate-900">{group.title}</h3>
                  </div>
                  
                  <div className="grid gap-2">
                    {group.items.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => setSelectedService(service)}
                        className="group flex items-center gap-4 rounded-xl border border-transparent bg-slate-50/50 p-3 text-left transition-all hover:border-blue-100 hover:bg-blue-50/30"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm transition-colors group-hover:text-blue-600">
                          <ServiceGlyph icon={service.icon} className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700 sm:text-base">
                            {service.title}
                          </p>
                          <p className="text-[11px] font-medium text-slate-500 line-clamp-1">
                            {service.highlights.join(' · ')}
                          </p>
                        </div>
                        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-400" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 샘플 미리보기 섹션 (이미지 참고 레이아웃) */}
      <section id="samples" className="scroll-mt-16 border-t border-slate-100 bg-white pb-20 pt-12 sm:pb-32 sm:pt-16 sm:scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-black text-slate-900 sm:text-4xl">서류 예시</h2>
            <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
            <p className="mt-8 text-lg font-medium text-slate-500 sm:text-xl">
              실제 현장에서 생성되는 고품질 안전 서류들을 확인해 보세요.<br className="hidden sm:block" />
              전문가 수준의 결과물을 누구나 클릭 몇 번으로 완성할 수 있습니다.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl shadow-slate-200/60">
            {/* 내부 상단 탭 */}
            <div className="flex justify-center border-b border-slate-100 bg-slate-50/50 px-4 sm:justify-start sm:px-10">
              {samples.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handleTabChange(sample.id)}
                  className={`relative px-4 py-5 text-sm font-bold transition-all sm:px-8 sm:text-base ${
                    activeTab === sample.id
                      ? 'text-blue-600'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {sample.title}
                  {activeTab === sample.id && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 h-1 w-full bg-blue-600"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* 메인 콘텐츠 영역 (좌우 구분) */}
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* 왼쪽: 샘플 프리뷰 */}
              <div className="lg:col-span-7 flex items-center justify-center bg-slate-50/50 p-6 sm:p-12">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4 }}
                    className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                  >
                    {/* 실제 샘플 이미지 표시 */}
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="h-full w-full cursor-zoom-in relative"
                      onClick={() => handleOpenModal(activeSample.image)}
                    >
                      {isSampleLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-600/60" />
                        </div>
                      )}
                      <img
                        src={activeSample.image}
                        alt={`${activeSample.title} 샘플 프리뷰`}
                        className={`h-full w-full object-contain object-top transition-opacity duration-300 ${isSampleLoading ? 'opacity-0' : 'opacity-1'}`}
                        onLoad={() => setIsSampleLoading(false)}
                      />
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* 오른쪽: 설명부 */}
              <div className="lg:col-span-5 flex flex-col justify-center p-8 sm:p-16">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      {activeSample.icon}
                    </div>
                    <h3 className="mb-6 whitespace-pre-line text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
                      {activeSample.heading}
                    </h3>
                    <p className="text-lg leading-relaxed text-slate-500">
                      {activeSample.description}
                    </p>
                    <div className="mt-12">
                      <Link
                        href="/login"
                        className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
                      >
                        시작하기
                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="pb-20 sm:pb-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-blue-600 px-6 py-12 text-center shadow-2xl shadow-blue-200/60 sm:py-20">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
            
            <Users className="relative mx-auto h-12 w-12 text-white/90" />
            <h2 className="relative mt-6 text-2xl font-black leading-tight text-white sm:text-4xl">
              컨설팅 견적 전에 우리 회사 서류부터 직접 만들어 보세요
            </h2>
            <p className="relative mx-auto mt-4 max-w-2xl text-base font-medium text-blue-100 sm:text-lg">
              가입 즉시 위험성평가·안전보건계획서 등 핵심 서류 작성 기능을 시작할 수 있습니다.
            </p>
            <div className="relative mt-10">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-12 py-4 text-lg font-black text-blue-600 shadow-xl transition-all hover:bg-blue-50 active:scale-95"
              >
                지금 시작하기
                <ArrowRight className="h-6 w-6" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:text-left sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-slate-500">© 2026 모두의 안전</p>
          <p className="text-xs font-medium text-slate-400">샘플 검색 대신 맞춤 초안 · AI와 실무 설계</p>
        </div>
      </footer>

      {/* 이미지 확대 모달 */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-sm sm:p-10"
            onClick={() => setSelectedImage(null)}
          >
            <motion.button
              className="absolute right-4 top-4 z-[110] rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:right-10 sm:top-10"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-8 w-8" />
            </motion.button>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-h-full max-w-full overflow-hidden rounded-xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {isModalImageLoading && (
                <div className="absolute inset-0 z-[120] flex items-center justify-center bg-white/50 backdrop-blur-sm">
                  <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                </div>
              )}
              <img
                src={selectedImage}
                alt="샘플 확대 보기"
                className={`max-h-[90vh] w-auto object-contain transition-opacity duration-300 ${isModalImageLoading ? 'opacity-0' : 'opacity-1'}`}
                onLoad={() => setIsModalImageLoading(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 서비스 설명 모달 */}
      <AnimatePresence>
        {selectedService && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
            onClick={() => setSelectedService(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-8 shadow-2xl shadow-slate-900/20 sm:p-10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute right-6 top-6 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                onClick={() => setSelectedService(null)}
              >
                <X className="h-6 w-6" />
              </button>

              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <ServiceGlyph icon={selectedService.icon} className="h-8 w-8" />
              </div>

              <h3 className="mb-4 text-2xl font-black text-slate-900 sm:text-3xl">
                {selectedService.title}
              </h3>
              
              <p className="mb-8 text-base leading-relaxed text-slate-600 sm:text-lg">
                {selectedService.description}
              </p>

              <div className="space-y-4">
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">주요 특징</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedService.highlights.map((h) => (
                    <span
                      key={h}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-10">
                <Link
                  href="/login"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-lg font-black text-white shadow-xl shadow-blue-900/20 transition-all hover:bg-blue-700 active:scale-95"
                >
                  시작하기
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
