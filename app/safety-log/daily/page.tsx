'use client';

import React, { useState, useEffect, Suspense } from 'react';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { LogList } from '../_components/LogList';
import { LogForm } from '../_components/LogForm';
import { LogDetail } from '../_components/LogDetail';
import { SafetyLog } from '../_lib/types';
import { Button } from '../_components/ui/Button';
import { Plus, FileText, Edit, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/app/lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  startAfter,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { uploadBase64 } from '@/app/work-permit/_lib/storage';

const LOGS_PER_PAGE = 10;

type ModalMode = null | 'create' | 'edit' | 'detail';

function SafetyDailyLogContent() {
  const { user } = useAuth();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [logs, setLogs] = useState<SafetyLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<SafetyLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = async (isNextPage = false) => {
    if (!user) return;

    if (isNextPage) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      let q = query(
        collection(db, 'safety_logs'),
        where('managerId', '==', user.uid),
        orderBy('date', 'desc'),
        limit(LOGS_PER_PAGE)
      );

      if (isNextPage && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      const newLogs = snapshot.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as SafetyLog[];

      if (isNextPage) {
        setLogs((prev) => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === LOGS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchLogs();
  }, [user]);

  const closeModal = () => {
    setModalMode(null);
    setSelectedLog(null);
  };

  const handleCreateLog = async (data: SafetyLog) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const imageUrls: string[] = [];
      if (data.photos && data.photos.length > 0) {
        for (let i = 0; i < data.photos.length; i++) {
          const photo = data.photos[i];
          if (photo.startsWith('data:')) {
            const path = `safety-logs/${user.uid}/${Date.now()}_${i}.jpg`;
            const url = await uploadBase64(path, photo);
            imageUrls.push(url);
          } else {
            imageUrls.push(photo);
          }
        }
      }

      const cleanData = JSON.parse(JSON.stringify(data));

      await addDoc(collection(db, 'safety_logs'), {
        ...cleanData,
        photos: imageUrls,
        managerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await fetchLogs();
      closeModal();
    } catch (error) {
      console.error('Error creating log:', error);
      alert('일지 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateLog = async (data: SafetyLog) => {
    if (!user || !data.id) return;
    setIsSubmitting(true);

    try {
      const imageUrls: string[] = [];
      if (data.photos && data.photos.length > 0) {
        for (let i = 0; i < data.photos.length; i++) {
          const photo = data.photos[i];
          if (photo.startsWith('data:')) {
            const path = `safety-logs/${user.uid}/${Date.now()}_${i}.jpg`;
            const url = await uploadBase64(path, photo);
            imageUrls.push(url);
          } else {
            imageUrls.push(photo);
          }
        }
      }

      const cleanData = JSON.parse(JSON.stringify(data));
      const logRef = doc(db, 'safety_logs', data.id);
      await updateDoc(logRef, {
        ...cleanData,
        photos: imageUrls,
        updatedAt: serverTimestamp(),
      });

      await fetchLogs();
      setSelectedLog({ ...data, photos: imageUrls });
      setModalMode('detail');
    } catch (error) {
      console.error('Error updating log:', error);
      alert('일지 수정 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('정말로 이 일지를 삭제하시겠습니까?')) return;

    setIsLoading(true);
    try {
      await deleteDoc(doc(db, 'safety_logs', logId));
      setLogs((prev) => prev.filter((log) => log.id !== logId));
      closeModal();
    } catch (error) {
      console.error('Error deleting log:', error);
      alert('일지 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const modalTitle =
    modalMode === 'create'
      ? '새 안전일지 작성'
      : modalMode === 'edit'
        ? '안전일지 수정'
        : selectedLog?.title || '안전일지';

  const modalSubtitle =
    modalMode === 'create'
      ? '오늘의 안전 정보를 기록하세요.'
      : modalMode === 'edit'
        ? `${selectedLog?.date ?? ''} 일지 내용을 수정합니다.`
        : selectedLog?.date;

  return (
    <WorkspaceShell
      serviceHref="/safety-log/daily"
      title="일일 안전일지"
      description="안전 상태와 작업 내용을 일일 단위로 기록하고 관리합니다."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-blue-600">
            <FileText className="h-3.5 w-3.5" />
            <span className="text-xs font-bold">전체 일지 {logs.length}건</span>
          </div>
          <Button className="gap-2" onClick={() => setModalMode('create')}>
            <Plus className="h-4 w-4" /> 일지 작성하기
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-4 text-sm font-bold text-gray-400">일지를 불러오는 중...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <LogList
              logs={logs}
              onSelect={(log) => {
                setSelectedLog(log);
                setModalMode('detail');
              }}
              onDelete={handleDeleteLog}
            />

            {hasMore && logs.length > 0 && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchLogs(true)}
                  disabled={isLoadingMore}
                  className="w-full max-w-xs gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      불러오는 중...
                    </>
                  ) : (
                    <>더 보기</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {modalMode && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ' +
                      (modalMode === 'edit'
                        ? 'bg-amber-500 shadow-amber-100'
                        : modalMode === 'create'
                          ? 'bg-blue-600 shadow-blue-100'
                          : 'bg-gray-900 shadow-gray-200')
                    }
                  >
                    {modalMode === 'edit' ? (
                      <Edit className="h-6 w-6" />
                    ) : modalMode === 'create' ? (
                      <Plus className="h-6 w-6" />
                    ) : (
                      <FileText className="h-6 w-6" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 truncate">{modalTitle}</h2>
                    {modalSubtitle && (
                      <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{modalSubtitle}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors ml-2 shrink-0"
                  aria-label="닫기"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                {modalMode === 'create' && (
                  <LogForm
                    onSubmit={handleCreateLog}
                    onCancel={closeModal}
                    submitting={isSubmitting}
                  />
                )}

                {modalMode === 'edit' && selectedLog && (
                  <LogForm
                    initialData={selectedLog}
                    onSubmit={handleUpdateLog}
                    onCancel={() => setModalMode('detail')}
                    submitting={isSubmitting}
                  />
                )}

                {modalMode === 'detail' && selectedLog && (
                  <LogDetail
                    log={selectedLog}
                    onEdit={(log) => {
                      setSelectedLog(log);
                      setModalMode('edit');
                    }}
                    onDelete={handleDeleteLog}
                    onBack={closeModal}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </WorkspaceShell>
  );
}

export default function SafetyDailyLogPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SafetyDailyLogContent />
    </Suspense>
  );
}
