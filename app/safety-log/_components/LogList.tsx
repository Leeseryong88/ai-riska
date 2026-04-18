'use client';

import React from 'react';
import { SafetyLog } from '../_lib/types';
import { Card } from './ui/Button';
import { Calendar, Cloud, Sun, CloudRain, Snowflake, Wind, Trash2, ChevronRight } from 'lucide-react';

interface LogListProps {
  logs: SafetyLog[];
  onSelect: (log: SafetyLog) => void;
  onDelete: (id: string) => void;
}

const WeatherIcon = ({ weather }: { weather: string }) => {
  switch (weather) {
    case 'clear': return <Sun className="w-4 h-4 text-orange-500" />;
    case 'cloudy': return <Cloud className="w-4 h-4 text-gray-500" />;
    case 'rain': return <CloudRain className="w-4 h-4 text-blue-500" />;
    case 'snow': return <Snowflake className="w-4 h-4 text-cyan-500" />;
    case 'windy': return <Wind className="w-4 h-4 text-teal-500" />;
    default: return <Sun className="w-4 h-4" />;
  }
};

export const LogList: React.FC<LogListProps> = ({ logs, onSelect, onDelete }) => {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Calendar className="w-12 h-12 mb-4 opacity-20" />
        <p>작성된 안전일지가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
          onClick={() => onSelect(log)}
        >
          {/* 1. 날짜 (고정폭) */}
          <div className="flex-shrink-0 w-24">
            <span className="text-sm font-bold text-gray-900">{log.date}</span>
          </div>

          {/* 2. 날씨 및 기온 (고정폭) */}
          <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100 w-24 justify-center">
            <WeatherIcon weather={log.weather || 'clear'} />
            <span className="text-[11px] font-semibold text-gray-600">{log.temperature || '0'}°C</span>
          </div>

          {/* 3. 제목 및 작업 요약 (가변폭, 한 줄 생략) */}
          <div className="flex-grow min-w-0">
            <h4 className="text-sm font-bold text-gray-900 truncate mb-0.5">
              {log.title || '제목 없는 일지'}
            </h4>
            <p className="text-[11px] text-gray-400 truncate">
              {log.workSummary}
            </p>
          </div>

          {/* 4. 통계 정보 (선택적 표시/슬림화) */}
          <div className="flex-shrink-0 hidden sm:flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
            <span className="whitespace-nowrap">인원: {log.manpower?.total || 0}명</span>
            <span className="whitespace-nowrap text-gray-200">|</span>
            <span className="whitespace-nowrap">점검: {log.safetyChecks?.filter(i => i.checked).length || 0}건</span>
          </div>

          {/* 5. 액션 버튼 */}
          <div className="flex-shrink-0 flex items-center gap-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(log.id!);
              }}
              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <span className="text-gray-200 group-hover:text-blue-500 transition-colors ml-1">
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
