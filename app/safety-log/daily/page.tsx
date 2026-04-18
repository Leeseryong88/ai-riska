'use client';

import React, { useState, useEffect, Suspense } from 'react';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { LogList } from '../_components/LogList';
import { LogForm } from '../_components/LogForm';
import { LogDetail } from '../_components/LogDetail';
import { SafetyLog } from '../_lib/types';
import { Button } from '../_components/ui/Button';
import { Plus, FileText, Edit, Loader2 } from 'lucide-react';
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

function SafetyDailyLogContent() {
  const { user } = useAuth();
  const [view, setView] = useState<'list' | 'create' | 'detail' | 'edit'>('list');
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

      fetchLogs();
      setView('list');
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

      fetchLogs();
      setSelectedLog({ ...data, photos: imageUrls });
      setView('detail');
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
      setView('list');
      setSelectedLog(null);
    } catch (error) {
      console.error('Error deleting log:', error);
      alert('일지 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <WorkspaceShell
      serviceHref="/safety-log/daily"
      title="일일 안전일지"
      description="안전 상태와 작업 내용을 일일 단위로 기록하고 관리합니다."
    >
      <div className="mx-auto max-w-4xl">
        <AnimatePresence mode="wait">
          {view === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-blue-600">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="text-xs font-bold">전체 일지 {logs.length}건</span>
                </div>
                <Button className="gap-2" onClick={() => setView('create')}>
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
                      setView('detail');
                    }}
                    onDelete={handleDeleteLog}
                  />

                  {hasMore && (
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
                          <>더 많은 일지 불러오기</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                  <Plus className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900">새 안전일지 작성</h2>
                  <p className="text-sm font-medium text-gray-500">오늘의 안전 정보를 기록하세요.</p>
                </div>
              </div>
              <LogForm onSubmit={handleCreateLog} onCancel={() => setView('list')} submitting={isSubmitting} />
            </motion.div>
          )}

          {view === 'detail' && selectedLog && (
            <motion.div key="detail" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
              <LogDetail
                log={selectedLog}
                onEdit={(log) => {
                  setSelectedLog(log);
                  setView('edit');
                }}
                onDelete={handleDeleteLog}
                onBack={() => setView('list')}
              />
            </motion.div>
          )}

          {view === 'edit' && selectedLog && (
            <motion.div
              key="edit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-100">
                  <Edit className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900">안전일지 수정</h2>
                  <p className="text-sm font-medium text-gray-500">{selectedLog.date} 일지 내용을 수정합니다.</p>
                </div>
              </div>
              <LogForm
                initialData={selectedLog}
                onSubmit={handleUpdateLog}
                onCancel={() => setView('detail')}
                submitting={isSubmitting}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
