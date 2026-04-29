'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/app/lib/firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Gauge,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '@/app/safety-log/_components/ui/Button';
import { cn } from '@/app/safety-log/_lib/utils';
import { Pagination } from '@/components/ui/Pagination';
import { MAX_UPLOAD_FILE_BYTES } from '@/app/lib/upload-limits';
import {
  deleteHazardousMachineryFile,
  deleteHazardousMachineryStorageFiles,
  uploadHazardousMachineryFile,
} from './_lib/storage';

type DocumentType = 'certificate' | 'inspection' | 'manual' | 'etc';

interface StoredFile {
  url: string;
  path: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
}

interface MachineryDocuments {
  certificate: StoredFile[];
  inspection: StoredFile[];
  manual: StoredFile[];
  etc: StoredFile[];
}

interface HazardousMachinery {
  id: string;
  managerId: string;
  name: string;
  category: string;
  managementNo: string;
  location: string;
  modelName: string;
  serialNo: string;
  maker: string;
  inspectionCycleMonths: number;
  lastInspectionDate: string;
  nextInspectionDate: string;
  memo: string;
  documents: MachineryDocuments;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface MachineryForm {
  category: string;
  managementNo: string;
  location: string;
  modelName: string;
  serialNo: string;
  maker: string;
  inspectionCycleMonths: string;
  lastInspectionDate: string;
  nextInspectionDate: string;
  memo: string;
}

const PAGE_SIZE = 8;

const EMPTY_DOCS: MachineryDocuments = {
  certificate: [],
  inspection: [],
  manual: [],
  etc: [],
};

const MODAL_DOCUMENT_TYPES: DocumentType[] = ['certificate', 'inspection'];

type PendingMachineryDocuments = Partial<Record<DocumentType, File[]>>;

const EMPTY_FORM: MachineryForm = {
  category: '크레인',
  managementNo: '',
  location: '',
  modelName: '',
  serialNo: '',
  maker: '',
  inspectionCycleMonths: '24',
  lastInspectionDate: '',
  nextInspectionDate: '',
  memo: '',
};

const CATEGORY_OPTIONS = [
  '크레인',
  '이동식 크레인',
  '고소작업대',
  '리프트',
  '압력용기',
  '프레스',
  '전단기',
  '롤러기',
  '사출성형기',
  '곤돌라',
  '국소배기장치',
  '기타',
];

const CYCLE_OPTIONS = [
  { label: '6개월', value: 6 },
  { label: '1년', value: 12 },
  { label: '2년', value: 24 },
  { label: '3년', value: 36 },
];

const DEFAULT_CYCLE_BY_CATEGORY: Record<string, number> = {
  크레인: 24,
  '이동식 크레인': 24,
  고소작업대: 24,
  리프트: 24,
  압력용기: 24,
  프레스: 24,
  전단기: 24,
  롤러기: 24,
  사출성형기: 24,
  곤돌라: 6,
  국소배기장치: 12,
  기타: 12,
};

const DOCUMENT_META: Record<DocumentType, { label: string; helper: string }> = {
  certificate: { label: '인증서류', helper: '안전인증서, 자율안전확인신고증 등' },
  inspection: { label: '검사서류', helper: '안전검사 합격증명서, 정기검사 결과서 등' },
  manual: { label: '매뉴얼/제원', helper: '취급설명서, 제원표, 설치도면 등' },
  etc: { label: '기타서류', helper: '점검표, 사진, 보수 이력 등' },
};

function addMonthsToDate(dateText: string, months: number) {
  if (!dateText || !months) return '';
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setMonth(date.getMonth() + months);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysUntil(dateText: string) {
  if (!dateText) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getInspectionStatus(item: Pick<HazardousMachinery, 'nextInspectionDate'>) {
  const days = daysUntil(item.nextInspectionDate);
  if (days === null) {
    return {
      key: 'none',
      label: '일정 미등록',
      tone: 'bg-slate-100 text-slate-600 border-slate-200',
      icon: CalendarClock,
      days,
    };
  }
  if (days < 0) {
    return {
      key: 'overdue',
      label: `${Math.abs(days)}일 지남`,
      tone: 'bg-red-50 text-red-700 border-red-200',
      icon: AlertTriangle,
      days,
    };
  }
  if (days <= 30) {
    return {
      key: 'soon',
      label: `${days}일 남음`,
      tone: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: CalendarClock,
      days,
    };
  }
  return {
    key: 'ok',
    label: `${days}일 남음`,
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
    days,
  };
}

function normalizeDocuments(value: unknown): MachineryDocuments {
  const docs = value && typeof value === 'object' ? value as Partial<Record<DocumentType, StoredFile[]>> : {};
  return {
    certificate: Array.isArray(docs.certificate) ? docs.certificate : [],
    inspection: Array.isArray(docs.inspection) ? docs.inspection : [],
    manual: Array.isArray(docs.manual) ? docs.manual : [],
    etc: Array.isArray(docs.etc) ? docs.etc : [],
  };
}

function normalizeMachinery(id: string, data: any): HazardousMachinery {
  return {
    id,
    managerId: String(data.managerId || ''),
    name: String(data.name || data.category || ''),
    category: String(data.category || '기타'),
    managementNo: String(data.managementNo || ''),
    location: String(data.location || ''),
    modelName: String(data.modelName || ''),
    serialNo: String(data.serialNo || ''),
    maker: String(data.maker || ''),
    inspectionCycleMonths: Number(data.inspectionCycleMonths) || 0,
    lastInspectionDate: String(data.lastInspectionDate || ''),
    nextInspectionDate: String(data.nextInspectionDate || ''),
    memo: String(data.memo || ''),
    documents: normalizeDocuments(data.documents),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function formatDate(dateText: string) {
  if (!dateText) return '-';
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function toForm(item: HazardousMachinery): MachineryForm {
  return {
    category: item.category,
    managementNo: item.managementNo,
    location: item.location,
    modelName: item.modelName,
    serialNo: item.serialNo,
    maker: item.maker,
    inspectionCycleMonths: String(item.inspectionCycleMonths || 24),
    lastInspectionDate: item.lastInspectionDate,
    nextInspectionDate: item.nextInspectionDate,
    memo: item.memo,
  };
}

function HazardousMachineryContent() {
  const { user } = useAuth();
  const [items, setItems] = useState<HazardousMachinery[]>([]);
  const [selected, setSelected] = useState<HazardousMachinery | null>(null);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HazardousMachinery | null>(null);
  const [form, setForm] = useState<MachineryForm>(EMPTY_FORM);
  const [pendingDocuments, setPendingDocuments] = useState<PendingMachineryDocuments>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setSelected(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, 'hazardous_machinery'),
        where('managerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const next = snap.docs.map((d) => normalizeMachinery(d.id, d.data()));
      setItems(next);
      setSelected((current) => {
        if (!next.length) return null;
        if (!current) return next[0];
        return next.find((item) => item.id === current.id) || next[0];
      });
    } catch (e) {
      console.error(e);
      alert('유해위험기계기구 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const months = Number(form.inspectionCycleMonths);
    if (!form.lastInspectionDate || !months) return;
    setForm((prev) => ({
      ...prev,
      nextInspectionDate: addMonthsToDate(prev.lastInspectionDate, months),
    }));
  }, [form.lastInspectionDate, form.inspectionCycleMonths]);

  const stats = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const status = getInspectionStatus(item).key;
        acc.total += 1;
        if (status === 'overdue') acc.overdue += 1;
        if (status === 'soon') acc.soon += 1;
        if (status === 'ok') acc.ok += 1;
        return acc;
      },
      { total: 0, overdue: 0, soon: 0, ok: 0 }
    );
  }, [items]);

  const filtered = useMemo(() => {
    const needle = queryText.trim().toLowerCase();
    const result = needle
      ? items.filter((item) =>
          [item.name, item.category, item.managementNo, item.location, item.modelName, item.serialNo, item.maker]
            .join(' ')
            .toLowerCase()
            .includes(needle)
        )
      : items;
    return [...result].sort((a, b) => {
      const ad = daysUntil(a.nextInspectionDate);
      const bd = daysUntil(b.nextInspectionDate);
      if (ad === null && bd === null) return a.category.localeCompare(b.category, 'ko');
      if (ad === null) return 1;
      if (bd === null) return -1;
      return ad - bd;
    });
  }, [items, queryText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPendingDocuments({});
    setModalOpen(true);
  };

  const openEdit = (item: HazardousMachinery) => {
    setEditing(item);
    setForm(toForm(item));
    setPendingDocuments({});
    setModalOpen(true);
  };

  const uploadPendingDocuments = async (
    userId: string,
    machineryId: string,
    baseDocuments: MachineryDocuments
  ): Promise<MachineryDocuments> => {
    const nextDocs: MachineryDocuments = {
      certificate: [...baseDocuments.certificate],
      inspection: [...baseDocuments.inspection],
      manual: [...baseDocuments.manual],
      etc: [...baseDocuments.etc],
    };

    for (const type of MODAL_DOCUMENT_TYPES) {
      const files = pendingDocuments[type] || [];
      for (const file of files) {
        if (file.size > MAX_UPLOAD_FILE_BYTES) {
          throw new Error('보관 서류는 파일당 최대 20MB까지 업로드할 수 있습니다.');
        }
        const uploaded = await uploadHazardousMachineryFile(userId, machineryId, type, file);
        nextDocs[type] = [...nextDocs[type], uploaded];
      }
    }

    return nextDocs;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!form.category.trim()) {
      alert('종류를 선택해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const cycle = Math.max(0, Number(form.inspectionCycleMonths) || 0);
      const nextInspectionDate =
        form.nextInspectionDate || addMonthsToDate(form.lastInspectionDate, cycle);
      const payload = {
        managerId: user.uid,
        name: form.category.trim(),
        category: form.category,
        managementNo: form.managementNo.trim(),
        location: form.location.trim(),
        modelName: form.modelName.trim(),
        serialNo: form.serialNo.trim(),
        maker: form.maker.trim(),
        inspectionCycleMonths: cycle,
        lastInspectionDate: form.lastInspectionDate,
        nextInspectionDate,
        memo: form.memo.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editing) {
        const documents = await uploadPendingDocuments(user.uid, editing.id, editing.documents);
        await updateDoc(doc(db, 'hazardous_machinery', editing.id), {
          ...payload,
          documents,
        });
      } else {
        const itemRef = doc(collection(db, 'hazardous_machinery'));
        const documents = await uploadPendingDocuments(user.uid, itemRef.id, EMPTY_DOCS);
        await setDoc(itemRef, {
          ...payload,
          documents,
          createdAt: serverTimestamp(),
        });
      }

      setModalOpen(false);
      setEditing(null);
      setPendingDocuments({});
      await load();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error && e.message ? e.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: HazardousMachinery) => {
    if (!user) return;
    if (!confirm(`${item.category} 항목과 첨부 서류를 삭제할까요?`)) return;

    try {
      await deleteHazardousMachineryStorageFiles(user.uid, item.id);
      await deleteDoc(doc(db, 'hazardous_machinery', item.id));
      setSelected((current) => current?.id === item.id ? null : current);
      await load();
    } catch (e) {
      console.error(e);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleUpload = async (type: DocumentType, file: File | null) => {
    if (!user || !selected || !file) return;
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      alert('보관 서류는 파일당 최대 20MB까지 업로드할 수 있습니다.');
      return;
    }
    setUploadingType(type);
    try {
      const uploaded = await uploadHazardousMachineryFile(user.uid, selected.id, type, file);
      const nextDocs = {
        ...selected.documents,
        [type]: [...selected.documents[type], uploaded],
      };
      await updateDoc(doc(db, 'hazardous_machinery', selected.id), {
        documents: nextDocs,
        updatedAt: serverTimestamp(),
      });
      const nextSelected = { ...selected, documents: nextDocs };
      setSelected(nextSelected);
      setItems((prev) => prev.map((item) => item.id === selected.id ? nextSelected : item));
    } catch (e) {
      console.error(e);
      alert(e instanceof Error && e.message ? e.message : '파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadingType(null);
    }
  };

  const handleDeleteFile = async (type: DocumentType, file: StoredFile) => {
    if (!selected) return;
    if (!confirm(`${file.fileName} 파일을 삭제할까요?`)) return;

    try {
      await deleteHazardousMachineryFile(file.path);
      const nextDocs = {
        ...selected.documents,
        [type]: selected.documents[type].filter((item) => item.path !== file.path),
      };
      await updateDoc(doc(db, 'hazardous_machinery', selected.id), {
        documents: nextDocs,
        updatedAt: serverTimestamp(),
      });
      const nextSelected = { ...selected, documents: nextDocs };
      setSelected(nextSelected);
      setItems((prev) => prev.map((item) => item.id === selected.id ? nextSelected : item));
    } catch (e) {
      console.error(e);
      alert('파일 삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[26rem] items-center justify-center rounded-3xl border border-slate-100 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-black text-amber-700 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              법정검사 일정과 서류를 한곳에서 관리
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              유해위험기계기구 대장
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">
              현장별 기계기구를 등록하고 인증서류·검사서류를 기계별로 보관하세요.
              마지막 검사일과 주기를 기준으로 다음 검사 예정일을 자동 계산합니다.
            </p>
          </div>
          <Button type="button" size="lg" onClick={openCreate} className="gap-2 bg-amber-600 hover:bg-amber-700">
            <Plus className="h-5 w-5" />
            기계기구 등록
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="등록 기계기구" value={`${stats.total}대`} icon={Wrench} tone="text-slate-800" />
          <StatCard label="검사 지연" value={`${stats.overdue}대`} icon={AlertTriangle} tone="text-red-600" />
          <StatCard label="30일 이내" value={`${stats.soon}대`} icon={CalendarClock} tone="text-amber-600" />
          <StatCard label="정상 관리" value={`${stats.ok}대`} icon={CheckCircle2} tone="text-emerald-600" />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(28rem,1.25fr)]">
        <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950">기계기구 목록</h3>
              <p className="text-xs font-bold text-slate-500">검사일이 가까운 순서로 표시됩니다.</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={queryText}
                onChange={(e) => {
                  setQueryText(e.target.value);
                  setPage(1);
                }}
                placeholder="종류, 관리번호, 위치 검색"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 sm:w-64"
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {pagedItems.length === 0 ? (
              <EmptyState onCreate={openCreate} />
            ) : (
              pagedItems.map((item) => (
                <MachineryListItem
                  key={item.id}
                  item={item}
                  active={selected?.id === item.id}
                  onSelect={() => setSelected(item)}
                />
              ))
            )}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
            accentClass="bg-amber-600 text-white border-amber-600"
          />
        </section>

        <section className="min-h-[32rem] rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          {selected ? (
            <MachineryDetail
              item={selected}
              onEdit={() => openEdit(selected)}
              onDelete={() => handleDelete(selected)}
              onUpload={handleUpload}
              onDeleteFile={handleDeleteFile}
              uploadingType={uploadingType}
            />
          ) : (
            <div className="flex h-full min-h-[28rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
              <Wrench className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-base font-black text-slate-700">선택된 기계기구가 없습니다.</p>
              <p className="mt-1 text-sm font-medium text-slate-500">왼쪽 목록에서 항목을 선택하거나 새로 등록해 주세요.</p>
              <Button type="button" onClick={openCreate} className="mt-4 gap-2 bg-amber-600 hover:bg-amber-700">
                <Plus className="h-4 w-4" />
                등록하기
              </Button>
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <MachineryModal
            form={form}
            setForm={setForm}
            editing={editing}
            pendingDocuments={pendingDocuments}
            setPendingDocuments={setPendingDocuments}
            submitting={submitting}
            onClose={() => setModalOpen(false)}
            onSubmit={handleSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50', tone)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function MachineryListItem({
  item,
  active,
  onSelect,
}: {
  item: HazardousMachinery;
  active: boolean;
  onSelect: () => void;
}) {
  const status = getInspectionStatus(item);
  const StatusIcon = status.icon;
  const docCount = Object.values(item.documents).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-2xl border p-4 text-left transition hover:border-amber-200 hover:bg-amber-50/40',
        active ? 'border-amber-300 bg-amber-50 shadow-sm' : 'border-slate-100 bg-white'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-slate-950">{item.category}</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-500">
            {item.managementNo || '관리번호 미등록'} · {item.location || '위치 미등록'}
          </p>
        </div>
        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-black', status.tone)}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
        <span className="rounded-xl bg-slate-50 px-3 py-2">다음검사 {formatDate(item.nextInspectionDate)}</span>
        <span className="rounded-xl bg-slate-50 px-3 py-2">서류 {docCount}개</span>
      </div>
    </button>
  );
}

function MachineryDetail({
  item,
  onEdit,
  onDelete,
  onUpload,
  onDeleteFile,
  uploadingType,
}: {
  item: HazardousMachinery;
  onEdit: () => void;
  onDelete: () => void;
  onUpload: (type: DocumentType, file: File | null) => void;
  onDeleteFile: (type: DocumentType, file: StoredFile) => void;
  uploadingType: DocumentType | null;
}) {
  const status = getInspectionStatus(item);
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black', status.tone)}>
            <StatusIcon className="h-4 w-4" />
            다음 검사 {status.label}
          </div>
          <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{item.category}</h3>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {item.managementNo || '관리번호 미등록'} · {item.location || '위치 미등록'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onEdit} className="gap-2">
            <Pencil className="h-4 w-4" />
            수정
          </Button>
          <Button type="button" variant="danger" onClick={onDelete} className="gap-2">
            <Trash2 className="h-4 w-4" />
            삭제
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoTile label="관리번호" value={item.managementNo || '-'} icon={ClipboardCheck} />
        <InfoTile label="모델/형식" value={item.modelName || '-'} icon={Gauge} />
        <InfoTile label="제조사" value={item.maker || '-'} icon={Wrench} />
        <InfoTile label="제조번호" value={item.serialNo || '-'} icon={ClipboardCheck} />
        <InfoTile label="검사주기" value={item.inspectionCycleMonths ? `${item.inspectionCycleMonths}개월` : '-'} icon={CalendarClock} />
        <InfoTile label="최근 검사일" value={formatDate(item.lastInspectionDate)} icon={ShieldCheck} />
        <InfoTile label="다음 검사일" value={formatDate(item.nextInspectionDate)} icon={AlertTriangle} />
      </div>

      {item.memo && (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-black text-slate-400">관리 메모</p>
          <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">{item.memo}</p>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-lg font-black text-slate-950">기계별 보관 서류</h4>
            <p className="text-xs font-bold text-slate-500">서류 종류별로 파일을 업로드하고 바로 열람할 수 있습니다.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(['certificate', 'inspection'] as DocumentType[]).map((type) => (
            <DocumentBox
              key={type}
              type={type}
              files={item.documents[type]}
              uploading={uploadingType === type}
              onUpload={(file) => onUpload(type, file)}
              onDeleteFile={(file) => onDeleteFile(type, file)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-400">{label}</p>
          <p className="truncate text-sm font-black text-slate-800">{value}</p>
        </div>
      </div>
    </div>
  );
}

function DocumentBox({
  type,
  files,
  uploading,
  onUpload,
  onDeleteFile,
}: {
  type: DocumentType;
  files: StoredFile[];
  uploading: boolean;
  onUpload: (file: File | null) => void;
  onDeleteFile: (file: StoredFile) => void;
}) {
  const meta = DOCUMENT_META[type];

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="font-black text-slate-900">{meta.label}</h5>
          <p className="mt-1 text-xs font-medium text-slate-500">{meta.helper}</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">파일당 최대 20MB</p>
        </div>
        <label
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm ring-1 ring-amber-100 transition hover:bg-amber-50"
          title={`${meta.label} 업로드`}
          aria-label={`${meta.label} 업로드`}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              onUpload(event.target.files?.[0] || null);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      <div className="mt-3 space-y-2">
        {files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs font-bold text-slate-400">
            등록된 파일이 없습니다.
          </div>
        ) : (
          files.map((file) => (
            <div key={file.path} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-xs font-black text-slate-700 hover:text-amber-700"
              >
                {file.fileName}
              </a>
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="파일 열기"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => onDeleteFile(file)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="파일 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MachineryModal({
  form,
  setForm,
  editing,
  pendingDocuments,
  setPendingDocuments,
  submitting,
  onClose,
  onSubmit,
}: {
  form: MachineryForm;
  setForm: React.Dispatch<React.SetStateAction<MachineryForm>>;
  editing: HazardousMachinery | null;
  pendingDocuments: PendingMachineryDocuments;
  setPendingDocuments: React.Dispatch<React.SetStateAction<PendingMachineryDocuments>>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-xl font-black text-slate-950">
              {editing ? '기계기구 정보 수정' : '유해위험기계기구 등록'}
            </h3>
            <p className="text-sm font-medium text-slate-500">검사주기를 입력하면 다음 검사일이 자동 계산됩니다.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="max-h-[calc(92vh-5rem)] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="종류" required>
              <select
                value={form.category}
                onChange={(e) => {
                  const category = e.target.value;
                  const cycle = String(DEFAULT_CYCLE_BY_CATEGORY[category] || 12);
                  setForm((prev) => ({
                    ...prev,
                    category,
                    inspectionCycleMonths: cycle,
                    nextInspectionDate: addMonthsToDate(prev.lastInspectionDate, Number(cycle)),
                  }));
                }}
                className="form-input"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="관리번호">
              <input
                value={form.managementNo}
                onChange={(e) => setForm((prev) => ({ ...prev, managementNo: e.target.value }))}
                placeholder="예: CR-2026-001"
                className="form-input"
              />
            </Field>
            <Field label="설치/사용 위치">
              <input
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="예: A동 2층 생산라인"
                className="form-input"
              />
            </Field>
            <Field label="제조사">
              <input
                value={form.maker}
                onChange={(e) => setForm((prev) => ({ ...prev, maker: e.target.value }))}
                placeholder="제조사"
                className="form-input"
              />
            </Field>
            <Field label="모델/형식">
              <input
                value={form.modelName}
                onChange={(e) => setForm((prev) => ({ ...prev, modelName: e.target.value }))}
                placeholder="모델명 또는 형식"
                className="form-input"
              />
            </Field>
            <Field label="제조번호">
              <input
                value={form.serialNo}
                onChange={(e) => setForm((prev) => ({ ...prev, serialNo: e.target.value }))}
                placeholder="Serial No."
                className="form-input"
              />
            </Field>
            <Field label="법정 검사주기">
              <select
                value={form.inspectionCycleMonths}
                onChange={(e) => setForm((prev) => ({ ...prev, inspectionCycleMonths: e.target.value }))}
                className="form-input"
              >
                {CYCLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                종류 선택 시 기본 주기를 넣고, 현장 적용 기준에 맞게 조정할 수 있습니다.
              </p>
            </Field>
            <Field label="최근 검사일">
              <input
                type="date"
                value={form.lastInspectionDate}
                onChange={(e) => setForm((prev) => ({ ...prev, lastInspectionDate: e.target.value }))}
                className="form-input"
              />
            </Field>
            <Field label="다음 검사 예정일">
              <input
                type="date"
                value={form.nextInspectionDate}
                onChange={(e) => setForm((prev) => ({ ...prev, nextInspectionDate: e.target.value }))}
                className="form-input"
              />
            </Field>
            <Field label="관리 메모" className="sm:col-span-2">
              <textarea
                value={form.memo}
                onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
                placeholder="검사 특이사항, 담당자, 보수 이력 등을 메모하세요."
                rows={4}
                className="form-input min-h-24 resize-y"
              />
            </Field>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
            <div>
              <p className="text-sm font-black text-slate-900">등록 서류 첨부</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                등록 단계에서 인증서류와 검사서류를 함께 업로드할 수 있습니다. 파일당 최대 20MB입니다.
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {MODAL_DOCUMENT_TYPES.map((type) => {
                const meta = DOCUMENT_META[type];
                const files = pendingDocuments[type] || [];
                return (
                  <div key={type} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{meta.label}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{meta.helper}</p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white transition hover:bg-amber-700">
                        <UploadCloud className="h-4 w-4" />
                        첨부
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          disabled={submitting}
                          onChange={(event) => {
                            const nextFiles = Array.from(event.target.files || []);
                            setPendingDocuments((prev) => ({
                              ...prev,
                              [type]: [...(prev[type] || []), ...nextFiles],
                            }));
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <div className="mt-3 space-y-2">
                      {files.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs font-bold text-slate-400">
                          첨부된 파일이 없습니다.
                        </div>
                      ) : (
                        files.map((file, index) => (
                          <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
                            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-700">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingDocuments((prev) => ({
                                  ...prev,
                                  [type]: (prev[type] || []).filter((_, fileIndex) => fileIndex !== index),
                                }));
                              }}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                              aria-label={`${file.name} 첨부 제거`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              취소
            </Button>
            <Button type="submit" isLoading={submitting} className="bg-amber-600 hover:bg-amber-700">
              {editing ? '수정 저장' : '등록'}
            </Button>
          </div>
        </form>
      </motion.div>
      <style jsx>{`
        .form-input {
          width: 100%;
          border-radius: 0.875rem;
          border: 1px solid rgb(226 232 240);
          background: rgb(248 250 252);
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: rgb(15 23 42);
          outline: none;
          transition: all 0.15s ease;
        }
        .form-input:focus {
          border-color: rgb(251 191 36);
          background: white;
          box-shadow: 0 0 0 3px rgb(254 243 199);
        }
      `}</style>
    </motion.div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-black text-slate-500">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
      <Wrench className="h-10 w-10 text-slate-300" />
      <p className="mt-3 text-base font-black text-slate-700">등록된 기계기구가 없습니다.</p>
      <p className="mt-1 max-w-sm text-sm font-medium leading-6 text-slate-500">
        현장에서 사용하는 유해위험기계기구를 먼저 등록하면 검사 일정과 서류를 함께 관리할 수 있습니다.
      </p>
      <Button type="button" onClick={onCreate} className="mt-4 gap-2 bg-amber-600 hover:bg-amber-700">
        <Plus className="h-4 w-4" />
        첫 기계기구 등록
      </Button>
    </div>
  );
}

export default function HazardousMachineryPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[24rem] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /></div>}>
      <WorkspaceShell
        serviceHref="/hazardous-machinery"
        title="유해위험기계기구"
        description="기계기구 대장, 인증·검사 서류, 다음 검사 예정일을 통합 관리합니다."
      >
        <HazardousMachineryContent />
      </WorkspaceShell>
    </Suspense>
  );
}
