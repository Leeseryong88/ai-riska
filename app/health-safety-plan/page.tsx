'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { compressImage } from '@/app/lib/image-utils';
import { useAuth } from '@/app/context/AuthContext';
import { apiAuthHeaders } from '@/lib/api-client';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Save } from 'lucide-react';
import AIDisclaimer from '@/components/common/AIDisclaimer';

const QUESTIONS = [
  // 1. 공사 개요
  { 
    id: 'q1_name', 
    text: '공사 명칭을 입력해주세요.', 
    placeholder: '예: 00지구 아파트 신축공사',
    defaultValue: '00지구 신축공사'
  },
  { 
    id: 'q1_address', 
    text: '사업장 위치(주소)를 입력해주세요.', 
    placeholder: '예: 서울시 00구 00동 123-4',
    defaultValue: '서울특별시 강남구 테헤란로 123'
  },
  { 
    id: 'q2', 
    text: '공사 기간(착공일~준공일)은 언제인가요?', 
    placeholder: '예: 2024년 1월 1일 ~ 2025년 12월 31일 (24개월)',
    options: ['6개월 미만', '6개월 ~ 1년', '1년 ~ 2년', '2년 이상'],
    defaultValue: '2024년 03월 01일 ~ 2025년 08월 31일 (약 18개월)'
  },
  { 
    id: 'q3', 
    text: '총 공사계약금액(VAT 포함)은 얼마인가요?', 
    placeholder: '예: 100억원',
    options: ['10억 미만', '10억 ~ 50억', '50억 ~ 100억', '100억 이상'],
    defaultValue: '50억원'
  },
  { 
    id: 'q4', 
    text: '시공사 상호와 관리 조직 인적사항을 입력해주세요.', 
    type: 'org-structure',
    defaultValue: '시공사: (주)안전건설, 조직: 소장: 홍길동 (010-1234-5678)'
  },
  // 2. 안전보건 관리체계
  { 
    id: 'q5', 
    text: '안전보건 관리 조직 구성(안전관리자, 보건관리자 등)의 구체적인 역할 분담을 입력해주세요.', 
    placeholder: '예: 소장 총괄, 안전관리자 순찰, 보건관리자 건강검진 관리 등',
    options: ['안전/보건 전담자 배치', '소장 직접 관리체계', '외부 전문기관 위탁관리'],
    defaultValue: '소장 총괄 관리 및 안전관리자 상주 점검, 각 공종별 관리감독자 지정'
  },
  { 
    id: 'q6', 
    text: '안전보건관리비 총액과 항목별 사용 계획을 입력해주세요.', 
    placeholder: '예: 2.5억원 / 안전시설 50%, 개인보호구 30%, 교육/행사 20%',
    options: ['법정 요율 준수', '안전시설비 강화', '스마트 안전장비 구입'],
    defaultValue: '총 공사비의 2.1% 계상 (약 1.05억원), 보호구 및 안전시설비 우선 집행'
  },
  // 3. 방침 및 목표
  { 
    id: 'q7', 
    text: '안전보건 경영방침과 올해의 구체적인 목표는 무엇인가요?', 
    placeholder: '예: 중대재해 ZERO / 무재해 365일 달성, 위험요인 100% 제거',
    options: ['중대재해 ZERO', '안전수칙 100% 준수', '자율 안전문화 정착'],
    defaultValue: '중대재해 ZERO 및 안전보건관리체계 정착, 일일 안전점검 100% 실시'
  },
  // 4. 교육 및 점검
  { 
    id: 'q8', 
    text: '정기교육, 채용 시 교육 등 안전보건 교육 실시 계획은 어떠한가요?', 
    placeholder: '예: 신규자 1시간, 정기교육 월 2시간, 작업 전 TBM 매일 10분',
    options: ['매일 작업 전 TBM', '정기 안전점검의 날 운영', '전문강사 초빙 교육'],
    defaultValue: '신규 채용 시 8시간 교육, 매주 1회 정기 안전 교육, 작업 전 TBM 실시'
  },
  { 
    id: 'q9', 
    text: '자체 점검(일일, 주간, 월간) 계획을 입력해주세요.', 
    placeholder: '예: 일일 소장 점검, 주간 합동 점검, 월간 경영층 점검',
    options: ['일일 작업 전 점검', '주간 노사 합동점검', '월간 정밀 안전점검'],
    defaultValue: '일일 소장 순찰, 주간 협력업체 합동 점검, 월간 정밀 안전 진단'
  },
  // 5. 비상대응 및 건강관리
  { 
    id: 'q10', 
    text: '비상 시 신속한 대응을 위한 비상연락망과 인근 지정병원 정보가 있나요?', 
    placeholder: '예: 00병원(5km 이내), 비상연락망 구축 완료',
    options: ['인근 응급센터 협약', '비상구급함 비치', '정기 비상대응 훈련'],
    defaultValue: '인근 00종합병원 비상연락망 구축 및 비상 대응 매뉴얼 비치'
  },
  { 
    id: 'q11', 
    text: '근로자 건강관리(검진, 휴게시설, 폭염/한파 대책)는 어떻게 하시나요?', 
    placeholder: '예: 냉온수기 비치, 휴게실 에어컨 설치, 정기 건강검진 실시',
    options: ['사내 휴게시설 운영', '온열질환 예방활동', '정기 건강진단'],
    defaultValue: '휴게소(에어컨 비치) 운영, 폭염 시 휴게시간 보장, 정기 건강검진 실시'
  },
  // 6. 협력업체 관리
  { 
    id: 'q12', 
    text: '협력업체와의 안전보건 협의체 운영 및 합동 점검 계획을 입력해주세요.', 
    placeholder: '예: 매월 1회 협의체 회의, 협력사 안전수준 평가 실시',
    options: ['월간 협의체 운영', '협력사 합동 점검', '해당 없음'],
    defaultValue: '매월 1회 협의체 회의 진행 및 협력사 합동 점검 수행'
  },
];

const WORK_TYPES = [
  '가설공사', '굴착공사', '철근콘크리트공사', '강구조물공사', '성토 및 법면공사', 
  '해체공사', '전기공사', '기타 특수공종'
];

const DEFAULT_WORK_DETAILS: Record<string, string> = {
  '가설공사': '비계 설치 시 안전 난간 및 작업 발판 설치 확인, 낙하물 방지망 설치 및 고정 상태 점검 실시',
  '굴착공사': '굴착 깊이 1.5m 이상 시 법면 기울기 준수 및 흙막이 지보공 설치, 장비 주변 작업자 접근 금지',
  '철근콘크리트공사': '거푸집 동바리 설치 시 구조 검토 및 조립도 준수, 콘크리트 타설 시 편심 하중 방지 및 감시자 배치',
  '강구조물공사': '고소 작업 시 안전대 체결 필수, 부재 인양 시 2줄 걸이 준수 및 하부 통제 실시',
  '성토 및 법면공사': '법면 배수 시설 확인 및 사면 보호 조치 실시, 장비 전도 방지를 위한 지반 지지력 확인',
  '해체공사': '해체 계획서 준수 및 작업 구역 통제, 사전 구조 진단 실시 및 파쇄물 비산 방지 조치',
  '전기공사': '활선 작업 금지 및 절연용 보호구 착용, 임시 배전반 누전차단기 설치 및 접지 상태 점검',
  '기타 특수공종': '작업 전 위험성평가 실시 및 TBM을 통한 위험요인 공유, 공종별 표준 안전 작업 지침 준수'
};

export default function HealthSafetyPlanPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [subStep, setSubStep] = useState<'disclaimer' | 'main' | 'work-choice' | 'work-select' | 'work-detail'>('disclaimer');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState('');
  const [selectedWorks, setSelectedWorks] = useState<string[]>([]);
  const [currentWorkIndex, setCurrentWorkIndex] = useState(0);
  const [workDetails, setWorkDetails] = useState<Record<string, { detail: string, drawing?: string }>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [planHtml, setPlanHtml] = useState('');
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [orgData, setOrgData] = useState<{
    company: string;
    members: { role: string; name: string; contact: string; selected: boolean }[];
  }>({
    company: '',
    members: [
      { role: '소장', name: '', contact: '', selected: true },
      { role: '안전관리자', name: '', contact: '', selected: false },
      { role: '보건관리자', name: '', contact: '', selected: false },
      { role: '관리감독자', name: '', contact: '', selected: false },
      { role: '안전담당자', name: '', contact: '', selected: false },
    ],
  });

  const loadingMessages = [
    { title: "데이터를 분석하고 있습니다...", desc: "입력하신 정보를 체계적으로 검토 중입니다." },
    { title: "계획서 초안을 작성 중입니다...", desc: "산업안전보건법령을 준수하여 내용을 구성하고 있습니다." },
    { title: "안전 수칙을 검토 중입니다...", desc: "맞춤형 위험 방지 대책을 수립하고 있습니다." },
    { title: "최종 문서를 정리 중입니다...", desc: "표준 양식에 맞춰 계획서를 마무리하고 있습니다." }
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % loadingMessages.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleOptionClick = (option: string) => {
    if (inputValue.includes(option)) return;
    setInputValue(prev => prev ? `${prev}, ${option}` : option);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, workType: string) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // 이미지 압축 (최대 1200px, 품질 0.7)
        const compressed = await compressImage(file, 1200, 1200, 0.7);
        
        if (typeof compressed === 'string') {
          setWorkDetails(prev => ({
            ...prev,
            [workType]: { ...prev[workType], drawing: compressed }
          }));
        } else {
          const reader = new FileReader();
          reader.onloadend = () => {
            setWorkDetails(prev => ({
              ...prev,
              [workType]: { ...prev[workType], drawing: reader.result as string }
            }));
          };
          reader.readAsDataURL(compressed instanceof File ? compressed : new Blob([compressed], { type: 'image/jpeg' }));
        }
      } catch (error) {
        console.error('이미지 처리 중 오류:', error);
        // 오류 시 원본을 그대로 처리 시도
        const reader = new FileReader();
        reader.onloadend = () => {
          setWorkDetails(prev => ({
            ...prev,
            [workType]: { ...prev[workType], drawing: reader.result as string }
          }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleReset = () => {
    setPlanHtml('');
    setIsEditing(false);
    setSubStep('main'); // 유의사항 동의는 유지하고 바로 정보수집(main)으로 이동
    setCurrentStep(0);
    setAnswers({});
    setInputValue('');
    setSelectedWorks([]);
    setCurrentWorkIndex(0);
    setWorkDetails({});
  };

  const handlePrev = () => {
    if (subStep === 'main') {
      if (currentStep > 0) {
        const prevQuestion = QUESTIONS[currentStep - 1];
        setCurrentStep(currentStep - 1);
        if (prevQuestion.type !== 'org-structure') {
          setInputValue(answers[prevQuestion.id] || '');
        }
      } else {
        setSubStep('disclaimer');
      }
    } else if (subStep === 'work-choice') {
      setSubStep('main');
      setCurrentStep(QUESTIONS.length - 1);
      const lastQuestion = QUESTIONS[QUESTIONS.length - 1];
      if (lastQuestion.type !== 'org-structure') {
        setInputValue(answers[lastQuestion.id] || '');
      }
    } else if (subStep === 'work-select') {
      setSubStep('work-choice');
    } else if (subStep === 'work-detail') {
      if (currentWorkIndex > 0) {
        setCurrentWorkIndex(currentWorkIndex - 1);
        setInputValue(workDetails[selectedWorks[currentWorkIndex - 1]]?.detail || '');
      } else {
        setSubStep('work-select');
      }
    }
  };

  const handleNext = () => {
    if (subStep === 'main') {
      const currentQuestion = QUESTIONS[currentStep];
      let valueToSave = inputValue.trim();
      
      if (currentQuestion.type === 'org-structure') {
        // 시공사 정보가 비어있으면 기본 데이터 사용
        if (!orgData.company.trim()) {
          valueToSave = (currentQuestion as any).defaultValue || '';
        } else {
          const selectedMembers = orgData.members
            .filter(m => m.selected)
            .map(m => `${m.role}: ${m.name || '정보 없음'}${m.contact ? ` (${m.contact})` : ''}`)
            .join(', ');
          valueToSave = `시공사: ${orgData.company}, 조직: ${selectedMembers || '정보 없음'}`;
        }
      } else {
        // 일반 질문인데 비어있으면 기본값 사용
        if (!valueToSave) {
          valueToSave = (currentQuestion as any).defaultValue || '';
        }
      }

      const newAnswers = { ...answers, [currentQuestion.id]: valueToSave };
      setAnswers(newAnswers);
      setInputValue('');

      if (currentStep < QUESTIONS.length - 1) {
        const nextQuestion = QUESTIONS[currentStep + 1];
        setCurrentStep(currentStep + 1);
        if (nextQuestion.type !== 'org-structure') {
          setInputValue(newAnswers[nextQuestion.id] || '');
        }
      } else {
        setSubStep('work-choice');
      }
    } else if (subStep === 'work-choice') {
      // work-choice에서는 하단 버튼이 아닌 카드 버튼으로 이동하므로 여기서는 처리하지 않음
    } else if (subStep === 'work-select') {
      if (selectedWorks.length > 0) {
        setSubStep('work-detail');
        setCurrentWorkIndex(0);
      } else {
        generatePlan(answers, {});
      }
    } else if (subStep === 'work-detail') {
      const currentWork = selectedWorks[currentWorkIndex];
      let valueToSave = inputValue.trim();
      
      // 세부 공종 내용이 비어있으면 기본 데이터 사용
      if (!valueToSave) {
        valueToSave = DEFAULT_WORK_DETAILS[currentWork] || '작업 전 위험성평가 실시 및 표준 안전 수칙 준수';
      }

      const updatedDetails = {
        ...workDetails,
        [currentWork]: { ...workDetails[currentWork], detail: valueToSave }
      };
      
      setWorkDetails(updatedDetails);

      if (currentWorkIndex < selectedWorks.length - 1) {
        const nextWorkIndex = currentWorkIndex + 1;
        setCurrentWorkIndex(nextWorkIndex);
        // 다음 공종의 기존 데이터가 있으면 불러오고, 없으면 비움
        setInputValue(updatedDetails[selectedWorks[nextWorkIndex]]?.detail || '');
      } else {
        setInputValue('');
        // 필터링: 내용이 비어있는 공종은 제외하고 전송
        const finalDetails = Object.fromEntries(
          Object.entries(updatedDetails).filter(([_, data]) => data.detail?.trim() || data.drawing)
        );
        generatePlan(answers, finalDetails);
      }
    }
  };

  const generatePlan = async (mainAnswers: Record<string, string>, details: any) => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/health-safety-plan', {
        method: 'POST',
        headers: await apiAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ answers: mainAnswers, workDetails: details }),
      });

      const data = await response.json();
      if (data.planHtml) {
        setPlanHtml(data.planHtml);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleEditing = () => {
    if (isEditing && reportRef.current) {
      setPlanHtml(reportRef.current.innerHTML);
    }
    setIsEditing(!isEditing);
  };

  const handleSavePlan = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!planHtml) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'healthSafetyPlans'), {
        userId: user.uid,
        title: saveTitle || `안전보건계획서 ${new Date().toLocaleDateString()}`,
        planHtml: planHtml,
        createdAt: serverTimestamp(),
      });
      alert('계획서가 저장되었습니다.');
      setShowSaveModal(false);
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (planHtml) {
    return (
      <WorkspaceShell
        serviceHref="/health-safety-plan"
        title="안전보건계획서"
        description="입력값을 바탕으로 계획서를 생성하고 결과를 직접 편집할 수 있습니다."
        contentClassName="pb-20"
      >
        <div className="mx-auto max-w-4xl px-4 pt-10">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">생성된 안전보건계획서</h1>
            <div className="space-x-2 flex items-center">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-bold"
              >
                다시 만들기
              </button>
              <button
                onClick={toggleEditing}
                className={`px-4 py-2 ${isEditing ? 'bg-blue-600' : 'bg-gray-800'} text-white rounded-lg hover:opacity-90 transition-colors text-sm font-bold flex items-center gap-2`}
              >
                {isEditing ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    수정 완료
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    직접 수정
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setSaveTitle(`안전보건계획서 ${new Date().toLocaleDateString()}`);
                  setShowSaveModal(true);
                }}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-bold flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                저장하기
              </button>
            </div>
          </div>
          <div 
            ref={reportRef} 
            contentEditable={isEditing}
            suppressContentEditableWarning={true}
            className={`bg-white p-10 shadow-xl rounded-lg border ${isEditing ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'} min-h-[1000px] overflow-auto report-container outline-none`} 
            dangerouslySetInnerHTML={{ __html: planHtml }} 
          />

          {/* 저장 모달 추가 */}
          {showSaveModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setShowSaveModal(false)}
              ></div>
              <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative z-[110]">
                <h3 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                  <Save className="w-8 h-8 text-amber-600" />
                  계획서 저장
                </h3>
                <div className="mb-8">
                  <label className="block text-sm font-bold text-gray-500 mb-2 ml-1">저장 제목</label>
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder="예: OO안전보건계획서"
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-amber-500 focus:bg-white outline-none transition-all font-bold text-gray-900"
                    autoFocus
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-black text-lg hover:bg-gray-200 transition-all"
                  >
                    취소
                  </button>
                  <button 
                    onClick={handleSavePlan}
                    disabled={isSaving}
                    className="flex-1 py-4 bg-amber-600 text-white rounded-xl font-black text-lg hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 disabled:opacity-50"
                  >
                    {isSaving ? '저장 중...' : '저장하기'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <style jsx global>{`
            .report-container table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 10pt; table-layout: fixed; }
            .report-container th { background-color: #f8fafc; border: 1px solid #94a3b8; padding: 10px; font-weight: bold; text-align: center; color: #334155; }
            .report-container td { border: 1px solid #94a3b8; padding: 10px; vertical-align: middle; word-break: break-all; }
            .report-container h2 { font-size: 16pt; font-weight: bold; border-left: 8px solid #1e40af; padding-left: 15px; margin-top: 40px; margin-bottom: 15px; background: #f1f5f9; padding-top: 8px; padding-bottom: 8px; border-bottom: 1px solid #cbd5e1; }
            .report-container h3 { font-size: 13pt; font-weight: bold; margin-top: 25px; margin-bottom: 10px; color: #1e293b; }
            .report-container .report-title { font-size: 24pt; font-weight: bold; text-align: center; margin-bottom: 50px; padding: 20px; border: 2px solid #333; }
            .report-container .drawing-container { text-align: center; margin: 20px 0; border: 1px solid #eee; padding: 10px; border-radius: 8px; }
            .report-container .drawing-image { max-width: 100%; height: auto; border: 1px solid #ddd; }
          `}</style>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      serviceHref="/health-safety-plan"
      title="안전보건계획서"
      description="AI 기술을 활용하여 맞춤형 안전보건계획서를 빠르고 정확하게 생성하고 관리합니다."
    >
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        {!isGenerating ? (
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
            {subStep === 'disclaimer' && (
              <AIDisclaimer
                serviceName="안전보건관리계획서"
                accentColor="blue"
                onAgree={() => setSubStep('main')}
                standalone={false}
              />
            )}

            {subStep === 'main' && (
              <>
                <div className="mb-8">
                  <div className="flex justify-between text-xs text-gray-400 mb-2">
                    <span>기본 정보 수집 ({currentStep + 1} / {QUESTIONS.length})</span>
                    <span>{Math.round(((currentStep + 1) / (QUESTIONS.length + 2)) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${((currentStep + 1) / (QUESTIONS.length + 2)) * 100}%` }} />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">{QUESTIONS[currentStep].text}</h2>
                
                {QUESTIONS[currentStep].type === 'org-structure' ? (
                  <div className="text-left space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">시공사 상호</label>
                      <input 
                        type="text" 
                        className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="예: (주)안전건설"
                        value={orgData.company}
                        onChange={(e) => setOrgData({ ...orgData, company: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-4">
                      <label className="block text-sm font-bold text-gray-700">관리 조직 (선택 및 입력)</label>
                      {orgData.members.map((member, idx) => (
                        <div key={idx} className="p-4 border border-gray-100 rounded-xl bg-gray-50 space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="w-5 h-5 text-blue-600 rounded"
                              checked={member.selected}
                              onChange={(e) => {
                                const newMembers = [...orgData.members];
                                newMembers[idx].selected = e.target.checked;
                                setOrgData({ ...orgData, members: newMembers });
                              }}
                            />
                            <span className="font-bold text-gray-700">{member.role}</span>
                          </label>
                          
                          {member.selected && (
                            <div className="grid grid-cols-2 gap-3 pl-8">
                              <input 
                                type="text" 
                                placeholder="성함"
                                className="p-3 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                                value={member.name}
                                onChange={(e) => {
                                  const newMembers = [...orgData.members];
                                  newMembers[idx].name = e.target.value;
                                  setOrgData({ ...orgData, members: newMembers });
                                }}
                              />
                              <input 
                                type="text" 
                                placeholder="연락처"
                                className="p-3 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                                value={member.contact}
                                onChange={(e) => {
                                  const newMembers = [...orgData.members];
                                  newMembers[idx].contact = e.target.value;
                                  setOrgData({ ...orgData, members: newMembers });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-blue-600 font-medium mb-4 text-left px-1 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      시공사명을 작성하지 않고 넘어가면 가상의 샘플 데이터가 자동으로 입력됩니다.
                    </p>
                  </div>
                ) : (
                  <>
                <textarea className="w-full h-32 p-4 border border-gray-300 rounded-xl mb-2 outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder={QUESTIONS[currentStep].placeholder} value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                <p className="text-sm text-blue-600 font-medium mb-4 text-left px-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  직접 작성하지 않고 '다음 질문'을 누르면 전문가가 작성한 샘플 데이터가 자동으로 입력됩니다.
                </p>
                    {QUESTIONS[currentStep].options && (
                      <div className="flex flex-wrap gap-2 mb-6 justify-center">
                        {QUESTIONS[currentStep].options.map((option) => (
                          <button key={option} onClick={() => handleOptionClick(option)} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full hover:bg-blue-100 border border-blue-100">+ {option}</button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {subStep === 'work-choice' && (
              <div className="max-w-xl mx-auto py-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">계획서 생성 방식을 선택해주세요</h2>
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => generatePlan(answers, {})}
                    className="group p-6 text-left border-2 border-gray-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1">일반 안전보건계획서 생성하기</h3>
                        <p className="text-sm text-gray-500 font-medium">기본 정보만으로 구성된 표준 계획서를 생성합니다.</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setSubStep('work-select')}
                    className="group p-6 text-left border-2 border-gray-100 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1">세부 공정 추가하기</h3>
                        <p className="text-sm text-gray-500 font-medium">특정 공종에 대한 정밀한 안전 계획을 직접 추가합니다.</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {subStep === 'work-select' && (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">해당되는 세부 공종을 선택해주세요</h2>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {WORK_TYPES.map(work => (
                    <button
                      key={work}
                      onClick={() => setSelectedWorks(prev => prev.includes(work) ? prev.filter(w => w !== work) : [...prev, work])}
                      className={`p-4 rounded-xl border-2 transition-all font-bold ${selectedWorks.includes(work) ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-blue-200'}`}
                    >
                      {work}
                    </button>
                  ))}
                </div>
              </>
            )}

            {subStep === 'work-detail' && (
              <>
                <div className="mb-4 inline-block px-4 py-1 bg-blue-600 text-white rounded-full text-sm font-bold">{selectedWorks[currentWorkIndex]}</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">해당 공종의 세부 안전계획을 작성해주세요</h2>
                <textarea className="w-full h-32 p-4 border border-gray-300 rounded-xl mb-2 outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="예: 굴착 깊이 2m 이상 시 흙막이 지보공 설치, 상하 동시작업 금지..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                <p className="text-sm text-blue-600 font-medium mb-6 text-left px-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  작성하지 않고 '계획서 생성'을 누르면 해당 공종의 표준 안전 수칙이 자동으로 입력됩니다.
                </p>
                <div className="mb-8 p-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                  <p className="text-sm font-bold text-gray-600 mb-3">파일 도면 첨부 (필요 시)</p>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, selectedWorks[currentWorkIndex])} className="hidden" id="fileInput" />
                  <label htmlFor="fileInput" className="cursor-pointer px-6 py-3 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 shadow-sm transition-all inline-block">
                    {workDetails[selectedWorks[currentWorkIndex]]?.drawing ? '파일 변경하기' : '이미지 선택하기'}
                  </label>
                  {workDetails[selectedWorks[currentWorkIndex]]?.drawing && (
                    <div className="mt-4 flex justify-center">
                      <img src={workDetails[selectedWorks[currentWorkIndex]].drawing} alt="Preview" className="max-h-40 rounded-lg shadow-md border border-gray-200" />
                    </div>
                  )}
                </div>
              </>
            )}

            {subStep !== 'disclaimer' && (
              <div className="flex space-x-3">
                <button 
                  onClick={handlePrev}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-all"
                >
                  이전 단계
                </button>
                <button 
                  onClick={handleNext} 
                  disabled={subStep === 'work-choice'}
                  className={`flex-[2] py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex flex-col items-center justify-center leading-tight ${subStep === 'work-choice' ? 'opacity-0 pointer-events-none' : ''}`}
                >
                  {subStep === 'main' ? '다음 질문' : 
                   subStep === 'work-select' ? (
                     selectedWorks.length > 0 ? (
                       `세부 계획 작성 (1/${selectedWorks.length})`
                     ) : (
                       <>
                         <span>계획서 바로 생성</span>
                         <span className="text-[10px] font-normal opacity-80 mt-0.5">세부공종 없이</span>
                       </>
                     )
                   ) : 
                   (currentWorkIndex === selectedWorks.length - 1 ? '계획서 최종 생성' : `다음 공종 (${currentWorkIndex + 2}/${selectedWorks.length})`)}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 transition-all duration-500">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-8"></div>
            <div className="text-center animate-pulse">
              <h2 className="text-2xl font-bold text-gray-800 mb-3 tracking-tight">
                {loadingMessages[loadingStep].title}
              </h2>
              <p className="text-gray-500 text-lg">
                {loadingMessages[loadingStep].desc}
              </p>
            </div>
            <div className="mt-10 flex gap-2">
              {loadingMessages.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 w-8 rounded-full transition-all duration-500 ${i === loadingStep ? 'bg-blue-600 w-12' : 'bg-gray-200'}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
