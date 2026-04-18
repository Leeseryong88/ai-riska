export const OPTIONAL_DOC_KEYS = [
  'industryLicense',
  'preventionContract',
  'insurance',
  'qualifications',
  'equipmentInspection',
] as const;

export type OptionalDocKey = (typeof OPTIONAL_DOC_KEYS)[number];

export const OPTIONAL_DOC_META: Record<
  OptionalDocKey,
  { title: string; hint: string }
> = {
  industryLicense: {
    title: '업종 및 면허 정보',
    hint: '예: 비계구조물해체공사업, 전기공사업 등 (내용 입력 및 서류 첨부)',
  },
  preventionContract: {
    title: '산업재해예방 지도계약서',
    hint: '해당 시 제출 서류',
  },
  insurance: {
    title: '산재보험 가입증명원 및 완납증명서',
    hint: '가입·완납 증빙',
  },
  qualifications: {
    title: '자격증 및 교육 이수증',
    hint: '용접공, 크레인 운전원, 고소작업대 조종자 등',
  },
  equipmentInspection: {
    title: '장비 검사필증',
    hint: '지게차, 크레인 등 투입 장비',
  },
};

export const REQUIRED_DOC_KEYS = ['safetyPlan', 'riskAssessment'] as const;
export type RequiredDocKey = (typeof REQUIRED_DOC_KEYS)[number];

export const REQUIRED_DOC_LABELS: Record<RequiredDocKey, string> = {
  safetyPlan: '안전보건관리계획서',
  riskAssessment: '위험성평가표',
};

/** 1단계 모달에 표시하는 필수 기본정보(항상 선택·해제 불가) */
export const REQUIRED_BASIC_FIELD_LABELS = [
  { id: 'companyName', label: '업체명' },
  { id: 'responsiblePerson', label: '관리책임자' },
  { id: 'contact', label: '연락처' },
] as const;

export interface StoredFile {
  url: string;
  fileName: string;
}

export function emptyOptionalEnabled(): Record<OptionalDocKey, boolean> {
  return {
    industryLicense: false,
    preventionContract: false,
    insurance: false,
    qualifications: false,
    equipmentInspection: false,
  };
}

export interface ContractorPartner {
  id: string;
  managerId: string;
  companyName: string;
  responsiblePerson: string;
  contact: string;
  /** 안전보건관리계획서·위험성평가표 — 미첨부 시 해당 키 없음 */
  requiredDocs?: Partial<Record<RequiredDocKey, StoredFile>> | null;
  optionalEnabled: Record<OptionalDocKey, boolean>;
  /** 업종·면허 등 선택 항목의 텍스트 메모 */
  optionalText?: Partial<Record<'industryLicense', string>>;
  optionalDocs?: Partial<Record<OptionalDocKey, StoredFile>>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** 목록 등: 필수 서류(계획서·평가표) 파일 존재 여부 */
export function hasRequiredDocFile(partner: ContractorPartner, key: RequiredDocKey): boolean {
  return !!partner.requiredDocs?.[key];
}

/** 선택해 둔 기타(선택) 서류 항목 수 */
export function countOptionalCategoriesSelected(partner: ContractorPartner): number {
  const en = partner.optionalEnabled ?? emptyOptionalEnabled();
  return OPTIONAL_DOC_KEYS.filter((k) => en[k]).length;
}

/** 선택 항목 중 내용·파일이 채워진 항목 수 (업종·면허는 텍스트 또는 파일) */
export function countOptionalCategoriesWithAttachment(partner: ContractorPartner): number {
  const en = partner.optionalEnabled ?? emptyOptionalEnabled();
  let n = 0;
  for (const k of OPTIONAL_DOC_KEYS) {
    if (!en[k]) continue;
    if (k === 'industryLicense') {
      const hasFile = !!partner.optionalDocs?.industryLicense;
      const hasText = !!partner.optionalText?.industryLicense?.trim();
      if (hasFile || hasText) n++;
    } else if (partner.optionalDocs?.[k]) {
      n++;
    }
  }
  return n;
}
