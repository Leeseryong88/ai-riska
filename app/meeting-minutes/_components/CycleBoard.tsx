'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, FileText, ChevronLeft, ChevronRight, AlertCircle, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import type { MeetingMinute } from '../_lib/types';
import { currentYear } from '../_lib/utils';
import { MeetingDetailModal } from './MeetingDetailModal';
import { Pagination } from '@/components/ui/Pagination';

const OTHERS_PAGE_SIZE = 10;

interface CycleBoardProps {
  meetings: MeetingMinute[];
  onChanged: () => void;
}

export const CycleBoard: React.FC<CycleBoardProps> = ({ meetings, onChanged }) => {
  const thisYear = currentYear();
  const [year, setYear] = useState<number>(thisYear);
  const [selected, setSelected] = useState<MeetingMinute | null>(null);
  const [othersPage, setOthersPage] = useState(1);

  const { oshcByQuarter, partnerByMonth, others } = useMemo(() => {
    const oshc: Record<number, MeetingMinute[]> = { 1: [], 2: [], 3: [], 4: [] };
    const partner: Record<number, MeetingMinute[]> = {};
    for (let m = 1; m <= 12; m++) partner[m] = [];
    const otherList: MeetingMinute[] = [];

    meetings.forEach((m) => {
      if (m.type === 'oshc' && m.year === year && m.quarter) {
        oshc[m.quarter].push(m);
      } else if (m.type === 'partner_council' && m.year === year && m.month) {
        partner[m.month].push(m);
      } else if (m.type === 'other') {
        const d = new Date(m.date);
        if (!isNaN(d.getTime()) && d.getFullYear() === year) {
          otherList.push(m);
        }
      }
    });

    otherList.sort((a, b) => (a.date < b.date ? 1 : -1));
    return { oshcByQuarter: oshc, partnerByMonth: partner, others: otherList };
  }, [meetings, year]);

  const completedQuarters = Object.values(oshcByQuarter).filter((arr) => arr.length > 0).length;
  const completedMonths = Object.values(partnerByMonth).filter((arr) => arr.length > 0).length;

  const nowMonth = new Date().getMonth() + 1;
  const nowQuarter = Math.floor((nowMonth - 1) / 3) + 1;
  const isCurrentYear = year === thisYear;

  const othersTotalPages = Math.max(1, Math.ceil(others.length / OTHERS_PAGE_SIZE));

  // 연도 변경 시 1페이지로 리셋
  useEffect(() => {
    setOthersPage(1);
  }, [year]);

  // 데이터 감소로 현재 페이지가 범위를 벗어나면 보정
  useEffect(() => {
    if (othersPage > othersTotalPages) setOthersPage(othersTotalPages);
  }, [othersPage, othersTotalPages]);

  const pagedOthers = useMemo(() => {
    const start = (othersPage - 1) * OTHERS_PAGE_SIZE;
    return others.slice(start, start + OTHERS_PAGE_SIZE);
  }, [others, othersPage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-black text-slate-900">회의록 주기표</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            법정 회의 주기별 이행 현황을 한눈에 확인하세요. 항목을 누르면 상세 정보가 열립니다.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 px-2 py-1.5">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[56px] text-center text-sm font-black text-slate-800">{year}년</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* OSHC quarterly */}
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
              <h4 className="text-sm font-black text-slate-900">산업안전보건위원회</h4>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-600">
                분기당 1회
              </span>
            </div>
            <p className="mt-1 text-[11px] font-bold text-slate-400">산업안전보건법 제24조</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-slate-400">이행률</p>
            <p className="text-lg font-black text-blue-600">
              {completedQuarters}
              <span className="text-xs text-slate-400"> / 4</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((q) => {
            const list = oshcByQuarter[q];
            const hasItem = list.length > 0;
            const isCurrent = isCurrentYear && q === nowQuarter;
            const isOverdue = isCurrentYear && q < nowQuarter && !hasItem;

            return (
              <motion.div
                key={q}
                whileHover={{ y: -2 }}
                className={`group relative overflow-hidden rounded-2xl border p-4 transition ${
                  hasItem
                    ? 'border-blue-100 bg-blue-50/40'
                    : isOverdue
                    ? 'border-red-100 bg-red-50/40'
                    : isCurrent
                    ? 'border-amber-100 bg-amber-50/40'
                    : 'border-slate-100 bg-white'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-500">{q}분기</span>
                  <StatusDot status={hasItem ? 'done' : isOverdue ? 'overdue' : isCurrent ? 'current' : 'idle'} />
                </div>
                {hasItem ? (
                  <div className="space-y-1.5">
                    {list.slice(0, 3).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelected(m)}
                        className="flex w-full items-center gap-2 rounded-xl bg-white p-2 text-left text-xs font-bold text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                        <span className="flex-1 truncate">{m.title}</span>
                        <span className="shrink-0 text-[10px] font-black text-slate-400">
                          {m.date.slice(5)}
                        </span>
                      </button>
                    ))}
                    {list.length > 3 && (
                      <p className="text-center text-[10px] font-bold text-slate-400">외 {list.length - 3}건</p>
                    )}
                  </div>
                ) : (
                  <p className={`text-[11px] font-bold ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                    {isOverdue ? '미실시 (지연)' : isCurrent ? '이번 분기 예정' : '기록 없음'}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Partner Council Monthly */}
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-purple-600" />
              <h4 className="text-sm font-black text-slate-900">협력업체 협의체회의</h4>
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-black text-purple-600">
                월 1회
              </span>
            </div>
            <p className="mt-1 text-[11px] font-bold text-slate-400">산업안전보건법 제64조</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-slate-400">이행률</p>
            <p className="text-lg font-black text-purple-600">
              {completedMonths}
              <span className="text-xs text-slate-400"> / 12</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const list = partnerByMonth[m];
            const hasItem = list.length > 0;
            const isCurrent = isCurrentYear && m === nowMonth;
            const isOverdue = isCurrentYear && m < nowMonth && !hasItem;

            return (
              <motion.div
                key={m}
                whileHover={{ y: -2 }}
                className={`group relative rounded-2xl border p-3 transition ${
                  hasItem
                    ? 'border-purple-100 bg-purple-50/40'
                    : isOverdue
                    ? 'border-red-100 bg-red-50/30'
                    : isCurrent
                    ? 'border-amber-100 bg-amber-50/30'
                    : 'border-slate-100 bg-white'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-500">{m}월</span>
                  <StatusDot status={hasItem ? 'done' : isOverdue ? 'overdue' : isCurrent ? 'current' : 'idle'} />
                </div>
                {hasItem ? (
                  <div className="space-y-1">
                    {list.slice(0, 2).map((x) => (
                      <button
                        key={x.id}
                        onClick={() => setSelected(x)}
                        className="flex w-full items-center gap-1.5 rounded-lg bg-white p-1.5 text-left text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-purple-50 hover:text-purple-700"
                        title={x.title}
                      >
                        <FileText className="h-3 w-3 shrink-0 text-purple-500" />
                        <span className="flex-1 truncate">{x.title}</span>
                      </button>
                    ))}
                    {list.length > 2 && (
                      <p className="text-center text-[10px] font-bold text-slate-400">+{list.length - 2}건</p>
                    )}
                  </div>
                ) : (
                  <p className={`text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                    {isOverdue ? '미실시' : isCurrent ? '이번 달 예정' : '—'}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Others */}
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
              <h4 className="text-sm font-black text-slate-900">기타 회의</h4>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-600">
                주기 없음
              </span>
            </div>
            <p className="mt-1 text-[11px] font-bold text-slate-400">{year}년 등록된 기타 회의록</p>
          </div>
          <p className="text-lg font-black text-emerald-600">
            {others.length}
            <span className="text-xs text-slate-400">건</span>
          </p>
        </div>

        {others.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
            <p className="text-xs font-bold text-slate-400">등록된 기타 회의록이 없습니다.</p>
          </div>
        ) : (
          <>
            {othersTotalPages > 1 && (
              <div className="mb-2 flex items-center justify-end px-1 text-[11px] font-bold text-slate-400">
                <span>
                  {othersPage} / {othersTotalPages} 페이지
                </span>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {pagedOthers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-800">{m.title}</p>
                    <p className="text-[11px] font-bold text-slate-400">{m.date}</p>
                  </div>
                </button>
              ))}
            </div>
            <Pagination
              page={othersPage}
              totalPages={othersTotalPages}
              onChange={setOthersPage}
              accentClass="bg-emerald-600 text-white border-emerald-600"
            />
          </>
        )}
      </section>

      <Legend />

      <MeetingDetailModal
        meeting={selected}
        onClose={() => setSelected(null)}
        onDeleted={onChanged}
      />
    </div>
  );
};

type Status = 'done' | 'overdue' | 'current' | 'idle';

const StatusDot: React.FC<{ status: Status }> = ({ status }) => {
  if (status === 'done') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3 w-3 stroke-[3]" />
      </span>
    );
  }
  if (status === 'overdue') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
        <AlertCircle className="h-3 w-3" />
      </span>
    );
  }
  if (status === 'current') {
    return <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />;
  }
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400">
      <Minus className="h-3 w-3" />
    </span>
  );
};

const Legend: React.FC = () => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-[11px] font-bold text-slate-500">
    <div className="flex items-center gap-1.5">
      <StatusDot status="done" /> 완료 / 기록됨
    </div>
    <div className="flex items-center gap-1.5">
      <StatusDot status="current" /> 현재 주기
    </div>
    <div className="flex items-center gap-1.5">
      <StatusDot status="overdue" /> 미실시 (지연)
    </div>
    <div className="flex items-center gap-1.5">
      <StatusDot status="idle" /> 예정 / 미대상
    </div>
  </div>
);
