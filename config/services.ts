export type ServiceCategory = 'analysis' | 'document' | 'community';
export type ServiceStatus = 'stable' | 'beta';
export type DevicePriority = 'high' | 'medium' | 'low';
export type ServiceIcon = 'hub' | 'camera' | 'assessment' | 'document' | 'currency' | 'community';

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
    title: 'AI 분석',
    description: '현장 사진과 작업 내용을 빠르게 분석하고 위험요인을 정리합니다.',
  },
  document: {
    title: '문서 작성',
    description: '계획서와 문서형 결과물을 데스크탑 작업공간에서 집중 작성합니다.',
  },
  community: {
    title: '협업과 소통',
    description: '문의와 커뮤니티를 통해 운영 정보와 사용자 피드백을 이어갑니다.',
  },
};

export const services: ServiceDefinition[] = [
  {
    id: 'camera',
    title: '실시간 사진 위험 분석',
    shortTitle: '사진분석',
    description: '모바일에서 바로 촬영하거나 업로드한 사진으로 위험요인과 개선방안을 빠르게 확인합니다.',
    href: '/camera',
    category: 'analysis',
    status: 'stable',
    icon: 'camera',
    mobilePriority: 'high',
    desktopMode: 'quick',
    featured: true,
    accent: { from: 'from-sky-500', to: 'to-blue-600' },
    highlights: ['모바일 최적', '즉시 촬영', '현장용'],
  },
  {
    id: 'assessment',
    title: '스마트 위험성 평가',
    shortTitle: '위험성평가',
    description: '사진 또는 텍스트 기반으로 위험성평가표를 생성하고 결과를 정리합니다.',
    href: '/assessment',
    category: 'analysis',
    status: 'stable',
    icon: 'assessment',
    mobilePriority: 'medium',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-blue-600', to: 'to-indigo-700' },
    highlights: ['보고서형 결과', '텍스트 입력 지원', '데스크탑 추천'],
  },
  {
    id: 'health-safety-plan',
    title: '안전보건계획서',
    shortTitle: '안전보건계획서',
    description: '공사 개요와 현장 정보를 바탕으로 계획서 초안을 만들고 편집할 수 있습니다.',
    href: '/health-safety-plan',
    category: 'document',
    status: 'stable',
    icon: 'document',
    mobilePriority: 'low',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-violet-500', to: 'to-indigo-600' },
    highlights: ['문서 편집', '공사정보 입력'],
  },
  {
    id: 'safety-management-fee',
    title: '안전보건관리비 계획서',
    shortTitle: '관리비 계획서',
    description: '공사 종류와 금액에 따라 안전보건관리비 사용계획서를 계산하고 문서화합니다.',
    href: '/safety-management-fee',
    category: 'document',
    status: 'stable',
    icon: 'currency',
    mobilePriority: 'low',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-emerald-500', to: 'to-teal-600' },
    highlights: ['예산 계산', '문서 생성'],
  },
  {
    id: 'safety-log',
    title: '일일 안전일지',
    shortTitle: '안전일지',
    description: '현장의 일일 안전 점검 사항과 작업 내용을 기록하고 관리하는 일지를 작성합니다.',
    href: '/safety-log',
    category: 'document',
    status: 'stable',
    icon: 'document',
    mobilePriority: 'low',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-blue-600', to: 'to-cyan-600' },
    highlights: ['일일 기록', '점검 관리', '수정 가능'],
  },
  {
    id: 'work-permit',
    title: '안전작업 허가서',
    shortTitle: '작업허가서',
    description: '현장 작업 전 작업 종류별 위험요인을 확인하고 안전작업 허가서를 작성 및 관리합니다.',
    href: '/work-permit',
    category: 'document',
    status: 'stable',
    icon: 'document',
    mobilePriority: 'medium',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-blue-500', to: 'to-indigo-600' },
    highlights: ['QR 접수', '전자서명', '실시간 확인'],
  },
  {
    id: 'contractor-partners',
    title: '협력업체 관리',
    shortTitle: '협력업체 관리',
    description: '협력업체 기본 정보와 안전관리 서류를 등록·보관하고 필요 시 선택 서류까지 함께 관리합니다.',
    href: '/contractor-partners',
    category: 'document',
    status: 'stable',
    icon: 'document',
    mobilePriority: 'low',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-slate-600', to: 'to-blue-700' },
    highlights: ['필수·선택 서류', '문서 보관', '업체 정보'],
  },
  {
    id: 'worker-feedback',
    title: '근로자 의견청취',
    shortTitle: '근로자 의견청취',
    description:
      '근로자가 안전·보건에 관한 제보·의견을 낼 수 있도록 안내 문구를 편집하고, 접수 링크로 의견을 수집·확인합니다.',
    href: '/worker-feedback',
    category: 'document',
    status: 'stable',
    icon: 'document',
    mobilePriority: 'medium',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-violet-500', to: 'to-indigo-700' },
    highlights: ['양식 편집', '의견 수집', '접수 링크'],
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
    description: '사진분석, 위험성평가, 계획서 등 AI 서비스로 생성된 모든 결과물을 모아보고 관리합니다.',
    href: '/storage',
    category: 'document',
    status: 'stable',
    icon: 'document',
    mobilePriority: 'medium',
    desktopMode: 'workspace',
    featured: true,
    accent: { from: 'from-amber-500', to: 'to-orange-600' },
    highlights: ['결과 모아보기', '내역 관리', '삭제 가능'],
  },
];

export const primaryServices = services.filter((service) => service.featured);

export function getServiceByHref(href: string | null | undefined) {
  if (!href) return undefined;
  return services.find((service) => service.href === href);
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
