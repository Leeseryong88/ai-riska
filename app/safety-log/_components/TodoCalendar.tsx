'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../_lib/utils';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 앞: 그날 기한 중 완료 건수, 뒤: 그날 기한인 전체 할 일 수(항목 추가·삭제 시에만 변함) */
export type DueDayStats = { done: number; total: number };

interface TodoCalendarProps {
  /** 현재 보이는 달 (아무 날짜나 넣으면 해당 월 기준) */
  visibleMonth: Date;
  onVisibleMonthChange: (next: Date) => void;
  /** 선택된 날 (null이면 날짜 필터 없음) */
  selectedDayKey: string | null;
  onSelectDay: (dayKey: string | null) => void;
  /** YYYY-MM-DD → 해당 날 기한인 할 일 (완료 건수 / 전체 건수) */
  dueStatsByDay: Record<string, DueDayStats>;
}

export function TodoCalendar({
  visibleMonth,
  onVisibleMonthChange,
  selectedDayKey,
  onSelectDay,
  dueStatsByDay,
}: TodoCalendarProps) {
  const { year, monthIndex, cells } = useMemo(() => {
    const y = visibleMonth.getFullYear();
    const m = visibleMonth.getMonth();
    const first = new Date(y, m, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startPad + 1;
      const date = new Date(y, m, dayNum);
      cells.push({ date, inMonth: dayNum >= 1 && dayNum <= daysInMonth });
    }
    return { year: y, monthIndex: m, cells };
  }, [visibleMonth]);

  const label = `${year}년 ${monthIndex + 1}월`;

  const goPrev = () => {
    onVisibleMonthChange(new Date(year, monthIndex - 1, 1));
  };
  const goNext = () => {
    onVisibleMonthChange(new Date(year, monthIndex + 1, 1));
  };

  const todayKey = toDayKey(new Date());

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrev}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
          aria-label="이전 달"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-black text-slate-800">{label}</p>
        <button
          type="button"
          onClick={goNext}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
          aria-label="다음 달"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-slate-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {cells.map(({ date, inMonth }, i) => {
          const key = toDayKey(date);
          const stats = dueStatsByDay[key] ?? { done: 0, total: 0 };
          const total = stats.total;
          const isSelected = selectedDayKey === key;
          const isToday = key === todayKey;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDay(isSelected ? null : key)}
              className={cn(
                'relative flex min-h-[2.75rem] flex-col items-center justify-start rounded-lg py-0.5 text-xs font-bold transition-colors',
                !inMonth && 'text-slate-300',
                inMonth && 'text-slate-800 hover:bg-blue-50',
                isSelected && 'bg-blue-600 text-white hover:bg-blue-700',
                isToday && !isSelected && 'ring-2 ring-blue-400 ring-offset-1'
              )}
            >
              <span className="leading-none">{date.getDate()}</span>
              {inMonth && total > 0 && (
                <span
                  className={cn(
                    'mt-0.5 rounded-md px-1 py-0.5 font-mono text-[10px] font-black tabular-nums leading-none',
                    isSelected ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-950'
                  )}
                >
                  {stats.done}/{stats.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        표시는 <span className="font-bold text-slate-700">완료 수 / 그날 기한 전체</span>입니다. 체크하면 앞 숫자만 늘고, 뒤 숫자는 그날 기한인 할 일 개수로 그대로입니다.
      </p>
    </div>
  );
}
