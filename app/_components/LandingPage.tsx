'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  FileSpreadsheet, 
  FileText, 
  Calculator, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Zap,
  Menu,
  X
} from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    title: "스마트 위험성 평가",
    description: "사진 촬영이나 텍스트 입력만으로 현장의 위험 요인을 AI가 즉시 분석하여 상세한 평가표를 생성합니다.",
    icon: <FileSpreadsheet className="w-8 h-8 text-blue-600" />,
    color: "bg-blue-50",
    href: "/assessment"
  },
  {
    title: "AI 안전보건계획서",
    description: "현장 정보를 바탕으로 법적 기준에 부합하는 맞춤형 계획서 초안을 단 10초 만에 완성합니다.",
    icon: <FileText className="w-8 h-8 text-emerald-600" />,
    color: "bg-emerald-50",
    href: "/health-safety-plan"
  },
  {
    title: "실시간 사진 위험 분석",
    description: "현장 사진을 업로드하면 위험 요인을 실시간 감지하고 공학적/관리적 개선 대책을 제안합니다.",
    icon: <Camera className="w-8 h-8 text-amber-600" />,
    color: "bg-amber-50",
    href: "/camera"
  },
  {
    title: "안전보건관리비 계획",
    description: "공사 금액에 따른 법정 관리비를 자동 계산하고 항목별 배분 계획을 스마트하게 수립합니다.",
    icon: <Calculator className="w-8 h-8 text-orange-600" />,
    color: "bg-orange-50",
    href: "/safety-management-fee"
  }
];

const stats = [
  { label: "문서 작성 시간 단축", value: "90%", icon: <Clock className="w-5 h-5" /> },
  { label: "위험 요인 탐지율", value: "98%", icon: <Zap className="w-5 h-5" /> },
  { label: "법적 기준 준수율", value: "100%", icon: <ShieldCheck className="w-5 h-5" /> }
];

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <ShieldCheck className="text-white w-6 h-6" />
              </div>
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                AI Riska
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8 font-bold text-sm text-gray-600">
              <a href="#features" className="hover:text-blue-600 transition-colors">주요 기능</a>
              <a href="#about" className="hover:text-blue-600 transition-colors">서비스 소개</a>
              <Link href="/login" className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95">
                시작하기
              </Link>
            </div>

            <button className="md:hidden p-2 text-gray-600" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-b border-gray-100 p-4 space-y-4 shadow-xl overflow-hidden"
            >
              <a href="#features" onClick={() => setIsMenuOpen(false)} className="block text-lg font-bold text-gray-700 py-2">주요 기능</a>
              <a href="#about" onClick={() => setIsMenuOpen(false)} className="block text-lg font-bold text-gray-700 py-2">서비스 소개</a>
              <Link href="/login" className="block w-full text-center px-6 py-4 bg-blue-600 text-white rounded-xl font-bold">
                로그인 / 시작하기
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-sm font-black mb-8 border border-blue-100">
              <Zap className="w-4 h-4 fill-current" />
              <span>현장 안전 관리의 새로운 표준</span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-black text-gray-900 leading-[1.1] mb-8 tracking-tight">
              복잡한 안전 서류,<br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent italic">AI Riska</span>가 단 몇 초 만에
            </h1>
            <p className="text-xl text-gray-600 mb-12 leading-relaxed max-w-2xl mx-auto font-medium">
              인공지능으로 현장의 위험 요인을 분석하고,<br />
              법적 기준에 완벽하게 부합하는 서류를 자동 생성하세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/login" className="w-full sm:w-auto px-10 py-5 bg-blue-600 text-white rounded-2xl text-lg font-black hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200 flex items-center justify-center gap-2 group">
                지금 무료로 시작하기
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#features" className="w-full sm:w-auto px-10 py-5 bg-gray-50 text-gray-700 rounded-2xl text-lg font-black hover:bg-gray-100 transition-all flex items-center justify-center">
                주요 기능 보기
              </a>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-100/50 flex flex-col items-center text-center group hover:border-blue-200 transition-all">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {stat.icon}
                </div>
                <div className="text-4xl font-black text-gray-900 mb-2">{stat.value}</div>
                <div className="text-sm font-bold text-gray-500">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl font-black text-gray-900 mb-4">현장의 모든 안전 관리를 하나로</h2>
            <p className="text-xl text-gray-600 font-medium">네 가지 핵심 엔진이 안전 관리를 스마트하게 혁신합니다.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -8 }}
                className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl hover:shadow-2xl transition-all group"
              >
                <div className={`w-16 h-16 ${feature.color} rounded-2xl flex items-center justify-center mb-8 group-hover:rotate-6 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed font-medium mb-8">
                  {feature.description}
                </p>
                <Link href="/login" className="inline-flex items-center gap-2 text-blue-600 font-black hover:gap-4 transition-all">
                  체험하기 <ArrowRight className="w-5 h-5" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Section */}
      <section id="about" className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-8">
                왜 <span className="text-blue-600">AI Riska</span>인가요?
              </h2>
              <div className="space-y-8">
                {[
                  { title: "최신 AI 모델 기반", desc: "현장 이미지를 실시간으로 분석하여 고도화된 위험 요소를 추출합니다." },
                  { title: "법적 리스크 제로", desc: "산업안전보건법 및 건설안전 지침을 완벽하게 준수하는 서류를 보장합니다." },
                  { title: "압도적인 효율성", desc: "기존 몇 시간이 소요되던 문서 업무를 단 몇 초의 데이터 입력으로 단축합니다." },
                  { title: "저장 및 사후 관리", desc: "생성된 모든 결과물은 클라우드에 자동 보관되어 언제든 수정 및 인쇄가 가능합니다." }
                ].map((item, idx) => (
                  <motion.div 
                    key={idx} 
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + idx * 0.1 }}
                    className="flex gap-4"
                  >
                    <div className="shrink-0 mt-1">
                      <CheckCircle2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-gray-600 font-medium">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-blue-100/50 rounded-[3rem] blur-3xl" />
              <div className="relative bg-white p-4 rounded-[2.5rem] shadow-2xl border border-gray-100">
                <div className="bg-gray-50 rounded-[2rem] p-8 aspect-video flex items-center justify-center">
                  <div className="text-center">
                    <Zap className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-bounce" />
                    <div className="text-2xl font-black text-gray-900 italic">AI Powering Safety</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-blue-600 rounded-[3rem] p-12 lg:p-20 text-center relative overflow-hidden shadow-2xl shadow-blue-300">
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500 rounded-full blur-3xl opacity-50" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-50" />
            
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-4xl lg:text-5xl font-black text-white mb-8 leading-tight">
                지금 바로 현장 안전을<br />스마트하게 바꾸세요
              </h2>
              <p className="text-blue-100 text-lg font-bold mb-12">
                무료 가입으로 AI Riska의 모든 기능을 지금 바로 경험해보세요.
              </p>
              <Link href="/login" className="inline-flex items-center gap-3 px-12 py-6 bg-white text-blue-600 rounded-2xl text-xl font-black hover:bg-blue-50 transition-all shadow-xl active:scale-95">
                로그인 / 시작하기
                <ArrowRight className="w-6 h-6" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <ShieldCheck className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-black text-gray-900 tracking-tight">
                AI Riska
              </span>
            </div>
            <div className="text-sm font-bold text-gray-400">
              © 2026 AI Riska. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
