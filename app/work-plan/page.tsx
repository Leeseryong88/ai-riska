'use client';

import React, { useMemo, useRef, useState } from 'react';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import AIDisclaimer from '@/components/common/AIDisclaimer';
import { apiAuthHeaders } from '@/lib/api-client';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/app/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { compressImageFileToDataUrl } from '@/app/work-plan/_lib/compress-image';
import { shrinkHtmlDataUrlsForFirestore } from '@/app/work-plan/_lib/shrink-plan-html';
import {
  COMMON_WORK_PLAN_FIELDS,
  WORK_PLAN_TEMPLATES,
  WorkPlanAttachment,
  WorkPlanField,
  WorkPlanTemplate,
  WorkPlanTypeId,
} from '@/app/work-plan/_lib/work-plan-templates';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  FileText,
  ImagePlus,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

const MAX_ATTACHMENTS = 2;

const today = new Date().toISOString().slice(0, 10);

/** 원본(압축 전) 기준, 카메라 고해상도도 허용. 전송은 압축 후. */
const MAX_RAW_IMAGE_BYTES = 20 * 1024 * 1024;

function fieldValue(values: Record<string, string>, id: string): string {
  return values[id] || '';
}

function allTemplateFields(template: WorkPlanTemplate): WorkPlanField[] {
  return [...COMMON_WORK_PLAN_FIELDS, ...template.requiredFields, ...template.optionalFields];
}

export default function WorkPlanPage() {
  const { user } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<WorkPlanTypeId>('construction-machinery');
  const [values, setValues] = useState<Record<string, string>>({ workDate: today });
  const [attachments, setAttachments] = useState<WorkPlanAttachment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [planHtml, setPlanHtml] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const selectedTemplate = useMemo(
    () => WORK_PLAN_TEMPLATES.find((template) => template.id === selectedTemplateId) || WORK_PLAN_TEMPLATES[0],
    [selectedTemplateId]
  );

  const requiredFields = useMemo(
    () => allTemplateFields(selectedTemplate).filter((field) => field.required),
    [selectedTemplate]
  );

  const missingRequiredFields = requiredFields.filter((field) => !fieldValue(values, field.id).trim());
  const canGenerate = missingRequiredFields.length === 0 && !isGenerating;

  const updateValue = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const handleTemplateChange = (templateId: WorkPlanTypeId) => {
    setSelectedTemplateId(templateId);
    setError('');
    setWarning('');
  };

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    const imageFiles = files
      .filter((file) => file.type.startsWith('image/'))
      .filter((file) => file.size <= MAX_RAW_IMAGE_BYTES);

    const available = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    if (available === 0) {
      setError(`이미지는 최대 ${MAX_ATTACHMENTS}개까지 첨부할 수 있습니다.`);
      return;
    }

    try {
      const nextFiles = imageFiles.slice(0, available);
      const nextAttachments = await Promise.all(
        nextFiles.map(async (file) => ({
          id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          dataUrl: await compressImageFileToDataUrl(file),
          note: '',
        }))
      );
      setAttachments((prev) => [...prev, ...nextAttachments]);
      if (files.length !== nextFiles.length) {
        setWarning('이미지 파일만 첨부되며, 20MB를 초과한 파일 또는 최대 개수를 넘은 파일은 제외했습니다.');
      }
    } catch (fileError) {
      console.error('첨부 이미지 읽기 오류:', fileError);
      setError('이미지 첨부 중 오류가 발생했습니다.');
    }
  };

  const updateAttachmentNote = (id: string, note: string) => {
    setAttachments((prev) => prev.map((item) => (item.id === id ? { ...item, note } : item)));
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleGenerate = async () => {
    if (!canGenerate) {
      setError(`필수 정보를 입력하세요: ${missingRequiredFields.map((field) => field.label).join(', ')}`);
      return;
    }

    setIsGenerating(true);
    setError('');
    setWarning('');

    try {
      const response = await fetch('/api/work-plan', {
        method: 'POST',
        headers: await apiAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          fields: values,
          attachments,
        }),
      });
      const raw = await response.text();
      let data: { planHtml?: string; error?: string; warning?: string } = {};
      try {
        if (raw) data = JSON.parse(raw) as typeof data;
      } catch {
        const hint =
          response.status === 413
            ? '첨부 용량이 서버 제한을 초과했습니다. 이미지 수를 줄이거나, 더 작은 이미지로 시도하세요.'
            : !response.ok
              ? `요청이 실패했습니다 (HTTP ${response.status}).`
              : '서버 응답을 해석할 수 없습니다.';
        throw new Error(hint);
      }
      if (!response.ok || !data.planHtml) {
        throw new Error(data.error || '작업계획서 생성에 실패했습니다.');
      }
      setPlanHtml(data.planHtml);
      setSaveTitle(`${fieldValue(values, 'projectName') || selectedTemplate.shortTitle} 작업계획서 ${new Date().toLocaleDateString()}`);
      setWarning(data.warning || '');
      setIsEditing(false);
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : '작업계획서 생성 중 오류가 발생했습니다.';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setPlanHtml('');
    setError('');
    setWarning('');
    setIsEditing(false);
  };

  const handlePrint = () => {
    const content = reportRef.current?.innerHTML || planHtml;
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('팝업이 차단되어 인쇄 창을 열 수 없습니다.');
      return;
    }
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>작업계획서</title>
<style>@page{size:A4;margin:12mm;}body{margin:0;padding:0;background:#fff;}</style>
</head><body>${content}<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};</script></body></html>`);
    printWindow.document.close();
  };

  const handleSaveWorkPlan = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    const currentHtml = reportRef.current?.innerHTML || planHtml;
    if (!currentHtml) return;

    setIsSaving(true);
    try {
      let planBody = currentHtml;
      try {
        planBody = await shrinkHtmlDataUrlsForFirestore(currentHtml);
      } catch (shrinkErr) {
        const msg =
          shrinkErr instanceof Error ? shrinkErr.message : '문서 크기를 줄이지 못했습니다.';
        alert(msg);
        return;
      }

      await addDoc(collection(db, 'workPlans'), {
        userId: user.uid,
        title: saveTitle || `${fieldValue(values, 'projectName') || selectedTemplate.shortTitle} 작업계획서 ${new Date().toLocaleDateString()}`,
        planHtml: planBody,
        templateId: selectedTemplate.id,
        templateTitle: selectedTemplate.title,
        workplace: fieldValue(values, 'workplace'),
        workDate: fieldValue(values, 'workDate'),
        fields: values,
        attachmentCount: attachments.length,
        createdAt: serverTimestamp(),
      });
      setPlanHtml(planBody);
      setShowSaveModal(false);
      alert('작업계획서가 AI 서비스 결과 저장소에 저장되었습니다.');
    } catch (saveError) {
      console.error('Error saving work plan:', saveError);
      const msg =
        saveError instanceof Error && /longer than \d+ bytes/i.test(saveError.message)
          ? '문서(HTML)가 Firestore 용량 한도(약 1MB)를 넘습니다. 본문·이미지를 줄인 뒤 다시 저장하세요.'
          : '저장 중 오류가 발생했습니다.';
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (field: WorkPlanField) => {
    const baseClass =
      'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

    return (
      <div key={field.id} className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-black text-slate-700">
          {field.label}
          {field.required && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">필수</span>}
        </label>
        {field.type === 'textarea' ? (
          <textarea
            rows={3}
            value={fieldValue(values, field.id)}
            onChange={(event) => updateValue(field.id, event.target.value)}
            placeholder={field.placeholder}
            className={`${baseClass} resize-y`}
          />
        ) : field.type === 'select' ? (
          <select
            value={fieldValue(values, field.id)}
            onChange={(event) => updateValue(field.id, event.target.value)}
            className={baseClass}
          >
            <option value="">선택하세요</option>
            {(field.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={field.type || 'text'}
            value={fieldValue(values, field.id)}
            onChange={(event) => updateValue(field.id, event.target.value)}
            placeholder={field.placeholder}
            className={baseClass}
          />
        )}
        {field.helper && <p className="text-xs font-medium text-slate-500">{field.helper}</p>}
      </div>
    );
  };

  if (planHtml) {
    return (
      <WorkspaceShell
        serviceHref="/work-plan"
        title="작업계획서"
        description="고정 양식에 따라 생성된 작업계획서를 검토하고 필요한 부분을 직접 수정할 수 있습니다."
        contentClassName="pb-20"
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">생성된 작업계획서</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">{selectedTemplate.title}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
              >
                <RefreshCw className="h-4 w-4" />
                다시 작성
              </button>
              <button
                onClick={() => setIsEditing((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white transition ${
                  isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'
                }`}
              >
                <Edit3 className="h-4 w-4" />
                {isEditing ? '수정 완료' : '직접 수정'}
              </button>
              <button
                onClick={() => {
                  setSaveTitle(`${fieldValue(values, 'projectName') || selectedTemplate.shortTitle} 작업계획서 ${new Date().toLocaleDateString()}`);
                  setShowSaveModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-blue-100 transition hover:bg-blue-700"
              >
                <Save className="h-4 w-4" />
                저장소 저장
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-amber-100 transition hover:bg-amber-700"
              >
                <Printer className="h-4 w-4" />
                인쇄/PDF
              </button>
            </div>
          </div>

          {warning && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              {warning}
            </div>
          )}

          <div
            ref={reportRef}
            contentEditable={isEditing}
            suppressContentEditableWarning
            className={`min-h-[900px] overflow-auto rounded-xl border bg-white p-8 shadow-xl shadow-slate-200/70 outline-none ${
              isEditing ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'
            }`}
            dangerouslySetInnerHTML={{ __html: planHtml }}
          />

          {showSaveModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setShowSaveModal(false)}
              />
              <div className="relative z-[110] w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl">
                <h3 className="mb-6 flex items-center gap-3 text-2xl font-black text-slate-900">
                  <Save className="h-7 w-7 text-blue-600" />
                  작업계획서 저장
                </h3>
                <div className="mb-8">
                  <label className="mb-2 ml-1 block text-sm font-bold text-slate-500">저장 제목</label>
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(event) => setSaveTitle(event.target.value)}
                    placeholder="예: 굴착 작업계획서 2026. 4. 25."
                    className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 rounded-xl bg-slate-100 py-4 text-base font-black text-slate-600 transition hover:bg-slate-200"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveWorkPlan}
                    disabled={isSaving}
                    className="flex-1 rounded-xl bg-blue-600 py-4 text-base font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? '저장 중...' : '저장하기'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      serviceHref="/work-plan"
      title="작업계획서"
      description="법정 작업계획서 대상 작업을 선택하고 최소 정보를 입력하면, 고정 양식에 맞춰 AI가 초안을 작성합니다."
      contentClassName="pb-20"
    >
      {!agreed ? (
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-100">
          <AIDisclaimer
            serviceName="작업계획서"
            accentColor="amber"
            agreeLabel="주의사항을 확인했고 작업계획서 생성을 시작합니다"
            declineLabel="동의하지 않음"
            onAgree={() => setAgreed(true)}
            standalone={false}
          />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">양식 선택</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    산업안전보건기준에 관한 규칙 제38조의 13개 작업 대상 기준으로 고정했습니다.
                  </p>
                </div>
              </div>

              <div className="grid max-h-[34rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-1">
                {WORK_PLAN_TEMPLATES.map((template) => {
                  const selected = selectedTemplate.id === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateChange(template.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        selected
                          ? 'border-amber-500 bg-amber-50 text-amber-950 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-black text-slate-400">#{template.order}</span>
                        {selected && <CheckCircle2 className="h-4 w-4 text-amber-600" />}
                      </div>
                      <p className="mt-1 text-sm font-black">{template.shortTitle}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">{template.appliesTo}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
              <h3 className="text-sm font-black text-blue-900">고정 양식 구성</h3>
              <ul className="mt-3 space-y-2 text-sm font-medium text-blue-900">
                <li>문서 기본정보</li>
                <li>입력 정보 요약</li>
                <li>작업 개요 및 사전조사 결과</li>
                <li>별표 4 포함사항 반영표</li>
                <li>작업순서별 계획 및 위험요인 대책</li>
                <li>보호구ㆍ점검ㆍ교육ㆍ비상조치</li>
                <li>도면ㆍ사진 첨부 및 승인란</li>
              </ul>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">Selected Form</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">{selectedTemplate.title}</h2>
                <p className="mt-2 text-sm font-medium text-slate-500">{selectedTemplate.summary}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-800">법정 포함사항</p>
                <div className="mt-3 grid gap-2">
                  {selectedTemplate.planningItems.map((item, index) => (
                    <div key={item} className="flex gap-2 text-sm text-slate-600">
                      <span className="font-black text-slate-400">{index + 1}.</span>
                      <span className="font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-black text-slate-900">기본 정보</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {COMMON_WORK_PLAN_FIELDS.map(renderField)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-black text-slate-900">양식별 필수 정보</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {selectedTemplate.requiredFields.map(renderField)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-black text-slate-900">추가 정보</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {selectedTemplate.optionalFields.map(renderField)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">도면ㆍ사진 첨부</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">{selectedTemplate.imageGuide}</p>
                  <p className="mt-1 text-xs font-bold text-amber-800">
                    이미지는 작업계획서 생성 시 <span className="font-black">최대 {MAX_ATTACHMENTS}장</span>까지만 첨부할 수
                    있습니다.
                  </p>
                </div>
                <label
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white transition ${
                    attachments.length >= MAX_ATTACHMENTS
                      ? 'cursor-not-allowed bg-slate-300'
                      : 'cursor-pointer bg-slate-900 hover:bg-slate-700'
                  }`}
                  title={
                    attachments.length >= MAX_ATTACHMENTS
                      ? `이미지는 최대 ${MAX_ATTACHMENTS}장까지 첨부할 수 있습니다.`
                      : undefined
                  }
                >
                  <ImagePlus className="h-4 w-4" />
                  이미지 추가
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={attachments.length >= MAX_ATTACHMENTS}
                    onChange={handleFiles}
                  />
                </label>
              </div>

              {attachments.length > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex gap-3">
                        <img
                          src={attachment.dataUrl}
                          alt={attachment.name}
                          className="h-20 w-24 shrink-0 rounded-lg border border-slate-200 bg-white object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <p className="min-w-0 flex-1 truncate text-sm font-black text-slate-800">{attachment.name}</p>
                            <button
                              type="button"
                              onClick={() => removeAttachment(attachment.id)}
                              className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-red-600"
                              title="첨부 삭제"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={attachment.note || ''}
                            onChange={(event) => updateAttachmentNote(attachment.id, event.target.value)}
                            placeholder="이미지 설명 또는 표시 위치 메모"
                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-500">
                  도면, 작업구역 사진, 운행경로도, 장비 제원 이미지가 있으면 선택적으로 첨부하세요.
                </div>
              )}
            </div>

            {(error || warning || missingRequiredFields.length > 0) && (
              <div className="space-y-2">
                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    <X className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {warning && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{warning}</span>
                  </div>
                )}
                {!error && missingRequiredFields.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                    남은 필수 입력: {missingRequiredFields.map((field) => field.label).join(', ')}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-amber-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-amber-100 transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  작업계획서 생성 중
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  고정 양식으로 작업계획서 생성
                </>
              )}
            </button>
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}
