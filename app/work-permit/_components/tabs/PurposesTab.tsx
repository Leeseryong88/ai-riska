'use client';

import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, getDocs, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where } from 'firebase/firestore';
import { db, auth } from '@/app/lib/firebase';
import { VisitPurpose, FormField } from '../../_lib/types';
import { Card, Button, Input, Label } from '../ui/Button';
import { Plus, Trash2, Edit2, Save, X, GripVertical, Loader2, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../_lib/utils';

export const PurposesTab: React.FC = () => {
  const [purposes, setPurposes] = useState<VisitPurpose[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPurpose, setEditingPurpose] = useState<Partial<VisitPurpose> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSafetyPresetModalOpen, setIsSafetyPresetModalOpen] = useState(false);
  const [selectedPresetIndices, setSelectedPresetIndices] = useState<number[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchPurposes(user.uid);
      } else {
        setPurposes([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const SAFETY_PRESETS: Partial<VisitPurpose>[] = [
    {
      name: '화기작업 허가서',
      description: '용접, 용단, 연마 등 불꽃·열·스파크 발생 작업',
      isActive: true,
      showSafetyInfo: true,
      safetyHazards: [
        '용접 불꽃 및 스파크에 의한 화재 발생 위험',
        '가연성 가스 체류 시 폭발 위험',
        '고열에 의한 화상 위험',
        '흄(Fume) 및 유해가스에 의한 질식/중독 위험'
      ],
      safetyPrecautions: [
        '작업 반경 10m 이내 가연물 제거 및 방염시트 설치',
        '작업 구역 내 소화기 비치 및 화재감시자 배치',
        '작업 전/중 가연성 가스 농도 측정',
        '작업 종료 후 1시간 이상 잔불 감시 실시'
      ],
      fields: [
        { id: 'work_start', label: '작업 시작 일시', type: 'datetime-local', required: true },
        { id: 'work_end', label: '작업 종료 예정 일시', type: 'datetime-local', required: true },
        { id: 'worker_company', label: '소속 (업체명)', type: 'text', required: true },
        { id: 'worker_name', label: '작업자 성함', type: 'text', required: true },
        { id: 'worker_contact', label: '작업자 연락처', type: 'tel', required: true },
        { id: 'work_location', label: '상세 작업 장소', type: 'text', required: true },
        { id: 'hot_work_type', label: '작업 종류', type: 'select', required: true, options: ['용접', '용단', '그라인딩', '절단', '기타'] },
        { id: 'watcher_name', label: '화재감시자 성함', type: 'text', required: true, placeholder: '해당 없는 경우 "없음" 입력' },
        { id: 'check_combustibles', label: '가연물 제거 및 방염시트 설치', type: 'radio', required: true, options: ['조치 완료', '해당 없음'] },
        { id: 'check_extinguisher', label: '소화기 비치 상태', type: 'radio', required: true, options: ['비치 완료', '해당 없음'] },
        { id: 'gas_check', label: '인화성 가스 농도 측정', type: 'text', required: true, placeholder: '측정치 입력 (해당 없으면 "N/A")' },
      ]
    },
    {
      name: '밀폐공간 작업 허가서',
      description: '탱크, 맨홀, 지하 pit 등 환기 불충분 공간 작업',
      isActive: true,
      showSafetyInfo: true,
      safetyHazards: [
        '산소 결핍에 의한 질식 사고',
        '황화수소, 일산화탄소 등 유해가스 중독',
        '가연성 가스 폭발 위험',
        '추락 및 고립 위험'
      ],
      safetyPrecautions: [
        '작업 전 산소 및 유해가스 농도 측정 필수',
        '작업 중 지속적인 강제 환기 실시',
        '외부 감시인 배치 및 비상 연락 체계 구축',
        '송기 마스크 등 개인 보호구 착용'
      ],
      fields: [
        { id: 'work_start', label: '작업 시작 일시', type: 'datetime-local', required: true },
        { id: 'work_end', label: '작업 종료 예정 일시', type: 'datetime-local', required: true },
        { id: 'worker_company', label: '소속 (업체명)', type: 'text', required: true },
        { id: 'worker_name', label: '작업자 성함', type: 'text', required: true },
        { id: 'worker_contact', label: '작업자 연락처', type: 'tel', required: true },
        { id: 'oxygen_level', label: '산소 농도 (%)', type: 'text', required: true, placeholder: '측정치 입력 (예: 20.9%)' },
        { id: 'gas_levels', label: '유해가스 농도 (CO, H2S 등)', type: 'text', required: true, placeholder: '측정치 입력 (없으면 "불검출")' },
        { id: 'watcher_name', label: '외부 감시인 성함', type: 'text', required: true },
        { id: 'ventilation', label: '환기 설비 가동 상태', type: 'radio', required: true, options: ['가동 중', '해당 없음(자연환기 충분)'] },
        { id: 'rescue_gear', label: '구조 장비 및 보호구 확보', type: 'radio', required: true, options: ['확보 완료', '해당 없음'] },
      ]
    },
    {
      name: '정전·에너지 차단 작업 허가서 (LOTO)',
      description: '기계 정비, 수리 등 에너지 차단 필요 작업',
      isActive: true,
      showSafetyInfo: true,
      safetyHazards: [
        '불시 가동에 의한 협착 및 절단 사고',
        '잔류 에너지(전기, 압력 등)에 의한 감전/충격',
        '유압/공압 해제 시 설비 낙하 위험'
      ],
      safetyPrecautions: [
        '전원 차단 후 개인별 잠금장치(Lock) 및 표식(Tag) 설치',
        '잔류 에너지 완전히 제거 후 확인 작업 실시',
        '작업자 전원이 잠금장치를 해제하기 전까지 재가동 금지',
        '조작 금지 표지판 설치'
      ],
      fields: [
        { id: 'work_start', label: '작업 시작 일시', type: 'datetime-local', required: true },
        { id: 'work_end', label: '작업 종료 예정 일시', type: 'datetime-local', required: true },
        { id: 'worker_company', label: '소속 (업체명)', type: 'text', required: true },
        { id: 'worker_name', label: '작업자 성함', type: 'text', required: true },
        { id: 'worker_contact', label: '작업자 연락처', type: 'tel', required: true },
        { id: 'energy_type', label: '차단 에너지 종류', type: 'checkbox', required: true, options: ['전기', '유압', '공압', '증기', '기타'] },
        { id: 'lock_id', label: '잠금 장치(Lock) 번호', type: 'text', required: true, placeholder: '사용 중인 잠금장치 번호' },
        { id: 'tag_check', label: '표식(Tag) 부착 상태', type: 'radio', required: true, options: ['부착 완료', '해당 없음'] },
        { id: 'residual_energy', label: '잔류 에너지 제거 상태', type: 'radio', required: true, options: ['제거 완료', '해당 없음'] },
      ]
    },
    {
      name: '고소작업 허가서',
      description: '2m 이상 높이에서의 추락 위험 작업',
      isActive: true,
      showSafetyInfo: true,
      safetyHazards: [
        '작업자 추락에 의한 중대재해',
        '공구 및 자재 낙하에 의한 하부 행인 사고',
        '강풍 등 기상 악화 시 전도 위험'
      ],
      safetyPrecautions: [
        '안전대(하네스) 착용 및 안전고리 체결 필수',
        '견고한 작업발판 및 안전난간 설치 확인',
        '하부 출입통제 구역 설정 및 감시자 배치',
        '악천후(강풍, 강우, 강설) 시 작업 중지'
      ],
      fields: [
        { id: 'work_start', label: '작업 시작 일시', type: 'datetime-local', required: true },
        { id: 'work_end', label: '작업 종료 예정 일시', type: 'datetime-local', required: true },
        { id: 'worker_company', label: '소속 (업체명)', type: 'text', required: true },
        { id: 'worker_name', label: '작업자 성함', type: 'text', required: true },
        { id: 'worker_contact', label: '작업자 연락처', type: 'tel', required: true },
        { id: 'work_height', label: '작업 높이 (m)', type: 'text', required: true },
        { id: 'harness_check', label: '안전대(하네스) 착용 및 고리체결', type: 'radio', required: true, options: ['체결 완료', '해당 없음(고소작업대 내부)'] },
        { id: 'scaffold_check', label: '작업발판/비계 상태 점검', type: 'radio', required: true, options: ['점검 양호', '해당 없음(사다리 등)'] },
        { id: 'weather_check', label: '기상 조건 확인 (강풍 등)', type: 'radio', required: true, options: ['작업 가능', '작업 불가'] },
      ]
    },
    {
      name: '굴착작업 허가서',
      description: '지반 굴착, 터파기 등 붕괴 위험 작업',
      isActive: true,
      showSafetyInfo: true,
      safetyHazards: [
        '굴착면 붕괴에 의한 매몰 사고',
        '지하 매설물(가스관, 케이블 등) 파손 및 폭발',
        '장비(굴착기 등) 전도 및 협착'
      ],
      safetyPrecautions: [
        '지반 종류에 따른 안전 기울기 준수 및 흙막이 지보공 설치',
        '작업 전 지하 매설물 위치 확인 및 표식 설치',
        '굴착 상부 하중(장비, 자재) 적재 금지',
        '작업 구역 내 관계자 외 출입 통제'
      ],
      fields: [
        { id: 'work_start', label: '작업 시작 일시', type: 'datetime-local', required: true },
        { id: 'work_end', label: '작업 종료 예정 일시', type: 'datetime-local', required: true },
        { id: 'worker_company', label: '소속 (업체명)', type: 'text', required: true },
        { id: 'worker_name', label: '작업자 성함', type: 'text', required: true },
        { id: 'worker_contact', label: '작업자 연락처', type: 'tel', required: true },
        { id: 'dig_depth', label: '굴착 깊이 (m)', type: 'text', required: true },
        { id: 'underground_check', label: '지하 매설물 사전 조사', type: 'radio', required: true, options: ['조사 완료', '해당 없음'] },
        { id: 'shoring_check', label: '흙막이/지보공 설치 상태', type: 'select', required: true, options: ['설치 완료', '해당 없음(경사면 확보)', '보강 필요'] },
        { id: 'access_control', label: '접근 금지 구역 설정', type: 'radio', required: true, options: ['설정 완료', '해당 없음'] },
      ]
    },
    {
      name: '중량물 취급/양중작업 허가서',
      description: '크레인 등을 이용한 중량물 이동 작업',
      isActive: true,
      showSafetyInfo: true,
      safetyHazards: [
        '줄걸이 와이어 파단으로 인한 화물 낙하',
        '양중 장비(크레인 등) 전도 사고',
        '화물과 주변 구조물 사이에 협착'
      ],
      safetyPrecautions: [
        '장비별 정격 하중 준수 및 과부하 방지장치 작동 확인',
        '신호수 지정 및 표준 신호 체계 준수',
        '작업 반경 내 출입 통제 및 하부 통행 금지',
        '와이어로프 및 슬링벨트 사전 점검'
      ],
      fields: [
        { id: 'work_start', label: '작업 시작 일시', type: 'datetime-local', required: true },
        { id: 'work_end', label: '작업 종료 예정 일시', type: 'datetime-local', required: true },
        { id: 'worker_company', label: '소속 (업체명)', type: 'text', required: true },
        { id: 'worker_name', label: '작업자 성함', type: 'text', required: true },
        { id: 'worker_contact', label: '작업자 연락처', type: 'tel', required: true },
        { id: 'load_weight', label: '중량물 무게 (ton)', type: 'text', required: true },
        { id: 'signal_person', label: '신호수 지정 및 배치', type: 'text', required: true, placeholder: '신호수 성함 입력' },
        { id: 'gear_check', label: '와이어/슬링 상태 점검', type: 'radio', required: true, options: ['점검 완료', '해당 없음'] },
        { id: 'radius_control', label: '작업 반경 출입 통제', type: 'radio', required: true, options: ['통제 실시', '해당 없음'] },
      ]
    },
    {
      name: '화학물질 취급 작업 허가서',
      description: '유해·위험 화학물질 취급, 이송, 혼합 작업',
      isActive: true,
      showSafetyInfo: true,
      safetyHazards: [
        '유해물질 누출에 의한 중독 및 화학 화상',
        '인화성 물질에 의한 화재 및 폭발',
        '화학 반응에 의한 유해가스 발생'
      ],
      safetyPrecautions: [
        '해당 물질의 MSDS 숙지 및 현장 비치',
        '물질 특성에 맞는 보호구(방독마스크, 내화학장갑 등) 착용',
        '누출 방지 턱(Dike) 설치 및 비상 세척 시설 확보',
        '화기 엄금 및 정전기 방지 조치'
      ],
      fields: [
        { id: 'work_start', label: '작업 시작 일시', type: 'datetime-local', required: true },
        { id: 'work_end', label: '작업 종료 예정 일시', type: 'datetime-local', required: true },
        { id: 'worker_company', label: '소속 (업체명)', type: 'text', required: true },
        { id: 'worker_name', label: '작업자 성함', type: 'text', required: true },
        { id: 'worker_contact', label: '작업자 연락처', type: 'tel', required: true },
        { id: 'chemical_name', label: '취급 화학물질 명칭', type: 'text', required: true },
        { id: 'msds_check', label: 'MSDS 내용 숙지 및 비치', type: 'radio', required: true, options: ['확인 완료', '해당 없음'] },
        { id: 'ppe_check', label: '전용 보호구 착용 확인', type: 'radio', required: true, options: ['착용 완료', '해당 없음'] },
        { id: 'emergency_plan', label: '비상 조치 계획 및 장비', type: 'radio', required: true, options: ['수립 완료', '해당 없음'] },
      ]
    }
  ];

  const fetchPurposes = async (uid?: string) => {
    const userId = uid || auth.currentUser?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, 'purposes'),
        where('ownerId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      setPurposes(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as VisitPurpose)));
    } catch (error) {
      console.error('Error fetching purposes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSafetyPresets = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    if (selectedPresetIndices.length === 0) {
      alert('추가할 양식을 하나 이상 선택해주세요.');
      return;
    }

    setLoading(true);
    const presetsToAdd = selectedPresetIndices.map(index => SAFETY_PRESETS[index]);

    try {
      for (const preset of presetsToAdd) {
        await addDoc(collection(db, 'purposes'), {
          ...preset,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      alert(`${presetsToAdd.length}가지 안전작업 허가서 양식이 추가되었습니다.`);
      setIsSafetyPresetModalOpen(false);
      setSelectedPresetIndices([]);
      fetchPurposes();
    } catch (error) {
      console.error('Error adding safety presets:', error);
      alert('양식 추가 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const togglePresetSelection = (index: number) => {
    setSelectedPresetIndices(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index) 
        : [...prev, index]
    );
  };

  const toggleAllPresets = () => {
    if (selectedPresetIndices.length === SAFETY_PRESETS.length) {
      setSelectedPresetIndices([]);
    } else {
      setSelectedPresetIndices(SAFETY_PRESETS.map((_, i) => i));
    }
  };

  const handleOpenModal = (purpose?: VisitPurpose) => {
    if (purpose) {
      setEditingPurpose({ ...purpose });
    } else {
      setEditingPurpose({
        name: '',
        description: '',
        isActive: true,
        showSafetyInfo: false,
        safetyHazards: [''],
        safetyPrecautions: [''],
        fields: [
          { id: 'work_start', label: '작업 시작 일시', type: 'datetime-local', required: true },
          { id: 'work_end', label: '작업 종료 예정 일시', type: 'datetime-local', required: true },
          { id: 'worker_company', label: '소속 (업체명)', type: 'text', required: true },
          { id: 'worker_name', label: '작업자 성함', type: 'text', required: true },
          { id: 'worker_contact', label: '연락처', type: 'tel', required: true },
        ],
      });
    }
    setIsModalOpen(true);
  };

  const handleAddSafetyItem = (type: 'hazards' | 'precautions') => {
    if (!editingPurpose) return;
    const field = type === 'hazards' ? 'safetyHazards' : 'safetyPrecautions';
    setEditingPurpose({
      ...editingPurpose,
      [field]: [...(editingPurpose[field] || []), ''],
    });
  };

  const handleRemoveSafetyItem = (type: 'hazards' | 'precautions', index: number) => {
    if (!editingPurpose) return;
    const field = type === 'hazards' ? 'safetyHazards' : 'safetyPrecautions';
    setEditingPurpose({
      ...editingPurpose,
      [field]: (editingPurpose[field] || []).filter((_, i) => i !== index),
    });
  };

  const handleSafetyItemChange = (type: 'hazards' | 'precautions', index: number, value: string) => {
    if (!editingPurpose) return;
    const field = type === 'hazards' ? 'safetyHazards' : 'safetyPrecautions';
    const newList = [...(editingPurpose[field] || [])];
    newList[index] = value;
    setEditingPurpose({
      ...editingPurpose,
      [field]: newList,
    });
  };

  const handleAddField = () => {
    if (!editingPurpose) return;
    const newField: FormField = {
      id: `field_${Date.now()}`,
      label: '새 항목',
      type: 'text',
      required: false,
    };
    setEditingPurpose({
      ...editingPurpose,
      fields: [...(editingPurpose.fields || []), newField],
    });
  };

  const handleRemoveField = (id: string) => {
    if (!editingPurpose) return;
    setEditingPurpose({
      ...editingPurpose,
      fields: editingPurpose.fields?.filter(f => f.id !== id),
    });
  };

  const handleFieldChange = (id: string, updates: Partial<FormField>) => {
    if (!editingPurpose) return;
    setEditingPurpose({
      ...editingPurpose,
      fields: editingPurpose.fields?.map(f => f.id === id ? { ...f, ...updates } : f),
    });
  };

  const handleSave = async () => {
    if (!editingPurpose || !editingPurpose.name) return;
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Clean up fields (especially options)
      const cleanedFields = editingPurpose.fields?.map(f => {
        if (f.options) {
          return {
            ...f,
            options: f.options.map(opt => opt.trim()).filter(Boolean)
          };
        }
        return f;
      });

      const purposeData = {
        ...editingPurpose,
        fields: cleanedFields,
        safetyHazards: editingPurpose.safetyHazards?.map(h => h.trim()).filter(Boolean) || [],
        safetyPrecautions: editingPurpose.safetyPrecautions?.map(p => p.trim()).filter(Boolean) || [],
        ownerId: user.uid,
        updatedAt: serverTimestamp(),
      };

      if (editingPurpose.id) {
        const { id, ...data } = purposeData;
        await updateDoc(doc(db, 'purposes', id as string), data as any);
      } else {
        await addDoc(collection(db, 'purposes'), {
          ...purposeData,
          createdAt: serverTimestamp(),
        });
      }
      setIsModalOpen(false);
      fetchPurposes();
    } catch (error) {
      console.error('Error saving purpose:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'purposes', id));
      fetchPurposes();
    } catch (error) {
      console.error('Error deleting purpose:', error);
    }
  };

  if (loading && purposes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">허가서 양식 관리</h1>
          <p className="text-sm text-gray-500">작업 종류별 안전작업 허가서 양식을 구성합니다.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setIsSafetyPresetModalOpen(true)} className="gap-2 h-11 sm:h-auto border-blue-200 text-blue-700 hover:bg-blue-50">
            <ShieldAlert className="w-4 h-4" /> 안전 양식 세트 추가
          </Button>
          <Button onClick={() => handleOpenModal()} className="gap-2 h-11 sm:h-auto">
            <Plus className="w-4 h-4" /> 새 양식 만들기
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {purposes.length === 0 && !loading ? (
          <>
            <button
              onClick={() => setIsSafetyPresetModalOpen(true)}
              className="group p-8 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50/50 transition-all text-center min-h-[200px]"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">표준 안전 양식 추가</h3>
                <p className="text-sm text-gray-500 mt-1">준비된 7가지 표준 양식 중<br />필요한 양식을 선택해 바로 시작하세요.</p>
              </div>
            </button>

            <button
              onClick={() => handleOpenModal()}
              className="group p-8 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50/50 transition-all text-center min-h-[200px]"
            >
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">새 양식 직접 만들기</h3>
                <p className="text-sm text-gray-500 mt-1">우리 현장에 꼭 맞는<br />독자적인 허가서 양식을 구성합니다.</p>
              </div>
            </button>
          </>
        ) : (
          purposes.map((purpose) => (
            <Card key={purpose.id} className="p-6 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{purpose.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{purpose.description || '설명 없음'}</p>
                </div>
                <div className={cn(
                  'px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider',
                  purpose.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {purpose.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
              
              <div className="mt-auto pt-6 flex items-center gap-2 border-t border-gray-100">
                <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => handleOpenModal(purpose)}>
                  <Edit2 className="w-3.5 h-3.5" /> 수정
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-100" onClick={() => handleDelete(purpose.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Safety Preset Selection Modal */}
      <AnimatePresence>
        {isSafetyPresetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">안전 양식 세트 선택</h2>
                  <p className="text-sm text-gray-500">추가할 안전작업 허가서 양식을 선택해주세요.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsSafetyPresetModalOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-50">
                  <span className="text-sm font-medium text-gray-600">전체 {SAFETY_PRESETS.length}개 중 {selectedPresetIndices.length}개 선택됨</span>
                  <Button variant="ghost" size="sm" onClick={toggleAllPresets} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8">
                    {selectedPresetIndices.length === SAFETY_PRESETS.length ? '전체 해제' : '전체 선택'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {SAFETY_PRESETS.map((preset, index) => (
                    <div
                      key={index}
                      onClick={() => togglePresetSelection(index)}
                      className={cn(
                        "group p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-4",
                        selectedPresetIndices.includes(index)
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-100 hover:border-blue-200 hover:bg-gray-50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        selectedPresetIndices.includes(index)
                          ? "bg-blue-500 border-blue-500"
                          : "border-gray-300 bg-white group-hover:border-blue-400"
                      )}>
                        {selectedPresetIndices.includes(index) && (
                          <div className="w-2.5 h-2.5 bg-white rounded-sm" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900">{preset.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{preset.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                <Button variant="outline" onClick={() => setIsSafetyPresetModalOpen(false)} className="flex-1">취소</Button>
                <Button 
                  onClick={handleAddSafetyPresets} 
                  className="flex-[2] gap-2"
                  disabled={selectedPresetIndices.length === 0 || loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> {selectedPresetIndices.length}개 양식 추가하기
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">
                  {editingPurpose?.id ? '허가서 양식 수정' : '새 허가서 양식 추가'}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 pb-24 md:pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs md:text-sm font-bold text-gray-700">허가서 명칭</Label>
                    <Input
                      placeholder="예: 화기작업 허가서, 고소작업 허가서"
                      value={editingPurpose?.name || ''}
                      onChange={(e) => setEditingPurpose({ ...editingPurpose, name: e.target.value })}
                      className="h-11 md:h-auto"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs md:text-sm font-bold text-gray-700">설명</Label>
                    <Input
                      placeholder="간단한 설명을 입력하세요"
                      value={editingPurpose?.description || ''}
                      onChange={(e) => setEditingPurpose({ ...editingPurpose, description: e.target.value })}
                      className="h-11 md:h-auto"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base md:text-lg font-bold text-gray-900">작업 전 안전 숙지 사항</Label>
                      <p className="text-xs text-gray-500">작업자가 양식 작성 전 반드시 확인해야 하는 위험요인 및 주의사항입니다.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={editingPurpose?.showSafetyInfo}
                        onChange={(e) => setEditingPurpose({ ...editingPurpose, showSafetyInfo: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {editingPurpose?.showSafetyInfo && (
                    <div className="space-y-6">
                      {/* Hazards */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" /> 주요 위험요인
                          </Label>
                          <Button variant="ghost" size="sm" onClick={() => handleAddSafetyItem('hazards')} className="h-7 text-[10px] gap-1 text-red-600 hover:bg-red-50">
                            <Plus className="w-3 h-3" /> 추가
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {editingPurpose.safetyHazards?.map((hazard, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={hazard}
                                onChange={(e) => handleSafetyItemChange('hazards', index, e.target.value)}
                                placeholder="위험요인을 입력하세요 (예: 추락 위험)"
                                className="h-9 text-sm"
                              />
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveSafetyItem('hazards', index)} className="h-9 w-9 text-gray-400 hover:text-red-500">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Precautions */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" /> 안전 주의사항
                          </Label>
                          <Button variant="ghost" size="sm" onClick={() => handleAddSafetyItem('precautions')} className="h-7 text-[10px] gap-1 text-blue-600 hover:bg-blue-50">
                            <Plus className="w-3 h-3" /> 추가
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {editingPurpose.safetyPrecautions?.map((precaution, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={precaution}
                                onChange={(e) => handleSafetyItemChange('precautions', index, e.target.value)}
                                placeholder="주의사항을 입력하세요 (예: 안전대 착용)"
                                className="h-9 text-sm"
                              />
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveSafetyItem('precautions', index)} className="h-9 w-9 text-gray-400 hover:text-red-500">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-base md:text-lg font-bold text-gray-900">입력 항목 구성</Label>
                    <Button variant="outline" size="sm" onClick={handleAddField} className="gap-2 h-9 md:h-auto">
                      <Plus className="w-3.5 h-3.5" /> 항목 추가
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {editingPurpose?.fields?.map((field, index) => (
                      <div key={field.id} className="p-3 md:p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col md:flex-row items-start gap-4">
                        <div className="hidden md:block pt-2 text-gray-400">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="flex-1 w-full space-y-4">
                          <div className="flex items-center justify-between md:hidden">
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase">Item #{index + 1}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:bg-red-50 disabled:opacity-30"
                              onClick={() => handleRemoveField(field.id)}
                              disabled={['worker_name', 'worker_contact', 'worker_company', 'work_start', 'work_end'].includes(field.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] md:text-xs uppercase text-gray-500 font-bold">라벨</Label>
                              <Input
                                value={field.label}
                                onChange={(e) => handleFieldChange(field.id, { label: e.target.value })}
                                className="h-10 md:h-8 text-sm md:text-xs disabled:opacity-50"
                                disabled={['worker_name', 'worker_contact', 'worker_company', 'work_start', 'work_end'].includes(field.id)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] md:text-xs uppercase text-gray-500 font-bold">유형</Label>
                              <select
                                className="w-full h-10 md:h-8 rounded-md border border-gray-300 bg-white px-2 text-sm md:text-xs disabled:opacity-50"
                                value={field.type}
                                onChange={(e) => {
                                  const newType = e.target.value as any;
                                  handleFieldChange(field.id, { type: newType });
                                }}
                                disabled={['worker_name', 'worker_contact', 'worker_company', 'work_start', 'work_end'].includes(field.id)}
                              >
                                <option value="text">단문 입력</option>
                                <option value="textarea">장문 입력</option>
                                <option value="tel">연락처</option>
                                <option value="date">날짜</option>
                                <option value="time">시간</option>
                                <option value="select">선택(드롭다운)</option>
                                <option value="radio">선택(라디오)</option>
                                <option value="checkbox">다중 선택</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between md:justify-start gap-4 h-10 md:h-8 md:pt-6">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  disabled={['worker_name', 'worker_contact', 'worker_company', 'work_start', 'work_end'].includes(field.id)}
                                  onChange={(e) => handleFieldChange(field.id, { required: e.target.checked })}
                                  className="w-4 h-4 md:w-3.5 md:h-3.5 rounded text-blue-600 disabled:opacity-50"
                                />
                                <span className="text-sm md:text-xs font-medium text-gray-600">필수 입력</span>
                              </label>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hidden md:flex h-8 w-8 text-red-500 hover:bg-red-50 disabled:opacity-30"
                                onClick={() => handleRemoveField(field.id)}
                                disabled={['worker_name', 'worker_contact', 'worker_company', 'work_start', 'work_end'].includes(field.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            
                            {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                              <div className="md:col-span-3 space-y-1.5">
                                <Label className="text-[10px] md:text-xs uppercase text-gray-500 font-bold">옵션 (쉼표로 구분)</Label>
                                <Input
                                  placeholder="예: 옵션1, 옵션2, 옵션3"
                                  value={field.options?.join(',') || ''}
                                  onChange={(e) => handleFieldChange(field.id, { options: e.target.value.split(',') })}
                                  className="h-10 md:h-8 text-sm md:text-xs"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 sticky bottom-0 z-20">
                <label className="flex items-center gap-3 cursor-pointer py-2 md:py-0">
                  <input
                    type="checkbox"
                    checked={editingPurpose?.isActive}
                    onChange={(e) => setEditingPurpose({ ...editingPurpose, isActive: e.target.checked })}
                    className="w-5 h-5 md:w-4 md:h-4 rounded text-blue-600"
                  />
                  <span className="text-sm md:text-base font-medium text-gray-700">활성화</span>
                </label>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1 md:flex-none h-12 md:h-auto">취소</Button>
                  <Button onClick={handleSave} className="gap-2 flex-[2] md:flex-none h-12 md:h-auto">
                    <Save className="w-4 h-4" /> 저장하기
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
