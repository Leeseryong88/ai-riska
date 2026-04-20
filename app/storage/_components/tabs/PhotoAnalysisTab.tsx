'use client';

import React, { useState, useEffect } from 'react';
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
  DocumentData
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { Trash2, ExternalLink, Calendar, Info, Printer, Edit2, Check, X, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PhotoAnalysisRecord {
  id: string;
  userId: string;
  createdAt: any;
  title: string;
  imageUrl?: string;
  analysis: {
    risk_factors: string[];
    engineering_improvements: string[];
    management_improvements: string[];
  };
}

export function PhotoAnalysisTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<PhotoAnalysisRecord[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedItem, setSelectedItem] = useState<PhotoAnalysisRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAnalysis, setEditAnalysis] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const ITEMS_PER_PAGE = 10;

  const fetchItems = async (isNextPage = false) => {
    if (!user) return;

    try {
      if (!isNextPage) setLoading(true);
      else setLoadingMore(true);

      let q = query(
        collection(db, 'photoAnalysis'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(ITEMS_PER_PAGE)
      );

      if (isNextPage && lastDoc) {
        q = query(
          collection(db, 'photoAnalysis'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(ITEMS_PER_PAGE)
        );
      }

      const querySnapshot = await getDocs(q);
      const newItems = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PhotoAnalysisRecord[];

      if (isNextPage) {
        setItems(prev => [...prev, ...newItems]);
      } else {
        setItems(newItems);
      }

      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMore(querySnapshot.docs.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching photo analysis:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [user]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('정말로 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'photoAnalysis', id));
      setItems(prev => prev.filter(item => item.id !== id));
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
    setEditAnalysis(JSON.parse(JSON.stringify(selectedItem.analysis)));
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
  };

  const handleAnalysisChange = (category: string, index: number, value: string) => {
    const newAnalysis = { ...editAnalysis };
    newAnalysis[category][index] = value;
    setEditAnalysis(newAnalysis);
  };

  const addAnalysisItem = (category: string) => {
    const newAnalysis = { ...editAnalysis };
    newAnalysis[category] = [...newAnalysis[category], ''];
    setEditAnalysis(newAnalysis);
  };

  const removeAnalysisItem = (category: string, index: number) => {
    const newAnalysis = { ...editAnalysis };
    newAnalysis[category] = newAnalysis[category].filter((_: any, i: number) => i !== index);
    setEditAnalysis(newAnalysis);
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, 'photoAnalysis', selectedItem.id);
      await updateDoc(docRef, {
        title: editTitle,
        analysis: editAnalysis
      });

      setItems(prev => prev.map(item => 
        item.id === selectedItem.id 
          ? { ...item, title: editTitle, analysis: editAnalysis }
          : item
      ));
      setSelectedItem(prev => prev ? { ...prev, title: editTitle, analysis: editAnalysis } : null);
      setIsEditing(false);
      alert('수정되었습니다.');
    } catch (error) {
      console.error('Error updating photo analysis:', error);
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

    const { risk_factors, engineering_improvements, management_improvements } = selectedItem.analysis;

    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedItem.title}</title>
          <style>
            body { 
              font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; 
              padding: 40px;
              color: #333;
              line-height: 1.6;
            }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .header h1 { font-size: 28pt; margin: 0; }
            .info { text-align: right; margin-bottom: 30px; font-size: 11pt; color: #666; }
            .section { margin-bottom: 30px; }
            .section h2 { font-size: 18pt; border-left: 5px solid #333; padding-left: 15px; margin-bottom: 15px; }
            .list-item { margin-bottom: 10px; padding-left: 20px; position: relative; }
            .list-item:before { content: "•"; position: absolute; left: 0; font-weight: bold; }
            .image-container { text-align: center; margin-bottom: 40px; }
            .image-container img { max-width: 100%; max-height: 400px; border: 1px solid #ddd; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>사진 위험 분석 결과 보고서</h1>
          </div>
          <div class="info">
            제목: ${selectedItem.title}<br/>
            생성일: ${formatDate(selectedItem.createdAt)}
          </div>
          
          ${selectedItem.imageUrl ? `
            <div class="image-container">
              <img src="${selectedItem.imageUrl}" />
            </div>
          ` : ''}

          <div class="section">
            <h2>1. 위험 요인</h2>
            ${risk_factors.map(item => `<div class="list-item">${item}</div>`).join('')}
          </div>

          <div class="section">
            <h2>2. 공학적 개선 방안</h2>
            ${engineering_improvements.map(item => `<div class="list-item">${item}</div>`).join('')}
          </div>

          <div class="section">
            <h2>3. 관리적 개선 방안</h2>
            ${management_improvements.map(item => `<div class="list-item">${item}</div>`).join('')}
          </div>

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
          <p className="text-gray-500 font-bold">저장된 분석 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 text-xs font-black text-gray-500 uppercase tracking-wider">
            <div className="col-span-1 text-center">번호</div>
            <div className="col-span-5">제목</div>
            <div className="col-span-3 text-center">생성일</div>
            <div className="col-span-2 text-center">위험요인</div>
            <div className="col-span-1 text-center">작업</div>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((item, index) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setSelectedItem(item)}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-amber-50/30 transition-all cursor-pointer items-center"
              >
                <div className="hidden md:flex md:col-span-1 items-center justify-center">
                  <span className="text-sm font-black text-amber-600">{index + 1}</span>
                </div>
                <div className="col-span-1 md:col-span-5 flex items-center gap-3">
                  <div className="md:hidden w-8 h-8 shrink-0 rounded-lg bg-amber-100 flex items-center justify-center">
                    <span className="text-xs font-black text-amber-600">{index + 1}</span>
                  </div>
                  <div className="hidden md:flex w-10 h-10 rounded-lg bg-amber-100 items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 line-clamp-1">{item.title || '제목 없음'}</h3>
                    <div className="md:hidden mt-1 flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                      {formatDate(item.createdAt)}
                    </div>
                  </div>
                </div>
                
                <div className="hidden md:flex md:col-span-3 items-center justify-center text-xs font-bold text-gray-500">
                  {formatDate(item.createdAt)}
                </div>
                
                <div className="col-span-1 md:col-span-2 flex md:justify-center items-center gap-2">
                  <span className="md:hidden text-[10px] text-gray-400 font-bold">위험요인:</span>
                  <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full font-bold">
                    {item.analysis.risk_factors.length}건
                  </span>
                </div>

                <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center gap-2">
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="p-2 text-amber-600">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => fetchItems(true)}
            disabled={loadingMore}
            className="px-8 py-3 bg-white border border-gray-200 rounded-xl text-sm font-black text-gray-600 hover:border-amber-500 hover:text-amber-600 transition-all disabled:opacity-50"
          >
            {loadingMore ? '로딩 중...' : '더 보기'}
          </button>
        </div>
      )}

      {/* Detail Modal */}
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

              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
                {selectedItem.imageUrl && (
                  <div className="relative aspect-video rounded-2xl overflow-hidden border border-gray-100">
                    <img 
                      src={selectedItem.imageUrl} 
                      alt="분석 대상"
                      className="w-full h-full object-contain bg-slate-50"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6">
                  {(['risk_factors', 'engineering_improvements', 'management_improvements'] as const).map((category) => (
                    <section key={category}>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                          <div className={`w-2 h-6 rounded-full ${
                            category === 'risk_factors' ? 'bg-red-500' : 
                            category === 'engineering_improvements' ? 'bg-blue-500' : 'bg-emerald-500'
                          }`} />
                          {category === 'risk_factors' ? '위험 요인' : 
                           category === 'engineering_improvements' ? '공학적 개선 방안' : '관리적 개선 방안'} 
                          ({isEditing ? editAnalysis[category].length : selectedItem.analysis[category].length})
                        </h3>
                        {isEditing && (
                          <button
                            onClick={() => addAnalysisItem(category)}
                            className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                            title="항목 추가"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className={`rounded-2xl p-4 border space-y-2 ${
                        category === 'risk_factors' ? 'bg-red-50/50 border-red-100' : 
                        category === 'engineering_improvements' ? 'bg-blue-50/50 border-blue-100' : 'bg-emerald-50/50 border-emerald-100'
                      }`}>
                        {(isEditing ? editAnalysis[category] : selectedItem.analysis[category]).map((item: string, idx: number) => (
                          <div key={idx} className="flex gap-3 items-start group">
                            <span className={`font-black shrink-0 mt-0.5 text-sm ${
                              category === 'risk_factors' ? 'text-red-500' : 
                              category === 'engineering_improvements' ? 'text-blue-500' : 'text-emerald-500'
                            }`}>{idx + 1}.</span>
                            
                            {isEditing ? (
                              <div className="flex-1 flex gap-2">
                                <textarea
                                  value={item}
                                  onChange={(e) => handleAnalysisChange(category, idx, e.target.value)}
                                  className="flex-1 p-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                  rows={2}
                                />
                                <button
                                  onClick={() => removeAnalysisItem(category, idx)}
                                  className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-700 leading-relaxed">{item}</div>
                            )}
                          </div>
                        ))}
                        {(isEditing ? editAnalysis[category] : selectedItem.analysis[category]).length === 0 && (
                          <div className="text-sm text-gray-400 text-center py-4 italic">등록된 항목이 없습니다.</div>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
