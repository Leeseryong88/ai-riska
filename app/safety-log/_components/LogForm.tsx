'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SafetyLog, Weather, SafetyCheckItem } from '../_lib/types';
import { Button, Input, Card, Label } from './ui/Button';
import { Sun, Cloud, CloudRain, Snowflake, Wind, Plus, Trash2, CheckCircle2, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { cn } from '../_lib/utils';
import { compressImage } from '@/app/lib/image-utils';

interface LogFormProps {
  initialData?: SafetyLog;
  onSubmit: (data: SafetyLog) => void;
  onCancel: () => void;
  submitting?: boolean;
}

const DEFAULT_CHECK_ITEMS: string[] = [
  '작업 전 안전교육 실시 여부',
  '개인보호구 착용 상태 점검',
  '작업장 정리정돈 및 통로 확보',
  '위험물 저장 및 취급 상태',
  '소화기 등 방화설비 비치 상태',
  '안전표지판 및 방호장치 설치 상태',
  '비상구 및 대피로 확보 여부'
];

export const LogForm: React.FC<LogFormProps> = ({ initialData, onSubmit, onCancel, submitting }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [formData, setFormData] = useState<Partial<SafetyLog>>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    weather: null as any,
    temperature: '',
    workSummary: '',
    manpower: null as any,
    safetyChecks: DEFAULT_CHECK_ITEMS.map((label, index) => ({
      id: `check-${index}`,
      label,
      checked: false
    })),
    issues: '',
    photos: []
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleManpowerToggle = () => {
    if (formData.manpower) {
      setFormData(prev => ({ ...prev, manpower: null as any }));
    } else {
      setFormData(prev => ({
        ...prev,
        manpower: { total: 0, details: { '직영': 0, '협력': 0 } }
      }));
    }
  };

  const handleManpowerChange = (role: string, count: number) => {
    if (!formData.manpower) return;
    const newDetails = { ...formData.manpower.details, [role]: count };
    const newTotal = Object.values(newDetails).reduce((sum, c) => sum + (c as number), 0);
    setFormData(prev => ({
      ...prev,
      manpower: { total: newTotal, details: newDetails }
    }));
  };

  const handleCheckToggle = (id: string) => {
    setFormData(prev => ({
      ...prev,
      safetyChecks: prev.safetyChecks?.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsCompressing(true);
    const newPhotos: string[] = [...(formData.photos || [])];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // 압축 실행 (최대 1200px, 품질 0.7)
        const compressed = await compressImage(file, 1200, 1200, 0.7);
        
        // Base64로 변환하여 미리보기 및 업로드 준비 (Firestore 연동 시 Storage URL로 교체 예정)
        if (compressed instanceof Blob) {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(compressed);
          });
          newPhotos.push(base64);
        }
      }
      setFormData(prev => ({ ...prev, photos: newPhotos }));
    } catch (error) {
      console.error('이미지 압축 오류:', error);
      alert('이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos?.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData as SafetyLog);
  };

  const weathers: { value: Weather; icon: any; label: string }[] = [
    { value: 'clear', icon: Sun, label: '맑음' },
    { value: 'cloudy', icon: Cloud, label: '흐림' },
    { value: 'rain', icon: CloudRain, label: '비' },
    { value: 'snow', icon: Snowflake, label: '눈' },
    { value: 'windy', icon: Wind, label: '강풍' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-4">
        <div className="space-y-2">
          <Label>일지 제목</Label>
          <Input
            type="text"
            placeholder="예: 00현장 주간 안전점검 일지"
            value={formData.title}
            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
            required
            className="text-lg font-bold"
          />
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>점검 일자</Label>
          <Input
            type="date"
            value={formData.date}
            onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>기온 (°C) <span className="text-[10px] text-gray-400 font-normal">(선택)</span></Label>
          <Input
            type="number"
            placeholder="25"
            value={formData.temperature}
            onChange={e => setFormData(prev => ({ ...prev, temperature: e.target.value }))}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>날씨 상태 <span className="text-[10px] text-gray-400 font-normal">(선택)</span></Label>
          {formData.weather && (
            <button 
              type="button" 
              onClick={() => setFormData(prev => ({ ...prev, weather: null as any }))}
              className="text-[10px] text-red-500 font-bold hover:underline"
            >
              선택 해제
            </button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {weathers.map(w => (
            <button
              key={w.value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, weather: w.value }))}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-xl border transition-all",
                formData.weather === w.value
                  ? "bg-blue-50 border-blue-200 text-blue-600 shadow-sm"
                  : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
              )}
            >
              <w.icon className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-bold">{w.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>출력 인원 현황 <span className="text-[10px] text-gray-400 font-normal">(선택)</span></Label>
          <button 
            type="button" 
            onClick={handleManpowerToggle}
            className={cn(
              "text-[10px] font-bold transition-colors",
              formData.manpower ? "text-red-500" : "text-blue-600"
            )}
          >
            {formData.manpower ? "입력 취소" : "인원 정보 추가"}
          </button>
        </div>
        {formData.manpower ? (
          <Card className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500">총 투입 인원</span>
              <span className="text-sm font-black text-blue-600">{formData.manpower.total}명</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase">직영</span>
                <Input
                  type="number"
                  min="0"
                  value={formData.manpower.details?.['직영'] || 0}
                  onChange={e => handleManpowerChange('직영', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase">협력업체</span>
                <Input
                  type="number"
                  min="0"
                  value={formData.manpower.details?.['협력'] || 0}
                  onChange={e => handleManpowerChange('협력', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </Card>
        ) : (
          <div className="p-4 border border-dashed border-gray-200 rounded-xl text-center">
            <p className="text-xs text-gray-400">인원 현황이 선택되지 않았습니다.</p>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <Label>작업 요약</Label>
        <textarea
          className="w-full min-h-[100px] rounded-xl border border-gray-200 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="오늘의 주요 작업 내용을 입력하세요..."
          value={formData.workSummary}
          onChange={e => setFormData(prev => ({ ...prev, workSummary: e.target.value }))}
          required
        />
      </section>

      <section className="space-y-4">
        <Label>현장 사진 <span className="text-[10px] text-gray-400 font-normal">(선택)</span></Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {formData.photos?.map((photo, index) => (
            <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-gray-100 group">
              <img src={photo} alt={`현장사진 ${index + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressing}
            className="aspect-square flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all bg-gray-50/50"
          >
            {isCompressing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <ImageIcon className="w-5 h-5" />
                <span className="text-[10px] font-bold">사진 추가</span>
              </>
            )}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhotoUpload}
          className="hidden"
        />
        <p className="text-[10px] text-gray-400">이미지는 자동으로 압축되어 최적화됩니다.</p>
      </section>

      <section className="space-y-4">
        <Label>안전 점검 항목</Label>
        <div className="space-y-2">
          {formData.safetyChecks?.map(item => (
            <div
              key={item.id}
              onClick={() => handleCheckToggle(item.id)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                item.checked
                  ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                  : "bg-white border-gray-100 text-gray-500 hover:border-gray-200"
              )}
            >
              <CheckCircle2 className={cn("w-5 h-5", item.checked ? "text-emerald-500" : "text-gray-200")} />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <Label>특이사항 및 조치계획 <span className="text-[10px] text-gray-400 font-normal">(선택)</span></Label>
        <textarea
          className="w-full min-h-[100px] rounded-xl border border-gray-200 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="사고 징후, 위험요인 발굴 또는 안전 조치 사항을 입력하세요..."
          value={formData.issues}
          onChange={e => setFormData(prev => ({ ...prev, issues: e.target.value }))}
        />
      </section>

      <div className="flex gap-3 pt-6 border-t border-gray-100">
        <Button variant="outline" type="button" className="flex-1" onClick={onCancel}>취소</Button>
        <Button type="submit" className="flex-1" isLoading={submitting || isCompressing}>
          {initialData ? '일지 수정 완료' : '일지 저장하기'}
        </Button>
      </div>
    </form>
  );
};
