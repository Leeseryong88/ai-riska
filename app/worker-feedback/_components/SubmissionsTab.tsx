'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  limit,
  updateDoc,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { CheckCircle2, Loader2, Trash2, X } from 'lucide-react';
import { Button, Card } from '@/app/work-permit/_components/ui/Button';
import { cn } from '@/app/work-permit/_lib/utils';

export interface WorkerFeedbackSubmission {
  id: string;
  managerId: string;
  body: string;
  authorName?: string;
  department?: string;
  createdAt?: unknown;
  acknowledged?: boolean;
  acknowledgedAt?: unknown;
}

const PAGE_SIZE = 50;

export function SubmissionsTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<WorkerFeedbackSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkerFeedbackSubmission | null>(null);
  const [ackLoadingId, setAckLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'worker_feedback_submissions'),
        where('managerId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      setItems(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as WorkerFeedbackSubmission[]
      );
    } catch (e) {
      console.error(e);
      alert('목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('이 의견을 삭제할까요?')) return;
    try {
      await deleteDoc(doc(db, 'worker_feedback_submissions', id));
      setItems((prev) => prev.filter((x) => x.id !== id));
      setSelected((s) => (s?.id === id ? null : s));
    } catch (e) {
      console.error(e);
      alert('삭제하지 못했습니다.');
    }
  };

  const toggleAcknowledged = async (row: WorkerFeedbackSubmission, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = !row.acknowledged;
    setAckLoadingId(row.id);
    try {
      await updateDoc(doc(db, 'worker_feedback_submissions', row.id), {
        acknowledged: next,
        ...(next
          ? { acknowledgedAt: serverTimestamp() }
          : { acknowledgedAt: deleteField() }),
      });
      setItems((prev) =>
        prev.map((x) =>
          x.id === row.id ? { ...x, acknowledged: next, ...(next ? {} : { acknowledgedAt: undefined }) } : x
        )
      );
      setSelected((s) =>
        s?.id === row.id ? { ...s, acknowledged: next } : s
      );
    } catch (err) {
      console.error(err);
      alert('확인 상태를 저장하지 못했습니다.');
    } finally {
      setAckLoadingId(null);
    }
  };

  function formatDate(v: unknown): string {
    if (!v) return '-';
    if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
      try {
        return (v as { toDate: () => Date }).toDate().toLocaleString('ko-KR');
      } catch {
        return '-';
      }
    }
    return '-';
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-3 text-sm font-medium text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed border-gray-300 bg-gray-50 py-16 text-center">
        <p className="text-sm font-bold text-gray-600">접수된 의견이 없습니다.</p>
        <p className="mt-1 text-xs text-gray-500">접수 링크를 안내하면 여기에 표시됩니다.</p>
      </Card>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.id}>
            <Card
              role="button"
              tabIndex={0}
              onClick={() => setSelected(row)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(row);
                }
              }}
              className={cn(
                'cursor-pointer p-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                row.acknowledged && 'border-emerald-200 bg-emerald-50/40'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-gray-500">{formatDate(row.createdAt)}</span>
                  {row.acknowledged && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      <CheckCircle2 className="h-3 w-3" />
                      확인됨
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant={row.acknowledged ? 'outline' : 'primary'}
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    disabled={ackLoadingId === row.id}
                    isLoading={ackLoadingId === row.id}
                    onClick={(e) => toggleAcknowledged(row, e)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {row.acknowledged ? '확인 취소' : '확인'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-red-600 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(row.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    삭제
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                {(row.authorName || row.department) && (
                  <>
                    {row.authorName && (
                      <span>
                        <span className="font-bold text-gray-400">이름</span> {row.authorName}
                      </span>
                    )}
                    {row.department && (
                      <span>
                        <span className="font-bold text-gray-400">소속</span> {row.department}
                      </span>
                    )}
                  </>
                )}
                {!row.authorName && !row.department && (
                  <span className="text-gray-400">익명(이름·소속 미기재)</span>
                )}
              </div>
              <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{row.body}</p>
            </Card>
          </li>
        ))}
      </ul>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wf-submission-modal-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gray-50 px-5 py-4">
              <div>
                <h2 id="wf-submission-modal-title" className="text-lg font-black text-gray-900">
                  의견·제보 상세
                </h2>
                <p className="mt-1 text-xs text-gray-500">{formatDate(selected.createdAt)}</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-900"
                aria-label="닫기"
                onClick={() => setSelected(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap gap-2 pb-3">
                {selected.acknowledged && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    확인 처리됨
                  </span>
                )}
              </div>
              <div className="space-y-2 text-sm text-gray-700">
                {(selected.authorName || selected.department) && (
                  <div className="flex flex-wrap gap-4 rounded-lg bg-gray-50 px-3 py-2 text-xs">
                    {selected.authorName && (
                      <span>
                        <span className="font-bold text-gray-500">이름</span> {selected.authorName}
                      </span>
                    )}
                    {selected.department && (
                      <span>
                        <span className="font-bold text-gray-500">소속</span> {selected.department}
                      </span>
                    )}
                  </div>
                )}
                {!selected.authorName && !selected.department && (
                  <p className="text-xs text-gray-500">익명(이름·소속 미기재)</p>
                )}
              </div>
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-900">{selected.body}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4">
              <Button
                type="button"
                variant={selected.acknowledged ? 'outline' : 'primary'}
                size="sm"
                className="gap-1.5"
                disabled={ackLoadingId === selected.id}
                isLoading={ackLoadingId === selected.id}
                onClick={() => toggleAcknowledged(selected)}
              >
                <CheckCircle2 className="h-4 w-4" />
                {selected.acknowledged ? '확인 취소' : '확인'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                onClick={() => {
                  handleDelete(selected.id);
                }}
              >
                삭제
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setSelected(null)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
