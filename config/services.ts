export type ServiceCategory = 'analysis' | 'document' | 'community';
export type ServiceStatus = 'stable' | 'beta';
export type DevicePriority = 'high' | 'medium' | 'low';
export type ServiceIcon =
  | 'hub'
  | 'camera'
  | 'assessment'
  | 'currency'
  | 'community'
  | 'document'
  | 'todo'
  | 'safetyLog'
  | 'workPermit'
  | 'contractor'
  | 'workerFeedback'
  | 'healthPlan'
  | 'checklist'
  | 'storage'
  | 'meeting'
  | 'orgChart'
  | 'hazardousMachinery'
  | 'contact';

export interface ServiceDefinition {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  href: string;
  category: ServiceCategory;
  status: ServiceStatus;
  icon: ServiceIcon;
  mobilePriority: DevicePriority;
  desktopMode: 'quick' | 'workspace';
  featured: boolean;
  accent: {
    from: string;
    to: string;
  };
  highlights: string[];
}

export const serviceCategories: Record<
  ServiceCategory,
  { title: string; description: string }
> = {
  analysis: {
    title: 'AI Services',
    description: 'AI가 현장 정보와 사진을 바탕으로 위험요인과 문서 초안을 빠르게 정리합니다.',
  },
  document: {
    title: 'Safety Docs',
    description: '실무 문서, 허가서, 일지, 체크리스트를 누구나 빠짐없이 관리하도록 돕습니다.',
  },
  community: {
    title: '소통과 운영',
    description: '게시판과 문의를 통해 운영 정보와 현장 피드백을 연결합니다.',
  },
};

export const services: ServiceDefinition[] = [
  {
    id: 'camera',
    title: '실시간 사진 위험 분석',
    shortTitle: '사진분석',
    description: '현장 사진을 바로 분석해 위험요인과 개선 포인트를 빠르게 정리합니다.',
    href: '/camera',
    category: 'analysis',
    status: 'stable',
    icon: 'camera',
    mobilePriority: 'high',
    desktopMode: 'quick',
    featured: true,
    accent: { from: 'from-sky-500', to: 'to-blue-600' },
    highlights: ['사진 기반 분석', '즉시 확인', '현장 대응'],
  },
  {
    id: 'assessment',
    title: '스마트 위험성 평가',
    shortTitle: '위험성평가',
    description: '사진 또는 텍스트를 바탕으로 위험성평가표 초안을 만들고 결과를 정리합니다.',
    href: '/assessment',
    category: 'analysis',
    status: 'stable',
    icon: 'assessment',
    mobilePriority: 'medium',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-blue-600', to: 'to-indigo-700' },
    highlights: ['평가표 초안', '텍스트 입력', '보고서 정리'],
  },
  {
    id: 'health-safety-plan',
    title: '안전보건계획서',
    shortTitle: '안전보건계획서',
    description: '공사 개요와 사업장 정보를 바탕으로 안전보건계획서 초안을 빠르게 작성합니다.',
    href: '/health-safety-plan',
    category: 'document',
    status: 'stable',
    icon: 'healthPlan',
    mobilePriority: 'low',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-violet-500', to: 'to-indigo-600' },
    highlights: ['계획서 초안', '정보 입력', '실무 편집'],
  },
  {
    id: 'work-plan',
    title: '작업계획서',
    shortTitle: '작업계획서',
    description: '작업계획서 작성·정리 기능을 제공할 예정입니다.',
    href: '/work-plan',
    category: 'analysis',
    status: 'stable',
    icon: 'document',
    mobilePriority: 'low',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-amber-500', to: 'to-orange-600' },
    highlights: ['계획 정리', '문서화', '예정'],
  },
  {
    id: 'safety-checklist',
    title: '안전점검 체크리스트',
    shortTitle: '점검 체크리스트',
    description: '점검 정보와 항목을 선택하면 맞춤형 안전점검 체크리스트를 자동 생성합니다.',
    href: '/safety-checklist',
    category: 'analysis',
    status: 'stable',
    icon: 'checklist',
    mobilePriority: 'medium',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-rose-500', to: 'to-pink-600' },
    highlights: ['5W1H 선택형', '형식별 고정 양식', '문항 수 선택'],
  },
  {
    id: 'safety-management-fee',
    title: '안전보건관리비 계획서',
    shortTitle: '관리비 계획서',
    description: '공사 금액과 사업 유형에 맞춰 안전보건관리비 계획을 계산하고 문서화합니다.',
    href: '/safety-management-fee',
    category: 'document',
    status: 'stable',
    icon: 'currency',
    mobilePriority: 'low',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-emerald-500', to: 'to-teal-600' },
    highlights: ['예산 계산', '계획 정리', '문서화'],
  },
  {
    id: 'safety-manager-todo',
    title: 'TO DO LIST',
    shortTitle: 'TO DO LIST',
    description: '안전관리 업무를 할 일 중심으로 정리하고 일정과 완료 상태를 한눈에 확인합니다.',
    href: '/safety-log',
    category: 'document',
    status: 'stable',
    icon: 'todo',
    mobilePriority: 'medium',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-indigo-500', to: 'to-blue-600' },
    highlights: ['업무 정리', '완료 체크', '기한·메모'],
  },
  {
    id: 'safety-log',
    title: '일일 안전일지',
    shortTitle: '안전일지',
    description: '일일 점검 사항과 작업 내용을 기록해 현장 이력을 체계적으로 남깁니다.',
    href: '/safety-log/daily',
    category: 'document',
    status: 'stable',
    icon: 'safetyLog',
    mobilePriority: 'low',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-blue-600', to: 'to-cyan-600' },
    highlights: ['일일 기록', '점검 이력', '수정 가능'],
  },
  {
    id: 'org-chart',
    title: '조직도',
    shortTitle: '조직도',
    description: '조직도 작성·정리 기능을 제공할 예정입니다.',
    href: '/org-chart',
    category: 'document',
    status: 'stable',
    icon: 'orgChart',
    mobilePriority: 'low',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-cyan-500', to: 'to-sky-600' },
    highlights: ['조직 정리', '도식화', '예정'],
  },
  {
    id: 'meeting-minutes',
    title: '회의록 관리',
    shortTitle: '회의록',
    description: '산업안전보건위원회, 협력업체 협의체회의 등 법정 회의록을 주기별로 기록·관리합니다.',
    href: '/meeting-minutes',
    category: 'document',
    status: 'stable',
    icon: 'meeting',
    mobilePriority: 'medium',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-fuchsia-500', to: 'to-purple-600' },
    highlights: ['분기·월별 주기 관리', '양식 인쇄', '파일 업로드'],
  },
  {
    id: 'hazardous-machinery',
    title: '유해위험기계기구',
    shortTitle: '유해위험기계기구',
    description: '유해·위험기계기구 관리 기능을 제공할 예정입니다.',
    href: '/hazardous-machinery',
    category: 'document',
    status: 'stable',
    icon: 'hazardousMachinery',
    mobilePriority: 'low',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-amber-600', to: 'to-rose-600' },
    highlights: ['기계기구', '대장·점검', '예정'],
  },
  {
    id: 'work-permit',
    title: '안전작업 허가서',
    shortTitle: '작업허가서',
    description: '작업 전 위험요인을 확인하고 안전작업 허가 절차를 기록·관리합니다.',
    href: '/work-permit',
    category: 'document',
    status: 'stable',
    icon: 'workPermit',
    mobilePriority: 'medium',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-blue-500', to: 'to-indigo-600' },
    highlights: ['QR 접수', '전자서명', '허가 관리'],
  },
  {
    id: 'contractor-partners',
    title: '협력업체 관리',
    shortTitle: '협력업체 관리',
    description: '협력업체 정보와 안전 서류를 등록·보관해 협력사 관리 누락을 줄입니다.',
    href: '/contractor-partners',
    category: 'document',
    status: 'stable',
    icon: 'contractor',
    mobilePriority: 'low',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-slate-600', to: 'to-blue-700' },
    highlights: ['서류 보관', '업체 정보', '누락 방지'],
  },
  {
    id: 'worker-feedback',
    title: '근로자 의견청취',
    shortTitle: '근로자 의견청취',
    description:
      '근로자의 안전·보건 의견을 안내 문구와 접수 링크로 수집하고 확인할 수 있습니다.',
    href: '/worker-feedback',
    category: 'document',
    status: 'stable',
    icon: 'workerFeedback',
    mobilePriority: 'medium',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-violet-500', to: 'to-indigo-700' },
    highlights: ['안내 문구', '의견 수집', '접수 링크'],
  },
  {
    id: 'board',
    title: '커뮤니티 게시판',
    shortTitle: '게시판',
    description: '질문과 공지, 사용자 의견을 한곳에서 확인하고 소통할 수 있습니다.',
    href: '/board',
    category: 'community',
    status: 'stable',
    icon: 'community',
    mobilePriority: 'medium',
    desktopMode: 'workspace',
    featured: false,
    accent: { from: 'from-slate-500', to: 'to-slate-700' },
    highlights: ['질문/공지', '피드백', '운영 소통'],
  },
  {
    id: 'storage',
    title: 'AI 서비스 결과 저장소',
    shortTitle: '저장소',
    description: 'AI 분석과 문서 초안 결과를 한곳에 모아 보고 다시 활용할 수 있습니다.',
    href: '/storage',
    category: 'document',
    status: 'stable',
    icon: 'storage',
    mobilePriority: 'medium',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-amber-500', to: 'to-orange-600' },
    highlights: ['결과 모아보기', '내역 관리', '재활용'],
  },
];

export const primaryServices = services.filter((service) => service.featured);

export function getServiceByHref(href: string | null | undefined) {
  if (!href) return undefined;
  const exact = services.find((service) => service.href === href);
  if (exact) return exact;
  if (href.startsWith('/safety-log/daily')) {
    return services.find((s) => s.id === 'safety-log');
  }
  if (href.startsWith('/safety-log')) {
    return services.find((s) => s.id === 'safety-manager-todo');
  }
  return undefined;
}

/** 사이드바·탑바 활성 표시 */
export function isServiceActive(
  service: ServiceDefinition,
  pathname: string,
  search: string
): boolean {
  if (service.id === 'safety-log') {
    return pathname === '/safety-log/daily' || pathname.startsWith('/safety-log/daily/');
  }
  if (service.id === 'safety-manager-todo') {
    return pathname === '/safety-log';
  }
  const base = service.href.split('?')[0];
  if (pathname !== base) return false;
  return !service.href.includes('?');
}

export function getRelatedServices(href: string | null | undefined) {
  const current = getServiceByHref(href);
  if (!current) {
    return primaryServices.slice(0, 3);
  }

  const sameCategory = services.filter(
    (service) => service.category === current.category && service.href !== current.href
  );

  if (sameCategory.length >= 2) {
    return sameCategory;
  }

  const fallback = services.filter((service) => service.href !== current.href);
  return [...sameCategory, ...fallback].slice(0, 3);
}
