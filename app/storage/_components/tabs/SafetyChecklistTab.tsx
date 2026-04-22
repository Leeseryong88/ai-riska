'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Trash2, ExternalLink, Info, ListChecks, Printer, Edit2, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pagination } from '@/components/ui/Pagination';

interface ChecklistRecord {
  id: string;
  title: string;
  createdAt: any;
  checklistHtml: string;
  format?: string;
  questionCount?: number;
  userId: string;
}

export function SafetyChecklistTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<ChecklistRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listPage, setListPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<ChecklistRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const contentEditRef = useRef<HTMLDivElement>(null);

  const FETCH_BATCH = 100;
  const LIST_PAGE_SIZE = 10;

  const fetchItems = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const aggregated: ChecklistRecord[] = [];
      let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
      while (true) {
        let q = query(
          collection(db, 'safetyChecklists'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(FETCH_BATCH)
        );
        if (cursor) q = query(q, startAfter(cursor));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) break;
        aggregated.push(
          ...querySnapshot.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as ChecklistRecord
          )
        );
        if (querySnapshot.docs.length < FETCH_BATCH) break;
        cursor = querySnapshot.docs[querySnapshot.docs.length - 1];
      }
      setItems(aggregated);
      setListPage(1);
    } catch (error) {
      console.error('Error fetching safety checklists:', error);
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('정말로 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'safetyChecklists', id));
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}. ${month}. ${day}.`;
  };

  const handleEditStart = () => {
    if (!selectedItem) return;
    setEditTitle(selectedItem.title || '');
    setEditHtml(selectedItem.checklistHtml || '');
    setIsEditing(true);
  };

  const handleEditCancel = () => setIsEditing(false);

  const handleSave = async () => {
    if (!selectedItem) return;
    setIsSaving(true);
    try {
      const updatedHtml = contentEditRef.current?.innerHTML || editHtml;

      const docRef = doc(db, 'safetyChecklists', selectedItem.id);
      await updateDoc(docRef, {
        title: editTitle,
        checklistHtml: updatedHtml,
      });

      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id
            ? { ...item, title: editTitle, checklistHtml: updatedHtml }
            : item
        )
      );
      setSelectedItem((prev) => (prev ? { ...prev, title: editTitle, checklistHtml: updatedHtml } : null));
      setIsEditing(false);
      alert('수정되었습니다.');
    } catch (error) {
      console.error('Error updating checklist:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    if (!selectedItem) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('팝업 차단을 해제해주세요.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedItem.title}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #1f2937; line-height: 1.5; padding: 0; margin: 0; }
            .checklist-wrapper { padding: 0; }
            .checklist-title { font-size: 22pt; font-weight: bold; text-align: center; margin: 0 0 20px; padding: 16px; border: 2px solid #111827; letter-spacing: 1px; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10.5pt; table-layout: fixed; page-break-inside: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            tr { page-break-inside: avoid !important; break-inside: avoid !important; page-break-after: auto; }
            th { background-color: #f1f5f9; border: 1px solid #475569; padding: 8px; font-weight: bold; text-align: center; color: #0f172a; page-break-inside: avoid; break-inside: avoid; }
            td { border: 1px solid #475569; padding: 8px; vertical-align: middle; word-break: break-word; page-break-inside: avoid; break-inside: avoid; }
            .meta-table, .sign-table, .disclaimer { page-break-inside: avoid !important; break-inside: avoid !important; }
            .meta-table td.meta-label { background: #f8fafc; font-weight: bold; text-align: center; }
            .sign-table td { height: 60px; text-align: center; vertical-align: top; padding-top: 10px; }
            .disclaimer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 9pt; color: #6b7280; }
          </style>
        </head>
        <body>
          ${selectedItem.checklistHtml}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Info className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-bold">저장된 안전점검 체크리스트가 없습니다.</p>
        </div>
      ) : (
        <>
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 text-xs font-black text-gray-500 uppercase tracking-wider">
            <div className="col-span-1 text-center">번호</div>
            <div className="col-span-5">제목</div>
            <div className="col-span-2 text-center">형식</div>
            <div className="col-span-3 text-center">생성일</div>
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
                className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-rose-50/30 transition-all cursor-pointer items-center"
              >
                <div className="hidden md:flex md:col-span-1 items-center justify-center">
                  <span className="text-sm font-black text-rose-600">{(listPage - 1) * LIST_PAGE_SIZE + index + 1}</span>
                </div>
                <div className="col-span-1 md:col-span-5 flex items-center gap-3">
                  <div className="md:hidden w-8 h-8 shrink-0 rounded-lg bg-rose-100 flex items-center justify-center">
                    <span className="text-xs font-black text-rose-600">{(listPage - 1) * LIST_PAGE_SIZE + index + 1}</span>
                  </div>
                  <div className="hidden md:flex w-10 h-10 rounded-lg bg-rose-100 items-center justify-center shrink-0">
                    <ListChecks className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 line-clamp-1">{item.title || '제목 없음'}</h3>
                    <div className="md:hidden mt-1 flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                      {item.format || '-'} · {formatDate(item.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex md:col-span-2 items-center justify-center text-xs font-bold text-gray-500">
                  {item.format || '-'}
                  {item.questionCount ? <span className="ml-1 text-gray-400">({item.questionCount})</span> : null}
                </div>

                <div className="hidden md:flex md:col-span-3 items-center justify-center text-xs font-bold text-gray-500">
                  {formatDate(item.createdAt)}
                </div>

                <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center gap-2">
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="p-2 text-rose-600">
                    <ExternalLink className="w-4 h-4" />
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
              onClick={() => { setSelectedItem(null); setIsEditing(false); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-center shrink-0">
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-2xl font-black text-gray-900 border-b-2 border-blue-500 outline-none flex-1 mr-4"
                    autoFocus
                  />
                ) : (
                  <h2 className="text-2xl font-black text-gray-900">{selectedItem.title}</h2>
                )}

                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <>
                      <button
                        onClick={handlePrint}
                        className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-bold"
                        title="인쇄"
                      >
                        <Printer className="w-5 h-5" />
                        <span className="hidden sm:inline">인쇄</span>
                      </button>
                      <button
                        onClick={handleEditStart}
                        className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-2 text-sm font-bold"
                        title="수정"
                      >
                        <Edit2 className="w-5 h-5" />
                        <span className="hidden sm:inline">수정</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-bold disabled:opacity-50"
                      >
                        {isSaving ? (
                          <div className="w-5 h-5 border-t-2 border-white border-solid rounded-full animate-spin" />
                        ) : (
                          <Check className="w-5 h-5" />
                        )}
                        <span>저장</span>
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-bold"
                      >
                        <X className="w-5 h-5" />
                        <span>취소</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setSelectedItem(null); setIsEditing(false); }}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors ml-2"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                {isEditing ? (
                  <div className="h-full flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-gray-500">내용 수정 (문서를 직접 클릭하여 수정하세요)</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => document.execCommand('bold', false)}
                          className="px-2 py-1 bg-gray-100 rounded text-xs font-bold hover:bg-gray-200"
                        >가</button>
                        <button
                          onClick={() => document.execCommand('underline', false)}
                          className="px-2 py-1 bg-gray-100 rounded text-xs font-bold underline hover:bg-gray-200"
                        >U</button>
                      </div>
                    </div>
                    <div
                      ref={contentEditRef}
                      contentEditable={true}
                      className="flex-1 w-full p-8 bg-white border-2 border-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none overflow-auto checklist-store-container"
                      dangerouslySetInnerHTML={{ __html: editHtml }}
                      style={{ minHeight: '400px' }}
                    />
                  </div>
                ) : (
                  <div
                    className="bg-white p-8 border border-gray-100 rounded-2xl overflow-auto checklist-store-container"
                    dangerouslySetInnerHTML={{ __html: selectedItem.checklistHtml }}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .checklist-store-container .checklist-wrapper { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #1f2937; line-height: 1.5; }
        .checklist-store-container .checklist-title { font-size: 22pt; font-weight: bold; text-align: center; margin-bottom: 20px; padding: 16px; border: 2px solid #111827; letter-spacing: 1px; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; }
        .checklist-store-container table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10.5pt; table-layout: fixed; }
        .checklist-store-container thead { display: table-header-group; }
        .checklist-store-container tfoot { display: table-footer-group; }
        .checklist-store-container tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        .checklist-store-container th { background-color: #f1f5f9; border: 1px solid #475569; padding: 8px; font-weight: bold; text-align: center; color: #0f172a; page-break-inside: avoid; break-inside: avoid; }
        .checklist-store-container td { border: 1px solid #475569; padding: 8px; vertical-align: middle; word-break: break-word; page-break-inside: avoid; break-inside: avoid; }
        .checklist-store-container .meta-table { page-break-inside: avoid; break-inside: avoid; }
        .checklist-store-container .meta-table td.meta-label { background: #f8fafc; font-weight: bold; text-align: center; width: 15%; }
        .checklist-store-container .check-cell { text-align: center; width: 8%; }
        .checklist-store-container .no-cell { text-align: center; width: 6%; }
        .checklist-store-container .remark-cell { width: 18%; }
        .checklist-store-container .sign-table { page-break-inside: avoid; break-inside: avoid; }
        .checklist-store-container .sign-table td { height: 60px; text-align: center; vertical-align: top; padding-top: 10px; }
        .checklist-store-container .disclaimer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 9pt; color: #6b7280; page-break-inside: avoid; break-inside: avoid; }
        @media print {
          .checklist-store-container { padding: 0 !important; border: none !important; box-shadow: none !important; }
          .checklist-store-container table { page-break-inside: auto; }
          .checklist-store-container tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          .checklist-store-container thead { display: table-header-group; }
          .checklist-store-container tfoot { display: table-footer-group; }
          .checklist-store-container .sign-table,
          .checklist-store-container .meta-table,
          .checklist-store-container .disclaimer { page-break-inside: avoid !important; break-inside: avoid !important; }
        }
      `}</style>
    </div>
  );
}
