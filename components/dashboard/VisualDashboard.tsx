'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getCountFromServer,
  orderBy, 
  limit
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, 
  Users, 
  ShieldAlert, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  ClipboardList,
  UserPlus,
  MessageSquare,
  Check,
  AlertCircle,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths, 
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/app/work-permit/_components/ui/Button';

// --- Types ---
interface MeetingMini {
  id: string;
  type: 'oshc' | 'partner_council';
  title: string;
  date: string;
  year?: number;
  quarter?: number;
  month?: number;
}

interface DashboardData {
  totalLogs: number;
  permitApproved: number;
  permitTotal: number;
  totalPartners: number;
  feedbackAcknowledged: number;
  feedbackTotal: number;
  logDates: Map<string, number>;
  permitCounts: Map<string, number>;
  safetyLogs: any[];
  workPermits: any[];
  meetings: MeetingMini[];
}

export default function VisualDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'permit' | 'log'>('permit');
  const [data, setData] = useState<DashboardData>({
    totalLogs: 0,
    permitApproved: 0,
    permitTotal: 0,
    totalPartners: 0,
    feedbackAcknowledged: 0,
    feedbackTotal: 0,
    logDates: new Map(),
    permitCounts: new Map(),
    safetyLogs: [],
    workPermits: [],
    meetings: []
  });
  const [meetingYear, setMeetingYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(format(new Date(), 'yyyy-MM-dd'));

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const visibleStart = startOfWeek(startOfMonth(currentMonth));
      const visibleEnd = endOfDay(endOfWeek(endOfMonth(currentMonth)));
      const visibleStartKey = format(visibleStart, 'yyyy-MM-dd');
      const visibleEndKey = format(visibleEnd, 'yyyy-MM-dd');

      const logsRef = collection(db, 'safety_logs');
      const logsBaseQuery = query(logsRef, where('managerId', '==', user.uid));
      const logsMonthQuery = query(
        logsBaseQuery,
        where('date', '>=', visibleStartKey),
        where('date', '<=', visibleEndKey),
        limit(200)
      );
      const [logsCountSnapshot, logsSnapshot] = await Promise.all([
        getCountFromServer(logsBaseQuery),
        getDocs(logsMonthQuery),
      ]);
      const safetyLogs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      const logDatesMap = new Map<string, number>();
      safetyLogs.forEach(item => {
        const date = item.date;
        if (date) {
          logDatesMap.set(date, (logDatesMap.get(date) || 0) + 1);
        }
      });

      const permitsRef = collection(db, 'logs');
      const permitsBaseQuery = query(permitsRef, where('ownerId', '==', user.uid));
      const permitsApprovedQuery = query(
        permitsBaseQuery,
        where('adminSignature', '!=', '')
      );
      const permitsMonthQuery = query(
        permitsBaseQuery,
        where('data.work_start', '>=', visibleStartKey),
        where('data.work_start', '<=', `${visibleEndKey}T23:59:59`),
        orderBy('data.work_start', 'desc'),
        limit(200)
      );
      const [permitsCountSnapshot, permitsApprovedSnapshot, permitsSnapshot] = await Promise.all([
        getCountFromServer(permitsBaseQuery),
        getCountFromServer(permitsApprovedQuery),
        getDocs(permitsMonthQuery),
      ]);
      const workPermits = permitsSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      
      const permitCountsMap = new Map<string, number>();
      workPermits.forEach(item => {
        const d = item;
        const startStr = d.data?.work_start || d.data?.work_start_date;
        const endStr = d.data?.work_end || d.data?.work_end_date;
        
        if (startStr) {
          try {
            const start = startOfDay(new Date(startStr));
            const end = endStr ? startOfDay(new Date(endStr)) : start;
            
            // Check if end is before start, or if they are valid
            if (end >= start) {
              const interval = eachDayOfInterval({ start, end });
              interval.forEach(day => {
                const key = format(day, 'yyyy-MM-dd');
                permitCountsMap.set(key, (permitCountsMap.get(key) || 0) + 1);
              });
            } else {
              const key = format(start, 'yyyy-MM-dd');
              permitCountsMap.set(key, (permitCountsMap.get(key) || 0) + 1);
            }
          } catch (e) {
            console.error("Error parsing permit date:", e);
          }
        }
      });

      const partnersRef = collection(db, 'contractor_partners');
      const partnersQuery = query(partnersRef, where('managerId', '==', user.uid));
      const partnersCountSnapshot = await getCountFromServer(partnersQuery);

      const feedbackRef = collection(db, 'worker_feedback_submissions');
      const feedbackQuery = query(feedbackRef, where('managerId', '==', user.uid));
      const feedbackAcknowledgedQuery = query(feedbackQuery, where('acknowledged', '==', true));
      const [feedbackTotalSnapshot, feedbackAcknowledgedSnapshot] = await Promise.all([
        getCountFromServer(feedbackQuery),
        getCountFromServer(feedbackAcknowledgedQuery),
      ]);

      let meetings: MeetingMini[] = [];
      try {
        const meetingsRef = collection(db, 'meeting_minutes');
        const meetingsQuery = query(
          meetingsRef,
          where('managerId', '==', user.uid),
          where('year', '==', meetingYear),
          limit(100)
        );
        const meetingsSnapshot = await getDocs(meetingsQuery);
        meetings = meetingsSnapshot.docs
          .map((d) => {
            const v = d.data() as any;
            return {
              id: d.id,
              type: v.type,
              title: v.title,
              date: v.date,
              year: typeof v.year === 'number' ? v.year : undefined,
              quarter: typeof v.quarter === 'number' ? v.quarter : undefined,
              month: typeof v.month === 'number' ? v.month : undefined,
            } as MeetingMini;
          })
          // 기타 회의 제외 - 법정 2종만 노출
          .filter((m) => m.type === 'oshc' || m.type === 'partner_council');
      } catch (err) {
        // meeting_minutes 권한 미배포 등은 대시보드 전체를 막지 않도록 조용히 무시
        console.warn('[dashboard] meeting_minutes fetch skipped:', (err as any)?.code || err);
      }

      setData({
        totalLogs: logsCountSnapshot.data().count,
        permitApproved: permitsApprovedSnapshot.data().count,
        permitTotal: permitsCountSnapshot.data().count,
        totalPartners: partnersCountSnapshot.data().count,
        feedbackAcknowledged: feedbackAcknowledgedSnapshot.data().count,
        feedbackTotal: feedbackTotalSnapshot.data().count,
        logDates: logDatesMap,
        permitCounts: permitCountsMap,
        safetyLogs,
        workPermits,
        meetings,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, currentMonth, meetingYear]);

  // --- Calendar Logic ---
  const calendarDays = () => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  };

  const filteredPermits = selectedDayKey
    ? data.workPermits.filter(p => {
        const startStr = p.data?.work_start || p.data?.work_start_date;
        const endStr = p.data?.work_end || p.data?.work_end_date;
        if (!startStr) return false;
        try {
          const start = startOfDay(new Date(startStr));
          const end = endStr ? startOfDay(new Date(endStr)) : start;
          const target = startOfDay(new Date(selectedDayKey));
          return target >= start && target <= end;
        } catch { return false; }
      })
    : data.workPermits.slice(0, 10);

  const filteredSafetyLogs = selectedDayKey
    ? data.safetyLogs.filter(l => l.date === selectedDayKey)
    : data.safetyLogs.slice(0, 10);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: '누적 일지', value: `${data.totalLogs}건`, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '작업 허가서', value: `${data.permitApproved} / ${data.permitTotal}`, icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: '협력 업체', value: `${data.totalPartners}개`, icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: '근로자 의견청취', value: `${data.feedbackAcknowledged} / ${data.feedbackTotal}`, icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex flex-col items-center justify-center rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
          >
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${item.bg} ${item.color}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-slate-400">{item.label}</span>
            <span className="mt-1 text-2xl font-black text-slate-900">{item.value}</span>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left Col: Calendar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col h-full"
        >
          <div className="mb-6 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <CalendarIcon className="h-5 w-5 text-purple-600" />
              안전 캘린더
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-slate-50 rounded-lg">
                <ChevronLeft className="h-5 w-5 text-slate-400" />
              </button>
              <span className="text-sm font-black text-slate-700">
                {format(currentMonth, 'yyyy. MM', { locale: ko })}
              </span>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-slate-50 rounded-lg">
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <div key={day} className="text-center text-[10px] font-black text-slate-400 py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 flex-1">
            {calendarDays().map((day, idx) => {
              const isCurrMonth = day.getMonth() === currentMonth.getMonth();
              const key = format(day, 'yyyy-MM-dd');
              const hasLog = data.logDates.get(key);
              const permitCount = data.permitCounts.get(key) || 0;
              const isSelected = selectedDayKey === key;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDayKey(key)}
                  className={`relative flex flex-col items-center justify-start aspect-square rounded-xl p-1 text-[10px] font-bold transition-all cursor-pointer overflow-hidden
                    ${isCurrMonth ? 'text-slate-700' : 'text-slate-200'}
                    ${isSelected ? 'bg-blue-600 text-white shadow-md' : isToday(day) ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-100' : 'hover:bg-slate-50'}
                  `}
                >
                  <span className="mb-0.5 leading-none">{day.getDate()}</span>
                  
                  <div className="flex flex-col gap-0.5 w-full items-center scale-[0.85] origin-top">
                    {hasLog && hasLog > 0 && (
                      <span className={`px-1 py-0.5 rounded-[4px] leading-none whitespace-nowrap ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                        일지({hasLog})
                      </span>
                    )}
                    {permitCount > 0 && (
                      <span className={`px-1 py-0.5 rounded-[4px] leading-none whitespace-nowrap ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                        허가({permitCount})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-6 pt-6 border-t border-slate-50 grid grid-cols-2 gap-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <div className="h-2 w-2 rounded-sm bg-blue-100" />
              <span>일일 안전 일지</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <div className="h-2 w-2 rounded-sm bg-amber-100" />
              <span>작업 허가서</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col h-full"
        >
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                {selectedDayKey === format(new Date(), 'yyyy-MM-dd') 
                  ? '오늘의 정보' 
                  : `${selectedDayKey} 정보`}
              </h3>
              <div className="flex items-center gap-2">
                {selectedDayKey !== format(new Date(), 'yyyy-MM-dd') && (
                  <button 
                    onClick={() => setSelectedDayKey(format(new Date(), 'yyyy-MM-dd'))}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    오늘 보기
                  </button>
                )}
              </div>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 p-1 bg-slate-50 rounded-2xl">
              {[
                { id: 'permit', label: '작업허가서', icon: ClipboardList, count: filteredPermits.length },
                { id: 'log', label: '안전일지', icon: FileText, count: filteredSafetyLogs.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all
                    ${activeTab === tab.id 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'}
                  `}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeTab === 'permit' && (
                <motion.div
                  key="permit"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {filteredPermits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-slate-400">
                      <ClipboardList className="h-10 w-10 mb-2 opacity-20" />
                      <p className="text-sm font-bold">작업허가서가 없습니다.</p>
                    </div>
                  ) : (
                    filteredPermits.map((permit) => {
                      const permitKind =
                        permit.purposeName ||
                        permit.data?.purpose ||
                        '종류 미기재';
                      const workerLabel =
                        permit.visitorName ||
                        permit.data?.worker_name ||
                        '이름 미기재';
                      const companyLabel =
                        permit.data?.worker_company ||
                        permit.data?.company_name ||
                        '업체 미기재';
                      return (
                      <div 
                        key={permit.id}
                        className="flex flex-col gap-2 p-4 rounded-2xl border border-slate-100 bg-white hover:border-amber-200 transition-all shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-black px-2 py-0.5 rounded-full ${
                              permit.adminSignature
                                ? 'text-emerald-700 bg-emerald-100'
                                : 'text-amber-700 bg-amber-50'
                            }`}
                          >
                            {permit.adminSignature ? '승인됨' : '대기중'}
                          </span>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">작업일시</span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {permit.data?.work_start_date || permit.data?.work_start || '-'} ~ {permit.data?.work_end_date || permit.data?.work_end || '-'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-slate-700">
                          <span>{permitKind}</span>
                          <span className="text-slate-300 font-normal">·</span>
                          <span className="font-semibold text-slate-600">{workerLabel}</span>
                          <span className="text-slate-300 font-normal">·</span>
                          <span className="font-semibold text-slate-600">{companyLabel}</span>
                        </div>
                      </div>
                      );
                    })
                  )}
                </motion.div>
              )}

              {activeTab === 'log' && (
                <motion.div
                  key="log"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {filteredSafetyLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-slate-400">
                      <FileText className="h-10 w-10 mb-2 opacity-20" />
                      <p className="text-sm font-bold">안전일지가 없습니다.</p>
                    </div>
                  ) : (
                    filteredSafetyLogs.map((log) => (
                      <div 
                        key={log.id}
                        className="flex flex-col gap-2 p-4 rounded-2xl border border-slate-100 bg-white hover:border-blue-200 transition-all shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            작성완료
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {log.date}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-700">
                          {log.workSummary || '작업 요약 없음'}
                        </span>
                        {log.manpower && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <Users className="h-3 w-3" />
                            <span>총원 {log.manpower.total || 0}명</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400">
              * 각 페이지에서 상세 관리가 가능합니다.
            </p>
          </div>
        </motion.div>
      </div>

      {/* 법정 회의 이행 현황 (산업안전보건위원회 / 협력업체 협의체회의) */}
      <LegalMeetingsSection
        meetings={data.meetings}
        year={meetingYear}
        onChangeYear={setMeetingYear}
      />

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}

/* ============================================================
 * 법정 회의 이행 현황 섹션 (산업안전보건위원회 / 협력업체 협의체회의)
 * - 기타 회의는 표시하지 않음
 * - 카드/항목 클릭 시 회의록 탭으로 이동
 * ============================================================ */

interface LegalMeetingsSectionProps {
  meetings: MeetingMini[];
  year: number;
  onChangeYear: (year: number) => void;
}

function LegalMeetingsSection({ meetings, year, onChangeYear }: LegalMeetingsSectionProps) {
  const thisYear = new Date().getFullYear();
  const isCurrentYear = year === thisYear;
  const nowMonth = new Date().getMonth() + 1;
  const nowQuarter = Math.floor((nowMonth - 1) / 3) + 1;

  const oshcByQuarter: Record<number, MeetingMini[]> = { 1: [], 2: [], 3: [], 4: [] };
  const partnerByMonth: Record<number, MeetingMini[]> = {};
  for (let m = 1; m <= 12; m++) partnerByMonth[m] = [];

  meetings.forEach((m) => {
    if (m.year !== year) return;
    if (m.type === 'oshc' && m.quarter && oshcByQuarter[m.quarter]) {
      oshcByQuarter[m.quarter].push(m);
    } else if (m.type === 'partner_council' && m.month && partnerByMonth[m.month]) {
      partnerByMonth[m.month].push(m);
    }
  });

  const completedQuarters = Object.values(oshcByQuarter).filter((a) => a.length > 0).length;
  const completedMonths = Object.values(partnerByMonth).filter((a) => a.length > 0).length;

  const statusOf = (hasItem: boolean, currentMatch: boolean, pastMatch: boolean) => {
    if (hasItem) return 'done' as const;
    if (currentMatch) return 'current' as const;
    if (pastMatch) return 'overdue' as const;
    return 'idle' as const;
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
    >
      <div className="mb-5 flex flex-col items-start justify-between gap-3 border-b border-slate-50 pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <CalendarIcon className="h-5 w-5 text-blue-600" />
            법정 회의 이행 현황
          </h3>
          <p className="mt-1 text-xs font-medium text-slate-500">
            산업안전보건법상 의무 회의(분기/월 단위)의 실시 여부를 한눈에 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-2xl border border-slate-100 bg-slate-50/60 px-2 py-1">
            <button
              onClick={() => onChangeYear(year - 1)}
              className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[52px] text-center text-sm font-black text-slate-800">{year}년</span>
            <button
              onClick={() => onChangeYear(year + 1)}
              className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Link
            href="/meeting-minutes?tab=cycle"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
          >
            전체 보기 →
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* OSHC: 분기 4개 */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
                <Link
                  href="/meeting-minutes?tab=oshc"
                  className="text-sm font-black text-slate-900 hover:text-blue-600"
                >
                  산업안전보건위원회
                </Link>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-600">
                  분기 1회
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-bold text-slate-400">산업안전보건법 제24조</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400">이행률</p>
              <p className="text-base font-black text-blue-600">
                {completedQuarters}
                <span className="text-xs text-slate-400"> / 4</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[1, 2, 3, 4].map((q) => {
              const list = oshcByQuarter[q];
              const has = list.length > 0;
              const isCurrent = isCurrentYear && q === nowQuarter;
              const isOverdue = isCurrentYear && q < nowQuarter && !has;
              const status = statusOf(has, isCurrent, isOverdue);
              return (
                <Link
                  key={q}
                  href="/meeting-minutes?tab=oshc"
                  className={`group relative flex flex-col rounded-xl border p-3 transition ${
                    has
                      ? 'border-blue-100 bg-blue-50/60 hover:bg-blue-50'
                      : isOverdue
                      ? 'border-red-100 bg-red-50/40 hover:bg-red-50'
                      : isCurrent
                      ? 'border-amber-100 bg-amber-50/40 hover:bg-amber-50'
                      : 'border-slate-100 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-500">{q}분기</span>
                    <MeetingStatusDot status={status} />
                  </div>
                  {has ? (
                    <p className="truncate text-[11px] font-bold text-slate-700" title={list[0].title}>
                      {list[0].title}
                      {list.length > 1 && (
                        <span className="ml-1 text-[10px] text-slate-400">+{list.length - 1}</span>
                      )}
                    </p>
                  ) : (
                    <p className={`text-[11px] font-bold ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                      {isOverdue ? '미실시 (지연)' : isCurrent ? '이번 분기 예정' : '기록 없음'}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Partner Council: 월 12개 */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-purple-600" />
                <Link
                  href="/meeting-minutes?tab=partner_council"
                  className="text-sm font-black text-slate-900 hover:text-purple-600"
                >
                  협력업체 협의체회의
                </Link>
                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-black text-purple-600">
                  월 1회
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-bold text-slate-400">산업안전보건법 제64조</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400">이행률</p>
              <p className="text-base font-black text-purple-600">
                {completedMonths}
                <span className="text-xs text-slate-400"> / 12</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const list = partnerByMonth[m];
              const has = list.length > 0;
              const isCurrent = isCurrentYear && m === nowMonth;
              const isOverdue = isCurrentYear && m < nowMonth && !has;
              const status = statusOf(has, isCurrent, isOverdue);
              return (
                <Link
                  key={m}
                  href="/meeting-minutes?tab=partner_council"
                  title={has ? list[0].title : undefined}
                  className={`group relative flex aspect-square flex-col items-center justify-center rounded-lg border p-1.5 transition ${
                    has
                      ? 'border-purple-100 bg-purple-50/70 hover:bg-purple-100'
                      : isOverdue
                      ? 'border-red-100 bg-red-50/40 hover:bg-red-50'
                      : isCurrent
                      ? 'border-amber-100 bg-amber-50/40 hover:bg-amber-50'
                      : 'border-slate-100 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-[11px] font-black ${has ? 'text-purple-700' : isOverdue ? 'text-red-500' : 'text-slate-500'}`}>
                    {m}월
                  </span>
                  <div className="mt-0.5">
                    <MeetingStatusDot status={status} small />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-100 bg-slate-50/40 px-4 py-2.5 text-[10px] font-bold text-slate-500">
        <div className="flex items-center gap-1.5">
          <MeetingStatusDot status="done" small /> 완료
        </div>
        <div className="flex items-center gap-1.5">
          <MeetingStatusDot status="current" small /> 현재 주기
        </div>
        <div className="flex items-center gap-1.5">
          <MeetingStatusDot status="overdue" small /> 미실시 (지연)
        </div>
        <div className="flex items-center gap-1.5">
          <MeetingStatusDot status="idle" small /> 예정 / 미대상
        </div>
      </div>
    </motion.section>
  );
}

type MeetingStatus = 'done' | 'overdue' | 'current' | 'idle';

const MeetingStatusDot: React.FC<{ status: MeetingStatus; small?: boolean }> = ({ status, small }) => {
  const size = small ? 'h-4 w-4' : 'h-5 w-5';
  const iconSize = small ? 'h-2.5 w-2.5' : 'h-3 w-3';
  if (status === 'done') {
    return (
      <span className={`flex items-center justify-center rounded-full bg-emerald-500 text-white ${size}`}>
        <Check className={`${iconSize} stroke-[3]`} />
      </span>
    );
  }
  if (status === 'overdue') {
    return (
      <span className={`flex items-center justify-center rounded-full bg-red-500 text-white ${size}`}>
        <AlertCircle className={iconSize} />
      </span>
    );
  }
  if (status === 'current') {
    return <span className={`animate-pulse rounded-full bg-amber-500 ${small ? 'h-2 w-2' : 'h-2.5 w-2.5'}`} />;
  }
  return (
    <span className={`flex items-center justify-center rounded-full bg-slate-100 text-slate-400 ${size}`}>
      <Minus className={iconSize} />
    </span>
  );
};
