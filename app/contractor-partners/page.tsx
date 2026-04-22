'use client';

import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/app/lib/firebase';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  ClipboardCheck,
  ChevronLeft,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  FileText,
  Phone,
  User,
} from 'lucide-react';
import { Button } from '@/app/safety-log/_components/ui/Button';
import { PartnerWizardModal } from './_components/PartnerWizardModal';
import { uploadPartnerFile, deletePartnerStorageFiles } from './_lib/storage';
import { cn } from '@/app/safety-log/_lib/utils';
import { Pagination } from '@/components/ui/Pagination';
import {
  type ContractorPartner,
  type OptionalDocKey,
  OPTIONAL_DOC_KEYS,
  OPTIONAL_DOC_META,
  REQUIRED_DOC_KEYS,
  REQUIRED_DOC_LABELS,
  type RequiredDocKey,
  hasRequiredDocFile,
  countOptionalCategoriesSelected,
  countOptionalCategoriesWithAttachment,
} from './_lib/types';

function formatTs(v: unknown): string {
  if (!v) return '-';
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate().toLocaleString('ko-KR');
    } catch {
      return '-';
    }
  }
  return '-';
}

/** 목록 등 짧은 표기 */
function formatTsShort(v: unknown): string {
  if (!v) return '-';
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      const d = (v as { toDate: () => Date }).toDate();
      return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    } catch {
      return '-';
    }
  }
  return '-';
}

/** 버튼 내부용: 실제 input 없이 체크 상태만 표시 (중첩 interactive 방지) */
function ListDocCheckbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-2"
      title={checked ? `${label} 첨부됨` : `${label} 미첨부`}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border shadow-inner',
          checked ? 'border-emerald-600 bg-emerald-500' : 'border-slate-300 bg-white'
        )}
        aria-hidden
      >
        {checked ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} /> : null}
      </span>
      <span className="whitespace-nowrap text-[11px] font-bold text-slate-700">{label}</span>
    </span>
  );
}

const PARTNERS_PAGE_SIZE = 10;

const EVALUATION_THRESHOLD = 80;
interface EvaluationCriterion {
  id: string;
  label: string;
  description: string;
  maxScore: number;
}

type EvaluationScores = Record<string, number>;

const DEFAULT_EVALUATION_CRITERIA: EvaluationCriterion[] = [
  { id: 'safetyManagementSystem', label: '안전관리 체계', description: '안전관리자 지정, 역할·책임, 운영체계의 적정성', maxScore: 25 },
  { id: 'documentReadiness', label: '필수 서류 준비도', description: '안전보건관리계획서·위험성평가 등 서류 완성도', maxScore: 20 },
  { id: 'workerQualification', label: '인력 자격/경력', description: '투입 인력 자격증, 경력, 배치 적정성', maxScore: 20 },
  { id: 'safetyEducation', label: '안전교육 이행 수준', description: '정기교육, 특별교육, 신규채용자 교육 이행성', maxScore: 15 },
  { id: 'accidentHistoryAndImprovement', label: '사고이력/개선활동', description: '최근 사고이력, 재발방지 대책 및 개선 이행', maxScore: 20 },
];

function ContractorPartnersContent() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<ContractorPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContractorPartner | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [submitting, setSubmitting] = useState(false);
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [evaluationSubmitting, setEvaluationSubmitting] = useState(false);
  const [evaluatingPartner, setEvaluatingPartner] = useState<ContractorPartner | null>(null);
  const [evaluationScores, setEvaluationScores] = useState<EvaluationScores>({});
  const [evaluationComment, setEvaluationComment] = useState('');
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [criteriaSubmitting, setCriteriaSubmitting] = useState(false);
  const [evaluationCriteria, setEvaluationCriteria] = useState<EvaluationCriterion[]>(DEFAULT_EVALUATION_CRITERIA);
  const [evaluationThreshold, setEvaluationThreshold] = useState(EVALUATION_THRESHOLD);
  const [criteriaDraft, setCriteriaDraft] = useState<EvaluationCriterion[]>(DEFAULT_EVALUATION_CRITERIA);
  const [thresholdDraft, setThresholdDraft] = useState(EVALUATION_THRESHOLD);
  const [partnerListPage, setPartnerListPage] = useState(1);

  const criteriaTotal = evaluationCriteria.reduce((acc, item) => acc + item.maxScore, 0);
  const criteriaDraftTotal = criteriaDraft.reduce((acc, item) => acc + item.maxScore, 0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'contractor_partners'),
        where('managerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ContractorPartner[];
      setPartners(list);
    } catch (e) {
      console.error(e);
      alert('목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const partnerTotalPages = Math.max(1, Math.ceil(partners.length / PARTNERS_PAGE_SIZE));

  useEffect(() => {
    if (partnerListPage > partnerTotalPages) setPartnerListPage(partnerTotalPages);
  }, [partnerListPage, partnerTotalPages]);

  const pagedPartners = useMemo(() => {
    const start = (partnerListPage - 1) * PARTNERS_PAGE_SIZE;
    return partners.slice(start, start + PARTNERS_PAGE_SIZE);
  }, [partners, partnerListPage]);

  useEffect(() => {
    const loadCriteria = async () => {
      if (!user) return;
      try {
        const configRef = doc(db, 'contractor_partner_eval_criteria', user.uid);
        const snap = await getDoc(configRef);
        if (!snap.exists()) {
          setEvaluationCriteria(DEFAULT_EVALUATION_CRITERIA);
          setEvaluationThreshold(EVALUATION_THRESHOLD);
          return;
        }
        const data = snap.data() as {
          criteria?: EvaluationCriterion[];
          thresholdScore?: number;
        };
        const criteria = Array.isArray(data.criteria) && data.criteria.length
          ? data.criteria
              .map((c) => ({
                id: String(c.id || '').trim(),
                label: String(c.label || '').trim(),
                description: String(c.description || '').trim(),
                maxScore: Math.max(1, Number(c.maxScore) || 0),
              }))
              .filter((c) => c.id && c.label)
          : DEFAULT_EVALUATION_CRITERIA;
        const maxTotal = criteria.reduce((acc, item) => acc + item.maxScore, 0);
        const threshold = Math.min(maxTotal, Math.max(0, Number(data.thresholdScore) || EVALUATION_THRESHOLD));
        setEvaluationCriteria(criteria);
        setEvaluationThreshold(threshold);
      } catch (e) {
        // 아직 평가 기준 문서가 없거나 권한 규칙이 배포되기 전 단계에서
        // permission-denied 가 발생할 수 있으므로 기본값으로 폴백한다.
        console.warn('[contractor-partners] 평가 기준 로드 실패, 기본값 사용:', e);
        setEvaluationCriteria(DEFAULT_EVALUATION_CRITERIA);
        setEvaluationThreshold(EVALUATION_THRESHOLD);
      }
    };
    loadCriteria();
  }, [user]);

  const onSubmitWizard = async (payload: {
    optionalEnabled: Record<OptionalDocKey, boolean>;
    companyName: string;
    responsiblePerson: string;
    contact: string;
    industryLicenseNote: string;
    files: {
      required: Record<RequiredDocKey, File | null>;
      optional: Partial<Record<OptionalDocKey, File | null>>;
    };
  }) => {
    if (!user) return;
    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        const partnerRef = doc(collection(db, 'contractor_partners'));
        const partnerId = partnerRef.id;

        const requiredDocs: Partial<Record<RequiredDocKey, { url: string; fileName: string }>> = {};
        for (const key of REQUIRED_DOC_KEYS) {
          const f = payload.files.required[key];
          if (!f) continue;
          const up = await uploadPartnerFile(user.uid, partnerId, `req_${key}`, f);
          requiredDocs[key] = up;
        }

        const optionalDocs: Partial<Record<OptionalDocKey, { url: string; fileName: string }>> = {};
        for (const key of OPTIONAL_DOC_KEYS) {
          if (!payload.optionalEnabled[key]) continue;
          const file = payload.files.optional[key];
          if (!file) continue;
          const up = await uploadPartnerFile(user.uid, partnerId, `opt_${key}`, file);
          optionalDocs[key] = up;
        }

        const optionalText =
          payload.optionalEnabled.industryLicense && payload.industryLicenseNote.trim()
            ? { industryLicense: payload.industryLicenseNote.trim() }
            : undefined;

        await setDoc(partnerRef, {
          managerId: user.uid,
          companyName: payload.companyName,
          responsiblePerson: payload.responsiblePerson,
          contact: payload.contact,
          requiredDocs: Object.keys(requiredDocs).length ? requiredDocs : null,
          optionalEnabled: payload.optionalEnabled,
          optionalText: optionalText ?? null,
          optionalDocs: Object.keys(optionalDocs).length ? optionalDocs : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        setModalOpen(false);
        await load();
      } else if (selected) {
        const partnerId = selected.id;

        const requiredDocs: Partial<Record<RequiredDocKey, { url: string; fileName: string }>> = {
          ...(selected.requiredDocs || {}),
        };
        for (const key of REQUIRED_DOC_KEYS) {
          const f = payload.files.required[key];
          if (f) {
            const up = await uploadPartnerFile(user.uid, partnerId, `req_${key}`, f);
            requiredDocs[key] = up;
          }
        }

        const optionalDocs: Partial<Record<OptionalDocKey, { url: string; fileName: string }>> = {
          ...selected.optionalDocs,
        };
        for (const key of OPTIONAL_DOC_KEYS) {
          if (!selected.optionalEnabled[key]) continue;
          const f = payload.files.optional[key];
          if (f) {
            const up = await uploadPartnerFile(user.uid, partnerId, `opt_${key}`, f);
            optionalDocs[key] = up;
          }
        }

        const optionalText: { industryLicense?: string } = { ...selected.optionalText };
        if (selected.optionalEnabled.industryLicense) {
          const n = payload.industryLicenseNote.trim();
          if (n) optionalText.industryLicense = n;
          else delete optionalText.industryLicense;
        }

        await updateDoc(doc(db, 'contractor_partners', partnerId), {
          companyName: payload.companyName,
          responsiblePerson: payload.responsiblePerson,
          contact: payload.contact,
          requiredDocs: Object.keys(requiredDocs).length ? requiredDocs : null,
          optionalDocs: Object.keys(optionalDocs).length ? optionalDocs : null,
          optionalText: Object.keys(optionalText).length ? optionalText : null,
          updatedAt: serverTimestamp(),
        });

        const refreshed = await getDoc(doc(db, 'contractor_partners', partnerId));
        if (refreshed.exists()) {
          setSelected({ id: refreshed.id, ...refreshed.data() } as ContractorPartner);
        }
        setModalOpen(false);
        await load();
      }
    } catch (e) {
      console.error(e);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: ContractorPartner) => {
    if (!confirm(`「${p.companyName}」협력업체 정보를 삭제할까요?`)) return;
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    try {
      await deletePartnerStorageFiles(user.uid, p.id);
      await deleteDoc(doc(db, 'contractor_partners', p.id));
      setSelected(null);
      await load();
    } catch (e) {
      console.error(e);
      alert('삭제하지 못했습니다.');
    }
  };

  const openCreate = () => {
    setModalMode('create');
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setModalMode('edit');
    setModalOpen(true);
  };

  const openEvaluation = (partner: ContractorPartner) => {
    const saved = partner.qualificationEvaluation;
    setEvaluatingPartner(partner);
    const nextScores: EvaluationScores = {};
    for (const item of evaluationCriteria) {
      const raw = saved?.scores?.[item.id];
      nextScores[item.id] = Number.isFinite(raw) ? Math.max(0, Math.min(item.maxScore, Math.floor(Number(raw)))) : 0;
    }
    setEvaluationScores(nextScores);
    setEvaluationComment(saved?.comment ?? '');
    setEvaluationOpen(true);
  };

  const closeEvaluation = () => {
    if (evaluationSubmitting) return;
    setEvaluationOpen(false);
    setEvaluatingPartner(null);
  };

  const totalScore = evaluationCriteria.reduce((acc, item) => acc + (evaluationScores[item.id] || 0), 0);
  const isQualified = totalScore >= evaluationThreshold;

  const handleScoreChange = (key: string, max: number, raw: string) => {
    const num = Number(raw);
    const safe = Number.isFinite(num) ? Math.max(0, Math.min(max, Math.floor(num))) : 0;
    setEvaluationScores((prev) => ({ ...prev, [key]: safe }));
  };

  const openCriteriaModal = () => {
    setCriteriaDraft(evaluationCriteria);
    setThresholdDraft(evaluationThreshold);
    setCriteriaOpen(true);
  };

  const addCriteriaRow = () => {
    setCriteriaDraft((prev) => [
      ...prev,
      { id: `custom_${Date.now()}`, label: '', description: '', maxScore: 10 },
    ]);
  };

  const removeCriteriaRow = (id: string) => {
    setCriteriaDraft((prev) => prev.filter((item) => item.id !== id));
  };

  const updateCriteriaRow = (id: string, key: 'label' | 'description' | 'maxScore', value: string) => {
    setCriteriaDraft((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (key === 'maxScore') {
          const num = Number(value);
          return { ...item, maxScore: Number.isFinite(num) ? Math.max(1, Math.floor(num)) : 1 };
        }
        return { ...item, [key]: value };
      })
    );
  };

  const saveCriteria = async () => {
    if (!user) return;
    const normalized = criteriaDraft
      .map((item, idx) => ({
        id: item.id?.trim() || `custom_${idx}_${Date.now()}`,
        label: item.label.trim(),
        description: item.description.trim(),
        maxScore: Math.max(1, Math.floor(item.maxScore || 0)),
      }))
      .filter((item) => item.label);
    if (!normalized.length) {
      alert('평가 항목을 1개 이상 입력해 주세요.');
      return;
    }
    const total = normalized.reduce((acc, item) => acc + item.maxScore, 0);
    if (total !== 100) {
      alert('총점이 100점이 아니면 100점 미만이나 초과일경우 총점을 100점으로 맞춰주세요');
      return;
    }
    const threshold = Math.min(total, Math.max(0, Math.floor(thresholdDraft)));
    setCriteriaSubmitting(true);
    try {
      await setDoc(doc(db, 'contractor_partner_eval_criteria', user.uid), {
        managerId: user.uid,
        criteria: normalized,
        thresholdScore: threshold,
        updatedAt: serverTimestamp(),
      });
      setEvaluationCriteria(normalized);
      setEvaluationThreshold(threshold);
      setCriteriaOpen(false);
    } catch (e) {
      console.error(e);
      alert('평가 기준 저장 중 오류가 발생했습니다.');
    } finally {
      setCriteriaSubmitting(false);
    }
  };

  const submitEvaluation = async () => {
    if (!user || !evaluatingPartner) return;
    setEvaluationSubmitting(true);
    try {
      await updateDoc(doc(db, 'contractor_partners', evaluatingPartner.id), {
        qualificationEvaluation: {
          totalScore,
          thresholdScore: evaluationThreshold,
          status: isQualified ? 'qualified' : 'unqualified',
          comment: evaluationComment.trim(),
          scores: evaluationScores,
          criteriaSnapshot: evaluationCriteria,
          evaluatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });

      const refreshed = await getDoc(doc(db, 'contractor_partners', evaluatingPartner.id));
      if (refreshed.exists()) {
        const refreshedPartner = { id: refreshed.id, ...refreshed.data() } as ContractorPartner;
        if (selected?.id === refreshedPartner.id) setSelected(refreshedPartner);
      }
      await load();
      closeEvaluation();
    } catch (e) {
      console.error(e);
      alert('평가 저장 중 오류가 발생했습니다.');
    } finally {
      setEvaluationSubmitting(false);
    }
  };

  return (
    <WorkspaceShell
      serviceHref="/contractor-partners"
      title="협력업체 관리"
      description="협력업체 기본 정보와 안전관리 서류를 등록하고, 선택 항목까지 함께 보관합니다."
    >
      <div className="mx-auto w-full max-w-6xl">
        <AnimatePresence mode="wait">
          {!selected && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  <Building2 className="h-3.5 w-3.5 text-blue-600" />
                  등록 {partners.length}곳
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 text-sm" onClick={openCriteriaModal}>
                    <ClipboardCheck className="h-4 w-4" />
                    적격수급업체 기준 수립
                  </Button>
                  <Button size="sm" className="gap-1.5 text-sm" onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    협력업체 추가
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="mt-3 text-sm font-medium text-slate-400">불러오는 중...</p>
                </div>
              ) : partners.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 py-16 text-center">
                  <p className="text-sm font-bold text-slate-500">등록된 협력업체가 없습니다.</p>
                  <p className="mt-1 text-xs text-slate-400">추가 버튼으로 필수·선택 서류를 함께 등록할 수 있습니다.</p>
                </div>
              ) : (
                <>
                <ul className="space-y-2">
                  {pagedPartners.map((p) => {
                    const planOk = hasRequiredDocFile(p, 'safetyPlan');
                    const riskOk = hasRequiredDocFile(p, 'riskAssessment');
                    const optSel = countOptionalCategoriesSelected(p);
                    const optDone = countOptionalCategoriesWithAttachment(p);
                    const evaluation = p.qualificationEvaluation;
                    return (
                      <li key={p.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelected(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') setSelected(p);
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-all hover:border-blue-200 hover:shadow sm:px-4"
                        >
                          <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:gap-3 lg:gap-5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate text-sm font-black leading-tight text-slate-900 sm:text-base">
                                  {p.companyName}
                                </p>
                              </div>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] font-medium text-slate-500">
                                <span className="inline-flex items-center gap-0.5">
                                  <User className="h-3 w-3 shrink-0 opacity-70" />
                                  {p.responsiblePerson}
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="inline-flex items-center gap-0.5">
                                  <Phone className="h-3 w-3 shrink-0 opacity-70" />
                                  {p.contact}
                                </span>
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 min-[520px]:min-w-0 min-[520px]:flex-1 min-[520px]:justify-end lg:justify-center">
                              <ListDocCheckbox checked={planOk} label="안전보건계획서" />
                              <ListDocCheckbox checked={riskOk} label="위험성평가" />
                              <span
                                className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-700 sm:text-[11px]"
                                title="선택한 기타 서류 중, 파일·내용이 채워진 항목 수 / 선택한 항목 수"
                              >
                                기타 <span className="tabular-nums">({optDone}/{optSel})</span>
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-auto gap-1 px-2 py-1 text-[11px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEvaluation(p);
                                }}
                              >
                                <ClipboardCheck className="h-3 w-3" />
                                적격수급업체 평가
                              </Button>
                              {evaluation && (
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black',
                                    evaluation.status === 'qualified'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-rose-100 text-rose-700'
                                  )}
                                >
                                  {`평가완료(${evaluation.status === 'qualified' ? '적격' : '부적격'})`}
                                </span>
                              )}
                            </div>
                            <span className="hidden shrink-0 text-right text-[10px] font-bold leading-tight text-slate-400 min-[520px]:block lg:min-w-[7rem]">
                              {formatTs(p.createdAt)}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Pagination
                  page={partnerListPage}
                  totalPages={partnerTotalPages}
                  onChange={setPartnerListPage}
                  accentClass="bg-blue-600 text-white border-blue-600"
                />
                </>
              )}
            </motion.div>
          )}

          {selected && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelected(null)}>
                  <ChevronLeft className="h-4 w-4" />
                  목록
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
                  <Pencil className="h-4 w-4" />
                  수정
                </Button>
                <Button variant="danger" size="sm" className="gap-1.5" onClick={() => handleDelete(selected)}>
                  <Trash2 className="h-4 w-4" />
                  삭제
                </Button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-black leading-snug text-slate-900 sm:text-xl">{selected.companyName}</h2>
                    <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-[13px] sm:text-sm">
                      <div className="flex items-baseline gap-2">
                        <dt className="shrink-0 text-[11px] font-bold text-slate-400">관리책임자</dt>
                        <dd className="font-bold text-slate-800">{selected.responsiblePerson}</dd>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <dt className="shrink-0 text-[11px] font-bold text-slate-400">연락처</dt>
                        <dd className="font-bold text-slate-800">{selected.contact}</dd>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <dt className="shrink-0 text-[11px] font-bold text-slate-400">등록일</dt>
                        <dd className="text-slate-600">{formatTs(selected.createdAt)}</dd>
                      </div>
                    </dl>
                  </div>
                  {selected.qualificationEvaluation && (
                    <div
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-bold',
                        selected.qualificationEvaluation.status === 'qualified'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                      )}
                    >
                      {`평가완료(${selected.qualificationEvaluation.status === 'qualified' ? '적격' : '부적격'})`}
                      <p className="mt-0.5 text-xs font-medium">
                        총점 {selected.qualificationEvaluation.totalScore} / 100
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        평가일시: {formatTs(selected.qualificationEvaluation.evaluatedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {selected.qualificationEvaluation && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 sm:text-sm">적격수급업체 평가 결과</h3>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(selected.qualificationEvaluation.criteriaSnapshot?.length
                      ? selected.qualificationEvaluation.criteriaSnapshot
                      : evaluationCriteria
                    ).map((item) => (
                      <li key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                        <p className="font-bold text-slate-800">{item.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                        <p className="mt-1 text-xs font-black text-slate-700">
                          {selected.qualificationEvaluation?.scores[item.id] ?? 0} / {item.maxScore}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-bold text-slate-500">평가 의견</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                      {selected.qualificationEvaluation.comment || '의견 없음'}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 sm:p-5">
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-950 sm:text-sm">
                  <FileText className="h-4 w-4 shrink-0" />
                  필수 서류
                </h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {REQUIRED_DOC_KEYS.map((key) => {
                    const docFile = selected.requiredDocs?.[key];
                    return (
                      <li
                        key={key}
                        className="flex min-h-[3.25rem] flex-col justify-center gap-1 rounded-lg border border-amber-100/80 bg-white/90 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <span className="shrink-0 text-[13px] font-bold text-slate-800">{REQUIRED_DOC_LABELS[key]}</span>
                        {docFile ? (
                          <a
                            href={docFile.url}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 truncate text-right text-xs font-bold text-blue-600 hover:underline sm:max-w-[55%]"
                          >
                            {docFile.fileName}
                          </a>
                        ) : (
                          <span className="text-[11px] font-medium text-amber-800/90 sm:text-right">
                            미첨부 · 수정에서 추가
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {OPTIONAL_DOC_KEYS.some((k) => selected.optionalEnabled[k]) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 sm:text-sm">선택 서류</h3>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {OPTIONAL_DOC_KEYS.map((key) => {
                      if (!selected.optionalEnabled[key]) return null;
                      const hasFile = !!selected.optionalDocs?.[key];
                      const hasIndustryText =
                        key === 'industryLicense' && !!selected.optionalText?.industryLicense?.trim();
                      const pending =
                        key === 'industryLicense'
                          ? !hasIndustryText && !hasFile
                          : !hasFile;
                      return (
                        <li
                          key={key}
                          className="flex flex-col rounded-lg border border-slate-100 bg-white p-3"
                        >
                          <p className="text-[13px] font-bold leading-tight text-slate-800">{OPTIONAL_DOC_META[key].title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{OPTIONAL_DOC_META[key].hint}</p>
                          {key === 'industryLicense' && selected.optionalText?.industryLicense && (
                            <p className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                              {selected.optionalText.industryLicense}
                            </p>
                          )}
                          {selected.optionalDocs?.[key] && (
                            <a
                              href={selected.optionalDocs[key]!.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 truncate text-xs font-bold text-blue-600 hover:underline"
                            >
                              첨부: {selected.optionalDocs[key]!.fileName}
                            </a>
                          )}
                          {pending && (
                            <p className="mt-2 text-[11px] font-medium text-amber-700/90">
                              미등록 · 수정에서 추가
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PartnerWizardModal
        open={modalOpen}
        mode={modalMode}
        initial={modalMode === 'edit' ? selected : null}
        submitting={submitting}
        onClose={() => !submitting && setModalOpen(false)}
        onSubmit={onSubmitWizard}
      />

      {evaluationOpen && evaluatingPartner && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            aria-label="닫기"
            onClick={closeEvaluation}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-black text-slate-900">적격수급업체 평가</h2>
              <p className="text-xs text-slate-500">
                {evaluatingPartner.companyName} · 적격 기준 {evaluationThreshold}점 / {criteriaTotal}점
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-3">
                {evaluationCriteria.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={item.maxScore}
                          value={evaluationScores[item.id] ?? 0}
                          onChange={(e) => handleScoreChange(item.id, item.maxScore, e.target.value)}
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm font-bold"
                        />
                        <span className="text-xs font-bold text-slate-500">/ {item.maxScore}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                <p className="text-sm font-black text-slate-900">자동 합산 점수</p>
                <p className="mt-1 text-base font-black text-blue-700">
                  {totalScore} / {criteriaTotal} · {isQualified ? '평가완료(적격)' : '평가완료(부적격)'}
                </p>
              </div>

              <div className="mt-4">
                <label className="text-sm font-bold text-slate-700">평가 의견</label>
                <textarea
                  value={evaluationComment}
                  onChange={(e) => setEvaluationComment(e.target.value)}
                  placeholder="적격/부적격 여부와 별개로 판단 근거 및 보완 요청사항을 입력하세요."
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
              <Button type="button" variant="outline" className="flex-1" onClick={closeEvaluation} disabled={evaluationSubmitting}>
                취소
              </Button>
              <Button type="button" className="flex-1" onClick={submitEvaluation} disabled={evaluationSubmitting} isLoading={evaluationSubmitting}>
                평가 저장
              </Button>
            </div>
          </div>
        </div>
      )}

      {criteriaOpen && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            aria-label="닫기"
            onClick={() => !criteriaSubmitting && setCriteriaOpen(false)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-black text-slate-900">적격수급업체 기준 수립</h2>
              <p className="text-xs text-slate-500">
                평가 항목을 직접 구성할 수 있습니다. 기본 포맷은 자동 제공됩니다.
              </p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-700">평가 항목</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCriteriaDraft(DEFAULT_EVALUATION_CRITERIA);
                      setThresholdDraft(EVALUATION_THRESHOLD);
                    }}
                  >
                    기본 포맷 복원
                  </Button>
                  <Button type="button" size="sm" onClick={addCriteriaRow}>
                    항목 추가
                  </Button>
                </div>
              </div>

              <ul className="space-y-3">
                {criteriaDraft.map((item) => (
                  <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                    <div className="grid gap-2 sm:grid-cols-6">
                      <input
                        value={item.label}
                        onChange={(e) => updateCriteriaRow(item.id, 'label', e.target.value)}
                        placeholder="항목명"
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm sm:col-span-2"
                      />
                      <input
                        value={item.description}
                        onChange={(e) => updateCriteriaRow(item.id, 'description', e.target.value)}
                        placeholder="항목 설명"
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm sm:col-span-3"
                      />
                      <div className="flex gap-2 sm:col-span-1">
                        <input
                          type="number"
                          min={1}
                          value={item.maxScore}
                          onChange={(e) => updateCriteriaRow(item.id, 'maxScore', e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-sm"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => removeCriteriaRow(item.id)}
                          disabled={criteriaDraft.length <= 1}
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                <p className="text-sm font-bold text-slate-800">총점 및 적격 기준</p>
                <p className="mt-1 text-xs text-slate-600">현재 배점 총점: {criteriaDraftTotal}점</p>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600">적격 기준 점수</label>
                  <input
                    type="number"
                    min={0}
                    max={criteriaDraftTotal}
                    value={thresholdDraft}
                    onChange={(e) => setThresholdDraft(Math.max(0, Math.min(criteriaDraftTotal, Number(e.target.value) || 0)))}
                    className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-sm font-bold"
                  />
                  <span className="text-xs text-slate-500">/ {criteriaDraftTotal}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCriteriaOpen(false)} disabled={criteriaSubmitting}>
                취소
              </Button>
              <Button type="button" className="flex-1" onClick={saveCriteria} disabled={criteriaSubmitting} isLoading={criteriaSubmitting}>
                기준 저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}

export default function ContractorPartnersPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <ContractorPartnersContent />
    </Suspense>
  );
}
