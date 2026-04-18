'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, 
  Users, 
  ShieldAlert, 
  FileText, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  ClipboardList,
  UserPlus,
  MessageSquare,
  Plus,
  Trash2,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
  startOfDay
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/app/work-permit/_components/ui/Button';

// --- Types ---
interface DashboardData {
  totalLogs: number;
  permitApproved: number;
  permitTotal: number;
  totalPartners: number;
  feedbackAcknowledged: number;
  feedbackTotal: number;
  logDates: Map<string, number>;
  permitCounts: Map<string, number>;
  todoStats: Map<string, { done: number; total: number }>;
  todos: any[];
  safetyLogs: any[];
  workPermits: any[];
}

export default function VisualDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'todo' | 'permit' | 'log'>('todo');
  const [data, setData] = useState<DashboardData>({
    totalLogs: 0,
    permitApproved: 0,
    permitTotal: 0,
    totalPartners: 0,
    feedbackAcknowledged: 0,
    feedbackTotal: 0,
    logDates: new Map(),
    permitCounts: new Map(),
    todoStats: new Map(),
    todos: [],
    safetyLogs: [],
    workPermits: []
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(format(new Date(), 'yyyy-MM-dd'));

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. 누적 일지
      const logsRef = collection(db, 'safety_logs');
      const logsQuery = query(logsRef, where('managerId', '==', user.uid));
      const logsSnapshot = await getDocs(logsQuery);
      const safetyLogs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const logDatesMap = new Map<string, number>();
      safetyLogs.forEach(item => {
        const date = item.date;
        if (date) {
          logDatesMap.set(date, (logDatesMap.get(date) || 0) + 1);
        }
      });

      // 2. 작업 허가서
      const permitsRef = collection(db, 'logs');
      const permitsQuery = query(permitsRef, where('ownerId', '==', user.uid));
      const permitsSnapshot = await getDocs(permitsQuery);
      const workPermits = permitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const permitTotal = workPermits.length;
      const permitApproved = workPermits.filter(item => item.adminSignature).length;
      
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

      // 3. 협력 업체
      const partnersRef = collection(db, 'contractor_partners');
      const partnersQuery = query(partnersRef, where('managerId', '==', user.uid));
      const partnersSnapshot = await getDocs(partnersQuery);

      // 4. 근로자 의견청취
      const feedbackRef = collection(db, 'worker_feedback_submissions');
      const feedbackQuery = query(feedbackRef, where('managerId', '==', user.uid));
      const feedbackSnapshot = await getDocs(feedbackQuery);
      const feedbackTotal = feedbackSnapshot.size;
      const feedbackAcknowledged = feedbackSnapshot.docs.filter(doc => doc.data().acknowledged).length;

      // 5. 할 일 목록
      const todosRef = collection(db, 'safety_manager_todos');
      const allTodosQuery = query(todosRef, where('managerId', '==', user.uid));
      const allTodosSnapshot = await getDocs(allTodosQuery);
      
      const todoStatsMap = new Map<string, { done: number; total: number }>();
      const allTodos = allTodosSnapshot.docs.map(doc => {
        const t = doc.data();
        const item = { id: doc.id, ...t };
        if (t.dueDate) {
          const date = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
          const key = format(date, 'yyyy-MM-dd');
          const stats = todoStatsMap.get(key) || { done: 0, total: 0 };
          stats.total += 1;
          if (t.done) stats.done += 1;
          todoStatsMap.set(key, stats);
        }
        return item;
      });

      // Sort todos for the list
      const sortedTodos = allTodos
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      setData({
        totalLogs: logsSnapshot.size,
        permitApproved,
        permitTotal,
        totalPartners: partnersSnapshot.size,
        feedbackAcknowledged,
        feedbackTotal,
        logDates: logDatesMap,
        permitCounts: permitCountsMap,
        todoStats: todoStatsMap,
        todos: sortedTodos,
        safetyLogs,
        workPermits
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // --- Calendar Logic ---
  const calendarDays = () => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  };

  const hasLog = (day: Date) => data.logDates.some(logDate => isSameDay(logDate, day));

  // --- Todo Logic ---
  const handleToggleTodo = async (todoId: string, currentDone: boolean) => {
    try {
      await updateDoc(doc(db, 'safety_manager_todos', todoId), {
        done: !currentDone,
        updatedAt: serverTimestamp(),
      });
      setData(prev => ({
        ...prev,
        todos: prev.todos.map(t => t.id === todoId ? { ...t, done: !currentDone } : t)
      }));
    } catch (error) {
      console.error("Error toggling todo:", error);
    }
  };

  const filteredTodos = selectedDayKey 
    ? data.todos.filter(t => {
        if (!t.dueDate) return false;
        const date = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
        return format(date, 'yyyy-MM-dd') === selectedDayKey;
      })
    : data.todos.slice(0, 20); // Show top 20 if no date selected

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
              const todoStat = data.todoStats.get(key);
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
                    {todoStat && (
                      <span className={`px-1 py-0.5 rounded-[4px] leading-none whitespace-nowrap font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                        {todoStat.done}/{todoStat.total}
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
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <div className="h-2 w-2 rounded-sm bg-emerald-100" />
              <span>할 일 (완료/전체)</span>
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
                { id: 'todo', label: '할 일', icon: CheckCircle2, count: filteredTodos.length },
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
              {activeTab === 'todo' && (
                <motion.div
                  key="todo"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {filteredTodos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-slate-400">
                      <ClipboardList className="h-10 w-10 mb-2 opacity-20" />
                      <p className="text-sm font-bold">예정된 할 일이 없습니다.</p>
                    </div>
                  ) : (
                    filteredTodos.map((todo) => (
                      <div 
                        key={todo.id}
                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                          todo.done 
                            ? 'bg-slate-50 border-slate-100 opacity-60' 
                            : 'bg-white border-slate-100 hover:border-blue-200 shadow-sm'
                        }`}
                      >
                        <button
                          onClick={() => handleToggleTodo(todo.id, todo.done)}
                          className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            todo.done 
                              ? 'bg-blue-600 border-blue-600 text-white' 
                              : 'border-slate-200 hover:border-blue-400'
                          }`}
                        >
                          {todo.done && <Check className="h-4 w-4 stroke-[3]" />}
                        </button>
                        <span className={`text-sm font-bold flex-1 ${todo.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {todo.title}
                        </span>
                        {todo.dueDate && (
                          <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {format(todo.dueDate.toDate ? todo.dueDate.toDate() : new Date(todo.dueDate), 'MM/dd')}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </motion.div>
              )}

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
                    filteredPermits.map((permit) => (
                      <div 
                        key={permit.id}
                        className="flex flex-col gap-2 p-4 rounded-2xl border border-slate-100 bg-white hover:border-amber-200 transition-all shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            {permit.adminSignature ? '승인됨' : '대기중'}
                          </span>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">작업일시</span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {permit.data?.work_start_date || permit.data?.work_start || '-'} ~ {permit.data?.work_end_date || permit.data?.work_end || '-'}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-slate-700">
                          {permit.data?.purpose || '작업 목적 미기재'}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <Users className="h-3 w-3" />
                          <span>{permit.data?.worker_name || '작업자 미기재'}</span>
                          <span>|</span>
                          <span>{permit.data?.company_name || '업체 미기재'}</span>
                        </div>
                      </div>
                    ))
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
