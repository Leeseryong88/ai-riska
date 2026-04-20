'use client';

import React from 'react';
import { SafetyLog } from '../_lib/types';
import {
  Calendar,
  Cloud,
  Sun,
  CloudRain,
  Snowflake,
  Wind,
  Trash2,
  ChevronRight,
  FileText,
  Info,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface LogListProps {
  logs: SafetyLog[];
  onSelect: (log: SafetyLog) => void;
  onDelete: (id: string) => void;
}

const WeatherIcon = ({ weather }: { weather: string }) => {
  switch (weather) {
    case 'clear':
      return <Sun className="w-4 h-4 text-orange-500" />;
    case 'cloudy':
      return <Cloud className="w-4 h-4 text-gray-500" />;
    case 'rain':
      return <CloudRain className="w-4 h-4 text-blue-500" />;
    case 'snow':
      return <Snowflake className="w-4 h-4 text-cyan-500" />;
    case 'windy':
      return <Wind className="w-4 h-4 text-teal-500" />;
    default:
      return <Sun className="w-4 h-4" />;
  }
};

export const LogList: React.FC<LogListProps> = ({ logs, onSelect, onDelete }) => {
  if (logs.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <Info className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-bold">작성된 안전일지가 없습니다.</p>
        <p className="text-xs text-gray-400 mt-1">우측 상단의 “일지 작성하기” 버튼으로 새 일지를 추가하세요.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 text-xs font-black text-gray-500 uppercase tracking-wider">
        <div className="col-span-1 text-center">번호</div>
        <div className="col-span-5">제목</div>
        <div className="col-span-2 text-center">날씨</div>
        <div className="col-span-3 text-center">점검 일자</div>
        <div className="col-span-1 text-center">작업</div>
      </div>
      <div className="divide-y divide-gray-100">
        {logs.map((log, index) => (
          <motion.div
            layout
            key={log.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => onSelect(log)}
            className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-blue-50/30 transition-all cursor-pointer items-center"
          >
            <div className="hidden md:flex md:col-span-1 items-center justify-center">
              <span className="text-sm font-black text-blue-600">{index + 1}</span>
            </div>

            <div className="col-span-1 md:col-span-5 flex items-center gap-3 min-w-0">
              <div className="md:hidden w-8 h-8 shrink-0 rounded-lg bg-blue-100 flex items-center justify-center">
                <span className="text-xs font-black text-blue-600">{index + 1}</span>
              </div>
              <div className="hidden md:flex w-10 h-10 rounded-lg bg-blue-100 items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-gray-900 line-clamp-1">
                  {log.title || '제목 없는 일지'}
                </h3>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">
                  {log.workSummary || '작업 요약 없음'}
                </p>
                <div className="md:hidden mt-1 flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                  <WeatherIcon weather={log.weather || 'clear'} />
                  <span>{log.temperature || '0'}°C</span>
                  <span className="text-gray-200">·</span>
                  <Calendar className="w-3 h-3" />
                  <span>{log.date}</span>
                </div>
              </div>
            </div>

            <div className="hidden md:flex md:col-span-2 items-center justify-center gap-1.5 text-xs font-bold text-gray-500">
              <WeatherIcon weather={log.weather || 'clear'} />
              <span>{log.temperature || '0'}°C</span>
            </div>

            <div className="hidden md:flex md:col-span-3 items-center justify-center text-xs font-bold text-gray-500">
              {log.date}
            </div>

            <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(log.id!);
                }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="p-2 text-blue-600">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
