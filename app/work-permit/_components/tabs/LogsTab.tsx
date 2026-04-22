'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, getDocs, orderBy, where, Timestamp, limit, startAfter, QueryDocumentSnapshot, DocumentData, doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/app/lib/firebase';
import { VisitorLog, VisitPurpose } from '../../_lib/types';
import { Card, Button, Label, Input } from '../ui/Button';
import { uploadBase64 } from '../../_lib/storage';
import { Filter, Download, Eye, X, Loader2, Calendar, PenTool, Save, ClipboardList, Printer, ShieldAlert } from 'lucide-react';
import dynamic from 'next/dynamic';

const SignaturePad = dynamic(() => import('../SignaturePad').then(mod => mod.SignaturePad), { ssr: false });

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../_lib/utils';
import { Pagination } from '@/components/ui/Pagination';
// @ts-ignore
// import html2pdf from 'html2pdf.js'; // Moved to dynamic import inside handlePrint

export const LogsTab: React.FC = () => {
  const [logs, setLogs] = useState<VisitorLog[]>([]);
  const [purposes, setPurposes] = useState<VisitPurpose[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurposeId, setSelectedPurposeId] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<VisitorLog | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);
  const [adminSignData, setAdminSignData] = useState<string>('');
  const [savingSign, setSavingSign] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [showUnsignedOnly, setShowUnsignedOnly] = useState(false);
  
  // Date filter states
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [originalDates, setOriginalDates] = useState<{start: string, end: string} | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchPurposes(user.uid);
        fetchLogs(startDate, endDate, user.uid);
      } else {
        setPurposes([]);
        setLogs([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchPurposes = async (uid?: string) => {
    const userId = uid || auth.currentUser?.uid;
    if (!userId) return;
    try {
      const q = query(collection(db, 'purposes'), where('ownerId', '==', userId));
      const snapshot = await getDocs(q);
      setPurposes(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as VisitPurpose)));
    } catch (error) {
      console.error('Error fetching purposes:', error);
    }
  };

  const FETCH_BATCH = 150;
  const LIST_PAGE_SIZE = 10;

  const fetchLogs = async (sDate = startDate, eDate = endDate, uid?: string) => {
    const userId = uid || auth.currentUser?.uid;
    if (!userId) return;

    setLoading(true);

    try {
      const aggregated: VisitorLog[] = [];
      let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
      while (true) {
        let q = query(
          collection(db, 'logs'),
          where('ownerId', '==', userId),
          where('data.work_start', '>=', sDate),
          where('data.work_start', '<=', eDate + 'T23:59:59'),
          orderBy('data.work_start', 'desc'),
          limit(FETCH_BATCH)
        );
        if (cursor) q = query(q, startAfter(cursor));

        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        aggregated.push(
          ...snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as VisitorLog))
        );
        if (snapshot.docs.length < FETCH_BATCH) break;
        cursor = snapshot.docs[snapshot.docs.length - 1];
      }

      setLogs(aggregated);
      setListPage(1);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    fetchLogs();
    setIsFilterOpen(false);
  };

  const handlePrint = async () => {
    const element = document.getElementById('permit-document');
    if (!element || !selectedLog) return;

    // Dynamic import for html2pdf to avoid SSR issues
    const html2pdf = (await import('html2pdf.js' as any)).default;

    setIsPrinting(true);
    try {
      const widthPx = element.offsetWidth;
      const heightPx = element.offsetHeight;
      const pdfWidthMm = 210;
      const pdfHeightMm = (heightPx * pdfWidthMm) / widthPx + 0.5;
      
      const opt = {
        margin: 0,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          scrollY: 0,
          windowWidth: widthPx
        },
        jsPDF: { 
          unit: 'mm', 
          format: [pdfWidthMm, pdfHeightMm] as any,
          orientation: 'portrait' 
        },
        pagebreak: { mode: ['avoid-all'] }
      };

      // PDF 객체를 생성하여 새 창에서 인쇄 대화상자 실행
      const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(blobUrl, '_blank');
      
      if (printWindow) {
        // 새 창이 로드되면 인쇄 실행 (일부 브라우저는 자동 실행 안될 수 있음)
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
    } catch (error) {
      console.error('Print error:', error);
      alert('인쇄 준비 중 오류가 발생했습니다.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleResetFilter = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setStartDate(today);
    setEndDate(today);
    fetchLogs(today, today);
    setIsFilterOpen(false);
  };

  const handleAdminSign = async () => {
    if (!selectedLog || !adminSignData || !auth.currentUser) return;
    setSavingSign(true);
    try {
      const signatureUrl = await uploadBase64(
        `logs/${auth.currentUser.uid}/admin_sign_${selectedLog.id}_${Date.now()}.png`,
        adminSignData
      );

      await updateDoc(doc(db, 'logs', selectedLog.id), {
        adminSignature: signatureUrl,
        adminSignedAt: serverTimestamp()
      });

      // Update local state
      setLogs(prev => prev.map(l => 
        l.id === selectedLog.id 
          ? { ...l, adminSignature: signatureUrl, adminSignedAt: Timestamp.now() } 
          : l
      ));
      setSelectedLog(prev => prev ? { ...prev, adminSignature: signatureUrl, adminSignedAt: Timestamp.now() } : null);
      setShowSignModal(false);
      setAdminSignData('');
      alert('서명이 완료되었습니다.');
    } catch (error) {
      console.error('Error saving admin signature:', error);
      alert('서명 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingSign(false);
    }
  };

  const handleDeleteLog = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('삭제하시겠습니까?')) return;
    
    try {
      await deleteDoc(doc(db, 'logs', id));
      setLogs(prev => prev.filter(l => l.id !== id));
      if (selectedLog?.id === id) setSelectedLog(null);
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting log:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const toggleUnsignedOnly = () => {
    const nextState = !showUnsignedOnly;
    setShowUnsignedOnly(nextState);

    if (nextState) {
      // 모든 날짜를 보기 위해 아주 넓은 범위로 설정
      setOriginalDates({ start: startDate, end: endDate });
      const wideStart = '1900-01-01';
      const wideEnd = '2100-12-31';
      setStartDate(wideStart);
      setEndDate(wideEnd);
      fetchLogs(wideStart, wideEnd);
    } else {
      // 이전 날짜 필터로 복구 (기본은 오늘)
      const prevStart = originalDates?.start || format(new Date(), 'yyyy-MM-dd');
      const prevEnd = originalDates?.end || format(new Date(), 'yyyy-MM-dd');
      setStartDate(prevStart);
      setEndDate(prevEnd);
      fetchLogs(prevStart, prevEnd);
      setOriginalDates(null);
    }
  };

  const filteredLogs = logs.filter(log => 
    (selectedPurposeId === 'all' || log.purposeId === selectedPurposeId) &&
    (!showUnsignedOnly || !log.adminSignature)
  );

  const listTotalPages = Math.max(1, Math.ceil(filteredLogs.length / LIST_PAGE_SIZE));

  useEffect(() => {
    setListPage(1);
  }, [selectedPurposeId, showUnsignedOnly]);

  useEffect(() => {
    if (listPage > listTotalPages) setListPage(listTotalPages);
  }, [listPage, listTotalPages]);

  const pagedLogs = useMemo(() => {
    const start = (listPage - 1) * LIST_PAGE_SIZE;
    return filteredLogs.slice(start, start + LIST_PAGE_SIZE);
  }, [filteredLogs, listPage]);

  const getFieldLabel = (key: string, log: VisitorLog) => {
    // 1. 해당 로그의 purpose 찾기
    const purpose = purposes.find(p => p.id === log.purposeId);
    if (purpose && purpose.fields) {
      const field = purpose.fields.find(f => f.id === key);
      if (field) return field.label;
    }

    // 2. 공통 필드 매핑 (예비용 및 하드코딩된 필드)
    const commonMap: Record<string, string> = {
      work_start: '작업 시작 일시',
      work_end: '작업 종료 예정 일시',
      work_start_date: '작업 시작일',
      work_start_time: '시작 시간',
      work_end_date: '작업 종료일',
      work_end_time: '종료 예상 시간',
      worker_company: '소속 (업체명)',
      company: '소속 (업체명)',
      worker_name: '작업자 성함',
      worker_contact: '작업자 연락처',
      work_location: '상세 작업 장소',
      hot_work_type: '작업 종류',
      watcher_name: '화재감시자 성함',
      check_combustibles: '가연물 제거 및 방염시트 설치',
      check_extinguisher: '소화기 비치 상태',
      gas_check: '인화성 가스 농도 측정',
      oxygen_level: '산소 농도 (%)',
      gas_levels: '유해가스 농도 (CO, H2S 등)',
      ventilation: '환기 설비 가동 상태',
      rescue_gear: '구조 장비 및 보호구 확보',
      energy_type: '차단 에너지 종류',
      lock_id: '잠금 장치(Lock) 번호',
      tag_check: '표식(Tag) 부착 상태',
      residual_energy: '잔류 에너지 제거 상태',
      work_height: '작업 높이 (m)',
      harness_check: '안전대(하네스) 착용 및 고리체결',
      scaffold_check: '작업발판/비계 상태 점검',
      weather_check: '기상 조건 확인 (강풍 등)',
      dig_depth: '굴착 깊이 (m)',
      underground_check: '지하 매설물 사전 조사',
      shoring_check: '흙막이/지보공 설치 상태',
      access_control: '접근 금지 구역 설정',
      load_weight: '중량물 무게 (ton)',
      signal_person: '신호수 지정 및 배치',
      gear_check: '와이어/슬링 상태 점검',
      radius_control: '작업 반경 출입 통제',
      chemical_name: '취급 화학물질 명칭',
      msds_check: 'MSDS 내용 숙지 및 비치',
      ppe_check: '전용 보호구 착용 확인',
      emergency_plan: '비상 조치 계획 및 장비',
    };

    return commonMap[key] || key;
  };

  return (
    <div className="space-y-8 print:p-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">허가서 제출 내역</h1>
          <p className="text-sm text-gray-500">작업 시작일 기준으로 제출된 허가서 기록을 확인합니다.</p>
        </div>
      </div>

      <Card className="p-3 md:p-4 print:hidden">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <div className="relative flex-1">
            <div className="flex items-center w-full h-11 md:h-10 bg-white border border-gray-300 rounded-md px-3 gap-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
              <ClipboardList className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select
                className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-700 cursor-pointer h-full"
                value={selectedPurposeId}
                onChange={(e) => setSelectedPurposeId(e.target.value)}
              >
                <option value="all">모든 작업 허가서</option>
                {purposes.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <Button 
            variant="outline" 
            className={cn(
              "gap-2 w-full md:min-w-[200px] justify-start font-normal h-11 md:h-10",
              isFilterOpen && "border-blue-500 ring-1 ring-blue-500"
            )}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="flex-1 text-left truncate flex items-center gap-2">
              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold border border-blue-100 flex-shrink-0">
                {showUnsignedOnly ? '모든 날짜' : '시작일 기준'}
              </span>
              {showUnsignedOnly ? '전체 기간 데이터' : (startDate === endDate ? startDate : `${startDate} ~ ${endDate}`)}
            </span>
          </Button>
          <Button
            variant={showUnsignedOnly ? 'primary' : 'outline'}
            className={cn(
              "gap-2 w-full md:w-auto font-bold h-11 md:h-10 transition-all shrink-0 px-3",
              showUnsignedOnly ? "bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm shadow-red-100" : "text-slate-600"
            )}
            onClick={toggleUnsignedOnly}
          >
            <ShieldAlert className={cn("w-4 h-4", showUnsignedOnly ? "text-white" : "text-red-500")} />
            <span className="text-xs">{showUnsignedOnly ? '목록 보기' : '미서명만'}</span>
            {logs.filter(l => !l.adminSignature).length > 0 && !showUnsignedOnly && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white ml-0.5">
                {logs.filter(l => !l.adminSignature).length}
              </span>
            )}
          </Button>
        </div>

        <AnimatePresence>
          {isFilterOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-gray-100 flex flex-col md:flex-row items-end gap-4">
                <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-gray-400">작업 시작일 (부터)</Label>
                    <Input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-gray-400">작업 시작일 (까지)</Label>
                    <Input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <Button variant="ghost" onClick={handleResetFilter} className="flex-1 md:flex-none">초기화</Button>
                  <Button onClick={handleApplyFilter} className="flex-1 md:flex-none gap-2">
                    <Filter className="w-4 h-4" /> 필터 적용
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">작업 종류</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">작업일시</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">작업자명</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">연락처</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">제출 일시</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-500">
                    기록이 없습니다.
                  </td>
                </tr>
              ) : (
                pagedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 w-fit">
                          {log.purposeName}
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium ml-1">
                          {log.data?.worker_company || log.data?.company || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="text-xs space-y-0.5">
                        <p>{log.data?.work_start ? format(new Date(log.data.work_start), 'yyyy-MM-dd HH:mm') : (log.data?.work_start_date || '-')}</p>
                        <p className="text-gray-400">~ {log.data?.work_end ? format(new Date(log.data.work_end), 'yyyy-MM-dd HH:mm') : (log.data?.work_end_date || '-')}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{log.visitorName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{log.visitorContact}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {log.visitDate?.toDate ? format(log.visitDate.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {log.adminSignature ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-100">
                            허가
                          </span>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-2 text-[10px] gap-1 bg-blue-50 text-blue-700 border-blue-100"
                            onClick={() => {
                              setSelectedLog(log);
                              setShowSignModal(true);
                            }}
                          >
                            <PenTool className="w-3 h-3" /> 서명
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-2 text-[10px] gap-1 bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
                          onClick={(e) => handleDeleteLog(log.id, e)}
                        >
                          <X className="w-3 h-3" /> 반려
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3 print:hidden">
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
            기록이 없습니다.
          </div>
        ) : (
          pagedLogs.map((log) => (
            <Card key={log.id} className="p-4" onClick={() => setSelectedLog(log)}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase w-fit">
                    {log.purposeName}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium ml-1">
                    {log.data?.worker_company || log.data?.company || '소속 정보 없음'}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 font-medium">
                  {log.visitDate?.toDate ? format(log.visitDate.toDate(), 'HH:mm', { locale: ko }) : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{log.visitorName}</h3>
                  <p className="text-xs text-gray-500 mt-1">{log.visitorContact}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400">
                    {log.visitDate?.toDate ? format(log.visitDate.toDate(), 'MM/dd', { locale: ko }) : '-'}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    {log.adminSignature ? (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                        허가
                      </span>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 px-1.5 text-[9px] gap-1 bg-blue-50 text-blue-700 border-blue-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                          setShowSignModal(true);
                        }}
                      >
                        <PenTool className="w-2.5 h-2.5" /> 서명
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 px-1.5 text-[9px] gap-1 bg-red-50 text-red-600 border-red-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLog(log.id, e);
                      }}
                    >
                      <X className="w-2.5 h-2.5" /> 반려
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Eye className="w-4 h-4 text-gray-400" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Pagination
        page={listPage}
        totalPages={listTotalPages}
        onChange={setListPage}
        accentClass="bg-blue-600 text-white border-blue-600"
      />

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-5xl md:max-h-[95vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 md:px-8 md:py-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 shadow-sm">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  허가서 제출 상세 내역
                </h2>
                <div className="flex items-center gap-2">
                  {!selectedLog.adminSignature && (
                    <Button variant="outline" size="sm" className="flex gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" onClick={() => setShowSignModal(true)}>
                      <PenTool className="w-4 h-4" /> 승인 서명
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="hidden md:flex gap-2" onClick={handlePrint} isLoading={isPrinting}>
                    <Printer className="w-4 h-4" /> 인쇄
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSelectedLog(null)}>
                    <X className="w-5 h-5 text-gray-400" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-10 pb-24 md:pb-12 bg-gray-200/50 print:bg-white print:p-0">
                {/* Document Style Container */}
                <div id="permit-document" className="bg-white border border-gray-300 shadow-xl rounded-none md:rounded-sm p-8 md:p-16 w-full max-w-[210mm] mx-auto min-h-[297mm] print:border-0 print:shadow-none print:p-0 print:max-w-none">
                  {/* Document Header */}
                  <div className="text-center space-y-4 mb-12 border-b-4 border-double border-gray-900 pb-8">
                    <h1 className="text-3xl font-black text-gray-900 tracking-[0.2em] underline underline-offset-8">안전작업 허가서</h1>
                    <div className="flex justify-between items-end pt-4">
                      <p className="text-sm font-bold text-gray-500">문서번호: PERMIT-{selectedLog.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </div>

                  {/* Basic Info Table */}
                  <section className="mb-10">
                    <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-gray-900" />
                      1. 기본 인적 사항
                    </h3>
                    <div className="grid grid-cols-2 border-t-2 border-gray-900">
                      <div className="border-b border-r border-gray-200 p-3 bg-gray-50/50">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">소속 (업체명)</p>
                        <p className="text-sm font-bold text-gray-900">{selectedLog.data.worker_company || selectedLog.data.company || '-'}</p>
                      </div>
                      <div className="border-b border-gray-200 p-3 bg-gray-50/50">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">작업자 성함</p>
                        <p className="text-sm font-bold text-gray-900">{selectedLog.visitorName}</p>
                      </div>
                      <div className="border-b border-r border-gray-200 p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">연락처</p>
                        <p className="text-sm font-bold text-gray-900">{selectedLog.visitorContact}</p>
                      </div>
                      <div className="border-b border-gray-200 p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">작업 종류</p>
                        <p className="text-sm font-bold text-blue-700">{selectedLog.purposeName}</p>
                      </div>
                      <div className="col-span-2 border-b border-gray-200 p-3 bg-gray-50/50">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">제출 일시</p>
                        <p className="text-sm font-bold text-gray-900">
                          {selectedLog.visitDate?.toDate ? format(selectedLog.visitDate.toDate(), 'yyyy-MM-dd HH:mm') : '-'}
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Safety Info Section */}
                  {selectedLog.safetyInfoSnapshot && (
                    <section className="mb-10">
                      <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                        <div className="w-1 h-4 bg-gray-900" />
                        2. 위험요인 및 안전 주의사항 (숙지 확인됨)
                      </h3>
                      <div className="border border-gray-200 p-4 rounded-sm space-y-4 bg-gray-50/30">
                        {selectedLog.safetyInfoSnapshot.hazards && selectedLog.safetyInfoSnapshot.hazards.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-red-500 mb-2">● 주요 위험요인</p>
                            <ul className="grid grid-cols-1 gap-1">
                              {selectedLog.safetyInfoSnapshot.hazards.map((h, i) => (
                                <li key={i} className="text-[11px] text-gray-600 flex items-start gap-1">
                                  <span>-</span> {h}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {selectedLog.safetyInfoSnapshot.precautions && selectedLog.safetyInfoSnapshot.precautions.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-blue-500 mb-2">● 안전 주의사항</p>
                            <ul className="grid grid-cols-1 gap-1">
                              {selectedLog.safetyInfoSnapshot.precautions.map((p, i) => (
                                <li key={i} className="text-[11px] text-gray-600 flex items-start gap-1">
                                  <span>-</span> {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Dynamic Data Section */}
                  <section className="mb-10">
                    <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-gray-900" />
                      3. 작업 상세 내용 및 체크리스트
                    </h3>
                    <div className="border-t border-gray-200">
                      {/* 통합된 작업 기간 표시 */}
                      {(selectedLog.data.work_start || selectedLog.data.work_start_date) && (
                        <div className="flex border-b border-gray-200 min-h-[40px]">
                          <div className="w-1/3 bg-gray-50/50 p-2 flex items-center border-r border-gray-200">
                            <span className="text-[10px] font-bold text-gray-500">작업 기간</span>
                          </div>
                          <div className="w-2/3 p-2 flex items-center">
                            <div className="text-xs font-medium text-gray-900">
                              {selectedLog.data.work_start ? (
                                `${format(new Date(selectedLog.data.work_start), 'yyyy-MM-dd HH:mm')} ~ ${selectedLog.data.work_end ? format(new Date(selectedLog.data.work_end), 'yyyy-MM-dd HH:mm') : '-'}`
                              ) : (
                                `${selectedLog.data.work_start_date} ${selectedLog.data.work_start_time} ~ ${selectedLog.data.work_end_date} ${selectedLog.data.work_end_time}`
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {Object.entries(selectedLog.data).map(([key, value]) => {
                        const skipKeys = [
                          'name', 'contact', 'worker_name', 'worker_contact', 'visitorName', 'visitorContact',
                          'work_start_date', 'work_start_time', 'work_end_date', 'work_end_time',
                          'work_start', 'work_end'
                        ];
                        if (skipKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) return null;

                        return (
                          <div key={key} className="flex border-b border-gray-200 min-h-[40px]">
                            <div className="w-1/3 bg-gray-50/50 p-2 flex items-center border-r border-gray-200">
                              <span className="text-[10px] font-bold text-gray-500">{getFieldLabel(key, selectedLog)}</span>
                            </div>
                            <div className="w-2/3 p-2 flex items-center">
                              <div className="text-xs font-medium text-gray-900">
                                {typeof value === 'string' && value.startsWith('data:image/') ? (
                                  <img 
                                    src={value} 
                                    alt={key} 
                                    className="h-24 w-auto object-contain rounded-sm border border-gray-100"
                                  />
                                ) : Array.isArray(value) ? (
                                  <div className="flex flex-wrap gap-1">
                                    {value.map((v, i) => (
                                      <span key={i} className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] border border-gray-200">✓ {v}</span>
                                    ))}
                                  </div>
                                ) : typeof value === 'boolean' ? (
                                  value ? '예' : '아니오'
                                ) : (
                                  String(value)
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Signature Section */}
                  <section className="mt-16 pt-10 border-t-2 border-gray-900">
                    <div className="flex flex-col items-center space-y-6">
                      <p className="text-sm font-bold text-gray-900 text-center">위와 같이 안전작업 허가서를 제출하며, 안전 수칙을 준수할 것을 서약합니다.</p>
                      <div className="flex items-center gap-12">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-gray-400 mb-2">작업자 확인</p>
                          <div className="relative w-32 h-20 border border-gray-100 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                            <img src={selectedLog.signature} alt="Signature" className="h-full w-full object-contain mix-blend-multiply" crossOrigin="anonymous" />
                            <p className="absolute bottom-1 right-2 text-[8px] text-gray-300">(인)</p>
                          </div>
                          <p className="text-xs font-bold mt-2 text-gray-900">{selectedLog.visitorName}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-gray-400 mb-2">안전관리자 확인</p>
                          <div className="relative w-32 h-20 border border-gray-100 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                            {selectedLog.adminSignature ? (
                              <>
                                <img src={selectedLog.adminSignature} alt="Admin Signature" className="h-full w-full object-contain mix-blend-multiply" crossOrigin="anonymous" />
                                <p className="absolute bottom-1 right-2 text-[8px] text-gray-300">(인)</p>
                              </>
                            ) : (
                              <span className="text-[10px] text-gray-300 italic">서명 대기</span>
                            )}
                          </div>
                          <p className="text-xs font-bold mt-2 text-gray-400">
                            {selectedLog.adminSignedAt ? format(selectedLog.adminSignedAt.toDate ? selectedLog.adminSignedAt.toDate() : selectedLog.adminSignedAt, 'MM/dd HH:mm') : '(서명)'}
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 pt-8">제출일: {format(selectedLog.visitDate.toDate(), 'yyyy년 MM월 dd일 HH시 mm분', { locale: ko })}</p>
                    </div>
                  </section>
                </div>
              </div>

              <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50 sticky bottom-0 z-10 print:hidden">
                <div className="flex gap-3">
                  <Button className="flex-1 h-12 md:h-10" variant="outline" onClick={() => setSelectedLog(null)}>
                    닫기
                  </Button>
                  <Button className="flex-1 h-12 md:h-10 gap-2" onClick={handlePrint} isLoading={isPrinting}>
                    <Printer className="w-4 h-4" /> 인쇄하기
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Signing Modal */}
      <AnimatePresence>
        {showSignModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">안전관리자 승인 서명</h2>
                <button onClick={() => setShowSignModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6">
                <SignaturePad
                  onSave={(data) => setAdminSignData(data)}
                  onClear={() => setAdminSignData('')}
                />
                <p className="text-xs text-gray-400 mt-4 text-center">
                  위 작업의 내용을 확인하였으며, 작업을 승인합니다.
                </p>
              </div>
              <div className="p-6 bg-gray-50 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowSignModal(false)}>취소</Button>
                <Button 
                  className="flex-1 gap-2" 
                  onClick={handleAdminSign}
                  disabled={!adminSignData || savingSign}
                  isLoading={savingSign}
                >
                  <Save className="w-4 h-4" /> 서명 완료
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            font-size: 10pt; /* Scale down base font size for printing */
          }
          /* Hide all UI elements */
          nav, aside, header, footer, .print-hidden, 
          .fixed:not(.print-visible), .sticky:not(.print-visible),
          button:not(.print-visible) {
            display: none !important;
          }
          /* Reset overflow and height */
          html, body, #__next, main, .overflow-y-auto {
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            position: static !important;
          }
          /* Specific handling for the modal background and container */
          .fixed.inset-0 {
            position: static !important;
            background: none !important;
            padding: 0 !important;
            display: block !important;
          }
          /* The document itself */
          .md\:max-w-5xl {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            position: static !important;
            display: block !important;
            transform: scale(0.95); /* Slightly scale down to fit on one page */
            transform-origin: top center;
          }
          /* Fix for document pages */
          .print\:bg-white {
            background-color: white !important;
            padding: 0 !important;
          }
          .print\:p-0 {
            padding: 0 !important;
          }
          .print\:max-w-none {
            max-width: 100% !important;
            width: 100% !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important; /* Remove large padding for print */
          }
          /* Prevent sections from being split across pages if possible */
          section {
            page-break-inside: avoid;
            margin-bottom: 5mm !important;
          }
          .mb-10, .mb-12 {
            margin-bottom: 5mm !important;
          }
          .mt-16 {
            margin-top: 5mm !important;
          }
          /* Ensure text colors are printed */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Make tables more compact for printing */
          .grid, .flex {
            gap: 2px !important;
          }
          .p-3, .p-4, .p-6, .p-8, .p-12, .p-16 {
            padding: 4px !important;
          }
          h1 { font-size: 20pt !important; margin-bottom: 10px !important; }
          h3 { font-size: 11pt !important; margin-bottom: 5px !important; }
          .text-3xl { font-size: 18pt !important; }
          .text-sm { font-size: 9pt !important; }
          .text-xs { font-size: 8pt !important; }
          
          /* Ensure signature images are visible and not too large */
          img {
            max-height: 60px !important;
            width: auto !important;
          }
        }
      `}</style>
    </div>
  );
};
