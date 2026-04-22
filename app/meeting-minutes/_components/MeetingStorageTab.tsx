'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Save, Image as ImageIcon, Paperclip, Search } from 'lucide-react';
import { SaveMeetingModal } from './SaveMeetingModal';
import { MeetingDetailModal } from './MeetingDetailModal';
import { Pagination } from '@/components/ui/Pagination';
import { MEETING_TYPE_CYCLE, MEETING_TYPE_LABEL, type MeetingMinute, type MeetingType } from '../_lib/types';

const PAGE_SIZE = 10;

interface MeetingStorageTabProps {
  type: MeetingType;
  meetings: MeetingMinute[];
  loading: boolean;
  onChanged: () => void;
}

export const MeetingStorageTab: React.FC<MeetingStorageTabProps> = ({ type, meetings, loading, onChanged }) => {
  const [saveOpen, setSaveOpen] = useState(false);
  const [selected, setSelected] = useState<MeetingMinute | null>(null);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const own = meetings.filter((m) => m.type === type);
    const k = keyword.trim().toLowerCase();
    const byKeyword = k ? own.filter((m) => m.title.toLowerCase().includes(k) || m.date.includes(k)) : own;
    return [...byKeyword].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [meetings, type, keyword]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // 필터/검색/타입 변경 시 1페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [keyword, type]);

  // 데이터가 줄어들어 현재 페이지가 범위를 벗어나면 보정
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const accent =
    type === 'oshc'
      ? { dot: 'bg-blue-600', chip: 'bg-blue-50 text-blue-700', border: 'hover:border-blue-200', text: 'text-blue-600', soft: 'bg-blue-50', page: 'bg-blue-600 text-white border-blue-600', arrowHover: 'group-hover:text-blue-600' }
      : type === 'partner_council'
      ? { dot: 'bg-purple-600', chip: 'bg-purple-50 text-purple-700', border: 'hover:border-purple-200', text: 'text-purple-600', soft: 'bg-purple-50', page: 'bg-purple-600 text-white border-purple-600', arrowHover: 'group-hover:text-purple-600' }
      : { dot: 'bg-emerald-600', chip: 'bg-emerald-50 text-emerald-700', border: 'hover:border-emerald-200', text: 'text-emerald-600', soft: 'bg-emerald-50', page: 'bg-emerald-600 text-white border-emerald-600', arrowHover: 'group-hover:text-emerald-600' };

  const periodLabel = (m: MeetingMinute) => {
    if (m.type === 'oshc' && m.year && m.quarter) return `${m.year}년 ${m.quarter}분기`;
    if (m.type === 'partner_council' && m.year && m.month) return `${m.year}년 ${m.month}월`;
    return '주기 없음';
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${accent.dot}`} />
            <h3 className="text-base font-black text-slate-900">{MEETING_TYPE_LABEL[type]} 보관함</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${accent.chip}`}>
              {MEETING_TYPE_CYCLE[type]}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500">
            업로드된 회의록 파일과 기록을 보관하는 공간입니다. 양식 작성·인쇄는 <span className="font-black text-slate-700">양식 탭</span>을 이용하세요.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="제목·날짜 검색"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400"
            />
          </div>
          <button
            onClick={() => setSaveOpen(true)}
            className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            회의록 저장하기
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState onClick={() => setSaveOpen(true)} hasKeyword={!!keyword} />
      ) : (
        <>
        <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-bold text-slate-400">
          <span>
            총 <span className={`font-black ${accent.text}`}>{filtered.length}</span>건
            {totalPages > 1 && (
              <span className="ml-1 text-slate-400">· {page} / {totalPages} 페이지</span>
            )}
          </span>
          <span className="text-slate-400">최신순</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {/* 헤더 (데스크톱 전용) */}
          <div className="hidden border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[11px] font-black uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[auto_110px_1fr_minmax(0,200px)_96px_56px] sm:items-center sm:gap-3">
            <span className="w-6" aria-hidden />
            <span>주기</span>
            <span>제목</span>
            <span>첨부</span>
            <span className="text-right">작성일</span>
            <span className="text-right" aria-label="열기" />
          </div>

          <ul className="divide-y divide-slate-100">
            {paged.map((m) => {
              const isImage = m.fileType?.startsWith('image/');
              const hasFile = !!m.fileUrl;

              return (
                <li key={m.id}>
                  <motion.button
                    onClick={() => setSelected(m)}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.995 }}
                    className={`group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:grid-cols-[auto_110px_1fr_minmax(0,200px)_96px_56px]`}
                  >
                    {/* 썸네일/아이콘 */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl ${accent.soft}`}
                    >
                      {isImage && m.fileUrl ? (
                        <img src={m.fileUrl} alt={m.fileName} className="h-full w-full object-cover" />
                      ) : hasFile ? (
                        <Paperclip className={`h-4 w-4 ${accent.text}`} />
                      ) : (
                        <FileText className={`h-4 w-4 ${accent.text} opacity-60`} />
                      )}
                    </div>

                    {/* 주기 (데스크톱) */}
                    <span
                      className={`hidden shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-black sm:inline-block ${accent.chip}`}
                    >
                      {periodLabel(m)}
                    </span>

                    {/* 제목 + 모바일 메타 */}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{m.title}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-400 sm:hidden">
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${accent.chip}`}>
                          {periodLabel(m)}
                        </span>
                        <span>·</span>
                        <span>{m.date}</span>
                      </div>
                    </div>

                    {/* 첨부 (데스크톱) */}
                    <div className="hidden min-w-0 items-center gap-1.5 text-[11px] font-bold text-slate-500 sm:flex">
                      {hasFile ? (
                        <>
                          {isImage ? (
                            <ImageIcon className={`h-3.5 w-3.5 shrink-0 ${accent.text}`} />
                          ) : (
                            <Paperclip className={`h-3.5 w-3.5 shrink-0 ${accent.text}`} />
                          )}
                          <span className="truncate">{m.fileName || '첨부됨'}</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                          <span className="text-slate-400">첨부 없음</span>
                        </>
                      )}
                    </div>

                    {/* 작성일 (데스크톱) */}
                    <span className="hidden text-right text-[11px] font-black text-slate-500 sm:inline-block">
                      {m.date}
                    </span>

                    {/* 열기 화살표 */}
                    <span
                      className={`ml-auto text-[11px] font-black text-slate-300 transition ${accent.arrowHover}`}
                    >
                      열기 →
                    </span>
                  </motion.button>
                </li>
              );
            })}
          </ul>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          onChange={setPage}
          accentClass={accent.page}
        />
        </>
      )}

      <SaveMeetingModal
        type={type}
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSaved={() => {
          onChanged();
          setSaveOpen(false);
        }}
      />

      <MeetingDetailModal
        meeting={selected}
        onClose={() => setSelected(null)}
        onDeleted={onChanged}
      />
    </div>
  );
};

const LoadingState: React.FC = () => (
  <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-100 bg-white shadow-sm">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      <p className="text-xs font-bold text-slate-400">회의록을 불러오는 중...</p>
    </div>
  </div>
);

const EmptyState: React.FC<{ onClick: () => void; hasKeyword?: boolean }> = ({ onClick, hasKeyword }) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-slate-50/40 p-16 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
      <FileText className="h-6 w-6" />
    </div>
    <div>
      <p className="text-sm font-black text-slate-700">
        {hasKeyword ? '검색 결과가 없습니다.' : '아직 보관된 회의록이 없습니다.'}
      </p>
      <p className="mt-1 text-xs font-medium text-slate-400">
        {hasKeyword ? '다른 키워드로 검색해보세요.' : '회의록 파일을 업로드하여 보관해보세요.'}
      </p>
    </div>
    {!hasKeyword && (
      <button
        onClick={onClick}
        className="mt-2 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-blue-700"
      >
        <Save className="h-4 w-4" />
        회의록 저장하기
      </button>
    )}
  </div>
);
