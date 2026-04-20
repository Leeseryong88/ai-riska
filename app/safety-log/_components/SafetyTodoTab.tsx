'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  deleteField,
  Timestamp,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../_lib/utils';
import type { SafetyManagerTodo, TodoFilter } from '../_lib/todoTypes';
import { TodoCalendar, toDayKey } from './TodoCalendar';

const PAGE_LIMIT = 200;

function dueDateToDayKey(due: unknown): string | null {
  if (!due) return null;
  let d: Date | null = null;
  if (due instanceof Timestamp) {
    d = due.toDate();
  } else if (typeof due === 'object' && due !== null && 'toDate' in due && typeof (due as { toDate: () => Date }).toDate === 'function') {
    try {
      d = (due as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  if (!d) return null;
  return toDayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** 목록 뱃지용 — 예: 2026년 4월 24일 */
function formatDueLongKo(v: unknown): string {
  if (!v) return '';
  let d: Date | null = null;
  if (v instanceof Timestamp) d = v.toDate();
  else if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      d = (v as { toDate: () => Date }).toDate();
    } catch {
      return '';
    }
  }
  if (!d) return '';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function rowDueToInputString(row: SafetyManagerTodo): string {
  return dueDateToDayKey(row.dueDate) ?? '';
}

function formatDraftDueBarLabel(iso: string): string {
  if (!iso) return '기한 추가';
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return '기한 추가';
  return new Date(y, m - 1, d).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Chromium 등에서 type=date 입력의 히트 영역이 왼쪽에만 잡히는 경우가 있어, 프로그램으로 열어 전체 버튼과 동일하게 동작시킴 */
function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input) return;
  try {
    if (typeof input.showPicker === 'function') {
      void input.showPicker();
      return;
    }
  } catch {
    /* 일부 환경에서는 showPicker가 막힐 수 있음 */
  }
  input.click();
}

/** 목록 행 — 숨김 input은 앵커·값만 담고, 투명 버튼으로 전체 영역 클릭 시 달력 오픈 */
function RowDueDatePill({
  rowId,
  value,
  labelText,
  disabled,
  onPick,
}: {
  rowId: string;
  value: string;
  labelText: string;
  disabled: boolean;
  onPick: (iso: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        'relative inline-flex min-h-[2rem] min-w-0 max-w-full overflow-hidden rounded-full border px-3 py-1.5 text-left text-xs font-semibold shadow-sm transition-colors',
        'border-amber-200/90 bg-amber-50 text-amber-900',
        !disabled && 'hover:bg-amber-100/95',
        disabled && 'opacity-50'
      )}
    >
      <input
        id={`row-due-${rowId}`}
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onPick(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 z-0 h-full min-h-[2rem] w-full opacity-0"
        aria-hidden
      />
      <span className="pointer-events-none relative z-[1] flex min-w-0 items-center gap-1.5" aria-hidden>
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate">{labelText}</span>
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => openNativeDatePicker(inputRef.current)}
        className={cn(
          'absolute inset-0 z-[2] cursor-pointer rounded-full border-0 bg-transparent p-0',
          disabled && 'cursor-not-allowed'
        )}
        aria-label={value ? '기한 날짜 변경' : '기한 추가'}
      />
    </div>
  );
}

export function SafetyTodoTab() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<SafetyManagerTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'permission' | 'network' | null>(null);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<TodoFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [addHint, setAddHint] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  /** 새 할 일에 붙일 기한 (YYYY-MM-DD), 빈 문자열이면 기한 없음 */
  const [draftDueDate, setDraftDueDate] = useState('');
  const draftDueInputRef = useRef<HTMLInputElement>(null);
  /** 목록에서 '메모 있음' 클릭 시 아래로 펼쳐 보여 줄 항목 id */
  const [memoPreviewId, setMemoPreviewId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const q = query(
        collection(db, 'safety_manager_todos'),
        where('managerId', '==', user.uid),
        orderBy('sortOrder', 'asc'),
        limit(PAGE_LIMIT)
      );
      const snap = await getDocs(q);
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SafetyManagerTodo[]);
    } catch (e) {
      console.error(e);
      if (e instanceof FirebaseError && e.code === 'permission-denied') {
        setLoadError('permission');
      } else {
        setLoadError('network');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [load, authLoading]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items]
  );

  /** 달력 숫자/숫자: 앞=그날 기한 중 완료, 뒤=그날 기한인 전체(체크해도 뒤는 그대로) */
  const dueStatsByDay = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    for (const t of items) {
      const key = dueDateToDayKey(t.dueDate);
      if (!key) continue;
      if (!map[key]) map[key] = { done: 0, total: 0 };
      map[key].total += 1;
      if (t.done) map[key].done += 1;
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    let list = sorted;
    if (filter === 'active') list = list.filter((t) => !t.done);
    if (filter === 'done') list = list.filter((t) => t.done);
    if (selectedDayKey) {
      list = list.filter((t) => dueDateToDayKey(t.dueDate) === selectedDayKey);
    }
    return list;
  }, [sorted, filter, selectedDayKey]);

  const handleSelectDayFromCalendar = useCallback((dayKey: string | null) => {
    setSelectedDayKey(dayKey);
    // 좌측 달력 선택을 새 항목의 기한 입력과 동기화해 한 번에 설정 가능하게 함
    setDraftDueDate(dayKey ?? '');
  }, []);

  const addTodo = async () => {
    setAddHint(null);
    const title = input.trim();
    if (!title) {
      setAddHint('할 일 내용을 입력한 뒤 추가를 눌러 주세요.');
      return;
    }
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    const orders = items.map((t) =>
      typeof t.sortOrder === 'number' && !Number.isNaN(t.sortOrder) ? t.sortOrder : 0
    );
    const maxOrder = orders.length ? Math.max(...orders) : -1;
    const nextOrder = maxOrder + 1;

    let dueTs: Timestamp | undefined;
    if (draftDueDate) {
      const [yy, mm, dd] = draftDueDate.split('-').map((n) => parseInt(n, 10));
      if (!Number.isNaN(yy) && !Number.isNaN(mm) && !Number.isNaN(dd)) {
        dueTs = Timestamp.fromDate(new Date(yy, mm - 1, dd));
      }
    }

    setAdding(true);
    try {
      const payload: Record<string, unknown> = {
        managerId: user.uid,
        title,
        done: false,
        sortOrder: nextOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (dueTs) payload.dueDate = dueTs;

      const ref = await addDoc(collection(db, 'safety_manager_todos'), payload);
      setInput('');
      setAddHint(null);
      setSelectedDayKey(null);
      setFilter('all');
      setItems((prev) => [
        ...prev,
        {
          id: ref.id,
          managerId: user.uid,
          title,
          done: false,
          sortOrder: nextOrder,
          ...(dueTs ? { dueDate: dueTs } : {}),
        },
      ]);
    } catch (e) {
      console.error(e);
      const code = e instanceof FirebaseError ? e.code : (e as { code?: string })?.code;
      if (code === 'permission-denied') {
        alert('저장 권한이 없습니다. Firebase 콘솔에서 Firestore 규칙이 배포되었는지 확인해 주세요.');
      } else {
        alert('추가하지 못했습니다. 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setAdding(false);
    }
  };

  const toggleDone = async (row: SafetyManagerTodo) => {
    if (!user) return;
    setSavingId(row.id);
    try {
      await updateDoc(doc(db, 'safety_manager_todos', row.id), {
        done: !row.done,
        updatedAt: serverTimestamp(),
      });
      setItems((prev) => prev.map((t) => (t.id === row.id ? { ...t, done: !t.done } : t)));
    } catch (e) {
      console.error(e);
      alert('저장하지 못했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('이 할 일을 삭제할까요?')) return;
    try {
      await deleteDoc(doc(db, 'safety_manager_todos', id));
      setItems((prev) => prev.filter((t) => t.id !== id));
      setExpandedId((e) => (e === id ? null : e));
    } catch (e) {
      console.error(e);
      alert('삭제하지 못했습니다.');
    }
  };

  const saveNoteAndDue = async (row: SafetyManagerTodo, note: string, dueStr: string) => {
    setSavingId(row.id);
    try {
      const payload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      payload.note = note.trim() || deleteField();
      if (dueStr) {
        const d = new Date(dueStr);
        if (!Number.isNaN(d.getTime())) {
          payload.dueDate = Timestamp.fromDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
        }
      } else {
        payload.dueDate = deleteField();
      }
      await updateDoc(doc(db, 'safety_manager_todos', row.id), payload);
      setItems((prev) =>
        prev.map((t) => {
          if (t.id !== row.id) return t;
          const next = { ...t, note: note.trim() || undefined };
          if (dueStr) {
            const d = new Date(dueStr);
            if (!Number.isNaN(d.getTime())) {
              next.dueDate = Timestamp.fromDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
            }
          } else {
            delete next.dueDate;
          }
          return next;
        })
      );
    } catch (e) {
      console.error(e);
      alert('저장하지 못했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const list = sorted;
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[index];
    const b = list[j];
    const batch = writeBatch(db);
    batch.update(doc(db, 'safety_manager_todos', a.id), { sortOrder: b.sortOrder, updatedAt: serverTimestamp() });
    batch.update(doc(db, 'safety_manager_todos', b.id), { sortOrder: a.sortOrder, updatedAt: serverTimestamp() });
    try {
      await batch.commit();
      setItems((prev) => {
        const next = prev.map((t) => {
          if (t.id === a.id) return { ...t, sortOrder: b.sortOrder };
          if (t.id === b.id) return { ...t, sortOrder: a.sortOrder };
          return t;
        });
        return next.sort((x, y) => x.sortOrder - y.sortOrder);
      });
    } catch (e) {
      console.error(e);
      alert('순서를 바꾸지 못했습니다.');
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-3 text-sm font-medium text-gray-400">인증 확인 중...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-6 py-10 text-center">
        <p className="text-sm font-bold text-amber-900">로그인 후 할 일을 사용할 수 있습니다.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-3 text-sm font-medium text-gray-400">할 일을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-8">
      <div className="w-full shrink-0 lg:max-w-[280px]">
        <TodoCalendar
          visibleMonth={visibleMonth}
          onVisibleMonthChange={setVisibleMonth}
          selectedDayKey={selectedDayKey}
          onSelectDay={handleSelectDayFromCalendar}
          dueStatsByDay={dueStatsByDay}
        />
      </div>

      <div className="min-w-0 flex-1 space-y-6">
        <p className="text-sm font-medium text-slate-500">
          필터를 바꾸거나 달력에서 날짜를 눌러 기한이 있는 할 일만 모아 볼 수 있습니다.
        </p>

        {loadError === 'permission' && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p className="font-bold">Firestore 접근이 거부되었습니다.</p>
            <p className="mt-1 text-red-800/90">
              프로젝트에 <code className="rounded bg-red-100 px-1">safety_manager_todos</code> 규칙이 반영되었는지 확인하고, 터미널에서{' '}
              <code className="rounded bg-red-100 px-1">firebase deploy --only firestore:rules</code> 로 배포해 주세요.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
              다시 시도
            </Button>
          </div>
        )}

        {loadError === 'network' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            목록을 불러오지 못했습니다.
            <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void load()}>
              다시 시도
            </Button>
          </div>
        )}

        {selectedDayKey && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
              기한 {selectedDayKey} 항목만 표시 중
            </span>
            <button
              type="button"
              className="text-xs font-bold text-blue-600 underline"
              onClick={() => setSelectedDayKey(null)}
            >
              전체 날짜 보기
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'done'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {f === 'all' ? '전체' : f === 'active' ? '할 일' : '완료'}
            </button>
          ))}
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
          onSubmit={(e) => {
            e.preventDefault();
            void addTodo();
          }}
        >
          <div
            className={cn(
              'flex min-h-11 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border sm:flex-row',
              addHint ? 'border-amber-400 ring-1 ring-amber-400/30' : 'border-gray-300'
            )}
          >
            <div className="relative flex min-h-11 min-w-0 shrink-0 items-stretch overflow-hidden border-b border-gray-200 bg-slate-50 sm:border-b-0 sm:border-r">
              <input
                id="safety-todo-draft-due"
                ref={draftDueInputRef}
                type="date"
                value={draftDueDate}
                onChange={(e) => setDraftDueDate(e.target.value)}
                disabled={adding}
                tabIndex={-1}
                className={cn(
                  'pointer-events-none absolute inset-0 z-0 min-h-11 opacity-0 disabled:cursor-not-allowed',
                  draftDueDate ? 'right-10' : 'right-0'
                )}
                aria-hidden
              />
              <div className="pointer-events-none relative z-[1] flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left">
                <CalendarDays className="h-5 w-5 shrink-0 text-blue-600" aria-hidden />
                <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                  {formatDraftDueBarLabel(draftDueDate)}
                </span>
              </div>
              <button
                type="button"
                disabled={adding}
                onClick={() => openNativeDatePicker(draftDueInputRef.current)}
                className={cn(
                  'absolute inset-0 z-[2] cursor-pointer border-0 bg-transparent p-0',
                  draftDueDate ? 'right-10' : 'right-0'
                )}
                aria-label={draftDueDate ? `기한 ${formatDraftDueBarLabel(draftDueDate)}, 날짜 변경` : '기한 추가, 날짜 선택'}
              />
              {draftDueDate ? (
                <button
                  type="button"
                  className="relative z-[3] flex h-11 w-10 shrink-0 items-center justify-center border-l border-gray-200 text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-800"
                  onClick={(e) => {
                    e.preventDefault();
                    setDraftDueDate('');
                  }}
                  disabled={adding}
                  aria-label="선택한 기한 지우기"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (addHint) setAddHint(null);
              }}
              placeholder="할 일 내용 (기한은 왼쪽에서 선택)"
              autoComplete="off"
              className="min-h-11 min-w-0 flex-1 border-0 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500/25 disabled:opacity-60"
              disabled={adding}
              aria-invalid={!!addHint}
              aria-describedby={addHint ? 'todo-add-hint' : undefined}
            />
          </div>
          <Button
            type="submit"
            className="min-h-11 gap-2 shrink-0 px-5 sm:self-center"
            disabled={adding}
            isLoading={adding}
          >
            {!adding && <Plus className="h-4 w-4" />}
            추가
          </Button>
        </form>
        {addHint ? (
          <p id="todo-add-hint" className="text-sm font-bold text-amber-700" role="status">
            {addHint}
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="text-sm font-bold text-gray-600">
              {filter === 'all' ? '등록된 할 일이 없습니다.' : filter === 'active' ? '남은 할 일이 없습니다.' : '완료된 항목이 없습니다.'}
            </p>
            {filter === 'all' && !selectedDayKey && (
              <p className="mt-1 text-xs text-gray-500">위 입력란에 오늘 할 일을 적어 보세요.</p>
            )}
            {selectedDayKey && (
              <p className="mt-1 text-xs text-gray-500">이 날짜에 기한이 잡힌 할 일이 없습니다. 항목의 날짜 뱃지를 눌러 기한을 맞춰 보세요.</p>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((row) => {
              const idx = sorted.findIndex((t) => t.id === row.id);
              const canUp = idx > 0;
              const canDown = idx >= 0 && idx < sorted.length - 1;
              const hasDue = !!rowDueToInputString(row);
              const dueBadgeLabel = hasDue ? formatDueLongKo(row.dueDate) : '기한 추가';
              return (
                <li key={row.id}>
                  <div
                    className={cn(
                      'rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-colors',
                      row.done && 'bg-gray-50/80'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={row.done}
                        disabled={savingId === row.id}
                        onClick={() => void toggleDone(row)}
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                          row.done ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 hover:border-blue-400'
                        )}
                      >
                        {row.done && (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm font-bold text-gray-900', row.done && 'text-gray-400 line-through')}>{row.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <div className="inline-flex max-w-full items-stretch gap-1">
                            <RowDueDatePill
                              rowId={row.id}
                              value={rowDueToInputString(row)}
                              labelText={dueBadgeLabel}
                              disabled={savingId === row.id}
                              onPick={(iso) => void saveNoteAndDue(row, row.note || '', iso)}
                            />
                            {hasDue ? (
                              <button
                                type="button"
                                className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-amber-800/80 transition-colors hover:bg-amber-100 hover:text-amber-950"
                                disabled={savingId === row.id}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void saveNoteAndDue(row, row.note || '', '');
                                }}
                                aria-label="기한 삭제"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                          {row.note ? (
                            <button
                              type="button"
                              className={cn(
                                'inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-bold text-gray-600 transition-colors',
                                memoPreviewId === row.id ? 'bg-slate-200 text-slate-900' : 'hover:bg-slate-100'
                              )}
                              onClick={() =>
                                setMemoPreviewId((id) => (id === row.id ? null : row.id))
                              }
                              aria-expanded={memoPreviewId === row.id}
                            >
                              <MessageSquare className="h-3 w-3" />
                              메모 있음
                            </button>
                          ) : null}
                        </div>
                        {memoPreviewId === row.id && row.note ? (
                          <div
                            className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap"
                            role="region"
                            aria-label="메모 내용"
                          >
                            {row.note}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={!canUp}
                          onClick={() => void move(idx, -1)}
                          aria-label="위로"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={!canDown}
                          onClick={() => void move(idx, 1)}
                          aria-label="아래로"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-gray-600"
                          onClick={() => {
                            setMemoPreviewId(null);
                            setExpandedId((e) => (e === row.id ? null : row.id));
                          }}
                        >
                          메모
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50"
                          onClick={() => void remove(row.id)}
                          aria-label="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {expandedId === row.id && (
                      <TodoDetailForm
                        row={row}
                        saving={savingId === row.id}
                        onSave={(note) => void saveNoteAndDue(row, note, rowDueToInputString(row))}
                        onClose={() => setExpandedId(null)}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function TodoDetailForm({
  row,
  saving,
  onSave,
  onClose,
}: {
  row: SafetyManagerTodo;
  saving: boolean;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState(row.note || '');

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 pl-8">
      <label className="text-xs font-bold text-gray-400">메모</label>
      <p className="mt-0.5 text-[11px] text-gray-500">기한은 위의 날짜 뱃지를 눌러 변경할 수 있습니다.</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        placeholder="추가 메모 (선택)"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={saving} onClick={() => onSave(note)}>
          저장
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}
