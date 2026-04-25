'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { Check, ClipboardList, Edit2, ExternalLink, Info, Printer, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pagination } from '@/components/ui/Pagination';
import { shrinkHtmlDataUrlsForFirestore } from '@/app/work-plan/_lib/shrink-plan-html';

interface WorkPlanRecord {
  id: string;
  title: string;
  createdAt: any;
  planHtml: string;
  userId: string;
  templateId?: string;
  templateTitle?: string;
  workplace?: string;
  workDate?: string;
}

export function WorkPlanTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<WorkPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listPage, setListPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<WorkPlanRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const contentEditRef = useRef<HTMLDivElement>(null);

  const FETCH_BATCH = 100;
  const LIST_PAGE_SIZE = 10;

  const fetchItems = async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const aggregated: WorkPlanRecord[] = [];
      let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
      while (true) {
        let q = query(
          collection(db, 'workPlans'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(FETCH_BATCH)
        );
        if (cursor) q = query(q, startAfter(cursor));

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) break;

        aggregated.push(
          ...querySnapshot.docs.map((snapshot) => ({
            id: snapshot.id,
            ...snapshot.data(),
          }) as WorkPlanRecord)
        );

        if (querySnapshot.docs.length < FETCH_BATCH) break;
        cursor = querySnapshot.docs[querySnapshot.docs.length - 1];
      }

      setItems(aggregated);
      setListPage(1);
    } catch (error) {
      console.error('Error fetching work plans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [user]);

  const totalPages = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE));

  useEffect(() => {
    if (listPage > totalPages) setListPage(totalPages);
  }, [listPage, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (listPage - 1) * LIST_PAGE_SIZE;
    return items.slice(start, start + LIST_PAGE_SIZE);
  }, [items, listPage]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
  };

  const handleDelete = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!confirm('정말로 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'workPlans', id));
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting work plan:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleEditStart = () => {
    if (!selectedItem) return;
    setEditTitle(selectedItem.title || '');
    setEditHtml(selectedItem.planHtml || '');
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditHtml(selectedItem?.planHtml || '');
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    setIsSaving(true);

    try {
      const rawHtml = contentEditRef.current?.innerHTML || editHtml;
      let updatedHtml = rawHtml;
      try {
        updatedHtml = await shrinkHtmlDataUrlsForFirestore(rawHtml);
      } catch (shrinkErr) {
        const msg = shrinkErr instanceof Error ? shrinkErr.message : '문서 크기를 줄이지 못했습니다.';
        alert(msg);
        return;
      }
      const docRef = doc(db, 'workPlans', selectedItem.id);
      await updateDoc(docRef, {
        title: editTitle,
        planHtml: updatedHtml,
      });

      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id ? { ...item, title: editTitle, planHtml: updatedHtml } : item
        )
      );
      setSelectedItem((prev) => (prev ? { ...prev, title: editTitle, planHtml: updatedHtml } : null));
      setIsEditing(false);
      alert('수정되었습니다.');
    } catch (error) {
      console.error('Error updating work plan:', error);
      const msg =
        error instanceof Error && /longer than \d+ bytes/i.test(error.message)
          ? '문서(HTML)가 Firestore 용량 한도(약 1MB)를 넘습니다. 본문·이미지를 줄인 뒤 다시 저장하세요.'
          : '수정 중 오류가 발생했습니다.';
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    if (!selectedItem) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('팝업 차단을 해제해 주세요.');
      return;
    }

    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${selectedItem.title || '작업계획서'}</title>
    <style>
      @page { size: A4; margin: 12mm; }
      body { margin: 0; padding: 0; background: #fff; }
    </style>
  </head>
  <body>
    ${selectedItem.planHtml}
    <script>
      window.onload = function() {
        window.print();
        window.onafterprint = function() { window.close(); };
      };
    </script>
  </body>
</html>`);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 py-20 text-center">
          <Info className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="font-bold text-gray-500">저장된 작업계획서가 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="hidden grid-cols-12 gap-4 border-b border-gray-200 bg-gray-50 px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-500 md:grid">
              <div className="col-span-1 text-center">번호</div>
              <div className="col-span-5">제목</div>
              <div className="col-span-3">양식</div>
              <div className="col-span-2 text-center">생성일</div>
              <div className="col-span-1 text-center">작업</div>
            </div>

            <div className="divide-y divide-gray-100">
              {pagedItems.map((item, index) => (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setSelectedItem(item)}
                  className="grid cursor-pointer grid-cols-1 items-center gap-4 px-6 py-4 transition-all hover:bg-amber-50/30 md:grid-cols-12"
                >
                  <div className="hidden items-center justify-center md:col-span-1 md:flex">
                    <span className="text-sm font-black text-amber-600">
                      {(listPage - 1) * LIST_PAGE_SIZE + index + 1}
                    </span>
                  </div>

                  <div className="col-span-1 flex items-center gap-3 md:col-span-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                      <ClipboardList className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="line-clamp-1 text-sm font-black text-gray-900">
                        {item.title || '제목 없음'}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold text-gray-400 md:hidden">
                        <span>{item.templateTitle || '작업계획서'}</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden min-w-0 md:col-span-3 md:block">
                    <p className="line-clamp-1 text-xs font-bold text-gray-500">
                      {item.templateTitle || '작업계획서'}
                    </p>
                    {item.workplace && (
                      <p className="mt-1 line-clamp-1 text-[11px] font-medium text-gray-400">{item.workplace}</p>
                    )}
                  </div>

                  <div className="hidden items-center justify-center text-xs font-bold text-gray-500 md:col-span-2 md:flex">
                    {formatDate(item.createdAt)}
                  </div>

                  <div className="col-span-1 flex justify-end gap-2 md:col-span-1 md:justify-center">
                    <button
                      onClick={(event) => handleDelete(item.id, event)}
                      className="rounded-lg p-2 text-gray-400 transition-all hover:bg-red-50 hover:text-red-500"
                      title="삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="p-2 text-amber-600">
                      <ExternalLink className="h-4 w-4" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <Pagination
            page={listPage}
            totalPages={totalPages}
            onChange={setListPage}
            accentClass="bg-amber-600 text-white border-amber-600"
          />
        </>
      )}

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedItem(null);
                setIsEditing(false);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 p-6 sm:p-8">
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    className="mr-4 flex-1 border-b-2 border-blue-500 text-2xl font-black text-gray-900 outline-none"
                    autoFocus
                  />
                ) : (
                  <div className="min-w-0">
                    <h2 className="line-clamp-1 text-2xl font-black text-gray-900">{selectedItem.title}</h2>
                    <p className="mt-1 text-sm font-bold text-gray-500">
                      {selectedItem.templateTitle || '작업계획서'} · {formatDate(selectedItem.createdAt)}
                    </p>
                  </div>
                )}

                <div className="flex shrink-0 items-center gap-2">
                  {!isEditing ? (
                    <>
                      <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 rounded-xl bg-gray-100 p-2.5 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-200"
                        title="인쇄"
                      >
                        <Printer className="h-5 w-5" />
                        <span className="hidden sm:inline">인쇄</span>
                      </button>
                      <button
                        onClick={handleEditStart}
                        className="flex items-center gap-2 rounded-xl bg-blue-50 p-2.5 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-100"
                        title="수정"
                      >
                        <Edit2 className="h-5 w-5" />
                        <span className="hidden sm:inline">수정</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 p-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSaving ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-t-2 border-solid border-white" />
                        ) : (
                          <Check className="h-5 w-5" />
                        )}
                        <span>저장</span>
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="flex items-center gap-2 rounded-xl bg-gray-100 p-2.5 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-200"
                      >
                        <X className="h-5 w-5" />
                        <span>취소</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setSelectedItem(null);
                      setIsEditing(false);
                    }}
                    className="ml-2 rounded-xl p-2 transition-colors hover:bg-gray-100"
                    title="닫기"
                  >
                    <X className="h-6 w-6 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                {isEditing ? (
                  <div className="flex h-full flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-gray-500">
                        문서 내용을 직접 클릭하여 수정할 수 있습니다.
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => document.execCommand('bold', false)}
                          className="rounded bg-gray-100 px-2 py-1 text-xs font-bold hover:bg-gray-200"
                        >
                          B
                        </button>
                        <button
                          onClick={() => document.execCommand('underline', false)}
                          className="rounded bg-gray-100 px-2 py-1 text-xs font-bold underline hover:bg-gray-200"
                        >
                          U
                        </button>
                      </div>
                    </div>
                    <div
                      ref={contentEditRef}
                      contentEditable
                      className="work-plan-storage-container flex-1 overflow-auto rounded-2xl border-2 border-blue-100 bg-white p-8 outline-none focus:ring-2 focus:ring-blue-500"
                      dangerouslySetInnerHTML={{ __html: editHtml }}
                      style={{ minHeight: '480px' }}
                    />
                  </div>
                ) : (
                  <div
                    className="work-plan-storage-container overflow-auto rounded-2xl border border-gray-100 bg-white p-8"
                    dangerouslySetInnerHTML={{ __html: selectedItem.planHtml }}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .work-plan-storage-container table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1.25rem;
        }
        .work-plan-storage-container th,
        .work-plan-storage-container td {
          border: 1px solid #64748b;
          padding: 0.5rem;
          vertical-align: top;
          word-break: break-word;
        }
        .work-plan-storage-container th {
          background-color: #f8fafc;
          font-weight: 900;
        }
        .work-plan-storage-container img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}
