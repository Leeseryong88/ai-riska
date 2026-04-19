'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, FileText, Menu, Users, X } from 'lucide-react';
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

const workflowSteps = [
  { title: '입력', sub: '사진·작업 정보' },
  { title: '초안', sub: 'AI·문서 도구' },
  { title: '보관', sub: '일지·저장소' },
];

const serviceLookup = new Map<string, ServiceDefinition>(services.map((service) => [service.id, service]));

const groupedServices = serviceGroups.map((group) => ({
  ...group,
  items: group.serviceIds
    .map((id) => serviceLookup.get(id))
    .filter((service): service is ServiceDefinition => Boolean(service)),
}));

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
            <a href="#services" className="transition-colors hover:text-blue-600">
              기능
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
              <a href="#services" onClick={() => setIsMenuOpen(false)} className="block py-2 font-bold text-slate-800">
                기능
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
          >
            <h1 className="text-3xl font-black leading-snug tracking-tight sm:text-4xl lg:text-5xl">
              <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                클릭 한번으로 서류를 직접 만드세요
              </span>
            </h1>
          </motion.div>
          <p className="mb-5 mt-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 sm:mb-6 sm:mt-6 sm:text-sm">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            비싼 컨설팅 비용 내지마세요 · 양식·샘플 찾지 마세요
          </p>
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
                  href="#services"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/90 bg-white/95 px-6 py-3.5 text-sm font-black text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-white sm:px-8 sm:py-4 sm:text-base"
                >
                  어떤 서류가 되나요
                </a>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="mx-auto mt-10 max-w-6xl px-4 text-center sm:mt-12 sm:px-6 lg:px-8">
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
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {['안전보건계획서', '위험성평가', '작업허가', '안전일지'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* 기능 — 설명 최소, 카드는 제목+태그만 */}
      <section id="services" className="border-t border-slate-100 bg-slate-50/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">어떤 서류를 직접 만들 수 있나요</h2>
            <p className="mt-2 text-sm font-medium text-slate-600 sm:text-base">
              남이 쓴 샘플을 복붙하는 대신, 우리 회사 입력으로 채워지는 문서와 기록입니다.
            </p>
          </div>

          <div className="space-y-10">
            {groupedServices.map((group, groupIndex) => (
              <motion.section
                key={group.id}
                id={group.anchor}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: groupIndex * 0.05 }}
                className={`overflow-hidden rounded-[1.75rem] border bg-gradient-to-br p-6 sm:rounded-[2rem] sm:p-8 ${group.surfaceClass} ${group.borderClass}`}
              >
                <div className="mb-6 max-w-xl">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black sm:text-sm ${group.badgeClass}`}>
                    {group.eyebrow}
                  </span>
                  <h3 className="mt-3 text-xl font-black text-slate-900 sm:text-2xl">{group.title}</h3>
                  <p className="mt-2 text-sm font-medium text-slate-600">{group.tagline}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((service) => (
                    <Link
                      key={service.id}
                      href="/login"
                      className="group flex flex-col rounded-2xl border border-white/80 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-700 transition group-hover:bg-blue-50 group-hover:text-blue-700">
                        <ServiceGlyph icon={service.icon} className="h-5 w-5" />
                      </div>
                      <p className="text-base font-black text-slate-900">{service.title}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {service.highlights.slice(0, 3).map((h) => (
                          <span
                            key={h}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.section>
            ))}
          </div>
        </div>
      </section>

      {/* 흐름 — 3단어 중심 */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-900 px-6 py-8 text-white sm:rounded-[2rem] sm:px-10 sm:py-10">
            <h2 className="text-center text-xl font-black sm:text-2xl">입력 → 초안 → 보관</h2>
            <p className="mx-auto mt-2 max-w-md text-center text-sm font-medium text-slate-400">
              컨설팅 일정을 기다리지 말고, 필요한 순서대로 이어 쓰면 됩니다.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {workflowSteps.map((step, i) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center">
                  <p className="text-xs font-black uppercase tracking-widest text-blue-300">Step {i + 1}</p>
                  <p className="mt-2 text-lg font-black">{step.title}</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">{step.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="pb-16 sm:pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[1.75rem] bg-blue-600 px-8 py-12 text-center shadow-xl shadow-blue-200 sm:rounded-[2rem] sm:py-14">
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <Users className="relative mx-auto h-10 w-10 text-white/90" />
            <h2 className="relative mt-4 text-2xl font-black leading-snug text-white sm:text-3xl">
              컨설팅 견적 전에
              <br />
              우리 회사 서류부터 만들어 보세요
            </h2>
            <p className="relative mx-auto mt-3 max-w-sm text-sm font-medium text-blue-100">
              가입 후 바로 계획서·위험성평가·현장 기록 기능을 쓸 수 있습니다.
            </p>
            <Link
              href="/login"
              className="relative mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-10 py-4 text-base font-black text-blue-600 shadow-lg transition hover:bg-blue-50"
            >
              시작하기
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:text-left sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-slate-500">© 2026 모두의 안전</p>
          <p className="text-xs font-medium text-slate-400">샘플 검색 대신 맞춤 초안 · AI와 실무 설계</p>
        </div>
      </footer>
    </div>
  );
}
