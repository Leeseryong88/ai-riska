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
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { Loader2, Trash2 } from 'lucide-react';
import { Button, Card } from '@/app/work-permit/_components/ui/Button';

export interface WorkerFeedbackSubmission {
  id: string;
  managerId: string;
  body: string;
  authorName?: string;
  department?: string;
  createdAt?: unknown;
}

const PAGE_SIZE = 50;

export function SubmissionsTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<WorkerFeedbackSubmission[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async (id: string) => {
    if (!confirm('이 의견을 삭제할까요?')) return;
    try {
      await deleteDoc(doc(db, 'worker_feedback_submissions', id));
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      alert('삭제하지 못했습니다.');
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
        <p className="mt-1 text-xs text-gray-500">접수 링크를 현장에 안내하면 여기에 표시됩니다.</p>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((row) => (
        <li key={row.id}>
          <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-2">
            <div className="text-xs font-bold text-gray-500">{formatDate(row.createdAt)}</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-red-600 hover:bg-red-50"
              onClick={() => handleDelete(row.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </Button>
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
                    <span className="font-bold text-gray-400">소속·현장</span> {row.department}
                  </span>
                )}
              </>
            )}
            {!row.authorName && !row.department && (
              <span className="text-gray-400">익명(이름·소속 미기재)</span>
            )}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{row.body}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
