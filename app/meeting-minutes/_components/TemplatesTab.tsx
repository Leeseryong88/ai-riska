'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Users2, MessagesSquare, CalendarClock, ChevronRight, Printer, Save } from 'lucide-react';
import { TemplateModal } from './TemplateModal';
import { MEETING_TYPE_CYCLE, MEETING_TYPE_LABEL, type MeetingType } from '../_lib/types';

interface TemplatesTabProps {
  onSaved: () => void;
}

interface TemplateCardConfig {
  type: MeetingType;
  icon: any;
  gradient: string;
  ring: string;
  dot: string;
  chip: string;
  summary: string;
  regulation: string;
  sections: string[];
}

const CARDS: TemplateCardConfig[] = [
  {
    type: 'oshc',
    icon: Users2,
    gradient: 'from-blue-500 to-indigo-600',
    ring: 'ring-blue-100',
    dot: 'bg-blue-600',
    chip: 'bg-blue-50 text-blue-700',
    summary: '노·사 위원이 참여하는 분기 정기회의 양식입니다.',
    regulation: '산업안전보건법 제24조 / 시행령 제34~38조',
    sections: ['기본 정보 · 회차', '노·사 위원 참석표', '법정 심의·의결 안건 8종', '보고·건의·조치계획', '위원장/간사 서명'],
  },
  {
    type: 'partner_council',
    icon: MessagesSquare,
    gradient: 'from-fuchsia-500 to-purple-600',
    ring: 'ring-purple-100',
    dot: 'bg-purple-600',
    chip: 'bg-purple-50 text-purple-700',
    summary: '도급인·수급인이 매월 협의하는 협의체 회의 양식입니다.',
    regulation: '산업안전보건법 제64조 / 시행규칙 제79조',
    sections: ['현장·도급인 정보', '업체별 참석자', '법정 협의 5개 항목', '금월 공정·위험요인', '업체별 건의·조치'],
  },
  {
    type: 'other',
    icon: CalendarClock,
    gradient: 'from-emerald-500 to-teal-600',
    ring: 'ring-emerald-100',
    dot: 'bg-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700',
    summary: 'TBM 연장회의 · 소장회의 등 일반 회의에 쓰는 범용 양식입니다.',
    regulation: '사내 일반 안전·운영 회의',
    sections: ['기본 정보', '참석자 명단', '안건 / 주요 논의 내용', '결정사항·실행 과제', '비고 / 첨부'],
  },
];

export const TemplatesTab: React.FC<TemplatesTabProps> = ({ onSaved }) => {
  const [activeType, setActiveType] = useState<MeetingType | null>(null);

  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-500" />
          <h3 className="text-base font-black text-slate-900">회의록 양식 보관함</h3>
        </div>
        <p className="mt-1 text-xs font-medium text-slate-500">
          법정 회의 유형별 회의록 양식을 카드로 보관합니다. 카드를 눌러 양식을 확인하고, 바로 인쇄하거나 작성된 파일을 업로드해 보관하세요.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.type}
              onClick={() => setActiveType(card.type)}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.99 }}
              className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-sm transition ring-1 ring-transparent hover:${card.ring} hover:shadow-lg`}
            >
              {/* Gradient header */}
              <div
                className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${card.gradient} opacity-[0.08] transition group-hover:opacity-[0.14]`}
              />

              <div className="relative flex items-start justify-between">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.gradient} text-white shadow-lg shadow-slate-300/40`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-500" />
              </div>

              <div className="relative mt-5">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${card.dot}`} />
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${card.chip}`}>
                    {MEETING_TYPE_CYCLE[card.type]}
                  </span>
                </div>
                <h4 className="text-[17px] font-black tracking-tight text-slate-900">
                  {MEETING_TYPE_LABEL[card.type]} 양식
                </h4>
                <p className="mt-1 text-xs font-medium text-slate-500">{card.summary}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {card.regulation}
                </p>
              </div>

              <ul className="relative mt-4 space-y-1.5 border-t border-slate-100 pt-4">
                {card.sections.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                    <span className="inline-block h-1 w-1 rounded-full bg-slate-300" />
                    {s}
                  </li>
                ))}
              </ul>

              <div className="relative mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-[11px] font-bold text-slate-400">
                <span className="flex items-center gap-1">
                  <Printer className="h-3 w-3" /> 인쇄
                </span>
                <span className="h-3 w-px bg-slate-200" />
                <span className="flex items-center gap-1">
                  <Save className="h-3 w-3" /> 파일 업로드 보관
                </span>
                <span className="ml-auto text-[10px] font-black text-slate-400 transition group-hover:text-blue-600">
                  양식 열기 →
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      <TemplateModal type={activeType} onClose={() => setActiveType(null)} onSaved={onSaved} />
    </div>
  );
};
