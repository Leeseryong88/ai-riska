'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Button, Input, Label } from '@/app/safety-log/_components/ui/Button';
import { cn } from '@/app/safety-log/_lib/utils';
import {
  type ContractorPartner,
  type OptionalDocKey,
  OPTIONAL_DOC_KEYS,
  OPTIONAL_DOC_META,
  REQUIRED_DOC_KEYS,
  REQUIRED_DOC_LABELS,
  REQUIRED_BASIC_FIELD_LABELS,
  type RequiredDocKey,
  emptyOptionalEnabled,
} from '../_lib/types';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/*';

type Step = 1 | 2;

interface PartnerWizardModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: ContractorPartner | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    optionalEnabled: Record<OptionalDocKey, boolean>;
    companyName: string;
    responsiblePerson: string;
    contact: string;
    industryLicenseNote: string;
    files: {
      required: Record<RequiredDocKey, File | null>;
      optional: Partial<Record<OptionalDocKey, File | null>>;
    };
  }) => void;
}

export function PartnerWizardModal({
  open,
  mode,
  initial,
  submitting,
  onClose,
  onSubmit,
}: PartnerWizardModalProps) {
  const [step, setStep] = useState<Step>(1);
  /** 1단계: 필수정보 안내 접기/펼치기 (기본 접힘) */
  const [requiredInfoOpen, setRequiredInfoOpen] = useState(false);
  const [optionalEnabled, setOptionalEnabled] = useState(emptyOptionalEnabled());

  const [companyName, setCompanyName] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [contact, setContact] = useState('');
  const [industryLicenseNote, setIndustryLicenseNote] = useState('');

  const [reqFiles, setReqFiles] = useState<Record<RequiredDocKey, File | null>>({
    safetyPlan: null,
    riskAssessment: null,
  });
  const [optFiles, setOptFiles] = useState<Partial<Record<OptionalDocKey, File | null>>>({});

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setStep(2);
      setOptionalEnabled({ ...initial.optionalEnabled });
      setCompanyName(initial.companyName);
      setResponsiblePerson(initial.responsiblePerson);
      setContact(initial.contact);
      setIndustryLicenseNote(initial.optionalText?.industryLicense ?? '');
      setReqFiles({ safetyPlan: null, riskAssessment: null });
      setOptFiles({});
    } else if (mode === 'create') {
      setStep(1);
      setRequiredInfoOpen(false);
      setOptionalEnabled(emptyOptionalEnabled());
      setCompanyName('');
      setResponsiblePerson('');
      setContact('');
      setIndustryLicenseNote('');
      setReqFiles({ safetyPlan: null, riskAssessment: null });
      setOptFiles({});
    }
  }, [open, mode, initial]);

  if (!open) return null;

  const toggleOptional = (key: OptionalDocKey) => {
    setOptionalEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNext = () => {
    setStep(2);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !responsiblePerson.trim() || !contact.trim()) {
      alert('필수 정보(업체명, 관리책임자, 연락처)를 모두 입력해 주세요.');
      return;
    }
    onSubmit({
      optionalEnabled,
      companyName: companyName.trim(),
      responsiblePerson: responsiblePerson.trim(),
      contact: contact.trim(),
      industryLicenseNote: industryLicenseNote.trim(),
      files: { required: reqFiles, optional: optFiles },
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {mode === 'create' ? '협력업체 추가' : '협력업체 수정'}
            </h2>
            <p className="text-xs font-medium text-slate-500">
              {mode === 'create' && step === 1 && '「필수정보」에서 안내를 확인할 수 있습니다. 추가로 보관할 선택 서류를 고릅니다.'}
              {mode === 'create' &&
                step === 2 &&
                '기본 정보는 필수입니다. 안전보건관리계획서·위험성평가표·선택 서류는 비워두고 저장한 뒤 나중에 첨부할 수 있습니다.'}
              {mode === 'edit' && '정보와 서류를 수정합니다. (파일 미첨부 시 기존 파일 유지)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === 'create' && step === 1 && (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40">
                <button
                  type="button"
                  onClick={() => setRequiredInfoOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-amber-50/80"
                  aria-expanded={requiredInfoOpen}
                  aria-controls="required-info-panel"
                  id="required-info-trigger"
                >
                  <div>
                    <span className="text-sm font-black text-amber-950">필수정보</span>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      기본 정보·필수 서류 안내 (탭하여 펼치기)
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 shrink-0 text-amber-800 transition-transform duration-200',
                      requiredInfoOpen && 'rotate-180'
                    )}
                    aria-hidden
                  />
                </button>
                {requiredInfoOpen && (
                  <div
                    id="required-info-panel"
                    role="region"
                    aria-labelledby="required-info-trigger"
                    className="border-t border-amber-100 bg-white/60 px-4 pb-4 pt-1"
                  >
                    <div className="space-y-4 pt-3">
                      <div>
                        <p className="text-xs font-bold text-amber-900">필수 기본 정보</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          다음 단계에서 입력 · 항상 포함 (체크 해제 불가)
                        </p>
                        <ul className="mt-2 space-y-2">
                          {REQUIRED_BASIC_FIELD_LABELS.map((f) => (
                            <li key={f.id}>
                              <div
                                className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 opacity-95"
                                aria-disabled
                              >
                                <input
                                  type="checkbox"
                                  checked
                                  readOnly
                                  disabled
                                  className="mt-1 h-4 w-4 cursor-not-allowed rounded border-amber-300 text-amber-600"
                                  aria-label={`${f.label} 필수`}
                                />
                                <span className="text-sm font-bold text-slate-800">{f.label}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-900">필수 서류</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          다음 단계 또는 이후 수정에서 업로드 (체크 해제 불가)
                        </p>
                        <ul className="mt-2 space-y-2">
                          {REQUIRED_DOC_KEYS.map((key) => (
                            <li key={key}>
                              <div
                                className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 opacity-95"
                                aria-disabled
                              >
                                <input
                                  type="checkbox"
                                  checked
                                  readOnly
                                  disabled
                                  className="mt-1 h-4 w-4 cursor-not-allowed rounded border-amber-300 text-amber-600"
                                  aria-label={`${REQUIRED_DOC_LABELS[key]} 필수`}
                                />
                                <span className="text-sm font-bold text-slate-800">{REQUIRED_DOC_LABELS[key]}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-700">선택 서류 항목</p>
                <p className="text-xs text-slate-500">
                  체크한 항목만 다음 단계에서 입력할 수 있습니다. 서류는 나중에 수정 화면에서도 첨부할 수 있습니다.
                </p>
              </div>
              <ul className="space-y-2">
                {OPTIONAL_DOC_KEYS.map((key) => (
                  <li key={key}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                        optionalEnabled[key]
                          ? 'border-blue-200 bg-blue-50/80'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                        checked={optionalEnabled[key]}
                        onChange={() => toggleOptional(key)}
                      />
                      <span>
                        <span className="text-sm font-bold text-slate-800">{OPTIONAL_DOC_META[key].title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{OPTIONAL_DOC_META[key].hint}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(mode === 'edit' || step === 2) && (
            <form id="partner-form" onSubmit={handleFormSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-1">
                <div>
                  <Label htmlFor="companyName">업체명 *</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="협력업체 상호"
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="responsiblePerson">관리책임자 *</Label>
                  <Input
                    id="responsiblePerson"
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    placeholder="성명"
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact">연락처 *</Label>
                  <Input
                    id="contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="전화번호 등"
                    className="mt-1"
                    required
                  />
                </div>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                <p className="text-sm font-black text-amber-900">필수 서류</p>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  지금 첨부하지 않아도 저장됩니다. 이후 &quot;수정&quot;에서 언제든지 추가할 수 있습니다.
                </p>
                <div className="mt-3 space-y-3">
                  {REQUIRED_DOC_KEYS.map((key) => (
                    <div key={key}>
                      <Label className="text-slate-800">{REQUIRED_DOC_LABELS[key]}</Label>
                      {mode === 'edit' && initial?.requiredDocs?.[key] && (
                        <p className="mt-1 text-xs text-slate-500">
                          현재: {initial.requiredDocs[key]!.fileName}{' '}
                          <a
                            href={initial.requiredDocs[key]!.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-blue-600 hover:underline"
                          >
                            열기
                          </a>
                        </p>
                      )}
                      <input
                        type="file"
                        accept={ACCEPT}
                        className="mt-1 block w-full text-sm"
                        onChange={(e) =>
                          setReqFiles((prev) => ({
                            ...prev,
                            [key]: e.target.files?.[0] ?? null,
                          }))
                        }
                      />
                      {mode === 'create' && (
                        <p className="mt-1 text-[11px] text-slate-500">PDF·이미지·문서 파일</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {OPTIONAL_DOC_KEYS.some((k) => optionalEnabled[k]) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <p className="text-sm font-black text-slate-800">선택 서류</p>
                  <p className="mt-1 text-xs text-slate-500">
                    지금 첨부하지 않아도 저장됩니다. 이후 &quot;수정&quot;에서 언제든지 추가할 수 있습니다.
                  </p>
                  <div className="mt-3 space-y-4">
                    {OPTIONAL_DOC_KEYS.map((key) => {
                      if (!optionalEnabled[key]) return null;
                      if (key === 'industryLicense') {
                        return (
                          <div key={key} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
                            <Label>{OPTIONAL_DOC_META[key].title}</Label>
                            <p className="text-xs text-slate-500">{OPTIONAL_DOC_META[key].hint}</p>
                            <textarea
                              value={industryLicenseNote}
                              onChange={(e) => setIndustryLicenseNote(e.target.value)}
                              placeholder="업종·면허 내용을 입력하세요."
                              rows={3}
                              className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            />
                            {mode === 'edit' && initial?.optionalDocs?.industryLicense && (
                              <p className="mt-2 text-xs text-slate-500">
                                첨부: {initial.optionalDocs.industryLicense.fileName}{' '}
                                <a
                                  href={initial.optionalDocs.industryLicense.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-bold text-blue-600 hover:underline"
                                >
                                  열기
                                </a>
                              </p>
                            )}
                            <input
                              type="file"
                              accept={ACCEPT}
                              className="mt-2 block w-full text-sm"
                              onChange={(e) =>
                                setOptFiles((prev) => ({
                                  ...prev,
                                  industryLicense: e.target.files?.[0] ?? null,
                                }))
                              }
                            />
                          </div>
                        );
                      }
                      return (
                        <div key={key} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
                          <Label>{OPTIONAL_DOC_META[key].title}</Label>
                          <p className="text-xs text-slate-500">{OPTIONAL_DOC_META[key].hint}</p>
                          {mode === 'edit' && initial?.optionalDocs?.[key] && (
                            <p className="mt-1 text-xs text-slate-500">
                              현재: {initial.optionalDocs[key]!.fileName}{' '}
                              <a
                                href={initial.optionalDocs[key]!.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-bold text-blue-600 hover:underline"
                              >
                                열기
                              </a>
                            </p>
                          )}
                          <input
                            type="file"
                            accept={ACCEPT}
                            className="mt-2 block w-full text-sm"
                            onChange={(e) =>
                              setOptFiles((prev) => ({
                                ...prev,
                                [key]: e.target.files?.[0] ?? null,
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
          {mode === 'create' && step === 2 && (
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)} disabled={submitting}>
              이전
            </Button>
          )}
          {mode === 'create' && step === 1 && (
            <Button type="button" className="flex-1" onClick={handleNext}>
              다음: 정보 입력
            </Button>
          )}
          {(mode === 'edit' || step === 2) && (
            <Button type="submit" form="partner-form" className="flex-1" disabled={submitting} isLoading={submitting}>
              {mode === 'create' ? '저장' : '수정 반영'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
