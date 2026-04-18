'use client';

import React, { useCallback, useEffect, useState, Suspense } from 'react';
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

function ContractorPartnersContent() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<ContractorPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContractorPartner | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [submitting, setSubmitting] = useState(false);

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
                <Button size="sm" className="gap-1.5 text-sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  협력업체 추가
                </Button>
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
                <ul className="space-y-2">
                  {partners.map((p) => {
                    const planOk = hasRequiredDocFile(p, 'safetyPlan');
                    const riskOk = hasRequiredDocFile(p, 'riskAssessment');
                    const optSel = countOptionalCategoriesSelected(p);
                    const optDone = countOptionalCategoriesWithAttachment(p);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(p)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-all hover:border-blue-200 hover:shadow sm:px-4"
                        >
                          <div className="flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:gap-3 lg:gap-5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2 min-[520px]:block">
                                <p className="truncate text-sm font-black leading-tight text-slate-900 sm:text-base">
                                  {p.companyName}
                                </p>
                                <span className="shrink-0 text-[10px] font-bold text-slate-400 min-[520px]:hidden">
                                  {formatTsShort(p.createdAt)}
                                </span>
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
                            </div>
                            <span className="hidden shrink-0 text-right text-[10px] font-bold leading-tight text-slate-400 min-[520px]:block lg:min-w-[7rem]">
                              {formatTs(p.createdAt)}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
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
                </div>
              </div>

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
