'use client';

import React, { useState } from 'react';
import { X, FileText, Download, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import type { MeetingMinute } from '../_lib/types';
import { MEETING_TYPE_LABEL } from '../_lib/types';

interface MeetingDetailModalProps {
  meeting: MeetingMinute | null;
  onClose: () => void;
  onDeleted: () => void;
}

export const MeetingDetailModal: React.FC<MeetingDetailModalProps> = ({ meeting, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);
  if (!meeting) return null;

  const handleDelete = async () => {
    if (!window.confirm('이 회의록 기록을 삭제하시겠어요? (업로드된 파일은 보관됩니다)')) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'meeting_minutes', meeting.id));
      onDeleted();
      onClose();
    } catch (e) {
      console.error(e);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const periodLabel = () => {
    if (meeting.type === 'oshc' && meeting.year && meeting.quarter) {
      return `${meeting.year}년 ${meeting.quarter}분기`;
    }
    if (meeting.type === 'partner_council' && meeting.year && meeting.month) {
      return `${meeting.year}년 ${meeting.month}월`;
    }
    return '주기 없음';
  };

  const accent =
    meeting.type === 'oshc'
      ? 'bg-blue-600'
      : meeting.type === 'partner_council'
      ? 'bg-purple-600'
      : 'bg-emerald-600';

  const isImage = meeting.fileType?.startsWith('image/');

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${accent}`} />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                {MEETING_TYPE_LABEL[meeting.type]}
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900">{meeting.title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">{periodLabel()}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">회의일 {meeting.date}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {meeting.fileUrl ? (
            <div className="space-y-3">
              {isImage ? (
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <img src={meeting.fileUrl} alt={meeting.fileName} className="w-full" />
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-blue-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-800">{meeting.fileName}</p>
                    <p className="text-[11px] font-bold text-slate-400">{meeting.fileType || '파일'}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <a
                  href={meeting.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4" />새 창에서 열기
                </a>
                <a
                  href={meeting.fileUrl}
                  download={meeting.fileName}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />다운로드
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-bold text-slate-500">첨부된 파일이 없습니다.</p>
              <p className="mt-1 text-xs text-slate-400">회의록 기록만 남겨진 항목입니다.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 p-4">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-red-500 transition hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            기록 삭제
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
