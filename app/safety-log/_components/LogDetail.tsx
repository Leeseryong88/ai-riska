'use client';

import React, { useState } from 'react';
import { SafetyLog } from '../_lib/types';
import { Button, Card } from './ui/Button';
import { ChevronLeft, Edit, Printer, CheckCircle2, Sun, Cloud, CloudRain, Snowflake, Wind, Trash2 } from 'lucide-react';
import { cn } from '../_lib/utils';

interface LogDetailProps {
  log: SafetyLog;
  onEdit: (log: SafetyLog) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

const WeatherIcon = ({ weather }: { weather: string }) => {
  switch (weather) {
    case 'clear': return <Sun className="w-4 h-4 text-orange-500" />;
    case 'cloudy': return <Cloud className="w-4 h-4 text-gray-500" />;
    case 'rain': return <CloudRain className="w-4 h-4 text-blue-500" />;
    case 'snow': return <Snowflake className="w-4 h-4 text-cyan-500" />;
    case 'windy': return <Wind className="w-4 h-4 text-teal-500" />;
    default: return null;
  }
};

const weatherLabel = (weather?: string) => {
  switch (weather) {
    case 'clear': return '맑음';
    case 'cloudy': return '흐림';
    case 'rain': return '비';
    case 'snow': return '눈';
    case 'windy': return '강풍';
    default: return '미지정';
  }
};

export const LogDetail: React.FC<LogDetailProps> = ({ log, onEdit, onDelete, onBack }) => {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    const element = document.getElementById('safety-log-document');
    if (!element) return;

    setIsPrinting(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      
      const widthPx = element.offsetWidth;
      const heightPx = element.offsetHeight;
      const pdfWidthMm = 210;
      // 세로 길이를 분석하여 한 페이지에 맞게 높이 계산 (여유분 0.5mm 추가)
      const pdfHeightMm = (heightPx * pdfWidthMm) / widthPx + 0.5;
      
      const opt = {
        margin: 0,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          letterRendering: true,
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

      // PDF 블롭 생성 후 새 창에서 인쇄 대화상자 호출
      const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(blobUrl, '_blank');
      
      if (printWindow) {
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

  // Section numbering logic
  let sectionNum = 1;
  const getSectionNum = () => sectionNum++;

  return (
    <div className="space-y-8 pb-20">
      {/* Header Actions - Hidden when printing */}
      <div className="flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-sm py-4 z-20 border-b border-gray-100 -mx-4 px-4 md:-mx-8 md:px-8 print:hidden">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-gray-900 transition-colors">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-bold">목록으로</span>
        </button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-red-600 hover:bg-red-50 hover:border-red-200" onClick={() => onDelete(log.id!)}>
            <Trash2 className="w-4 h-4" /> 삭제
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => onEdit(log)}>
            <Edit className="w-4 h-4" /> 수정
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint} isLoading={isPrinting}>
            <Printer className="w-4 h-4" /> {isPrinting ? '준비중...' : '출력'}
          </Button>
        </div>
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-y-auto bg-gray-200/50 p-4 md:p-10 pb-24 md:pb-12 print:bg-white print:p-0">
        <div 
          id="safety-log-document" 
          className="bg-white border border-gray-300 shadow-xl rounded-none md:rounded-sm p-6 md:p-10 w-full max-w-[210mm] mx-auto min-h-[297mm] print:border-0 print:shadow-none print:p-0 print:max-w-none flex flex-col"
        >
          {/* Document Header */}
          <div className="text-center space-y-3 mb-6 border-b-4 border-double border-gray-900 pb-4">
            <h1 className="text-2xl font-black text-gray-900 tracking-[0.2em] underline underline-offset-8 uppercase">일일 안전 점검 일지</h1>
            {log.title && (
              <p className="text-sm font-black text-blue-600 mt-2">[{log.title}]</p>
            )}
            <p className="text-[10px] font-bold text-gray-400 uppercase">Daily Safety Inspection Log</p>
          </div>

          <section className="grid grid-cols-2 border-t-2 border-gray-900 mb-6">
            <div className="border-b border-r border-gray-200 p-3 bg-gray-50/50">
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">점검 일자</p>
              <p className="text-base font-black text-gray-900">{log.date}</p>
            </div>
            <div className="border-b border-gray-200 p-3 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">날씨 및 기온</p>
                <div className="flex items-center gap-1.5">
                  {log.weather && <WeatherIcon weather={log.weather} />}
                  <p className="text-xs font-bold text-gray-900">
                    {weatherLabel(log.weather)} {log.temperature ? `/ ${log.temperature}°C` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">작성자</p>
                <p className="text-xs font-bold text-gray-900">현장 안전관리자</p>
              </div>
            </div>
          </section>

          {/* 1. 현장 사진 대지 - Moved to top as requested */}
          {log.photos && log.photos.length > 0 && (
            <section className="mb-6">
              <h3 className="text-[11px] font-black text-gray-900 mb-2 flex items-center gap-2">
                <div className="w-1 h-3 bg-gray-900" />
                {getSectionNum()}. 현장 사진 대지
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {log.photos.map((photo, index) => (
                  <div key={index} className="space-y-1">
                    <div className="aspect-[16/9] rounded-sm overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                      <img 
                        src={photo} 
                        alt={`현장사진 ${index + 1}`} 
                        className="w-full h-full object-cover" 
                        crossOrigin="anonymous" 
                      />
                    </div>
                    <p className="text-[8px] font-bold text-gray-400 text-center">[사진 {index + 1}] 현장 점검 기록</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mb-6">
            <h3 className="text-[11px] font-black text-gray-900 mb-2 flex items-center gap-2">
              <div className="w-1 h-3 bg-gray-900" />
              {getSectionNum()}. 작업 요약
            </h3>
            <div className="p-3 bg-white border border-gray-200 rounded-sm">
              <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">{log.workSummary}</p>
            </div>
          </section>

          {log.manpower && (
            <section className="mb-6">
              <h3 className="text-[11px] font-black text-gray-900 mb-2 flex items-center gap-2">
                <div className="w-1 h-3 bg-gray-900" />
                {getSectionNum()}. 인원 투입 현황
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 flex flex-col items-center justify-center bg-blue-50/30 border border-blue-100 rounded-sm">
                  <p className="text-[8px] font-bold text-blue-400 uppercase mb-0.5">총원</p>
                  <p className="text-xs font-black text-blue-600">{log.manpower?.total || 0}명</p>
                </div>
                {log.manpower?.details && Object.entries(log.manpower.details).map(([role, count]) => (
                  <div key={role} className="p-2 flex flex-col items-center justify-center border border-gray-100 rounded-sm">
                    <p className="text-[8px] font-bold text-gray-400 uppercase mb-0.5">{role}</p>
                    <p className="text-xs font-black text-gray-900">{count}명</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mb-6">
            <h3 className="text-[11px] font-black text-gray-900 mb-2 flex items-center gap-2">
              <div className="w-1 h-3 bg-gray-900" />
              {getSectionNum()}. 주요 안전 점검 사항
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {log.safetyChecks?.map(item => (
                <div key={item.id} className={cn(
                  "flex items-center gap-2 p-1 border-b border-gray-50",
                  item.checked ? "opacity-100" : "opacity-40"
                )}>
                  <CheckCircle2 className={cn("w-3 h-3", item.checked ? "text-emerald-500" : "text-gray-300")} />
                  <span className={cn("text-[10px] font-bold", item.checked ? "text-gray-900" : "text-gray-400")}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {log.issues && (
            <section className="mb-6">
              <h3 className="text-[11px] font-black text-gray-900 mb-2 flex items-center gap-2">
                <div className="w-1 h-3 bg-gray-900" />
                {getSectionNum()}. 특이사항 및 조치계획
              </h3>
              <div className="p-3 bg-red-50/10 border border-red-100 rounded-sm">
                <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">{log.issues}</p>
              </div>
            </section>
          )}

          <p className="text-[9px] text-gray-400 text-center mt-auto pt-4 border-t border-gray-100">
            보고서 생성일: {new Date().toLocaleString('ko-KR')}
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .WorkspaceShell_sidebar, .TopBar_header, .print:hidden, 
          nav, aside, header, footer, button {
            display: none !important;
          }
          html, body, #__next, main, div, section {
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            position: static !important;
          }
          #safety-log-document {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 10mm !important;
            border: none !important;
            box-shadow: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};
