'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  FileText,
  GripVertical,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/app/lib/firebase';
import { Button, Input, Label } from '@/app/work-permit/_components/ui/Button';
import { cn } from '@/app/work-permit/_lib/utils';
import type { ContractorPartner } from '@/app/contractor-partners/_lib/types';
import type { MeetingMinute } from '@/app/meeting-minutes/_lib/types';

type Affiliation = 'own' | 'contractor';

interface SafetyOrgMember {
  id: string;
  managerId: string;
  name: string;
  role: string;
  department?: string;
  position?: string;
  phone?: string;
  email?: string;
  duty?: string;
  affiliation: Affiliation;
  contractorCompanyId?: string;
  contractorCompanyName?: string;
  isCommitteeMember: boolean;
  committeeSide?: string;
  committeeRole?: string;
  notes?: string;
  sortOrder?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

type MemberDraft = Omit<SafetyOrgMember, 'id' | 'managerId' | 'createdAt' | 'updatedAt'>;

type QuickAddKind = 'executive' | 'safetyTeam' | 'committee' | 'supervisor' | 'contractor';

interface QuickAddConfig {
  kind: QuickAddKind;
  contractorCompanyId?: string;
  contractorCompanyName?: string;
}

interface ContractorGroup {
  key: string;
  name: string;
  partner?: ContractorPartner;
  members: SafetyOrgMember[];
}

const ROLE_OPTIONS = [
  '안전보건총괄책임자',
  '안전관리책임자',
  '안전관리자',
  '보건관리자',
  '관리감독자',
  '산업보건의',
  '명예산업안전감독관',
  '근로자 대표',
  '협력업체 현장대리인',
  '협력업체 안전관리자',
  '협력업체 관리감독자',
  '산업안전보건위원회 위원',
  '기타',
] as const;

const EMPTY_DRAFT: MemberDraft = {
  name: '',
  role: '안전관리자',
  department: '',
  position: '',
  phone: '',
  email: '',
  duty: '',
  affiliation: 'own',
  contractorCompanyId: '',
  contractorCompanyName: '',
  isCommitteeMember: false,
  committeeSide: '사용자 위원',
  committeeRole: '',
  notes: '',
  sortOrder: undefined,
};

const DEFAULT_SAFETY_TEAM_NAME = '안전보건팀';
const SUPERVISOR_CARD_MIN_WIDTH = 160;
const SUPERVISOR_CARD_GAP = 16;

function normalizeMember(id: string, data: DocumentData): SafetyOrgMember {
  return {
    id,
    managerId: data.managerId,
    name: data.name || '',
    role: data.role || '기타',
    department: data.department || '',
    position: data.position || '',
    phone: data.phone || '',
    email: data.email || '',
    duty: data.duty || '',
    affiliation: data.affiliation === 'contractor' ? 'contractor' : 'own',
    contractorCompanyId: data.contractorCompanyId || '',
    contractorCompanyName: data.contractorCompanyName || '',
    isCommitteeMember: data.isCommitteeMember === true,
    committeeSide: data.committeeSide || '사용자 위원',
    committeeRole: data.committeeRole || '',
    notes: data.notes || '',
    sortOrder: typeof data.sortOrder === 'number' && Number.isFinite(data.sortOrder) ? data.sortOrder : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function toMillis(value: unknown) {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    return maybeTimestamp.toDate?.().getTime() ?? 0;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value).getTime();
  }
  return 0;
}

function formatDate(value: unknown) {
  const millis = toMillis(value);
  if (!millis) return '-';
  const date = new Date(millis);
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}

function memberSubtitle(member: SafetyOrgMember) {
  const parts = [member.department, member.position].filter(Boolean);
  if (member.affiliation === 'contractor') {
    parts.unshift(member.contractorCompanyName || '협력업체');
  }
  return parts.length ? parts.join(' · ') : member.affiliation === 'own' ? '우리사업장' : '협력업체';
}

function isExecutiveRole(role: string) {
  return ['안전보건총괄책임자', '안전관리책임자'].includes(role);
}

function isProfessionalRole(role: string) {
  return ['안전관리자', '보건관리자', '산업보건의'].includes(role);
}

function isSupervisorRole(role: string) {
  return ['관리감독자', '근로자 대표', '명예산업안전감독관'].includes(role);
}

function sortMembers(a: SafetyOrgMember, b: SafetyOrgMember) {
  const roleDiff = ROLE_OPTIONS.indexOf(a.role as (typeof ROLE_OPTIONS)[number]) - ROLE_OPTIONS.indexOf(b.role as (typeof ROLE_OPTIONS)[number]);
  if (roleDiff !== 0) return roleDiff;
  return a.name.localeCompare(b.name, 'ko');
}

function getExplicitSortOrder(member: SafetyOrgMember) {
  return typeof member.sortOrder === 'number' && Number.isFinite(member.sortOrder) ? member.sortOrder : null;
}

function getSupervisorOrderValue(member: SafetyOrgMember) {
  return getExplicitSortOrder(member) ?? toMillis(member.createdAt);
}

function sortSupervisorMembers(a: SafetyOrgMember, b: SafetyOrgMember) {
  const orderDiff = getSupervisorOrderValue(a) - getSupervisorOrderValue(b);
  if (orderDiff !== 0) return orderDiff;
  return sortMembers(a, b);
}

function getNextSupervisorSortOrder(members: SafetyOrgMember[]) {
  const orderValues = members
    .filter((member) => member.affiliation === 'own' && isSupervisorRole(member.role))
    .map((member) => getExplicitSortOrder(member) ?? toMillis(member.createdAt))
    .filter((value) => value > 0);

  return orderValues.length ? Math.max(...orderValues) + 1000 : Date.now();
}

function getPartnerOrderValue(partner: ContractorPartner) {
  const explicit =
    typeof partner.sortOrder === 'number' && Number.isFinite(partner.sortOrder) ? partner.sortOrder : null;
  return explicit ?? toMillis(partner.createdAt);
}

function sortPartnersForOrgChart(a: ContractorPartner, b: ContractorPartner) {
  const orderDiff = getPartnerOrderValue(a) - getPartnerOrderValue(b);
  if (orderDiff !== 0) return orderDiff;
  return a.companyName.localeCompare(b.companyName, 'ko');
}

function groupByCompany(members: SafetyOrgMember[], partners: ContractorPartner[]): ContractorGroup[] {
  const map = new Map<string, ContractorGroup>();

  partners.forEach((partner) => {
    map.set(partner.id, {
      key: partner.id,
      name: partner.companyName,
      partner,
      members: [],
    });
  });

  members.forEach((member) => {
    const key = member.contractorCompanyId || member.contractorCompanyName || 'direct-contractor';
    const existing = map.get(key);
    if (existing) {
      existing.members.push(member);
      return;
    }
    map.set(key, {
      key,
      name: member.contractorCompanyName || '협력업체',
      members: [member],
    });
  });

  const partnerBacked: ContractorGroup[] = [];
  partners.forEach((partner) => {
    const group = map.get(partner.id);
    if (group) partnerBacked.push(group);
  });

  const orphans: ContractorGroup[] = [];
  for (const group of Array.from(map.values())) {
    if (!group.partner) {
      orphans.push(group);
    }
  }
  orphans.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  return [...partnerBacked, ...orphans];
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function PersonBox({
  member,
  compact = false,
  onEdit,
  onDelete,
}: {
  member: SafetyOrgMember;
  compact?: boolean;
  onEdit?: (member: SafetyOrgMember) => void;
  onDelete?: (member: SafetyOrgMember) => void;
}) {
  const hasActions = !!onEdit || !!onDelete;

  return (
    <div className={cn(
      'rounded-lg border border-slate-200 bg-white p-3 shadow-sm',
      compact && 'p-2.5'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900">{member.name}</p>
          <p className="mt-0.5 truncate text-[11px] font-bold text-blue-700">{member.role}</p>
        </div>
        {member.isCommitteeMember ? (
          <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-700">
            위원
          </span>
        ) : null}
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-4 text-slate-500">
        {memberSubtitle(member)}
      </p>
      {member.duty ? (
        <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-600">{member.duty}</p>
      ) : null}
      {hasActions ? (
        <div className="mt-3 flex justify-end gap-1.5 border-t border-slate-100 pt-2">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(member)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <Pencil className="h-3 w-3" />
              수정
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(member)}
              className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-white px-2 py-1 text-[11px] font-black text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" />
              삭제
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EmptyNode({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs font-bold text-slate-400">
      {label}
    </div>
  );
}

function ChartSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
          {icon}
        </div>
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function DetailModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="org-chart-print-hidden fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="닫기"
      />
      <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-1 text-xs font-medium text-slate-500">{description}</p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function PdfOptionsModal({
  onClose,
  onDownload,
  generating,
}: {
  onClose: () => void;
  onDownload: (includeContractors: boolean) => void;
  generating: boolean;
}) {
  return (
    <div className="org-chart-print-hidden fixed inset-0 z-[140] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="닫기"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">조직도 PDF</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">협력업체 조직 포함 여부를 선택하세요.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={generating} className="shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-3 p-5">
          <button
            type="button"
            onClick={() => onDownload(true)}
            disabled={generating}
            className="w-full rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-left transition hover:border-emerald-200 hover:bg-emerald-100/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <p className="text-sm font-black text-slate-900">협력업체 포함 PDF</p>
            <p className="mt-1 text-xs font-medium text-slate-500">사업장 조직도와 등록된 모든 협력업체 조직을 하나의 가로형 1장 PDF로 저장합니다.</p>
          </button>
          <button
            type="button"
            onClick={() => onDownload(false)}
            disabled={generating}
            className="w-full rounded-xl border border-blue-100 bg-blue-50 px-4 py-4 text-left transition hover:border-blue-200 hover:bg-blue-100/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <p className="text-sm font-black text-slate-900">협력업체 제외 PDF</p>
            <p className="mt-1 text-xs font-medium text-slate-500">우리사업장 안전보건 조직만 하나의 가로형 1장 PDF로 저장합니다.</p>
          </button>
          {generating ? (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              PDF를 생성하는 중입니다.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ExecutiveCard({
  executives,
  onAddMember,
  onEditMember,
}: {
  executives: SafetyOrgMember[];
  onAddMember: (config: QuickAddConfig) => void;
  onEditMember: (member: SafetyOrgMember) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAddMember({ kind: 'executive' })}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAddMember({ kind: 'executive' });
        }
      }}
      className="org-chart-pdf-card w-[26rem] rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-center shadow-sm transition hover:border-blue-300 hover:bg-blue-50/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="space-y-2">
        {executives.length ? (
          executives.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEditMember(member);
              }}
              className="org-chart-pdf-card w-full rounded-lg border border-blue-100 bg-white px-3 py-3 text-center transition hover:border-blue-200 hover:bg-blue-50/50"
            >
              <div className="flex min-w-0 items-center justify-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <p className="truncate text-sm font-black text-blue-700">{member.role}</p>
              </div>
              <p className="mt-2 truncate text-sm font-black text-slate-900">
                {[member.position || '직위 미지정', member.name || '이름 미지정'].join(' · ')}
              </p>
            </button>
          ))
        ) : (
          <div className="org-chart-pdf-card rounded-lg border border-dashed border-blue-200 bg-white/70 px-3 py-4 text-center">
            <div className="flex min-w-0 items-center justify-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <p className="truncate text-sm font-black text-blue-700">책임자 역할 미지정</p>
            </div>
            <p className="mt-2 text-sm font-black text-slate-400">직위 · 이름</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SafetyTeamCard({
  teamNameDraft,
  teamNameSaving,
  roleCounts,
  onTeamNameDraftChange,
  onTeamNameSave,
  onOpen,
}: {
  teamNameDraft: string;
  teamNameSaving: boolean;
  roleCounts: Array<{ role: string; count: number }>;
  onTeamNameDraftChange: (value: string) => void;
  onTeamNameSave: (value: string) => void | Promise<void>;
  onOpen: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const teamName = teamNameDraft.trim() || DEFAULT_SAFETY_TEAM_NAME;

  const handleSave = async () => {
    await onTeamNameSave(teamNameDraft);
    setEditing(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen();
      }}
      className="org-chart-pdf-card relative z-10 rounded-xl border border-blue-100 bg-blue-50 p-4 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              value={teamNameDraft}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onTeamNameDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.stopPropagation();
                  handleSave();
                }
              }}
              className="h-9 bg-white text-sm font-black"
              autoFocus
            />
          ) : (
            <h3 className="truncate text-base font-black text-slate-900">{teamName}</h3>
          )}
          <p className="mt-1 text-[11px] font-bold text-blue-700">전담 안전보건 조직</p>
        </div>
        {editing ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={teamNameSaving}
            onClick={(event) => {
              event.stopPropagation();
              handleSave();
            }}
            className="org-chart-print-hidden h-9 w-9 shrink-0 bg-white"
            title="팀명 저장"
          >
            {teamNameSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation();
              setEditing(true);
            }}
            className="org-chart-print-hidden h-9 w-9 shrink-0 bg-white/80 text-blue-700 hover:bg-white"
            title="팀명 수정"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {roleCounts.length ? (
          roleCounts.map((item) => (
            <span key={item.role} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-blue-700">
              {item.role} {item.count}명
            </span>
          ))
        ) : (
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-400">
            등록 인원 없음
          </span>
        )}
      </div>
    </div>
  );
}

function CommitteeCard({
  userCount,
  workerCount,
  onOpen,
}: {
  userCount: number;
  workerCount: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="org-chart-pdf-card relative z-10 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-700 shadow-sm">
          <Users className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900">산업안전보건위원회</h3>
          <p className="mt-1 text-[11px] font-bold text-indigo-700">법정 심의·의결 기구</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-indigo-700">
          사용자 {userCount}명
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-indigo-700">
          근로자 {workerCount}명
        </span>
      </div>
    </button>
  );
}

function SafetyTeamModal({
  teamName,
  professionals,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onClose,
}: {
  teamName: string;
  professionals: SafetyOrgMember[];
  onAddMember: (config: QuickAddConfig) => void;
  onEditMember: (member: SafetyOrgMember) => void;
  onDeleteMember: (member: SafetyOrgMember) => void;
  onClose: () => void;
}) {
  return (
    <DetailModal title={teamName} description="안전보건팀 조직 인원" onClose={onClose}>
      <div className="space-y-5">
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-900">전담 안전보건 인원</h3>
            <Button type="button" size="sm" onClick={() => onAddMember({ kind: 'safetyTeam' })} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              추가
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {professionals.length ? (
              professionals.map((member) => (
                <PersonBox
                  key={member.id}
                  member={member}
                  onEdit={onEditMember}
                  onDelete={onDeleteMember}
                />
              ))
            ) : (
              <div className="sm:col-span-2">
                <EmptyNode label="안전관리자, 보건관리자, 산업보건의를 추가하세요." />
              </div>
            )}
          </div>
        </section>
      </div>
    </DetailModal>
  );
}

function meetingYear(meeting: MeetingMinute) {
  if (meeting.year) return meeting.year;
  const date = new Date(meeting.date);
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
}

function meetingQuarter(meeting: MeetingMinute) {
  if (meeting.quarter) return meeting.quarter;
  const date = new Date(meeting.date);
  if (Number.isNaN(date.getTime())) return undefined;
  return Math.floor(date.getMonth() / 3) + 1;
}

type QuarterStatus = 'done' | 'overdue' | 'current' | 'idle';

function QuarterStatusDot({ status }: { status: QuarterStatus }) {
  if (status === 'done') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3 w-3 stroke-[3]" />
      </span>
    );
  }
  if (status === 'overdue') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
        <AlertCircle className="h-3 w-3" />
      </span>
    );
  }
  if (status === 'current') {
    return <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />;
  }
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400">
      <Minus className="h-3 w-3" />
    </span>
  );
}

function OshcQuarterBoard({ meetings }: { meetings: MeetingMinute[] }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const nowMonth = new Date().getMonth() + 1;
  const nowQuarter = Math.floor((nowMonth - 1) / 3) + 1;
  const isCurrentYear = year === thisYear;

  const oshcByQuarter = useMemo(() => {
    const grouped: Record<number, MeetingMinute[]> = { 1: [], 2: [], 3: [], 4: [] };
    meetings.forEach((meeting) => {
      if (meeting.type !== 'oshc') return;
      if (meetingYear(meeting) !== year) return;
      const quarter = meetingQuarter(meeting);
      if (!quarter || quarter < 1 || quarter > 4) return;
      grouped[quarter].push(meeting);
    });
    Object.values(grouped).forEach((list) => {
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });
    return grouped;
  }, [meetings, year]);

  const completedQuarters = Object.values(oshcByQuarter).filter((list) => list.length > 0).length;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
            <h3 className="text-sm font-black text-slate-900">산업안전보건위원회</h3>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-600">
              분기당 1회
            </span>
          </div>
          <p className="mt-1 text-[11px] font-bold text-slate-400">산업안전보건법 제24조</p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="text-right">
            <p className="text-[11px] font-bold text-slate-400">이행률</p>
            <p className="text-lg font-black text-blue-600">
              {completedQuarters}
              <span className="text-xs text-slate-400"> / 4</span>
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-100 bg-slate-50/60 px-2 py-1.5">
            <button
              type="button"
              onClick={() => setYear((prev) => prev - 1)}
              className="rounded-lg px-2 py-1 text-xs font-black text-slate-500 transition hover:bg-white hover:text-slate-800"
            >
              이전
            </button>
            <span className="min-w-[56px] text-center text-sm font-black text-slate-800">{year}년</span>
            <button
              type="button"
              onClick={() => setYear((prev) => prev + 1)}
              className="rounded-lg px-2 py-1 text-xs font-black text-slate-500 transition hover:bg-white hover:text-slate-800"
            >
              다음
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[1, 2, 3, 4].map((quarter) => {
          const list = oshcByQuarter[quarter];
          const hasItem = list.length > 0;
          const isCurrent = isCurrentYear && quarter === nowQuarter;
          const isOverdue = isCurrentYear && quarter < nowQuarter && !hasItem;

          return (
            <div
              key={quarter}
              className={cn(
                'relative overflow-hidden rounded-2xl border p-4 transition',
                hasItem && 'border-blue-100 bg-blue-50/40',
                isOverdue && 'border-red-100 bg-red-50/40',
                isCurrent && !hasItem && 'border-amber-100 bg-amber-50/40',
                !hasItem && !isOverdue && !isCurrent && 'border-slate-100 bg-white'
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-black text-slate-500">{quarter}분기</span>
                <QuarterStatusDot status={hasItem ? 'done' : isOverdue ? 'overdue' : isCurrent ? 'current' : 'idle'} />
              </div>
              {hasItem ? (
                <div className="space-y-1.5">
                  {list.slice(0, 3).map((meeting) => (
                    <a
                      key={meeting.id}
                      href={meeting.fileUrl || '#'}
                      target={meeting.fileUrl ? '_blank' : undefined}
                      rel={meeting.fileUrl ? 'noreferrer' : undefined}
                      onClick={(event) => {
                        if (!meeting.fileUrl) event.preventDefault();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl bg-white p-2 text-left text-xs font-bold text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <span className="flex-1 truncate">{meeting.title}</span>
                      <span className="shrink-0 text-[10px] font-black text-slate-400">
                        {(meeting.date || '').slice(5)}
                      </span>
                    </a>
                  ))}
                  {list.length > 3 ? (
                    <p className="text-center text-[10px] font-bold text-slate-400">외 {list.length - 3}건</p>
                  ) : null}
                </div>
              ) : (
                <p className={cn('text-[11px] font-bold', isOverdue ? 'text-red-500' : 'text-slate-400')}>
                  {isOverdue ? '미실시 (지연)' : isCurrent ? '이번 분기 예정' : '기록 없음'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CommitteeModal({
  meetings,
  userCommitteeMembers,
  workerCommitteeMembers,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onClose,
}: {
  meetings: MeetingMinute[];
  userCommitteeMembers: SafetyOrgMember[];
  workerCommitteeMembers: SafetyOrgMember[];
  onAddMember: (config: QuickAddConfig) => void;
  onEditMember: (member: SafetyOrgMember) => void;
  onDeleteMember: (member: SafetyOrgMember) => void;
  onClose: () => void;
}) {
  return (
    <DetailModal title="산업안전보건위원회" description="회의기록 및 세부 위원" onClose={onClose}>
      <div className="space-y-5">
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-900">위원</h3>
            <Button type="button" size="sm" onClick={() => onAddMember({ kind: 'committee' })} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              추가
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-black text-slate-500">사용자 위원</p>
              <div className="space-y-2">
                {userCommitteeMembers.length ? (
                  userCommitteeMembers.map((member) => (
                    <PersonBox
                      key={member.id}
                      member={member}
                      compact
                      onEdit={onEditMember}
                      onDelete={onDeleteMember}
                    />
                  ))
                ) : (
                  <EmptyNode label="사용자 위원 없음" />
                )}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-black text-slate-500">근로자 위원</p>
              <div className="space-y-2">
                {workerCommitteeMembers.length ? (
                  workerCommitteeMembers.map((member) => (
                    <PersonBox
                      key={member.id}
                      member={member}
                      compact
                      onEdit={onEditMember}
                      onDelete={onDeleteMember}
                    />
                  ))
                ) : (
                  <EmptyNode label="근로자 위원 없음" />
                )}
              </div>
            </div>
          </div>
        </section>
        <OshcQuarterBoard meetings={meetings} />
      </div>
    </DetailModal>
  );
}

function SupervisorNode({
  member,
  onOpenList,
  dragging,
  dropTarget,
  onDragHandleStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  member: SafetyOrgMember;
  onOpenList: () => void;
  dragging?: boolean;
  dropTarget?: boolean;
  onDragHandleStart?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDragLeave?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenList}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenList();
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'org-chart-pdf-card relative min-h-[8.25rem] w-full rounded-lg border border-slate-200 bg-white p-3 pr-8 text-center shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30',
        dragging && 'opacity-45 ring-2 ring-blue-200',
        dropTarget && 'border-blue-300 bg-blue-50/50 ring-2 ring-blue-200'
      )}
    >
      <div
        role="button"
        tabIndex={0}
        draggable
        title="드래그해서 위치 변경"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onDragStart={onDragHandleStart}
        onDragEnd={onDragEnd}
        className="org-chart-print-hidden absolute right-2 top-2 flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <p className="truncate text-sm font-black text-slate-900">{member.department || '부서 미지정'}</p>
      <div className="mt-3 space-y-1.5 rounded-md bg-slate-50 px-2 py-2 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-[10px] font-black text-slate-400">이름</span>
          <span className="truncate text-xs font-black text-slate-900">{member.name || '미지정'}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-[10px] font-black text-slate-400">직위</span>
          <span className="truncate text-xs font-bold text-slate-600">{member.position || '미지정'}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-[10px] font-black text-slate-400">전화</span>
          <span className="truncate text-xs font-bold text-slate-600">{member.phone || '미지정'}</span>
        </div>
      </div>
      {member.duty ? (
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{member.duty}</p>
      ) : null}
    </div>
  );
}

function DynamicSupervisorRows({
  supervisors,
  onOpenList,
  onReorderSupervisors,
}: {
  supervisors: SafetyOrgMember[];
  onOpenList: () => void;
  onReorderSupervisors: (orderedSupervisors: SafetyOrgMember[]) => void | Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(1);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const rows = chunkItems(supervisors, columns);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateColumns = () => {
      const width = element.clientWidth;
      const nextColumns = Math.max(
        1,
        Math.floor((width + SUPERVISOR_CARD_GAP) / (SUPERVISOR_CARD_MIN_WIDTH + SUPERVISOR_CARD_GAP))
      );
      setColumns(Math.max(1, Math.min(supervisors.length || 1, nextColumns)));
    };

    updateColumns();

    const observer = new ResizeObserver(updateColumns);
    observer.observe(element);

    return () => observer.disconnect();
  }, [supervisors.length]);

  const moveSupervisor = (draggedId: string, targetId: string, insertAfter: boolean) => {
    if (draggedId === targetId) return;

    const draggedMember = supervisors.find((member) => member.id === draggedId);
    if (!draggedMember) return;

    const withoutDragged = supervisors.filter((member) => member.id !== draggedId);
    const targetIndex = withoutDragged.findIndex((member) => member.id === targetId);
    if (targetIndex === -1) return;

    const insertIndex = targetIndex + (insertAfter ? 1 : 0);
    const next = [...withoutDragged];
    next.splice(insertIndex, 0, draggedMember);
    onReorderSupervisors(next);
  };

  return (
    <div ref={containerRef} className="w-full">
      <div className="space-y-8">
        {rows.map((row, rowIndex) => {
          const rowWidth = `${row.length * SUPERVISOR_CARD_MIN_WIDTH + Math.max(row.length - 1, 0) * SUPERVISOR_CARD_GAP}px`;

          return (
            <div
              key={row.map((member) => member.id).join('-')}
              className={cn('relative mx-auto', rowIndex > 0 && 'pt-1')}
              style={{ maxWidth: rowWidth }}
            >
              {rowIndex === 0 ? (
                <div className="absolute left-1/2 top-[-1.5rem] h-6 w-px -translate-x-1/2 bg-slate-300" />
              ) : null}
              <div className="absolute left-0 right-0 top-0 h-px bg-slate-300" />
              <div
                className="relative grid gap-4 pt-6"
                style={{
                  gridTemplateColumns: `repeat(${row.length}, minmax(${SUPERVISOR_CARD_MIN_WIDTH}px, 1fr))`,
                  gap: `${SUPERVISOR_CARD_GAP}px`,
                }}
              >
                {row.map((member) => (
                  <div key={member.id} className="relative">
                    <div className="absolute left-1/2 top-[-1.5rem] h-6 w-px -translate-x-1/2 bg-slate-300" />
                    <SupervisorNode
                      member={member}
                      onOpenList={onOpenList}
                      dragging={draggingId === member.id}
                      dropTarget={dropTargetId === member.id && draggingId !== member.id}
                      onDragHandleStart={(event) => {
                        event.stopPropagation();
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', member.id);
                        setDraggingId(member.id);
                      }}
                      onDragOver={(event) => {
                        if (!draggingId || draggingId === member.id) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setDropTargetId(member.id);
                      }}
                      onDragLeave={() => {
                        if (dropTargetId === member.id) setDropTargetId(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const draggedId = event.dataTransfer.getData('text/plain') || draggingId;
                        if (!draggedId) return;
                        const rect = event.currentTarget.getBoundingClientRect();
                        moveSupervisor(draggedId, member.id, event.clientX > rect.left + rect.width / 2);
                        setDraggingId(null);
                        setDropTargetId(null);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropTargetId(null);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SupervisorBranch({
  supervisors,
  onAddMember,
  onOpenList,
  onReorderSupervisors,
}: {
  supervisors: SafetyOrgMember[];
  onAddMember: (config: QuickAddConfig) => void;
  onOpenList: () => void;
  onReorderSupervisors: (orderedSupervisors: SafetyOrgMember[]) => void | Promise<void>;
}) {
  if (!supervisors.length) {
    return (
      <div className="relative pt-8">
        <div className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-slate-300" />
        <div className="mb-4 flex justify-center">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onAddMember({ kind: 'supervisor' })}
            className="org-chart-print-hidden relative z-10 gap-1.5 bg-white shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            관리감독자 추가
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pt-8">
      <div className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-slate-300" />
      <div className="mb-4 flex justify-center">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onAddMember({ kind: 'supervisor' })}
          className="org-chart-print-hidden relative z-10 gap-1.5 bg-white shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          관리감독자 추가
        </Button>
      </div>
      <DynamicSupervisorRows
        supervisors={supervisors}
        onOpenList={onOpenList}
        onReorderSupervisors={onReorderSupervisors}
      />
    </div>
  );
}

function ContractorGroupCard({
  group,
  onSelect,
  reorderable,
  dragging,
  dropTarget,
  onDragHandleStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  group: ContractorGroup;
  onSelect: () => void;
  reorderable: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  onDragHandleStart?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDragLeave?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'org-chart-pdf-card relative rounded-lg border border-emerald-100 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40',
        dragging && 'opacity-45 ring-2 ring-emerald-200',
        dropTarget && 'border-emerald-300 bg-emerald-50/50 ring-2 ring-emerald-200'
      )}
    >
      {reorderable ? (
        <div
          role="button"
          tabIndex={0}
          draggable
          title="드래그해서 위치 변경"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onDragStart={onDragHandleStart}
          onDragEnd={onDragEnd}
          className="org-chart-print-hidden absolute right-2 top-2 flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      ) : null}
      <div className={cn('mb-2', reorderable && 'pr-8')}>
        <p className="truncate text-sm font-black text-slate-900">{group.name}</p>
        {group.partner ? (
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
            관리책임자 {group.partner.responsiblePerson} · {group.partner.contact}
          </p>
        ) : null}
      </div>
      <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
        등록 인원 {group.members.length}명
      </div>
    </div>
  );
}

function ContractorPartnerGrid({
  partnerBackedGroups,
  orphanGroups,
  onSelectGroup,
  onReorderPartners,
}: {
  partnerBackedGroups: ContractorGroup[];
  orphanGroups: ContractorGroup[];
  onSelectGroup: (key: string) => void;
  onReorderPartners: (orderedPartners: ContractorPartner[]) => void | Promise<void>;
}) {
  const partners = partnerBackedGroups.map((g) => g.partner!);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const movePartner = (draggedId: string, targetId: string, insertAfter: boolean) => {
    if (draggedId === targetId) return;
    const draggedPartner = partners.find((p) => p.id === draggedId);
    if (!draggedPartner) return;
    const without = partners.filter((p) => p.id !== draggedId);
    const targetIndex = without.findIndex((p) => p.id === targetId);
    if (targetIndex === -1) return;
    const insertIndex = targetIndex + (insertAfter ? 1 : 0);
    const next = [...without];
    next.splice(insertIndex, 0, draggedPartner);
    onReorderPartners(next);
  };

  return (
    <div className="org-chart-pdf-contractor-grid grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {partnerBackedGroups.map((group) => (
        <ContractorGroupCard
          key={group.key}
          group={group}
          onSelect={() => onSelectGroup(group.key)}
          reorderable
          dragging={draggingId === group.key}
          dropTarget={dropTargetId === group.key && draggingId !== group.key}
          onDragHandleStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', group.key);
            setDraggingId(group.key);
          }}
          onDragOver={(event) => {
            if (!draggingId || draggingId === group.key) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDropTargetId(group.key);
          }}
          onDragLeave={() => {
            if (dropTargetId === group.key) setDropTargetId(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const draggedId = event.dataTransfer.getData('text/plain') || draggingId;
            if (!draggedId) return;
            const rect = event.currentTarget.getBoundingClientRect();
            movePartner(draggedId, group.key, event.clientX > rect.left + rect.width / 2);
            setDraggingId(null);
            setDropTargetId(null);
          }}
          onDragEnd={() => {
            setDraggingId(null);
            setDropTargetId(null);
          }}
        />
      ))}
      {orphanGroups.map((group) => (
        <ContractorGroupCard key={group.key} group={group} onSelect={() => onSelectGroup(group.key)} reorderable={false} />
      ))}
    </div>
  );
}

function ContractorPeopleModal({
  group,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onClose,
}: {
  group: ContractorGroup;
  onAddMember: (config: QuickAddConfig) => void;
  onEditMember: (member: SafetyOrgMember) => void;
  onDeleteMember: (member: SafetyOrgMember) => void;
  onClose: () => void;
}) {
  return (
    <DetailModal
      title={group.name}
      description="협력업체 소속 인원"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900">인원 목록</h3>
            {group.partner ? (
              <p className="mt-1 text-xs font-medium text-slate-500">
                관리책임자 {group.partner.responsiblePerson} · {group.partner.contact}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => onAddMember({
              kind: 'contractor',
              contractorCompanyId: group.partner?.id || '',
              contractorCompanyName: group.name,
            })}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            추가
          </Button>
        </div>

        {group.members.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {group.members.map((member) => (
              <PersonBox
                key={member.id}
                member={member}
                onEdit={onEditMember}
                onDelete={onDeleteMember}
              />
            ))}
          </div>
        ) : (
          <EmptyNode label="등록된 협력업체 인원이 없습니다." />
        )}
      </div>
    </DetailModal>
  );
}

function OrgChartPreview({
  members,
  partners,
  meetings,
  teamNameDraft,
  teamNameSaving,
  onTeamNameDraftChange,
  onTeamNameSave,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onReorderSupervisors,
  onReorderPartners,
}: {
  members: SafetyOrgMember[];
  partners: ContractorPartner[];
  meetings: MeetingMinute[];
  teamNameDraft: string;
  teamNameSaving: boolean;
  onTeamNameDraftChange: (value: string) => void;
  onTeamNameSave: (value: string) => void | Promise<void>;
  onAddMember: (config: QuickAddConfig) => void;
  onEditMember: (member: SafetyOrgMember) => void;
  onDeleteMember: (member: SafetyOrgMember) => void;
  onReorderSupervisors: (orderedSupervisors: SafetyOrgMember[]) => void | Promise<void>;
  onReorderPartners: (orderedPartners: ContractorPartner[]) => void | Promise<void>;
}) {
  const ownMembers = members.filter((member) => member.affiliation === 'own').sort(sortMembers);
  const contractorMembers = members.filter((member) => member.affiliation === 'contractor').sort(sortMembers);
  const executives = ownMembers.filter((member) => isExecutiveRole(member.role));
  const professionals = ownMembers.filter((member) => isProfessionalRole(member.role));
  const supervisors = ownMembers.filter((member) => isSupervisorRole(member.role)).sort(sortSupervisorMembers);
  const committeeMembers = members.filter((member) => member.isCommitteeMember).sort(sortMembers);
  const userCommitteeMembers = committeeMembers.filter((member) => member.committeeSide !== '근로자 위원');
  const workerCommitteeMembers = committeeMembers.filter((member) => member.committeeSide === '근로자 위원');
  const contractorGroups = groupByCompany(contractorMembers, partners);
  const partnerBackedContractorGroups = contractorGroups.filter((g) => g.partner);
  const orphanContractorGroups = contractorGroups.filter((g) => !g.partner);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [committeeModalOpen, setCommitteeModalOpen] = useState(false);
  const [supervisorModalOpen, setSupervisorModalOpen] = useState(false);
  const [selectedContractorKey, setSelectedContractorKey] = useState<string | null>(null);
  const [pdfOptionsOpen, setPdfOptionsOpen] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const pdfContentRef = useRef<HTMLDivElement | null>(null);
  const teamName = teamNameDraft.trim() || DEFAULT_SAFETY_TEAM_NAME;
  const selectedContractorGroup = contractorGroups.find((group) => group.key === selectedContractorKey) || null;
  const safetyTeamRoleCounts = Array.from(
    professionals.reduce((acc, member) => {
      acc.set(member.role, (acc.get(member.role) || 0) + 1);
      return acc;
    }, new Map<string, number>())
  ).map(([role, count]) => ({ role, count }));

  const handlePdfDownload = async (includeContractors: boolean) => {
    const source = pdfContentRef.current;
    if (!source) {
      alert('PDF로 변환할 조직도 영역을 찾지 못했습니다.');
      return;
    }

    setPdfGenerating(true);

    try {
      const [{ default: html2canvas }, jsPdfModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const JsPDF = (jsPdfModule as any).jsPDF || (jsPdfModule as any).default;
      const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      const pdfStyleText = `
        .org-chart-pdf-export,
        .org-chart-pdf-export * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .org-chart-pdf-export {
          overflow: visible !important;
        }

        .org-chart-pdf-export button,
        .org-chart-pdf-export [role="button"],
        .org-chart-pdf-export .org-chart-pdf-card {
          height: auto !important;
          min-height: max-content !important;
          overflow: visible !important;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .org-chart-pdf-export button,
        .org-chart-pdf-export [role="button"] {
          display: block;
          padding-bottom: 0.875rem !important;
        }

        .org-chart-pdf-export .truncate {
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: normal !important;
        }

        .org-chart-pdf-export .line-clamp-2 {
          display: block !important;
          -webkit-line-clamp: unset !important;
          overflow: visible !important;
        }

        .org-chart-pdf-export p,
        .org-chart-pdf-export span {
          line-height: 1.45 !important;
          padding-bottom: 1px;
        }

        .org-chart-pdf-export .org-chart-pdf-card {
          padding-bottom: 14px !important;
        }

        .org-chart-pdf-export .org-chart-pdf-contractor-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)) !important;
          gap: 8px !important;
          align-items: stretch !important;
        }

        .org-chart-pdf-export .org-chart-print-contractors {
          margin-top: 18px !important;
          padding: 12px !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .org-chart-pdf-export .org-chart-print-contractors .org-chart-pdf-card {
          padding: 10px !important;
        }
      `;

      const exportPdf = async (content: HTMLDivElement, filename: string, baseWidth: number) => {
        let container: HTMLDivElement | null = null;
        try {
          content.classList.add('org-chart-pdf-export');
          content.querySelectorAll('.org-chart-print-hidden').forEach((element) => element.remove());
          content.style.width = `${baseWidth}px`;
          content.style.minWidth = `${baseWidth}px`;
          content.style.maxWidth = 'none';
          content.style.boxSizing = 'border-box';
          content.style.background = '#ffffff';
          content.style.padding = '18px 18px 30px';

          const pdfStyle = document.createElement('style');
          pdfStyle.textContent = pdfStyleText;

          container = document.createElement('div');
          container.style.position = 'fixed';
          container.style.left = '-10000px';
          container.style.top = '0';
          container.style.width = `${baseWidth}px`;
          container.style.background = '#ffffff';
          container.style.overflow = 'visible';
          container.appendChild(pdfStyle);
          container.appendChild(content);
          document.body.appendChild(container);

          let measuredWidth = baseWidth;
          let measuredHeight = 0;

          for (let attempt = 0; attempt < 8; attempt += 1) {
            content.style.width = `${measuredWidth}px`;
            content.style.minWidth = `${measuredWidth}px`;
            container.style.width = `${measuredWidth}px`;

            await new Promise((resolve) => window.requestAnimationFrame(resolve));

            measuredWidth = Math.ceil(Math.max(measuredWidth, content.scrollWidth + 32));
            measuredHeight = Math.ceil(content.scrollHeight + 32);

            if (measuredWidth >= measuredHeight) break;
            measuredWidth = Math.ceil(measuredHeight * 1.2);
          }

          if (measuredWidth < measuredHeight) {
            measuredWidth = Math.ceil(measuredHeight * 1.2);
          }

          content.style.width = `${measuredWidth}px`;
          content.style.minWidth = `${measuredWidth}px`;
          container.style.width = `${measuredWidth}px`;
          await new Promise((resolve) => window.requestAnimationFrame(resolve));

          let exportWidth = Math.ceil(Math.max(measuredWidth, content.scrollWidth + 8));
          let exportHeight = Math.ceil(content.scrollHeight + 8);

          if (exportHeight > exportWidth) {
            exportWidth = Math.ceil(exportHeight * 1.15);
            content.style.width = `${exportWidth}px`;
            content.style.minWidth = `${exportWidth}px`;
            container.style.width = `${exportWidth}px`;
            await new Promise((resolve) => window.requestAnimationFrame(resolve));
            exportWidth = Math.ceil(Math.max(exportWidth, content.scrollWidth + 8));
            exportHeight = Math.ceil(content.scrollHeight + 8);
          }

          const canvas = await html2canvas(content, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            windowWidth: exportWidth,
            windowHeight: exportHeight,
            width: exportWidth,
            height: exportHeight,
          });

          const pageWidth = Math.max(exportWidth, exportHeight + 1);
          const pageHeight = exportHeight;
          const imageWidth = exportWidth;
          const imageHeight = exportHeight;
          const offsetX = (pageWidth - imageWidth) / 2;
          const pdf = new JsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [pageWidth, pageHeight],
            hotfixes: ['px_scaling'],
          });

          pdf.addImage(
            canvas.toDataURL('image/jpeg', 0.98),
            'JPEG',
            offsetX,
            0,
            imageWidth,
            imageHeight,
            undefined,
            'FAST'
          );
          pdf.save(filename);
        } finally {
          container?.remove();
        }
      };

      const pdfClone = source.cloneNode(true) as HTMLDivElement;
      if (!includeContractors) {
        pdfClone.querySelectorAll('.org-chart-print-contractors').forEach((element) => element.remove());
      }
      await exportPdf(
        pdfClone,
        `안전보건조직도_${includeContractors ? '협력업체포함' : '협력업체제외'}_${dateStamp}.pdf`,
        includeContractors ? 1280 : 980
      );

      setPdfOptionsOpen(false);
    } catch (error) {
      console.error('조직도 PDF 생성 오류:', error);
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <section className="org-chart-print-area rounded-2xl border border-slate-200 bg-white shadow-sm">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          html,
          body {
            background: #ffffff !important;
            height: auto !important;
            overflow: visible !important;
          }

          body.org-chart-is-printing .min-h-screen,
          body.org-chart-is-printing .h-screen,
          body.org-chart-is-printing .overflow-hidden,
          body.org-chart-is-printing .overflow-y-auto,
          body.org-chart-is-printing main {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }

          body.org-chart-is-printing main {
            padding: 0 !important;
          }

          body.org-chart-is-printing aside,
          body.org-chart-is-printing header,
          body.org-chart-is-printing .sticky {
            display: none !important;
          }

          body.org-chart-is-printing .max-w-6xl {
            max-width: none !important;
          }

          body * {
            visibility: hidden !important;
          }

          .org-chart-print-area,
          .org-chart-print-area * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .org-chart-print-area {
            position: static !important;
            width: 100% !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            page-break-inside: auto !important;
          }

          .org-chart-print-hidden,
          .org-chart-print-hidden * {
            display: none !important;
            visibility: hidden !important;
          }

          .org-chart-print-scroll {
            overflow: visible !important;
            padding: 0 !important;
          }

          .org-chart-print-canvas {
            min-width: 980px !important;
            width: 980px !important;
            max-width: none !important;
          }

          .org-chart-print-area button,
          .org-chart-print-area [role='button'] {
            break-inside: avoid;
          }

          .org-chart-print-area[data-print-contractors='exclude'] .org-chart-print-contractors {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
      <div className="org-chart-print-hidden flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">조직도 미리보기</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            저장된 인원 정보가 직책과 소속 기준으로 자동 배치됩니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-600 sm:justify-end">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">우리사업장 {ownMembers.length}명</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">협력업체 {contractorMembers.length}명</span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">위원 {committeeMembers.length}명</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPdfOptionsOpen(true)}
            disabled={pdfGenerating}
            className="org-chart-print-hidden gap-1.5 bg-white"
          >
            {pdfGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            PDF
          </Button>
        </div>
      </div>

      <div className="org-chart-print-scroll overflow-x-auto p-4 sm:p-5">
        <div ref={pdfContentRef} className="org-chart-print-canvas min-w-[980px] space-y-6 bg-white">
          <div className="relative">
            <div className="flex justify-center">
              <ExecutiveCard
                executives={executives}
                onAddMember={onAddMember}
                onEditMember={onEditMember}
              />
            </div>

            <div className="mx-auto h-12 w-px bg-slate-300" />

            <div className="relative grid grid-cols-[1fr_8rem_1fr] items-center gap-4">
              <div className="absolute left-[12rem] right-[12rem] top-1/2 h-px bg-slate-300" />
              <div className="absolute left-1/2 top-[-3rem] bottom-[-3rem] w-px -translate-x-1/2 bg-slate-300" />

              <CommitteeCard
                userCount={userCommitteeMembers.length}
                workerCount={workerCommitteeMembers.length}
                onOpen={() => setCommitteeModalOpen(true)}
              />

              <div className="relative z-0 h-28" aria-hidden="true" />

              <SafetyTeamCard
                teamNameDraft={teamNameDraft}
                teamNameSaving={teamNameSaving}
                roleCounts={safetyTeamRoleCounts}
                onTeamNameDraftChange={onTeamNameDraftChange}
                onTeamNameSave={onTeamNameSave}
                onOpen={() => setTeamModalOpen(true)}
              />
            </div>

            <div className="mx-auto h-12 w-px bg-slate-300" />

            <SupervisorBranch
              supervisors={supervisors}
              onAddMember={onAddMember}
              onOpenList={() => setSupervisorModalOpen(true)}
              onReorderSupervisors={onReorderSupervisors}
            />
          </div>

          <div className="org-chart-print-contractors rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">협력업체 조직</h3>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-emerald-700">
                {contractorGroups.length}개 업체
              </span>
            </div>
            {contractorGroups.length ? (
              <ContractorPartnerGrid
                partnerBackedGroups={partnerBackedContractorGroups}
                orphanGroups={orphanContractorGroups}
                onSelectGroup={setSelectedContractorKey}
                onReorderPartners={onReorderPartners}
              />
            ) : (
              <EmptyNode label="협력업체 또는 협력업체 소속 인원을 추가하세요." />
            )}
          </div>
        </div>
      </div>
      {pdfOptionsOpen ? (
        <PdfOptionsModal
          onClose={() => {
            if (!pdfGenerating) setPdfOptionsOpen(false);
          }}
          onDownload={handlePdfDownload}
          generating={pdfGenerating}
        />
      ) : null}
      {teamModalOpen ? (
        <SafetyTeamModal
          teamName={teamName}
          professionals={professionals}
          onAddMember={onAddMember}
          onEditMember={onEditMember}
          onDeleteMember={onDeleteMember}
          onClose={() => setTeamModalOpen(false)}
        />
      ) : null}
      {committeeModalOpen ? (
        <CommitteeModal
          meetings={meetings}
          userCommitteeMembers={userCommitteeMembers}
          workerCommitteeMembers={workerCommitteeMembers}
          onAddMember={onAddMember}
          onEditMember={onEditMember}
          onDeleteMember={onDeleteMember}
          onClose={() => setCommitteeModalOpen(false)}
        />
      ) : null}
      {supervisorModalOpen ? (
        <SupervisorPeopleModal
          supervisors={supervisors}
          onAddMember={onAddMember}
          onEditMember={onEditMember}
          onDeleteMember={onDeleteMember}
          onClose={() => setSupervisorModalOpen(false)}
        />
      ) : null}
      {selectedContractorGroup ? (
        <ContractorPeopleModal
          group={selectedContractorGroup}
          onAddMember={onAddMember}
          onEditMember={onEditMember}
          onDeleteMember={onDeleteMember}
          onClose={() => setSelectedContractorKey(null)}
        />
      ) : null}
    </section>
  );
}

function SupervisorPeopleModal({
  supervisors,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onClose,
}: {
  supervisors: SafetyOrgMember[];
  onAddMember: (config: QuickAddConfig) => void;
  onEditMember: (member: SafetyOrgMember) => void;
  onDeleteMember: (member: SafetyOrgMember) => void;
  onClose: () => void;
}) {
  return (
    <DetailModal
      title="관리감독자"
      description="부서별 관리감독자 인원 목록"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900">인원 목록</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              추가 버튼으로 관리감독자를 계속 등록할 수 있습니다.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => onAddMember({ kind: 'supervisor' })}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            추가
          </Button>
        </div>

        {supervisors.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {supervisors.map((member) => (
              <PersonBox
                key={member.id}
                member={member}
                onEdit={onEditMember}
                onDelete={onDeleteMember}
              />
            ))}
          </div>
        ) : (
          <EmptyNode label="등록된 관리감독자가 없습니다." />
        )}
      </div>
    </DetailModal>
  );
}

function QuickMemberModal({
  config,
  submitting,
  onClose,
  onSubmit,
}: {
  config: QuickAddConfig;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<MemberDraft>) => void | Promise<void>;
}) {
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [committeeSide, setCommitteeSide] = useState('사용자 위원');
  const [committeeRole, setCommitteeRole] = useState('');

  useEffect(() => {
    setName('');
    setPosition('');
    setDepartment('');
    setPhone('');
    setEmail('');
    setCommitteeSide('사용자 위원');
    setCommitteeRole('');

    if (config.kind === 'executive') setRole('안전보건총괄책임자');
    if (config.kind === 'safetyTeam') setRole('안전관리자');
    if (config.kind === 'committee') setRole('산업안전보건위원회 위원');
    if (config.kind === 'supervisor') setRole('관리감독자');
    if (config.kind === 'contractor') setRole('협력업체 안전관리자');
  }, [config]);

  const roleOptions =
    config.kind === 'executive'
      ? ['안전보건총괄책임자', '안전관리책임자']
      : config.kind === 'safetyTeam'
      ? ['안전관리자', '보건관리자', '산업보건의']
      : config.kind === 'contractor'
      ? ['협력업체 현장대리인', '협력업체 안전관리자', '협력업체 관리감독자']
      : [role];

  const title =
    config.kind === 'executive'
      ? '책임자 인원 추가'
      : config.kind === 'safetyTeam'
      ? '전담 안전보건 인원 추가'
      : config.kind === 'committee'
      ? '위원 추가'
      : config.kind === 'supervisor'
      ? '관리감독자 추가'
      : `${config.contractorCompanyName || '협력업체'} 인원 추가`;

  const description =
    config.kind === 'contractor'
      ? '선택한 협력업체 소속으로 등록됩니다.'
      : '이 카드에 필요한 정보만 입력합니다.';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanPosition = position.trim();
    const cleanDepartment = department.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      alert('이름을 입력해 주세요.');
      return;
    }
    if (!cleanPosition) {
      alert('직위를 입력해 주세요.');
      return;
    }

    const base: Partial<MemberDraft> = {
      name: cleanName,
      role,
      position: cleanPosition,
      department: '',
      phone: cleanPhone,
      email: cleanEmail,
      duty: '',
      notes: '',
      affiliation: 'own',
      contractorCompanyId: '',
      contractorCompanyName: '',
      isCommitteeMember: false,
      committeeSide: '',
      committeeRole: '',
    };

    if (config.kind === 'committee') {
      await onSubmit({
        ...base,
        role: '산업안전보건위원회 위원',
        isCommitteeMember: true,
        committeeSide,
        committeeRole: committeeRole.trim() || cleanPosition,
      });
      return;
    }

    if (config.kind === 'supervisor') {
      await onSubmit({
        ...base,
        role: '관리감독자',
        department: cleanDepartment,
      });
      return;
    }

    if (config.kind === 'contractor') {
      await onSubmit({
        ...base,
        affiliation: 'contractor',
        role,
        department: cleanDepartment,
        contractorCompanyId: config.contractorCompanyId || '',
        contractorCompanyName: config.contractorCompanyName || '협력업체',
      });
      return;
    }

    await onSubmit({
      ...base,
      role,
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="닫기"
      />
      <form
        onSubmit={handleSubmit}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">{title}</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {config.kind !== 'committee' && config.kind !== 'supervisor' ? (
              <div className="sm:col-span-2">
                <Label htmlFor="quickRole">역할</Label>
                <select
                  id="quickRole"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {roleOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {config.kind === 'committee' ? (
              <>
                <div>
                  <Label htmlFor="quickCommitteeSide">위원 구분</Label>
                  <select
                    id="quickCommitteeSide"
                    value={committeeSide}
                    onChange={(event) => setCommitteeSide(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="사용자 위원">사용자 위원</option>
                    <option value="근로자 위원">근로자 위원</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="quickCommitteeRole">위원회 직책</Label>
                  <Input
                    id="quickCommitteeRole"
                    value={committeeRole}
                    onChange={(event) => setCommitteeRole(event.target.value)}
                    placeholder="예: 위원장, 간사, 근로자위원"
                    className="mt-1"
                  />
                </div>
              </>
            ) : null}

            {(config.kind === 'supervisor' || config.kind === 'contractor') ? (
              <div className="sm:col-span-2">
                <Label htmlFor="quickDepartment">{config.kind === 'contractor' ? '공종 / 업무' : '부서'}</Label>
                <Input
                  id="quickDepartment"
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  placeholder={config.kind === 'contractor' ? '예: 전기공사, 설비보수' : '예: 생산팀'}
                  className="mt-1"
                />
              </div>
            ) : null}

            <div>
              <Label htmlFor="quickPosition">직위 *</Label>
              <Input
                id="quickPosition"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder="예: 팀장, 현장소장"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="quickName">이름 *</Label>
              <Input
                id="quickName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="예: 홍길동"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="quickPhone">연락처</Label>
              <Input
                id="quickPhone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="010-0000-0000"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="quickEmail">이메일</Label>
              <Input
                id="quickEmail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button type="submit" disabled={submitting} isLoading={submitting} className="gap-2">
            <Save className="h-4 w-4" />
            저장
          </Button>
        </div>
      </form>
    </div>
  );
}

function EditMemberModal({
  open,
  draft,
  editingMember,
  submitting,
  onClose,
  onDraftChange,
  onSubmit,
}: {
  open: boolean;
  draft: MemberDraft;
  editingMember: SafetyOrgMember | null;
  submitting: boolean;
  onClose: () => void;
  onDraftChange: (next: MemberDraft) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  if (!open || !editingMember) return null;

  const setField = <K extends keyof MemberDraft>(key: K, value: MemberDraft[K]) => {
    onDraftChange({ ...draft, [key]: value });
  };

  const setOwnRole = (role: string) => {
    onDraftChange({
      ...draft,
      role,
      affiliation: 'own',
      contractorCompanyId: '',
      contractorCompanyName: '',
      isCommitteeMember: false,
      committeeSide: '',
      committeeRole: '',
    });
  };

  const setContractorRole = (role: string) => {
    onDraftChange({
      ...draft,
      role,
      affiliation: 'contractor',
      isCommitteeMember: false,
      committeeSide: '',
      committeeRole: '',
    });
  };

  const isCommitteeMode = draft.isCommitteeMember || draft.role === '산업안전보건위원회 위원';
  const mode =
    draft.affiliation === 'contractor'
      ? 'contractor'
      : isCommitteeMode
      ? 'committee'
      : isExecutiveRole(draft.role)
      ? 'executive'
      : isProfessionalRole(draft.role)
      ? 'safetyTeam'
      : isSupervisorRole(draft.role)
      ? 'supervisor'
      : 'basic';

  const title =
    mode === 'executive'
      ? '책임자 인원 수정'
      : mode === 'safetyTeam'
      ? '전담 안전보건 인원 수정'
      : mode === 'committee'
      ? '위원 정보 수정'
      : mode === 'supervisor'
      ? '관리감독자 수정'
      : mode === 'contractor'
      ? '협력업체 인원 수정'
      : '인원 정보 수정';

  const description =
    mode === 'contractor'
      ? `${draft.contractorCompanyName || '협력업체'} 소속 인원 정보만 수정합니다.`
      : '현재 조직도 카드에 필요한 정보만 수정합니다.';

  const roleOptions =
    mode === 'executive'
      ? ['안전보건총괄책임자', '안전관리책임자']
      : mode === 'safetyTeam'
      ? ['안전관리자', '보건관리자', '산업보건의']
      : mode === 'supervisor'
      ? ['관리감독자', '근로자 대표', '명예산업안전감독관']
      : mode === 'contractor'
      ? ['협력업체 현장대리인', '협력업체 안전관리자', '협력업체 관리감독자']
      : [];

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="닫기"
      />
      <form
        onSubmit={onSubmit}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">{title}</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === 'contractor' ? (
              <div className="sm:col-span-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-bold text-emerald-700">협력업체</p>
                <p className="mt-1 text-sm font-black text-slate-900">{draft.contractorCompanyName || '협력업체'}</p>
              </div>
            ) : null}

            {roleOptions.length ? (
              <div className="sm:col-span-2">
                <Label htmlFor="editMemberRole">
                  {mode === 'contractor' ? '협력업체 역할' : mode === 'supervisor' ? '관리감독자 구분' : '역할'}
                </Label>
                <select
                  id="editMemberRole"
                  value={draft.role}
                  onChange={(event) => {
                    if (mode === 'contractor') {
                      setContractorRole(event.target.value);
                      return;
                    }
                    setOwnRole(event.target.value);
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {mode === 'committee' ? (
              <>
                <div>
                  <Label htmlFor="editCommitteeSide">위원 구분</Label>
                  <select
                    id="editCommitteeSide"
                    value={draft.committeeSide || '사용자 위원'}
                    onChange={(event) => {
                      onDraftChange({
                        ...draft,
                        role: '산업안전보건위원회 위원',
                        affiliation: 'own',
                        contractorCompanyId: '',
                        contractorCompanyName: '',
                        isCommitteeMember: true,
                        committeeSide: event.target.value,
                      });
                    }}
                    className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="사용자 위원">사용자 위원</option>
                    <option value="근로자 위원">근로자 위원</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="editCommitteeRole">위원회 직책</Label>
                  <Input
                    id="editCommitteeRole"
                    value={draft.committeeRole || ''}
                    onChange={(event) => {
                      onDraftChange({
                        ...draft,
                        role: '산업안전보건위원회 위원',
                        affiliation: 'own',
                        contractorCompanyId: '',
                        contractorCompanyName: '',
                        isCommitteeMember: true,
                        committeeRole: event.target.value,
                      });
                    }}
                    placeholder="예: 위원장, 간사, 근로자위원"
                    className="mt-1"
                  />
                </div>
              </>
            ) : null}

            {(mode === 'supervisor' || mode === 'contractor' || mode === 'basic') ? (
              <div className="sm:col-span-2">
                <Label htmlFor="editMemberDepartment">{mode === 'contractor' ? '공종 / 업무' : '부서'}</Label>
                <Input
                  id="editMemberDepartment"
                  value={draft.department || ''}
                  onChange={(event) => setField('department', event.target.value)}
                  placeholder={mode === 'contractor' ? '예: 전기공사, 설비보수' : '예: 생산팀'}
                  className="mt-1"
                />
              </div>
            ) : null}

            {mode === 'basic' ? (
              <div className="sm:col-span-2">
                <Label htmlFor="editBasicRole">역할 *</Label>
                <Input
                  id="editBasicRole"
                  value={draft.role}
                  onChange={(event) => setField('role', event.target.value)}
                  placeholder="예: 안전보건 지원 담당"
                  className="mt-1"
                  required
                />
              </div>
            ) : null}

            <div>
              <Label htmlFor="editMemberPosition">직위 *</Label>
              <Input
                id="editMemberPosition"
                value={draft.position || ''}
                onChange={(event) => setField('position', event.target.value)}
                placeholder="예: 팀장, 현장소장"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="editMemberName">이름 *</Label>
              <Input
                id="editMemberName"
                value={draft.name}
                onChange={(event) => setField('name', event.target.value)}
                placeholder="예: 홍길동"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="editMemberPhone">연락처</Label>
              <Input
                id="editMemberPhone"
                value={draft.phone || ''}
                onChange={(event) => setField('phone', event.target.value)}
                placeholder="010-0000-0000"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="editMemberEmail">이메일</Label>
              <Input
                id="editMemberEmail"
                type="email"
                value={draft.email || ''}
                onChange={(event) => setField('email', event.target.value)}
                placeholder="name@company.com"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button type="submit" disabled={submitting} isLoading={submitting} className="gap-2">
            <Save className="h-4 w-4" />
            수정 반영
          </Button>
        </div>
      </form>
    </div>
  );
}

function OrgChartContent() {
  const { user } = useAuth();
  const [members, setMembers] = useState<SafetyOrgMember[]>([]);
  const [partners, setPartners] = useState<ContractorPartner[]>([]);
  const [meetings, setMeetings] = useState<MeetingMinute[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<MemberDraft>(EMPTY_DRAFT);
  const [editingMember, setEditingMember] = useState<SafetyOrgMember | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [quickAdd, setQuickAdd] = useState<QuickAddConfig | null>(null);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [teamNameDraft, setTeamNameDraft] = useState(DEFAULT_SAFETY_TEAM_NAME);
  const [teamNameSaving, setTeamNameSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setTeamNameDraft(DEFAULT_SAFETY_TEAM_NAME);
      return;
    }

    const settingsRef = doc(db, 'safety_org_settings', user.uid);
    return onSnapshot(
      settingsRef,
      (snapshot) => {
        const name = snapshot.exists() ? snapshot.data().safetyTeamName : '';
        setTeamNameDraft(typeof name === 'string' && name.trim() ? name.trim() : DEFAULT_SAFETY_TEAM_NAME);
      },
      (error) => {
        console.error('조직도 설정 로드 오류:', error);
      }
    );
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMembers([]);
      setPartners([]);
      setMeetings([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const membersQuery = query(
      collection(db, 'safety_org_members'),
      where('managerId', '==', user.uid)
    );
    const partnersQuery = query(
      collection(db, 'contractor_partners'),
      where('managerId', '==', user.uid)
    );
    const meetingsQuery = query(
      collection(db, 'meeting_minutes'),
      where('managerId', '==', user.uid)
    );

    let loadedMembers = false;
    let loadedPartners = false;
    let loadedMeetings = false;
    const finishIfReady = () => {
      if (loadedMembers && loadedPartners && loadedMeetings) setLoading(false);
    };

    const unsubscribeMembers = onSnapshot(
      membersQuery,
      (snapshot) => {
        const next = snapshot.docs
          .map((item) => normalizeMember(item.id, item.data()))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setMembers(next);
        loadedMembers = true;
        finishIfReady();
      },
      (error) => {
        console.error('조직도 인원 로드 오류:', error);
        loadedMembers = true;
        finishIfReady();
      }
    );

    const unsubscribePartners = onSnapshot(
      partnersQuery,
      (snapshot) => {
        const next = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as ContractorPartner)
          .sort(sortPartnersForOrgChart);
        setPartners(next);
        loadedPartners = true;
        finishIfReady();
      },
      (error) => {
        console.error('협력업체 로드 오류:', error);
        loadedPartners = true;
        finishIfReady();
      }
    );

    const unsubscribeMeetings = onSnapshot(
      meetingsQuery,
      (snapshot) => {
        const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MeetingMinute);
        setMeetings(next);
        loadedMeetings = true;
        finishIfReady();
      },
      (error) => {
        console.error('회의록 로드 오류:', error);
        loadedMeetings = true;
        finishIfReady();
      }
    );

    return () => {
      unsubscribeMembers();
      unsubscribePartners();
      unsubscribeMeetings();
    };
  }, [user]);

  const openQuickAdd = (config: QuickAddConfig) => {
    setQuickAdd(config);
  };

  const openEditModal = (member: SafetyOrgMember) => {
    const isCommitteeMember = member.isCommitteeMember || member.role === '산업안전보건위원회 위원';
    setEditingMember(member);
    setDraft({
      name: member.name,
      role: isCommitteeMember ? '산업안전보건위원회 위원' : member.role,
      department: member.department || '',
      position: member.position || '',
      phone: member.phone || '',
      email: member.email || '',
      duty: member.duty || '',
      affiliation: member.affiliation,
      contractorCompanyId: member.contractorCompanyId || '',
      contractorCompanyName: member.contractorCompanyName || '',
      isCommitteeMember,
      committeeSide: isCommitteeMember ? member.committeeSide || '사용자 위원' : '',
      committeeRole: isCommitteeMember ? member.committeeRole || '' : '',
      notes: member.notes || '',
      sortOrder: member.sortOrder,
    });
    setModalOpen(true);
  };

  const resetModal = () => {
    setModalOpen(false);
    setEditingMember(null);
    setDraft({ ...EMPTY_DRAFT });
  };

  const closeModal = () => {
    if (submitting) return;
    resetModal();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const name = draft.name.trim();
    const role = draft.role.trim();
    const contractorCompanyName = draft.contractorCompanyName?.trim() || '';
    const isCommitteeMember = draft.isCommitteeMember || role === '산업안전보건위원회 위원';

    if (!name || !role) {
      alert('성명과 안전보건 역할을 입력해 주세요.');
      return;
    }
    if (draft.affiliation === 'contractor' && !contractorCompanyName) {
      alert('협력업체명을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        managerId: user.uid,
        name,
        role,
        department: draft.department?.trim() || '',
        position: draft.position?.trim() || '',
        phone: draft.phone?.trim() || '',
        email: draft.email?.trim() || '',
        duty: draft.duty?.trim() || '',
        affiliation: draft.affiliation,
        contractorCompanyId: draft.affiliation === 'contractor' ? draft.contractorCompanyId || '' : '',
        contractorCompanyName: draft.affiliation === 'contractor' ? contractorCompanyName : '',
        isCommitteeMember,
        committeeSide: isCommitteeMember ? draft.committeeSide || '사용자 위원' : '',
        committeeRole: isCommitteeMember ? draft.committeeRole?.trim() || '' : '',
        notes: draft.notes?.trim() || '',
        ...(draft.sortOrder !== undefined ? { sortOrder: draft.sortOrder } : {}),
        updatedAt: serverTimestamp(),
      };

      if (editingMember) {
        await updateDoc(doc(db, 'safety_org_members', editingMember.id), payload);
      } else {
        await addDoc(collection(db, 'safety_org_members'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      resetModal();
    } catch (error) {
      console.error('조직도 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickSubmit = async (payload: Partial<MemberDraft>) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const name = payload.name?.trim() || '';
    const role = payload.role?.trim() || '';
    if (!name || !role) {
      alert('이름과 역할을 입력해 주세요.');
      return;
    }

    const isSupervisorMember = payload.affiliation !== 'contractor' && isSupervisorRole(role);
    const sortOrder = isSupervisorMember ? payload.sortOrder ?? getNextSupervisorSortOrder(members) : payload.sortOrder;

    setQuickSubmitting(true);
    try {
      await addDoc(collection(db, 'safety_org_members'), {
        managerId: user.uid,
        name,
        role,
        department: payload.department?.trim() || '',
        position: payload.position?.trim() || '',
        phone: payload.phone?.trim() || '',
        email: payload.email?.trim() || '',
        duty: payload.duty?.trim() || '',
        affiliation: payload.affiliation === 'contractor' ? 'contractor' : 'own',
        contractorCompanyId: payload.affiliation === 'contractor' ? payload.contractorCompanyId || '' : '',
        contractorCompanyName: payload.affiliation === 'contractor' ? payload.contractorCompanyName || '' : '',
        isCommitteeMember: payload.isCommitteeMember === true,
        committeeSide: payload.isCommitteeMember ? payload.committeeSide || '사용자 위원' : '',
        committeeRole: payload.isCommitteeMember ? payload.committeeRole?.trim() || '' : '',
        notes: payload.notes?.trim() || '',
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setQuickAdd(null);
    } catch (error) {
      console.error('조직도 빠른 인원 저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setQuickSubmitting(false);
    }
  };

  const handleDelete = async (member: SafetyOrgMember) => {
    if (!confirm(`${member.name}님의 안전보건관리 이력을 삭제할까요?`)) return;
    try {
      await deleteDoc(doc(db, 'safety_org_members', member.id));
    } catch (error) {
      console.error('조직도 인원 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSupervisorReorder = async (orderedSupervisors: SafetyOrgMember[]) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const previousMembers = members;
    const updates = orderedSupervisors.map((member, index) => ({
      id: member.id,
      sortOrder: (index + 1) * 1000,
    }));
    const orderMap = new Map(updates.map((item) => [item.id, item.sortOrder]));

    setMembers((current) =>
      current.map((member) => {
        const sortOrder = orderMap.get(member.id);
        return sortOrder === undefined ? member : { ...member, sortOrder };
      })
    );

    try {
      const batch = writeBatch(db);
      updates.forEach((item) => {
        batch.update(doc(db, 'safety_org_members', item.id), {
          sortOrder: item.sortOrder,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (error) {
      setMembers(previousMembers);
      console.error('관리감독자 순서 저장 오류:', error);
      alert('관리감독자 위치 저장 중 오류가 발생했습니다.');
    }
  };

  const handlePartnerReorder = async (orderedPartners: ContractorPartner[]) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const previousPartners = partners;
    const updates = orderedPartners.map((partner, index) => ({
      id: partner.id,
      sortOrder: (index + 1) * 1000,
    }));
    const orderMap = new Map(updates.map((item) => [item.id, item.sortOrder]));

    setPartners((current) =>
      [...current]
        .map((partner) => {
          const sortOrder = orderMap.get(partner.id);
          return sortOrder === undefined ? partner : { ...partner, sortOrder };
        })
        .sort(sortPartnersForOrgChart)
    );

    try {
      const batch = writeBatch(db);
      updates.forEach((item) => {
        batch.update(doc(db, 'contractor_partners', item.id), {
          sortOrder: item.sortOrder,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (error) {
      setPartners(previousPartners);
      console.error('협력업체 순서 저장 오류:', error);
      alert('협력업체 순서 저장 중 오류가 발생했습니다.');
    }
  };

  const saveSafetyTeamName = async (value: string) => {
    const cleanName = value.trim() || DEFAULT_SAFETY_TEAM_NAME;
    setTeamNameDraft(cleanName);
    if (!user) return;

    setTeamNameSaving(true);
    try {
      await setDoc(
        doc(db, 'safety_org_settings', user.uid),
        {
          managerId: user.uid,
          safetyTeamName: cleanName,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('안전보건팀 명칭 저장 오류:', error);
      alert('팀명 저장 중 오류가 발생했습니다.');
    } finally {
      setTeamNameSaving(false);
    }
  };

  const latestMemberDate = members.reduce((latest, member) => {
    return Math.max(latest, toMillis(member.createdAt));
  }, 0);
  const committeeCount = members.filter((member) => member.isCommitteeMember).length;
  const contractorCount = members.filter((member) => member.affiliation === 'contractor').length;

  return (
    <WorkspaceShell
      serviceHref="/org-chart"
      title="조직도"
      description="안전관리조직, 산업안전보건위원회, 협력업체 인원을 한곳에서 등록하고 조직도에 자동 배치합니다."
    >
      <div className="space-y-6">
        <div className="org-chart-print-hidden grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: '등록 인원', value: `${members.length}명`, icon: <Users className="h-4 w-4" />, tone: 'blue' },
            { label: '위원회 위원', value: `${committeeCount}명`, icon: <ShieldCheck className="h-4 w-4" />, tone: 'indigo' },
            { label: '협력업체 인원', value: `${contractorCount}명`, icon: <Building2 className="h-4 w-4" />, tone: 'emerald' },
            { label: '최근 등록', value: latestMemberDate ? formatDate(latestMemberDate) : '-', icon: <Calendar className="h-4 w-4" />, tone: 'slate' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-500">{item.label}</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{item.value}</p>
                </div>
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  item.tone === 'blue' && 'bg-blue-50 text-blue-700',
                  item.tone === 'indigo' && 'bg-indigo-50 text-indigo-700',
                  item.tone === 'emerald' && 'bg-emerald-50 text-emerald-700',
                  item.tone === 'slate' && 'bg-slate-100 text-slate-700'
                )}>
                  {item.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex min-h-[24rem] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-3 text-sm font-bold text-slate-500">조직도 정보를 불러오는 중입니다.</p>
            </div>
          </div>
        ) : (
          <OrgChartPreview
            members={members}
            partners={partners}
            meetings={meetings}
            teamNameDraft={teamNameDraft}
            teamNameSaving={teamNameSaving}
            onTeamNameDraftChange={setTeamNameDraft}
            onTeamNameSave={saveSafetyTeamName}
            onAddMember={openQuickAdd}
            onEditMember={openEditModal}
            onDeleteMember={handleDelete}
            onReorderSupervisors={handleSupervisorReorder}
            onReorderPartners={handlePartnerReorder}
          />
        )}
      </div>

      <EditMemberModal
        open={modalOpen}
        draft={draft}
        editingMember={editingMember}
        submitting={submitting}
        onClose={closeModal}
        onDraftChange={setDraft}
        onSubmit={handleSubmit}
      />
      {quickAdd ? (
        <QuickMemberModal
          key={`${quickAdd.kind}-${quickAdd.contractorCompanyId || quickAdd.contractorCompanyName || 'own'}`}
          config={quickAdd}
          submitting={quickSubmitting}
          onClose={() => {
            if (!quickSubmitting) setQuickAdd(null);
          }}
          onSubmit={handleQuickSubmit}
        />
      ) : null}
    </WorkspaceShell>
  );
}

export default function OrgChartPage() {
  return <OrgChartContent />;
}
