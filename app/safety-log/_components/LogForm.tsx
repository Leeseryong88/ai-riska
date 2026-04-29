'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SafetyLog, Weather } from '../_lib/types';
import { Button, Input, Card, Label } from './ui/Button';
import { Sun, Cloud, CloudRain, Snowflake, Wind, Plus, Trash2, CheckCircle2, Image as ImageIcon, X, Loader2, MessageSquarePlus } from 'lucide-react';
import { cn } from '../_lib/utils';
import { compressImage } from '@/app/lib/image-utils';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';

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

const MANPOWER_SELECT_PREFIX = '__select_affiliation__';

export const LogForm: React.FC<LogFormProps> = ({ initialData, onSubmit, onCancel, submitting }) => {
  const { user, userProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [contractorNames, setContractorNames] = useState<string[]>([]);
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

  useEffect(() => {
    const loadContractors = async () => {
      if (!user) {
        setContractorNames([]);
        return;
      }

      try {
        const q = query(
          collection(db, 'contractor_partners'),
          where('managerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const names = snap.docs
          .map((doc) => String(doc.data().companyName || '').trim())
          .filter(Boolean);
        setContractorNames(Array.from(new Set(names)));
      } catch (error) {
        console.error('협력업체 목록 로드 오류:', error);
      }
    };

    loadContractors();
  }, [user]);

  const affiliationOptionItems = useMemo(() => {
    const ownOrganization = userProfile?.organization?.trim();
    const items: Array<{ value: string; type: 'own' | 'contractor' }> = [];
    if (ownOrganization) items.push({ value: ownOrganization, type: 'own' });
    contractorNames.forEach((name) => items.push({ value: name, type: 'contractor' }));

    const unique = new Map<string, { value: string; type: 'own' | 'contractor' }>();
    items.forEach((item) => {
      if (!unique.has(item.value)) unique.set(item.value, item);
    });
    return Array.from(unique.values());
  }, [contractorNames, userProfile?.organization]);

  const affiliationOptions = useMemo(
    () => affiliationOptionItems.map((option) => option.value),
    [affiliationOptionItems]
  );

  const isPendingAffiliation = (affiliation: string) => affiliation.startsWith(MANPOWER_SELECT_PREFIX);

  const makePendingAffiliation = (details: Record<string, number>) => {
    let index = 1;
    while (Object.prototype.hasOwnProperty.call(details, `${MANPOWER_SELECT_PREFIX}${index}`)) {
      index += 1;
    }
    return `${MANPOWER_SELECT_PREFIX}${index}`;
  };

  const getSelectableAffiliationOptions = (details: Record<string, number>, currentAffiliation: string) => {
    return affiliationOptionItems.filter(
      (option) => option.value === currentAffiliation || !Object.prototype.hasOwnProperty.call(details, option.value)
    );
  };

  const makeUniqueAffiliation = (base: string, details: Record<string, number>, exclude?: string) => {
    const cleanBase = base.trim() || '직접입력';
    if (cleanBase === exclude || !Object.prototype.hasOwnProperty.call(details, cleanBase)) return cleanBase;
    let index = 2;
    while (Object.prototype.hasOwnProperty.call(details, `${cleanBase} ${index}`)) {
      index += 1;
    }
    return `${cleanBase} ${index}`;
  };

  const recalculateManpower = (details: Record<string, number>) => ({
    total: Object.values(details).reduce((sum, count) => sum + (Number(count) || 0), 0),
    details,
  });

  const handleManpowerToggle = () => {
    if (formData.manpower) {
      setFormData(prev => ({ ...prev, manpower: null as any }));
    } else {
      setFormData(prev => ({
        ...prev,
        manpower: { total: 0, details: { [MANPOWER_SELECT_PREFIX + '1']: 0 } }
      }));
    }
  };

  const handleManpowerCountChange = (affiliation: string, count: number) => {
    if (!formData.manpower) return;
    const newDetails = { ...formData.manpower.details, [affiliation]: count };
    setFormData(prev => ({
      ...prev,
      manpower: recalculateManpower(newDetails)
    }));
  };

  const handleManpowerAffiliationChange = (currentAffiliation: string, nextAffiliation: string) => {
    if (!formData.manpower) return;
    const currentDetails = formData.manpower.details || {};
    const { [currentAffiliation]: currentCount = 0, ...rest } = currentDetails;
    const cleanNext = makeUniqueAffiliation(nextAffiliation === '__custom__' ? '직접입력' : nextAffiliation, rest, currentAffiliation);
    setFormData(prev => ({
      ...prev,
      manpower: recalculateManpower({ ...rest, [cleanNext]: currentCount })
    }));
  };

  const addManpowerRow = () => {
    if (!formData.manpower) return;
    const details = formData.manpower.details || {};
    const nextAffiliation = makePendingAffiliation(details);
    setFormData(prev => ({
      ...prev,
      manpower: recalculateManpower({ ...details, [nextAffiliation]: 0 })
    }));
  };

  const removeManpowerRow = (affiliation: string) => {
    if (!formData.manpower) return;
    const { [affiliation]: _removed, ...rest } = formData.manpower.details || {};
    setFormData(prev => ({
      ...prev,
      manpower: Object.keys(rest).length ? recalculateManpower(rest) : { total: 0, details: {} }
    }));
  };

  const handleCheckToggle = (id: string) => {
    setFormData(prev => ({
      ...prev,
      safetyChecks: prev.safetyChecks?.map(item =>
        item.id === id
          ? { ...item, checked: !item.checked, remark: item.checked ? undefined : item.remark }
          : item
      )
    }));
  };

  const handleCheckRemarkChange = (id: string, remark: string | undefined) => {
    setFormData(prev => ({
      ...prev,
      safetyChecks: prev.safetyChecks?.map(item =>
        item.id === id ? { ...item, remark } : item
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
    const cleanData = { ...formData };
    if (cleanData.manpower?.details) {
      const details = Object.fromEntries(
        Object.entries(cleanData.manpower.details).filter(([affiliation]) => !isPendingAffiliation(affiliation))
      ) as Record<string, number>;
      cleanData.manpower = Object.keys(details).length ? recalculateManpower(details) : undefined;
    }
    onSubmit(cleanData as SafetyLog);
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
            placeholder="예: OO 주간 안전점검 일지"
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
          <Label>작업인원 <span className="text-[10px] text-gray-400 font-normal">(선택)</span></Label>
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
            {contractorNames.length === 0 && (
              <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                협력업체를 등록하여 선택할 수 있습니다.
              </div>
            )}
            <div className="space-y-3">
              {Object.entries(formData.manpower.details || {}).map(([affiliation, count]) => {
                const details = formData.manpower?.details || {};
                const selectableOptions = getSelectableAffiliationOptions(details, affiliation);
                const isPending = isPendingAffiliation(affiliation);
                const isKnownAffiliation = affiliationOptions.includes(affiliation);
                const selectedOption = affiliationOptionItems.find((option) => option.value === affiliation);
                const isContractor = selectedOption?.type === 'contractor';
                return (
                  <div key={affiliation} className="grid gap-2 rounded-xl border border-gray-100 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">소속</span>
                      <select
                        value={isPending ? affiliation : isKnownAffiliation ? affiliation : '__custom__'}
                        onChange={e => handleManpowerAffiliationChange(affiliation, e.target.value)}
                        className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                      >
                        {isPending && <option value={affiliation}>선택하기</option>}
                        {selectableOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.type === 'contractor' ? `협력업체 · ${option.value}` : option.value}
                          </option>
                        ))}
                        <option value="__custom__">직접입력</option>
                      </select>
                      {isContractor && (
                        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">협력업체</span>
                          <span className="min-w-0 truncate">{affiliation}</span>
                        </div>
                      )}
                      {!isKnownAffiliation && !isPending && (
                        <Input
                          type="text"
                          value={affiliation}
                          onChange={e => handleManpowerAffiliationChange(affiliation, e.target.value)}
                          placeholder="소속 직접 입력"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">인원</span>
                      <Input
                        type="number"
                        min="0"
                        disabled={isPending}
                        value={count || 0}
                        onChange={e => handleManpowerCountChange(affiliation, parseInt(e.target.value) || 0)}
                        placeholder={isPending ? '소속 선택 후 입력' : undefined}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeManpowerRow(affiliation)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-300 transition hover:bg-red-50 hover:text-red-500"
                      aria-label={`${affiliation} 작업인원 삭제`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addManpowerRow}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 py-2 text-xs font-black text-blue-600 transition hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" />
                소속 추가
              </button>
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
        <Label>사진 <span className="text-[10px] text-gray-400 font-normal">(선택)</span></Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {formData.photos?.map((photo, index) => (
            <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-gray-100 group">
              <img src={photo} alt={`사진 ${index + 1}`} className="w-full h-full object-cover" />
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
            <div key={item.id} className="space-y-2">
              <div
                onClick={() => handleCheckToggle(item.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                  item.checked
                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                    : "bg-white border-gray-100 text-gray-500 hover:border-gray-200"
                )}
              >
                <CheckCircle2 className={cn("w-5 h-5", item.checked ? "text-emerald-500" : "text-gray-200")} />
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                {item.checked && item.remark === undefined && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCheckRemarkChange(item.id, '');
                    }}
                    className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-white"
                    title="의견 추가"
                    aria-label={`${item.label} 의견 추가`}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </button>
                )}
              </div>
              {item.checked && item.remark !== undefined && (
                <div className="ml-8 space-y-1">
                  <textarea
                    className="w-full min-h-[72px] rounded-xl border border-emerald-100 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    placeholder="점검 의견을 입력하세요..."
                    value={item.remark}
                    onChange={e => handleCheckRemarkChange(item.id, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => handleCheckRemarkChange(item.id, undefined)}
                    className="text-[10px] font-bold text-gray-400 hover:text-red-500"
                  >
                    의견 입력 취소
                  </button>
                </div>
              )}
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
