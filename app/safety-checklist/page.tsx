'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { useAuth } from '@/app/context/AuthContext';
import { apiAuthHeaders } from '@/lib/api-client';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Save, Printer } from 'lucide-react';

type SubStep = 'disclaimer' | 'when' | 'where' | 'who' | 'what' | 'how' | 'count' | 'format';

type Selection = 'single' | 'multi';

interface StepDef {
  id: SubStep;
  title: string;
  description: string;
  selection: Selection;
  options: string[];
  allowFreeText?: boolean;
  freeTextLabel?: string;
  freeTextPlaceholder?: string;
}

const STEPS: StepDef[] = [
  {
    id: 'when',
    title: '언제 점검하나요?',
    description: '점검 주기(또는 시점)를 선택하세요. 필요하면 점검일을 함께 입력할 수 있습니다.',
    selection: 'single',
    options: ['작업 전', '일일(매일)', '주간', '월간', '수시', '특별점검'],
    allowFreeText: true,
    freeTextLabel: '점검 일자 (선택)',
    freeTextPlaceholder: '예: 2026-04-21 08:00',
  },
  {
    id: 'where',
    title: '어디서 점검하나요?',
    description: '점검 대상 현장 유형과 세부 구역을 입력합니다.',
    selection: 'single',
    options: ['건축 현장', '토목 현장', '플랜트', '제조공장', '물류창고', '사무·근린시설', '기타'],
    allowFreeText: true,
    freeTextLabel: '세부 장소/구역 (선택)',
    freeTextPlaceholder: '예: 지하 1층 기계실, B동 3층 슬라브',
  },
  {
    id: 'who',
    title: '누가 점검하나요?',
    description: '점검에 참여하는 주체를 모두 선택하세요.',
    selection: 'multi',
    options: ['소장', '안전관리자', '보건관리자', '관리감독자', '협력사 안전담당', '근로자 대표', '외부 전문기관'],
  },
  {
    id: 'what',
    title: '무엇을 점검하나요?',
    description: '점검 대상 공종·영역을 모두 선택하세요. (필요 시 직접 입력)',
    selection: 'multi',
    options: [
      '가설공사', '굴착·흙막이', '철근콘크리트', '강구조물', '고소작업',
      '밀폐공간', '화기작업', '전기·정전', '양중·크레인', '해체공사',
      '유해화학물질', '근로자 보호구', '가설전기·분전반', '비상대응·소방',
    ],
    allowFreeText: true,
    freeTextLabel: '기타 점검 항목 (선택)',
    freeTextPlaceholder: '예: 동절기 결빙 예방, 우기 배수 상태 등',
  },
  {
    id: 'how',
    title: '어떻게 점검하나요?',
    description: '점검 방식을 모두 선택하세요.',
    selection: 'multi',
    options: ['육안 확인', '계측 장비', '점검 후 사진 촬영', '서류·자격 확인', '면담·인터뷰', '시험·테스트'],
  },
  {
    id: 'count',
    title: '체크리스트 문항 수를 선택하세요',
    description: '생성될 점검 항목의 개수입니다.',
    selection: 'single',
    options: ['10', '15', '20', '30', '50'],
  },
  {
    id: 'format',
    title: '체크리스트 평가 형식을 선택하세요',
    description: '각 문항을 어떻게 평가할지 결정합니다. 결과 양식은 형식별로 고정됩니다.',
    selection: 'single',
    options: [
      '2단계 (적합 / 부적합)',
      '3단계 (적정 / 미흡 / 부적합)',
      'OX (O / X / N/A)',
      '예/아니오 (예 / 아니오 / 해당없음)',
      '5점 척도 (1~5)',
    ],
  },
];

interface Answers {
  when: { choice: string; freeText: string };
  where: { choice: string; freeText: string };
  who: { choices: string[] };
  what: { choices: string[]; freeText: string };
  how: { choices: string[] };
  count: string;
  format: string;
}

const INITIAL_ANSWERS: Answers = {
  when: { choice: '', freeText: '' },
  where: { choice: '', freeText: '' },
  who: { choices: [] },
  what: { choices: [], freeText: '' },
  how: { choices: [] },
  count: '',
  format: '',
};

export default function SafetyChecklistPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [subStep, setSubStep] = useState<SubStep | 'disclaimer'>('disclaimer');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [checklistHtml, setChecklistHtml] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const loadingMessages = [
    { title: '수집한 정보를 분석하고 있습니다...', desc: '5W1H 데이터를 체계적으로 정리하는 중입니다.' },
    { title: '적합한 점검 항목을 선정하고 있습니다...', desc: '선택하신 공종·영역에 맞춰 항목을 구성합니다.' },
    { title: '선택하신 형식에 맞춰 구조화 중입니다...', desc: '지정한 평가 형식의 고정 양식을 적용합니다.' },
    { title: '최종 체크리스트를 정리 중입니다...', desc: '한 장짜리 체크리스트로 마무리합니다.' },
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isGenerating) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 2500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isGenerating]);

  const currentStep = STEPS[stepIndex];
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const isStepAnswered = (step: StepDef): boolean => {
    switch (step.id) {
      case 'when': return !!answers.when.choice;
      case 'where': return !!answers.where.choice;
      case 'who': return answers.who.choices.length > 0;
      case 'what': return answers.what.choices.length > 0 || !!answers.what.freeText.trim();
      case 'how': return answers.how.choices.length > 0;
      case 'count': return !!answers.count;
      case 'format': return !!answers.format;
      default: return false;
    }
  };

  const handleToggleOption = (option: string) => {
    const step = currentStep;
    if (step.selection === 'single') {
      setAnswers((prev) => {
        const next = { ...prev };
        if (step.id === 'when') next.when = { ...next.when, choice: option };
        if (step.id === 'where') next.where = { ...next.where, choice: option };
        if (step.id === 'count') next.count = option;
        if (step.id === 'format') next.format = option;
        return next;
      });
    } else {
      setAnswers((prev) => {
        const next = { ...prev };
        const toggle = (arr: string[]) => arr.includes(option) ? arr.filter((o) => o !== option) : [...arr, option];
        if (step.id === 'who') next.who = { choices: toggle(prev.who.choices) };
        if (step.id === 'what') next.what = { ...prev.what, choices: toggle(prev.what.choices) };
        if (step.id === 'how') next.how = { choices: toggle(prev.how.choices) };
        return next;
      });
    }
  };

  const handleFreeTextChange = (value: string) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (currentStep.id === 'when') next.when = { ...next.when, freeText: value };
      if (currentStep.id === 'where') next.where = { ...next.where, freeText: value };
      if (currentStep.id === 'what') next.what = { ...next.what, freeText: value };
      return next;
    });
  };

  const currentFreeText = (): string => {
    if (currentStep.id === 'when') return answers.when.freeText;
    if (currentStep.id === 'where') return answers.where.freeText;
    if (currentStep.id === 'what') return answers.what.freeText;
    return '';
  };

  const isOptionSelected = (option: string): boolean => {
    const step = currentStep;
    if (step.id === 'when') return answers.when.choice === option;
    if (step.id === 'where') return answers.where.choice === option;
    if (step.id === 'who') return answers.who.choices.includes(option);
    if (step.id === 'what') return answers.what.choices.includes(option);
    if (step.id === 'how') return answers.how.choices.includes(option);
    if (step.id === 'count') return answers.count === option;
    if (step.id === 'format') return answers.format === option;
    return false;
  };

  const handlePrev = () => {
    if (subStep === 'disclaimer') return;
    if (stepIndex === 0) {
      setSubStep('disclaimer');
      return;
    }
    setStepIndex((prev) => prev - 1);
    setSubStep(STEPS[stepIndex - 1].id);
  };

  const handleNext = () => {
    if (!isStepAnswered(currentStep)) {
      alert('값을 선택해 주세요.');
      return;
    }
    if (stepIndex < STEPS.length - 1) {
      const ni = stepIndex + 1;
      setStepIndex(ni);
      setSubStep(STEPS[ni].id);
    } else {
      generateChecklist();
    }
  };

  const handleReset = () => {
    setChecklistHtml('');
    setIsEditing(false);
    setAnswers(INITIAL_ANSWERS);
    setStepIndex(0);
    setSubStep(STEPS[0].id);
  };

  const generateChecklist = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/safety-checklist', {
        method: 'POST',
        headers: await apiAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          when: answers.when,
          where: answers.where,
          who: answers.who,
          what: answers.what,
          how: answers.how,
          questionCount: parseInt(answers.count, 10) || 15,
          format: answers.format,
        }),
      });
      const data = await response.json();
      if (data.checklistHtml) {
        setChecklistHtml(data.checklistHtml);
      } else {
        alert(data.error || '체크리스트 생성 중 오류가 발생했습니다.');
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
      setChecklistHtml(reportRef.current.innerHTML);
    }
    setIsEditing(!isEditing);
  };

  const handleSaveChecklist = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!checklistHtml) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'safetyChecklists'), {
        userId: user.uid,
        title: saveTitle || `안전점검 체크리스트 ${new Date().toLocaleDateString()}`,
        checklistHtml,
        format: answers.format,
        questionCount: parseInt(answers.count, 10) || 15,
        meta: {
          when: answers.when,
          where: answers.where,
          who: answers.who,
          what: answers.what,
          how: answers.how,
        },
        createdAt: serverTimestamp(),
      });
      alert('체크리스트가 저장되었습니다.');
      setShowSaveModal(false);
    } catch (error) {
      console.error('Error saving checklist:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    if (!reportRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('팝업 차단을 해제해주세요.');
      return;
    }
    const content = reportRef.current.innerHTML;
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>안전점검 체크리스트</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #1f2937; line-height: 1.5; padding: 0; margin: 0; }
  .checklist-wrapper { padding: 0; }
  .checklist-title { font-size: 22pt; font-weight: bold; text-align: center; margin: 0 0 20px; padding: 16px; border: 2px solid #111827; letter-spacing: 1px; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10.5pt; table-layout: fixed; page-break-inside: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid !important; break-inside: avoid !important; page-break-after: auto; }
  th { background-color: #f1f5f9; border: 1px solid #475569; padding: 8px; font-weight: bold; text-align: center; color: #0f172a; page-break-inside: avoid; break-inside: avoid; }
  td { border: 1px solid #475569; padding: 8px; vertical-align: middle; word-break: break-word; page-break-inside: avoid; break-inside: avoid; }
  .meta-table, .sign-table, .disclaimer { page-break-inside: avoid !important; break-inside: avoid !important; }
  .meta-table td.meta-label { background: #f8fafc; font-weight: bold; text-align: center; }
  .sign-table td { height: 60px; text-align: center; vertical-align: top; padding-top: 10px; }
  .disclaimer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 9pt; color: #6b7280; }
</style>
</head><body>${content}<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};</script></body></html>`);
    printWindow.document.close();
  };

  if (checklistHtml) {
    return (
      <WorkspaceShell
        serviceHref="/safety-checklist"
        title="안전점검 체크리스트"
        description="입력값을 바탕으로 생성된 체크리스트를 직접 편집·저장·인쇄할 수 있습니다."
        contentClassName="pb-20"
      >
        <div className="mx-auto max-w-4xl px-4 pt-10">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
            <h1 className="text-2xl font-bold text-gray-800">생성된 안전점검 체크리스트</h1>
            <div className="flex flex-wrap gap-2 items-center">
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
                {isEditing ? '수정 완료' : '직접 수정'}
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-bold flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                인쇄
              </button>
              <button
                onClick={() => {
                  setSaveTitle(`안전점검 체크리스트 ${new Date().toLocaleDateString()}`);
                  setShowSaveModal(true);
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm font-bold flex items-center gap-2"
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
            className={`bg-white p-10 shadow-xl rounded-lg border ${isEditing ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'} min-h-[800px] overflow-auto checklist-container outline-none`}
            dangerouslySetInnerHTML={{ __html: checklistHtml }}
          />

          {showSaveModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setShowSaveModal(false)}
              />
              <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative z-[110]">
                <h3 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                  <Save className="w-8 h-8 text-rose-600" />
                  체크리스트 저장
                </h3>
                <div className="mb-8">
                  <label className="block text-sm font-bold text-gray-500 mb-2 ml-1">저장 제목</label>
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder="예: 고소작업 일일 점검 체크리스트"
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-rose-500 focus:bg-white outline-none transition-all font-bold text-gray-900"
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
                    onClick={handleSaveChecklist}
                    disabled={isSaving}
                    className="flex-1 py-4 bg-rose-600 text-white rounded-xl font-black text-lg hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 disabled:opacity-50"
                  >
                    {isSaving ? '저장 중...' : '저장하기'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <style jsx global>{`
            .checklist-container .checklist-wrapper { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #1f2937; line-height: 1.5; }
            .checklist-container .checklist-title { font-size: 22pt; font-weight: bold; text-align: center; margin-bottom: 20px; padding: 16px; border: 2px solid #111827; letter-spacing: 1px; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; }
            .checklist-container table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10.5pt; table-layout: fixed; }
            .checklist-container thead { display: table-header-group; }
            .checklist-container tfoot { display: table-footer-group; }
            .checklist-container tr { page-break-inside: avoid !important; break-inside: avoid !important; }
            .checklist-container th { background-color: #f1f5f9; border: 1px solid #475569; padding: 8px; font-weight: bold; text-align: center; color: #0f172a; page-break-inside: avoid; break-inside: avoid; }
            .checklist-container td { border: 1px solid #475569; padding: 8px; vertical-align: middle; word-break: break-word; page-break-inside: avoid; break-inside: avoid; }
            .checklist-container .meta-table { page-break-inside: avoid; break-inside: avoid; }
            .checklist-container .meta-table td.meta-label { background: #f8fafc; font-weight: bold; text-align: center; width: 15%; }
            .checklist-container .check-cell { text-align: center; width: 8%; }
            .checklist-container .no-cell { text-align: center; width: 6%; }
            .checklist-container .remark-cell { width: 18%; }
            .checklist-container .sign-table { page-break-inside: avoid; break-inside: avoid; }
            .checklist-container .sign-table td { height: 60px; text-align: center; vertical-align: top; padding-top: 10px; }
            .checklist-container .disclaimer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 9pt; color: #6b7280; page-break-inside: avoid; break-inside: avoid; }
            @media print {
              .checklist-container { padding: 0 !important; border: none !important; box-shadow: none !important; }
              .checklist-container table { page-break-inside: auto; }
              .checklist-container tr { page-break-inside: avoid !important; break-inside: avoid !important; }
              .checklist-container thead { display: table-header-group; }
              .checklist-container tfoot { display: table-footer-group; }
              .checklist-container .sign-table,
              .checklist-container .meta-table,
              .checklist-container .disclaimer { page-break-inside: avoid !important; break-inside: avoid !important; }
            }
          `}</style>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      serviceHref="/safety-checklist"
      title="안전점검 체크리스트"
      description="5W1H 정보를 선택하면 형식·문항 수에 맞춘 맞춤형 체크리스트를 생성합니다."
    >
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        {!isGenerating ? (
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
            {subStep === 'disclaimer' && (
              <div className="text-left">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">서비스 이용 전 유의사항</h2>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 mb-8 text-amber-900 leading-relaxed text-sm md:text-base">
                  <p className="mb-4 font-bold text-lg">⚠️ 필독: 인공지능(AI) 생성물 이용 관련 안내</p>
                  <p className="mb-3">
                    본 서비스는 AI 기술을 활용하여 <strong>안전점검 체크리스트 초안을 생성하는 보조 도구</strong>입니다.
                  </p>
                  <p className="mb-3">
                    AI가 생성한 체크리스트는 일반적인 가이드라인이며, <strong>실제 현장 조건·법적 요구사항을 완벽하게 반영하지 못할 수 있습니다.</strong>
                  </p>
                  <p className="mb-3">
                    따라서, 본 서비스로 생성된 결과물을 실제 업무에 활용하거나 외부 기관에 제출함에 있어 발생하는 <strong>모든 책임은 사용자 본인에게 있음</strong>을 알려드립니다.
                  </p>
                  <p className="font-semibold text-amber-700">
                    반드시 전문가의 검토를 거쳐 실제 상황에 맞게 수정 및 보완하여 사용하시기 바랍니다.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { setSubStep(STEPS[0].id); setStepIndex(0); }}
                    className="w-full py-4 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all text-lg"
                  >
                    위 내용을 확인했으며, 이에 동의합니다
                  </button>
                  <button
                    onClick={() => router.push('/')}
                    className="w-full py-4 bg-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-200 transition-all"
                  >
                    동의하지 않음 (메인으로 이동)
                  </button>
                </div>
              </div>
            )}

            {subStep !== 'disclaimer' && (
              <>
                <div className="mb-8">
                  <div className="flex justify-between text-xs text-gray-400 mb-2">
                    <span>정보 수집 ({stepIndex + 1} / {STEPS.length})</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-800 mb-2">{currentStep.title}</h2>
                <p className="text-sm text-gray-500 mb-6">{currentStep.description}</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 text-left">
                  {currentStep.options.map((option) => {
                    const selected = isOptionSelected(option);
                    return (
                      <button
                        key={option}
                        onClick={() => handleToggleOption(option)}
                        className={`p-4 rounded-xl border-2 transition-all font-bold text-sm ${
                          selected
                            ? 'border-rose-600 bg-rose-50 text-rose-600'
                            : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-rose-200'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                {currentStep.allowFreeText && (
                  <div className="text-left mb-6">
                    <label className="block text-xs font-bold text-gray-500 mb-2">
                      {currentStep.freeTextLabel || '추가 메모 (선택)'}
                    </label>
                    <input
                      type="text"
                      value={currentFreeText()}
                      onChange={(e) => handleFreeTextChange(e.target.value)}
                      placeholder={currentStep.freeTextPlaceholder}
                      className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={handlePrev}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-all"
                  >
                    이전 단계
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-[2] py-4 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all"
                  >
                    {stepIndex === STEPS.length - 1 ? '체크리스트 생성' : '다음 단계'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 transition-all duration-500">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-rose-600 mb-8"></div>
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
                  className={`h-1.5 w-8 rounded-full transition-all duration-500 ${i === loadingStep ? 'bg-rose-600 w-12' : 'bg-gray-200'}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
