export type WorkPlanTypeId =
  | 'tower-crane'
  | 'vehicle-handling'
  | 'construction-machinery'
  | 'chemical-equipment'
  | 'electrical'
  | 'excavation'
  | 'tunnel'
  | 'bridge'
  | 'quarry'
  | 'demolition'
  | 'heavy-load'
  | 'track-maintenance'
  | 'rail-shunting';

export type WorkPlanFieldType = 'text' | 'textarea' | 'date' | 'number' | 'select';

export interface WorkPlanField {
  id: string;
  label: string;
  type?: WorkPlanFieldType;
  required?: boolean;
  placeholder?: string;
  helper?: string;
  options?: string[];
}

export interface WorkPlanTemplate {
  id: WorkPlanTypeId;
  order: number;
  title: string;
  shortTitle: string;
  legalBasis: string;
  appliesTo: string;
  summary: string;
  surveyItems: string[];
  planningItems: string[];
  requiredFields: WorkPlanField[];
  optionalFields: WorkPlanField[];
  imageGuide: string;
}

export interface WorkPlanAttachment {
  id: string;
  name: string;
  dataUrl: string;
  note?: string;
}

export const COMMON_WORK_PLAN_FIELDS: WorkPlanField[] = [
  {
    id: 'projectName',
    label: '현장명 또는 작업명',
    required: true,
    placeholder: '예: 00공장 지게차 상하차 작업',
  },
  {
    id: 'workplace',
    label: '작업 장소',
    required: true,
    placeholder: '예: 1동 자재반입구, 지하 1층 기계실',
  },
  {
    id: 'workDate',
    label: '작업 예정일',
    type: 'date',
    required: true,
  },
  {
    id: 'workTime',
    label: '작업 시간',
    placeholder: '예: 08:00~17:00',
  },
  {
    id: 'companyName',
    label: '수행 업체',
    placeholder: '예: 우리사업장 / 00협력업체',
  },
  {
    id: 'siteManager',
    label: '현장 책임자',
    required: true,
    placeholder: '예: 홍길동 소장',
  },
  {
    id: 'workCommander',
    label: '작업지휘자 또는 신호수',
    placeholder: '예: 김안전 반장 / 신호수 별도 배치',
  },
  {
    id: 'workerCount',
    label: '작업 인원',
    type: 'number',
    placeholder: '예: 6',
  },
  {
    id: 'workSummary',
    label: '작업 개요',
    type: 'textarea',
    required: true,
    placeholder: '실제 수행할 작업을 한두 문장으로 입력하세요.',
  },
];

export const WORK_PLAN_TEMPLATES: WorkPlanTemplate[] = [
  {
    id: 'tower-crane',
    order: 1,
    title: '타워크레인 설치ㆍ조립ㆍ해체 작업계획서',
    shortTitle: '타워크레인',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제1호 및 별표 4',
    appliesTo: '타워크레인을 설치ㆍ조립ㆍ해체하는 작업',
    summary: '타워크레인의 형식, 작업순서, 지지방법, 방호설비와 역할 분담을 고정 양식으로 정리합니다.',
    surveyItems: ['현장 접근로 및 양중 반경', '지지ㆍ고정 위치', '주변 전선ㆍ건축물ㆍ교통 간섭', '기상 조건'],
    planningItems: ['타워크레인의 종류 및 형식', '설치ㆍ조립 및 해체순서', '작업도구ㆍ장비ㆍ가설설비 및 방호설비', '작업인원 구성 및 역할 범위', '지지 방법'],
    requiredFields: [
      { id: 'craneType', label: '타워크레인 종류 및 형식', required: true, placeholder: '예: T형, 8톤, Jib 55m' },
      { id: 'workPhase', label: '작업 구분', type: 'select', required: true, options: ['설치', '조립', '해체', '상승', '변경'] },
      { id: 'supportMethod', label: '지지ㆍ고정 방법', required: true, placeholder: '예: 기초 앵커 고정, 월타이 3개소' },
      { id: 'teamRoles', label: '작업 인원 및 역할', type: 'textarea', required: true, placeholder: '예: 조립 4명, 신호수 1명, 전기 1명' },
    ],
    optionalFields: [
      { id: 'craneRadius', label: '작업 반경ㆍ높이', placeholder: '예: 최대 반경 45m, 설치 높이 60m' },
      { id: 'weatherLimit', label: '기상 중지 기준', placeholder: '예: 순간풍속 10m/s 이상 중지' },
    ],
    imageGuide: '크레인 설치 위치도, 작업 반경도, 월타이 위치도, 해체 순서도를 선택 첨부할 수 있습니다.',
  },
  {
    id: 'vehicle-handling',
    order: 2,
    title: '차량계 하역운반기계등 사용 작업계획서',
    shortTitle: '하역운반기계',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제2호 및 별표 4',
    appliesTo: '차량계 하역운반기계등을 사용하는 작업',
    summary: '지게차, 고소작업대, 구내운반차 등 운행경로와 작업방법, 충돌ㆍ협착ㆍ전도 방지대책을 정리합니다.',
    surveyItems: ['작업장 바닥 상태', '보행자 통행 동선', '운행 경로 폭과 회전 공간', '상하차 위치와 적재 상태'],
    planningItems: ['추락ㆍ낙하ㆍ전도ㆍ협착 및 붕괴 등의 위험 예방대책', '차량계 하역운반기계등의 운행경로 및 작업방법'],
    requiredFields: [
      { id: 'equipmentType', label: '장비 종류', type: 'select', required: true, options: ['지게차', '고소작업대', '구내운반차', '화물자동차', '기타 차량계 하역운반기계'] },
      { id: 'operationRoute', label: '운행 경로', required: true, placeholder: '예: 정문 하역장 -> 1동 자재창고' },
      { id: 'workMethod', label: '작업 방법', type: 'textarea', required: true, placeholder: '예: 팔레트 하역 후 지정 적재구역으로 운반' },
      { id: 'separationPlan', label: '보행자 분리ㆍ출입통제', required: true, placeholder: '예: 라바콘 설치, 유도자 배치' },
    ],
    optionalFields: [
      { id: 'loadCondition', label: '취급 화물 상태', placeholder: '예: 팔레트 1톤 이하, 랩핑 완료' },
      { id: 'speedLimit', label: '속도 제한', placeholder: '예: 실내 5km/h 이하' },
    ],
    imageGuide: '운행경로도, 보행자 분리구획, 상하차 위치 사진을 선택 첨부할 수 있습니다.',
  },
  {
    id: 'construction-machinery',
    order: 3,
    title: '차량계 건설기계 사용 작업계획서',
    shortTitle: '건설기계',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제3호 및 별표 4',
    appliesTo: '차량계 건설기계를 사용하는 작업',
    summary: '굴착기, 로더, 덤프트럭, 펌프카 등 건설기계의 종류ㆍ성능, 운행경로와 작업방법을 정리합니다.',
    surveyItems: ['지형 및 지반 상태', '장비 전도ㆍ굴러떨어짐 위험', '주변 구조물ㆍ매설물', '장비 진입 및 회차 공간'],
    planningItems: ['사용하는 차량계 건설기계의 종류 및 성능', '차량계 건설기계의 운행경로', '차량계 건설기계에 의한 작업방법'],
    requiredFields: [
      { id: 'machineType', label: '건설기계 종류', type: 'select', required: true, options: ['굴착기', '로더', '덤프트럭', '콘크리트 펌프카', '콘크리트 믹서트럭', '롤러', '천공기', '항타ㆍ항발기', '기타'] },
      { id: 'machineSpec', label: '장비 성능ㆍ제원', required: true, placeholder: '예: 굴착기 0.6㎥, 정격하중 2.9톤' },
      { id: 'groundCondition', label: '지형ㆍ지반 상태', required: true, placeholder: '예: 평탄 다짐 완료, 연약지반 구간 철판 보강' },
      { id: 'operationRoute', label: '운행 경로', required: true, placeholder: '예: 서문 -> 굴착구간 A -> 토사 적치장' },
    ],
    optionalFields: [
      { id: 'attachmentTool', label: '부착 장치ㆍ작업 장치', placeholder: '예: 브레이커, 버킷, 훅' },
      { id: 'signalPlan', label: '신호 방법', placeholder: '예: 전담 신호수 1명, 무전기 사용' },
    ],
    imageGuide: '장비 배치도, 운행경로도, 지반 보강 위치도, 장비 제원표를 선택 첨부할 수 있습니다.',
  },
  {
    id: 'chemical-equipment',
    order: 4,
    title: '화학설비 및 부속설비 사용 작업계획서',
    shortTitle: '화학설비',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제4호 및 별표 4',
    appliesTo: '화학설비와 그 부속설비를 사용하는 작업',
    summary: '화학설비 운전ㆍ정지ㆍ재개ㆍ점검 과정의 누출, 화재, 폭발 방지대책을 정리합니다.',
    surveyItems: ['취급 물질 특성', '밸브ㆍ플랜지ㆍ계측기 상태', '환기 및 방폭 구역', '비상차단ㆍ경보장치 상태'],
    planningItems: ['밸브ㆍ콕 등의 조작', '냉각ㆍ가열ㆍ교반ㆍ압축장치 조작', '계측 및 제어장치 감시', '안전밸브ㆍ긴급차단장치 등 방호장치 조정', '누출 점검 및 시료 채취', '이상 상태 및 위험물 누출 시 조치'],
    requiredFields: [
      { id: 'equipmentName', label: '설비명', required: true, placeholder: '예: 반응기 R-101 및 이송펌프 P-201' },
      { id: 'materialName', label: '취급 물질', required: true, placeholder: '예: 톨루엔, 산성 세정액' },
      { id: 'operationScope', label: '작업 범위', type: 'textarea', required: true, placeholder: '예: 원료 투입, 가열, 세척 후 재가동' },
      { id: 'isolationPlan', label: '차단ㆍ격리 방법', required: true, placeholder: '예: LOTO, 블라인드 삽입, 잔압 제거' },
    ],
    optionalFields: [
      { id: 'monitoringPlan', label: '감시ㆍ측정 방법', placeholder: '예: 가스측정기 연속 측정, 중앙제어실 감시' },
      { id: 'emergencyMaterial', label: '비상 물품', placeholder: '예: 흡착포, 중화제, 소화기' },
    ],
    imageGuide: 'P&ID, 배관 라인업, 차단 위치도, MSDS 주요 페이지를 선택 첨부할 수 있습니다.',
  },
  {
    id: 'electrical',
    order: 5,
    title: '전기작업 안전작업계획서',
    shortTitle: '전기작업',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제5호 및 별표 4',
    appliesTo: '전압 50V 초과 또는 전기에너지 250VA 초과 전기작업',
    summary: '전기작업 목적, 자격, 차단ㆍ재투입 절차, 보호구와 전기도면 정보를 정리합니다.',
    surveyItems: ['전압ㆍ전원 계통', '활선 접근 위험', '차단 가능 지점', '작업 구역 출입통제'],
    planningItems: ['전기작업의 목적 및 내용', '전기작업 근로자의 자격 및 적정 인원', '작업 범위와 전기 위험요인 및 접근 한계거리', '전로 차단 및 전원 재투입 절차', '절연용 보호구ㆍ방호구ㆍ활선작업용 기구 준비', '작업 중단ㆍ교대 인계ㆍ출입금지 및 교육ㆍ평가 계획', '전기 도면 및 기기 세부 자료'],
    requiredFields: [
      { id: 'voltageInfo', label: '전압ㆍ전원 정보', required: true, placeholder: '예: AC 380V MCC-2 분전반' },
      { id: 'electricalPurpose', label: '작업 목적 및 내용', type: 'textarea', required: true, placeholder: '예: 차단기 교체 및 절연저항 측정' },
      { id: 'qualifiedWorkers', label: '작업자 자격ㆍ인원', required: true, placeholder: '예: 전기기능사 2명, 감시자 1명' },
      { id: 'powerCutPlan', label: '전로 차단ㆍ재투입 절차', type: 'textarea', required: true, placeholder: '예: 차단 -> 검전 -> 접지 -> 잠금표지 -> 작업 -> 복전 승인' },
    ],
    optionalFields: [
      { id: 'approachLimit', label: '접근 한계거리ㆍ통제', placeholder: '예: 방책 설치, 관계자 외 접근 금지' },
      { id: 'protectiveTools', label: '절연 보호구ㆍ방호구', placeholder: '예: 절연장갑, 절연매트, 검전기' },
    ],
    imageGuide: '단선결선도, 차단 위치 사진, 작업구역 통제도, 장비 명판 사진을 선택 첨부할 수 있습니다.',
  },
  {
    id: 'excavation',
    order: 6,
    title: '굴착 작업계획서',
    shortTitle: '굴착',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제6호 및 별표 4',
    appliesTo: '굴착면의 높이가 2미터 이상이 되는 지반의 굴착작업',
    summary: '지반 상태, 굴착순서, 토사 반출, 매설물 보호, 흙막이와 작업지휘자 배치를 정리합니다.',
    surveyItems: ['형상ㆍ지질 및 지층 상태', '균열ㆍ함수ㆍ용수ㆍ동결 상태', '매설물 유무 및 상태', '지하수위 상태'],
    planningItems: ['굴착방법 및 순서, 토사 반출 방법', '필요 인원 및 장비 사용계획', '매설물 등에 대한 이설ㆍ보호대책', '사업장 내 연락방법 및 신호방법', '흙막이 지보공 설치방법 및 계측계획', '작업지휘자 배치계획', '그 밖의 안전ㆍ보건 관련 사항'],
    requiredFields: [
      { id: 'excavationDepth', label: '굴착 깊이ㆍ규모', required: true, placeholder: '예: 깊이 3.5m, 폭 2m, 연장 20m' },
      { id: 'groundCondition', label: '지반ㆍ지층 상태', required: true, placeholder: '예: 매립토, 함수 일부, 균열 없음' },
      { id: 'undergroundUtilities', label: '매설물 확인 결과', required: true, placeholder: '예: 가스관 없음, 우수관 1개소 보호 필요' },
      { id: 'excavationMethod', label: '굴착 방법ㆍ순서', type: 'textarea', required: true, placeholder: '예: 굴착기 단계 굴착, 토사 즉시 반출' },
      { id: 'supportPlan', label: '흙막이ㆍ지보공 계획', required: true, placeholder: '예: H-pile + 토류판, 계측기 2개소' },
    ],
    optionalFields: [
      { id: 'waterPlan', label: '용수ㆍ지하수 처리', placeholder: '예: 배수펌프 상시 대기' },
      { id: 'spoilPlan', label: '토사 적치ㆍ반출', placeholder: '예: 굴착면 1m 이내 적치 금지' },
    ],
    imageGuide: '굴착 평면도, 흙막이 단면도, 매설물 위치도, 토사 반출 경로도를 선택 첨부할 수 있습니다.',
  },
  {
    id: 'tunnel',
    order: 7,
    title: '터널굴착 작업계획서',
    shortTitle: '터널굴착',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제7호 및 별표 4',
    appliesTo: '터널굴착작업',
    summary: '지형ㆍ지질 조사 결과, 굴착 방법, 지보공ㆍ복공, 용수 처리와 환기ㆍ조명을 정리합니다.',
    surveyItems: ['보링 등 지형ㆍ지질 및 지층 상태', '낙반 위험', '출수 위험', '가스폭발 위험'],
    planningItems: ['굴착의 방법', '터널지보공 및 복공 시공방법과 용수 처리방법', '환기 또는 조명시설 설치 방법'],
    requiredFields: [
      { id: 'geologyInfo', label: '지질ㆍ지층 조사 결과', required: true, placeholder: '예: 풍화암, 절리 발달, 용수 가능성 있음' },
      { id: 'tunnelMethod', label: '굴착 방법', required: true, placeholder: '예: NATM, 발파 후 숏크리트' },
      { id: 'supportPlan', label: '지보공ㆍ복공 계획', required: true, placeholder: '예: 락볼트, 숏크리트, 강지보공' },
      { id: 'waterGasPlan', label: '용수ㆍ가스 관리', required: true, placeholder: '예: 가스측정, 집수정 및 펌프 배수' },
    ],
    optionalFields: [
      { id: 'ventilationLighting', label: '환기ㆍ조명 계획', placeholder: '예: 송풍기 2대, 조도 75럭스 이상' },
    ],
    imageGuide: '터널 단면도, 지보 패턴도, 환기 배치도, 계측 위치도를 선택 첨부할 수 있습니다.',
  },
  {
    id: 'bridge',
    order: 8,
    title: '교량 설치ㆍ해체ㆍ변경 작업계획서',
    shortTitle: '교량',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제8호 및 별표 4',
    appliesTo: '높이 5m 이상 또는 최대 지간 30m 이상 금속ㆍ콘크리트 상부구조 교량 작업',
    summary: '교량 작업 방법과 순서, 부재 낙하ㆍ전도ㆍ붕괴 및 추락 방지, 가설구조물 안전성 검토를 정리합니다.',
    surveyItems: ['교량 높이ㆍ지간', '부재 중량 및 인양 조건', '하부 통행ㆍ수변 조건', '가설구조물 설치 위치'],
    planningItems: ['작업 방법 및 순서', '부재 낙하ㆍ전도 또는 붕괴 방지 방법', '근로자 추락 위험 방지 안전조치', '가설 철구조물 등의 설치ㆍ사용ㆍ해체 시 안전성 검토 방법', '사용 기계 등의 종류 및 성능, 작업방법', '작업지휘자 배치계획', '그 밖의 안전ㆍ보건 관련 사항'],
    requiredFields: [
      { id: 'bridgeInfo', label: '교량 조건', required: true, placeholder: '예: 높이 8m, 지간 35m, PSC 거더' },
      { id: 'bridgeWorkMethod', label: '작업 방법ㆍ순서', type: 'textarea', required: true, placeholder: '예: 가설벤트 설치 -> 거더 인양 -> 고정' },
      { id: 'fallProtection', label: '추락 방지대책', required: true, placeholder: '예: 안전대 부착설비, 난간, 추락방망' },
      { id: 'temporaryStructure', label: '가설구조물 안전성 검토', required: true, placeholder: '예: 구조검토서 확인, 설치 전 점검' },
    ],
    optionalFields: [
      { id: 'liftingEquipment', label: '사용 기계ㆍ장비', placeholder: '예: 100톤 크레인 1대' },
      { id: 'trafficControl', label: '하부 통행 통제', placeholder: '예: 신호수 배치, 우회로 안내' },
    ],
    imageGuide: '교량 평면ㆍ단면도, 인양계획도, 가설구조물 도면, 통제구역도를 선택 첨부할 수 있습니다.',
  },
  {
    id: 'quarry',
    order: 9,
    title: '채석 작업계획서',
    shortTitle: '채석',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제9호 및 별표 4',
    appliesTo: '채석작업',
    summary: '채석방법, 굴착면 높이ㆍ기울기, 소단, 발파, 장비와 운반경로를 정리합니다.',
    surveyItems: ['작업장 지형ㆍ지질 및 지층 상태', '지반 붕괴 위험', '굴착기계 굴러떨어짐 위험', '표토ㆍ용수 상태'],
    planningItems: ['노천굴착과 갱내굴착의 구별 및 채석방법', '굴착면 높이와 기울기', '소단 위치와 넓이', '갱내 낙반 및 붕괴방지 방법', '발파방법', '암석 분할방법', '암석 가공장소', '굴착ㆍ분할ㆍ적재ㆍ운반기계 종류 및 성능', '토석 또는 암석의 적재 및 운반방법과 운반경로', '표토 또는 용수 처리방법'],
    requiredFields: [
      { id: 'quarryMethod', label: '채석 방법', required: true, placeholder: '예: 노천굴착, 브레이커 파쇄' },
      { id: 'faceSlope', label: '굴착면 높이ㆍ기울기', required: true, placeholder: '예: 높이 8m, 기울기 1:0.5' },
      { id: 'quarryMachines', label: '사용 기계', required: true, placeholder: '예: 굴착기, 로더, 덤프트럭' },
      { id: 'transportRoute', label: '적재ㆍ운반 경로', required: true, placeholder: '예: 채석장 A -> 파쇄장 -> 야적장' },
    ],
    optionalFields: [
      { id: 'blastingPlan', label: '발파 계획', placeholder: '해당 없으면 해당 없음' },
      { id: 'waterPlan', label: '표토ㆍ용수 처리', placeholder: '예: 배수로 정비, 침사지 운영' },
    ],
    imageGuide: '채석장 평면도, 운반경로도, 소단 위치도, 발파구역도를 선택 첨부할 수 있습니다.',
  },
  {
    id: 'demolition',
    order: 10,
    title: '구축물등 해체 작업계획서',
    shortTitle: '해체',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제10호 및 별표 4',
    appliesTo: '구축물, 건축물, 그 밖의 시설물 등의 해체작업',
    summary: '해체 구조물 조사 결과, 해체 방법과 순서, 방호ㆍ살수ㆍ방화, 해체물 처리와 장비 사용계획을 정리합니다.',
    surveyItems: ['해체 대상 구조', '주변 상황', '위험물ㆍ석면 등 유해요인', '인접 구조물 및 통행 영향'],
    planningItems: ['해체의 방법 및 해체 순서도면', '가설설비ㆍ방호설비ㆍ환기설비 및 살수ㆍ방화설비 등의 방법', '사업장 내 연락방법', '해체물의 처분계획', '해체작업용 기계ㆍ기구 등의 작업계획서', '해체작업용 화약류 등의 사용계획서', '그 밖의 안전ㆍ보건 관련 사항'],
    requiredFields: [
      { id: 'structureInfo', label: '해체 대상 구조물', required: true, placeholder: '예: 철근콘크리트 3층 창고' },
      { id: 'demolitionMethod', label: '해체 방법ㆍ순서', type: 'textarea', required: true, placeholder: '예: 내부 반출 -> 상부층 순차 해체 -> 폐기물 반출' },
      { id: 'protectionPlan', label: '방호ㆍ살수ㆍ방화 계획', required: true, placeholder: '예: 방진막, 살수, 출입통제, 소화기 배치' },
      { id: 'wastePlan', label: '해체물 처분 계획', required: true, placeholder: '예: 콘크리트 분리 적재 후 지정업체 반출' },
    ],
    optionalFields: [
      { id: 'demolitionMachines', label: '해체 장비ㆍ기구', placeholder: '예: 압쇄기 부착 굴착기, 산소절단기' },
      { id: 'explosivePlan', label: '화약류 사용 계획', placeholder: '해당 없으면 해당 없음' },
    ],
    imageGuide: '해체 순서도, 방호시설 배치도, 폐기물 동선도, 인접 구조물 사진을 선택 첨부할 수 있습니다.',
  },
  {
    id: 'heavy-load',
    order: 11,
    title: '중량물 취급 작업계획서',
    shortTitle: '중량물',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제11호 및 별표 4',
    appliesTo: '중량물의 취급작업',
    summary: '중량물 제원, 취급 방법, 추락ㆍ낙하ㆍ전도ㆍ협착ㆍ붕괴 예방대책을 정리합니다.',
    surveyItems: ['중량물 중량ㆍ형상', '인양ㆍ운반 경로', '바닥 지내력', '작업 반경 내 간섭물'],
    planningItems: ['추락 위험 예방 안전대책', '낙하 위험 예방 안전대책', '전도 위험 예방 안전대책', '협착 위험 예방 안전대책', '붕괴 위험 예방 안전대책'],
    requiredFields: [
      { id: 'loadInfo', label: '중량물 정보', required: true, placeholder: '예: 배전반 1.2톤, 2.0m x 1.0m x 2.2m' },
      { id: 'handlingMethod', label: '취급ㆍ운반 방법', required: true, placeholder: '예: 지게차 운반 후 체인블록으로 위치 조정' },
      { id: 'equipmentSling', label: '장비ㆍ줄걸이 용구', required: true, placeholder: '예: 3톤 지게차, 섬유슬링 2톤 2본' },
      { id: 'routeArea', label: '작업 경로ㆍ작업 반경', required: true, placeholder: '예: 반입구 -> 기계실, 반경 내 출입금지' },
    ],
    optionalFields: [
      { id: 'loadCapacityCheck', label: '정격하중ㆍ지내력 확인', placeholder: '예: 장비 정격하중 3톤, 바닥 지내력 확인' },
      { id: 'pinchPointPlan', label: '협착 방지 방법', placeholder: '예: 손 끼임 위치 접근 금지, 유도봉 사용' },
    ],
    imageGuide: '인양계획도, 운반경로도, 중량물 사진, 줄걸이 위치 스케치를 선택 첨부할 수 있습니다.',
  },
  {
    id: 'track-maintenance',
    order: 12,
    title: '궤도ㆍ관련 설비 보수ㆍ점검 작업계획서',
    shortTitle: '궤도보수',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제12호 및 별표 4',
    appliesTo: '궤도나 그 밖의 관련 설비의 보수ㆍ점검작업',
    summary: '작업 구간, 열차 운행 협의, 인원ㆍ작업량ㆍ순서ㆍ방법과 안전조치를 정리합니다.',
    surveyItems: ['작업 구간 및 열차 운행 정보', '작업차량 사용 여부', '전차선ㆍ신호설비 간섭', '피난 장소'],
    planningItems: ['적절한 작업 인원', '작업량', '작업순서', '작업방법 및 위험요인에 대한 안전조치방법'],
    requiredFields: [
      { id: 'trackSection', label: '작업 구간', required: true, placeholder: '예: 00역 3번선 K12+300~K12+450' },
      { id: 'trainCoordination', label: '열차 운행 협의ㆍ차단 계획', required: true, placeholder: '예: 관제 협의 완료, 23:00~04:00 선로차단' },
      { id: 'workVolume', label: '작업량', required: true, placeholder: '예: 침목 교체 20정, 레일 체결구 점검' },
      { id: 'railSafetyMethod', label: '작업방법 및 안전조치', type: 'textarea', required: true, placeholder: '예: 감시자 배치, 작업표지, 무전 연락' },
    ],
    optionalFields: [
      { id: 'trackVehicle', label: '궤도작업차량', placeholder: '예: 모터카 1대, 멀티플타이탬퍼 1대' },
      { id: 'evacuationPlan', label: '대피ㆍ비상 연락', placeholder: '예: 상행측 대피공간 지정' },
    ],
    imageGuide: '작업구간도, 선로차단 승인 자료, 장비 배치도, 대피 위치도를 선택 첨부할 수 있습니다.',
  },
  {
    id: 'rail-shunting',
    order: 13,
    title: '입환 작업계획서',
    shortTitle: '입환',
    legalBasis: '산업안전보건기준에 관한 규칙 제38조제1항제13호 및 별표 4',
    appliesTo: '열차의 교환ㆍ연결 또는 분리 작업',
    summary: '입환 작업 인원, 작업량, 순서, 신호ㆍ연락과 끼임ㆍ충돌 방지조치를 정리합니다.',
    surveyItems: ['입환 구간 및 차량 수', '선로 상태', '신호ㆍ통신 상태', '작업자 대기 위치'],
    planningItems: ['적절한 작업 인원', '작업량', '작업순서', '작업방법 및 위험요인에 대한 안전조치방법'],
    requiredFields: [
      { id: 'yardSection', label: '입환 구간', required: true, placeholder: '예: 00역 유치선 2번선' },
      { id: 'trainCars', label: '대상 차량ㆍ작업량', required: true, placeholder: '예: 화차 8량 연결, 2량 분리' },
      { id: 'communicationSignal', label: '신호ㆍ연락 방법', required: true, placeholder: '예: 무전기 채널 3, 수신호 병행' },
      { id: 'shuntingSequence', label: '작업 순서', type: 'textarea', required: true, placeholder: '예: 접근 확인 -> 연결 -> 제동 확인 -> 이동 승인' },
    ],
    optionalFields: [
      { id: 'crewRoles', label: '인원 역할', placeholder: '예: 입환책임자 1명, 유도자 2명' },
      { id: 'stopBlockPlan', label: '충돌ㆍ끼임 방지', placeholder: '예: 차륜막이 설치, 작업자 선로 내 대기 금지' },
    ],
    imageGuide: '입환 구간도, 차량 배치도, 신호 위치도, 대피 위치도를 선택 첨부할 수 있습니다.',
  },
];

export function getWorkPlanTemplate(id: string | undefined | null): WorkPlanTemplate | undefined {
  return WORK_PLAN_TEMPLATES.find((template) => template.id === id);
}

export function getWorkPlanFieldLabel(id: string, template: WorkPlanTemplate): string {
  const field = [...COMMON_WORK_PLAN_FIELDS, ...template.requiredFields, ...template.optionalFields].find(
    (item) => item.id === id
  );
  return field?.label || id;
}
