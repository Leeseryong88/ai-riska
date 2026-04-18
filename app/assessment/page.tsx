'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import ImageUploader from '@/components/ImageUploader';
import ImageAnalysis from '@/components/ImageAnalysis';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { usePathname, useSearchParams } from 'next/navigation';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { compressImage } from '@/app/lib/image-utils';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';

// 분석 항목 인터페이스 정의
interface AnalysisItem {
  id: number;
  image: File | null;
  imageUrl: string | null;
  analysis: string | null;
  loading: boolean;
  selectedRows: string[];
  processName: string;
}

// 저장된 위험성평가 인터페이스 정의
interface SavedAssessment {
  id: string;
  title: string;
  createdAt: string;
  tableData: {
    processName: string;
    riskFactor: string;
    severity: string;
    probability: string;
    riskLevel: string;
    countermeasure: string;
  }[];
  tableHTML: string;
  userId: string;
}

// 작업 종류별 예시 데이터
const workTypeExamples: Record<string, { general: string; process: string }> = {
  // 건설업
  '토공사': { 
    general: '대규모 터파기 작업이 진행 중인 건설 사업장이며, 굴착기 및 덤프트럭 등 중장비 이동이 빈번합니다.', 
    process: '굴착 사면 인근에서 작업 중 지반 붕괴로 인한 매몰 위험 또는 장비 선회 반경 내 근로자 협착...' 
  },
  '골조공사': { 
    general: '철근 배근 및 거푸집 설치 작업이 진행되는 고층 빌딩 사업장으로, 타워크레인 양중 작업이 포함됩니다.', 
    process: '외부 비계 상부에서 거푸집 조립 중 안전대 미체결 상태에서 중심을 잃고 추락하는 사고...' 
  },
  '마감공사': { 
    general: '내부 인테리어 및 조적, 미장 작업이 진행되는 아파트 사업장이며, 다양한 공종이 혼재되어 있습니다.', 
    process: '실내 천장 마감 작업 중 이동식 비계(우마) 위에서 이동하다 바닥 요철에 걸려 넘어짐...' 
  },
  '전기/설비공사': { 
    general: '건물 내 배관 설치 및 배선 작업 사업장이며, 사다리 작업과 전기 판넬 작업이 위주입니다.', 
    process: '천장 내 케이블 트레이 설치 중 사다리 최상단에 올라가 작업하다 사다리가 전도되어 추락...' 
  },
  '도장공사': { 
    general: '아파트 외벽 및 내부 도장 작업 사업장이며, 달비계 작업과 유기용제 사용이 포함됩니다.', 
    process: '실내 도장 작업 중 환기 설비 미흡으로 인한 유기용제 증기 질식 또는 화재 발생 위험...' 
  },
  // 제조업
  '금속가공': { 
    general: '각종 금속 절단 및 가공 공장이며, 대형 선반과 밀링 머신이 가동되고 있습니다.', 
    process: '절삭 가공 중 회전하는 공작물에 장갑이 말려 들어가면서 손가락이 끼이는 사고...' 
  },
  '조립라인': { 
    general: '자동차 부품 조립 라인이며, 컨베이어 시스템과 자동화 로봇이 상시 구동됩니다.', 
    process: '컨베이어 벨트 구동부의 방호덮개가 열린 상태에서 정비 작업 중 손이 끼이는 위험...' 
  },
  '용접작업': { 
    general: '선박 블록 용접 사업장이며, 아크 용접과 가스 절단 작업이 주된 공정입니다.', 
    process: '용접 불티가 주변 가연물에 튀어 발생하는 화재 또는 밀폐공간 내 용접 흄 중독...' 
  },
  '포장/물류': { 
    general: '제품 출고를 위한 자동 포장 라인 및 지게차 이동이 잦은 물류 창고입니다.', 
    process: '지게차로 파레트 적재 작업 중 시야 미확보로 인한 보행 근로자 충돌 사고...' 
  },
  '기계정비': { 
    general: '설비 유지보수를 위한 정비실이며, 각종 공구 및 중량물 취급 작업이 발생합니다.', 
    process: '대형 모터 교체 작업 중 체인 블럭에서 제품이 이탈하여 발등에 낙하하는 사고...' 
  },
  // 서비스업
  '시설관리': { 
    general: '대형 쇼핑몰의 기계실 및 전기실 관리 업무이며, 고층 작업이 포함될 수 있습니다.', 
    process: '지하 저수조 밸브 점검 중 미끄러운 바닥에 넘어져 머리를 부딪히는 사고...' 
  },
  '청소/방역': { 
    general: '오피스 빌딩 내부 청소 및 약제 살포 방역 작업이며, 화학 물질 취급이 포함됩니다.', 
    process: '희석된 소독액을 살포하던 중 보안경 미착용으로 눈에 약제가 들어가는 사고...' 
  },
  '조리/식당': { 
    general: '단체 급식 시설의 대형 주방이며, 화기 및 칼, 고온의 증기를 사용하는 환경입니다.', 
    process: '끓는 국물을 옮기던 중 바닥의 기름기에 미끄러져 화상을 입는 사고...' 
  },
  '판매/영업': { 
    general: '대형 마트 매장 운영 및 상품 진열 업무이며, 사다리 및 카트 사용이 잦습니다.', 
    process: '매장 상단 선반에 물건을 진열하던 중 사다리에서 발을 헛디뎌 추락하는 위험...' 
  },
  '배송/배달': { 
    general: '이륜차 및 화물차를 이용한 도심 배송 작업이며, 시간 압박이 있는 환경입니다.', 
    process: '빗길 주행 중 급제동으로 인해 이륜차가 전도되면서 발생하는 교통사고...' 
  },
  // 사무직
  '일반사무': { 
    general: '일반적인 사무실 근무 환경이며, VDT 작업 및 서류 보관실 이용이 포함됩니다.', 
    process: '탕비실의 뜨거운 물에 손을 데거나, 사무실 바닥의 전선 케이블에 걸려 넘어짐...' 
  },
  'IT/컴퓨터': { 
    general: '서버실 관리 및 전산 장비 유지보수 작업이며, 정전기 예방 및 중량물 이동이 있습니다.', 
    process: '서버 랙(Rack) 이동 중 발등 위에 서버가 낙하하여 발생하는 골절 사고...' 
  },
  '안전 관리': { 
    general: '사업장 감독 및 안전 점검 업무이며, 전체를 순회하며 확인합니다.', 
    process: '순찰 중 개구부 덮개가 불완전하게 닫힌 구간을 밟아 추락하는 위험...' 
  },
  // 운수/창고업
  '상하차': { 
    general: '택배 터미널의 화물 상하차 작업이며, 컨베이어 및 중량물 취급이 반복됩니다.', 
    process: '트럭 적재함 끝단에서 하차 작업 중 중심을 잃고 바닥으로 추락하는 사고...' 
  },
  '창고관리': { 
    general: '고단 적재 랙이 설치된 대형 창고이며, 지게차와 리치 트럭이 운용됩니다.', 
    process: '적재 랙 상단의 박스가 고정 불량으로 인해 하부 근로자 머리 위로 낙하...' 
  },
  '운전/운송': { 
    general: '대형 화물차 장거리 운송 업무이며, 졸음 운전 및 적재물 결속 상태 확인이 중요합니다.', 
    process: '적재물 결속 상태를 확인하기 위해 적재함 위에 올라갔다 뛰어내리며 발생하는 무릎 부상...' 
  },
  '장비운용': { 
    general: '크레인, 지게차 등 하역 장비 운용 사업장이며, 장비 결함 확인 및 신호수 배치가 필요합니다.', 
    process: '지게차 포크 위에 사람을 태우고 고소 작업을 하던 중 균형 상실로 인한 추락...' 
  },
  '기타': { 
    general: '기본적인 상황과 안전 수칙을 입력해주세요. (예: 환기 상태, 보호구 착용 여부 등)', 
    process: '작업 중 발생할 수 있는 구체적인 위험 상황을 설명해주세요. (예: 사다리 작업 중 추락, 기계 끼임 등)' 
  }
};

// 클라이언트 컴포넌트 - useSearchParams 사용
function ClientSideContent() {
  // 상태 변수들
  const [analysisItems, setAnalysisItems] = useState<AnalysisItem[]>([
    { id: 1, image: null, imageUrl: null, analysis: null, loading: false, selectedRows: [], processName: '' }
  ]);
  const [finalAnalysis, setFinalAnalysis] = useState<string | null>(null);
  const [isGeneratingFinal, setIsGeneratingFinal] = useState(false);
  const [isEditingFinal, setIsEditingFinal] = useState(false);
  const [editableTableData, setEditableTableData] = useState<any[]>([]);
  const [isRequestingAdditional, setIsRequestingAdditional] = useState(false);
  const [additionalAnalysisIndex, setAdditionalAnalysisIndex] = useState<number | null>(null);
  const [showProcessNameModal, setShowProcessNameModal] = useState(false);
  const [tempImageFile, setTempImageFile] = useState<File | null>(null);
  const [tempItemId, setTempItemId] = useState<number | null>(null);
  const [processNameInput, setProcessNameInput] = useState('');
  const [assessmentMethod, setAssessmentMethod] = useState<'3x3' | '5x5'>('5x5');
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const [currentView, setCurrentView] = useState<'main' | 'saved' | 'detail'>('main');
  const [previousView, setPreviousView] = useState<'main' | 'saved' | 'detail'>('main'); // 이전 화면 상태 추적
  const [savedAssessments, setSavedAssessments] = useState<SavedAssessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<SavedAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isEditingSaved, setIsEditingSaved] = useState(false); // 저장된 위험성평가 수정 모드
  const [isUpdating, setIsUpdating] = useState(false); // 업데이트 중 상태
  const [showSuccessToast, setShowSuccessToast] = useState(false); // 성공 토스트 표시 상태
  const [approvalCount, setApprovalCount] = useState(0);
  const [showWorkerSignatures, setShowWorkerSignatures] = useState(false);
  const [showApprovalSelect, setShowApprovalSelect] = useState(false);
  
  // 신규 추가: 시작 메뉴 및 텍스트 기반 생성 관련 상태
  const [showInitialMenu, setShowInitialMenu] = useState(true);
  const [generationType, setGenerationType] = useState<'photo' | 'text' | null>(null);
  const [textProcesses, setTextProcesses] = useState<string[]>(['']);
  const [currentTextProcessIndex, setCurrentTextProcessIndex] = useState(0);
  const [isGeneratingFromText, setIsGeneratingFromText] = useState(false);
  const [generalInfo, setGeneralInfo] = useState('');
  const [isEnteringGeneralInfo, setIsEnteringGeneralInfo] = useState(false);
  const [siteType, setSiteType] = useState('');
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [isSelectingSiteType, setIsSelectingSiteType] = useState(false);
  const [isSelectingWorkType, setIsSelectingWorkType] = useState(false);
  
  // 결과 영역으로 스크롤하기 위한 ref
  const resultsRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  // 모바일 환경 감지를 위한 상태 추가
  const [isMobileView, setIsMobileView] = useState(false);

  // 테이블 데이터를 HTML로 변환하는 헬퍼 함수
  const generateTableHTML = (data: any[], appCount: number, workerSigs: boolean) => {
    let approvalHTML = '';
    if (appCount > 0) {
      approvalHTML = `
        <div class="approval-section-wrapper" style="display: flex; justify-content: flex-end; margin-bottom: 25px; width: 100%;">
          <div style="width: fit-content; margin-left: auto;">
            <table border="1" style="border-collapse: collapse; text-align: center; border: 1px solid #94A3B8;">
              <tr>
                <th rowspan="2" style="padding: 5px; background-color: #F8FAFC; font-size: 11px; width: 30px; border: 1px solid #94A3B8; color: #475569; line-height: 1.2; text-align: center;">
                  <div class="approval-cell">
                    <div style="width: 100%;">결</div>
                    <div style="width: 100%;">재</div>
                  </div>
                </th>
                ${Array(appCount).fill(0).map(() => `<th style="padding: 5px; background-color: #F8FAFC; font-size: 11px; width: 70px; height: 25px; border: 1px solid #94A3B8; color: #475569; text-align: center;"></th>`).join('')}
              </tr>
              <tr>
                ${Array(appCount).fill(0).map(() => `<td style="height: 70px; width: 70px; border: 1px solid #94A3B8;"></td>`).join('')}
              </tr>
            </table>
          </div>
        </div>
      `;
    }

    let workerSignatureHTML = '';
    if (workerSigs) {
      workerSignatureHTML = `
        <div class="worker-signature-section" style="margin-top: 40px; page-break-before: auto;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1E293B; border-left: 4px solid #3B82F6; padding-left: 10px;">근로자 명단 및 서명</h3>
          <table border="1" style="border-collapse: collapse; width: 100%; text-align: center; border: 1px solid #94A3B8;">
            <thead>
              <tr style="background-color: #F8FAFC;">
                <th style="padding: 10px; font-size: 13px; border: 1px solid #94A3B8; width: 16%; color: #475569;">성명</th>
                <th style="padding: 10px; font-size: 13px; border: 1px solid #94A3B8; width: 17%; color: #475569;">서명</th>
                <th style="padding: 10px; font-size: 13px; border: 1px solid #94A3B8; width: 16%; color: #475569;">성명</th>
                <th style="padding: 10px; font-size: 13px; border: 1px solid #94A3B8; width: 17%; color: #475569;">서명</th>
                <th style="padding: 10px; font-size: 13px; border: 1px solid #94A3B8; width: 16%; color: #475569;">성명</th>
                <th style="padding: 10px; font-size: 13px; border: 1px solid #94A3B8; width: 18%; color: #475569;">서명</th>
              </tr>
            </thead>
            <tbody>
              ${Array(4).fill(0).map(() => `
                <tr>
                  <td style="height: 45px; border: 1px solid #94A3B8;"></td>
                  <td style="border: 1px solid #94A3B8;"></td>
                  <td style="border: 1px solid #94A3B8;"></td>
                  <td style="border: 1px solid #94A3B8;"></td>
                  <td style="border: 1px solid #94A3B8;"></td>
                  <td style="border: 1px solid #94A3B8;"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const mainTableHTML = `
      <table class="main-assessment-table" border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; border: 1px solid #94A3B8;">
        <thead style="background-color: #F1F5F9;">
          <tr>
            <th style="padding: 12px 8px; text-align: center; border: 1px solid #94A3B8; color: #334155; font-size: 13px; width: 15%;">공정/장비</th>
            <th style="padding: 12px 8px; text-align: center; border: 1px solid #94A3B8; color: #334155; font-size: 13px; width: 22%;">위험 요소</th>
            <th style="padding: 12px 4px; text-align: center; border: 1px solid #94A3B8; color: #334155; font-size: 13px; width: 7%;">중대성</th>
            <th style="padding: 12px 4px; text-align: center; border: 1px solid #94A3B8; color: #334155; font-size: 13px; width: 7%;">가능성</th>
            <th style="padding: 12px 4px; text-align: center; border: 1px solid #94A3B8; color: #334155; font-size: 13px; width: 10%;">위험도</th>
            <th style="padding: 12px 8px; text-align: center; border: 1px solid #94A3B8; color: #334155; font-size: 13px;">개선 대책</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((row, index) => `
            <tr style="background-color: ${index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
              <td style="padding: 10px 8px; border: 1px solid #94A3B8; color: #1E293B; font-size: 12px;">${row.processName}</td>
              <td style="padding: 10px 8px; border: 1px solid #94A3B8; color: #1E293B; font-size: 12px;">${row.riskFactor}</td>
              <td style="padding: 10px 4px; border: 1px solid #94A3B8; color: #1E293B; font-size: 12px; text-align: center;">${row.severity}</td>
              <td style="padding: 10px 4px; border: 1px solid #94A3B8; color: #1E293B; font-size: 12px; text-align: center;">${row.probability}</td>
              <td style="padding: 10px 4px; border: 1px solid #94A3B8; color: #1E293B; font-size: 12px; text-align: center;">${row.riskLevel}</td>
              <td style="padding: 10px 8px; border: 1px solid #94A3B8; color: #1E293B; font-size: 12px; line-height: 1.5;">${row.countermeasure}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    return `
      <div style="width: 100%; position: relative;">
        ${approvalHTML}
        ${mainTableHTML}
        ${workerSignatureHTML}
      </div>
    `;
  };

  // 모바일에서 제목을 숨길 '작성 단계'인지 확인
  const isInputStep = currentView === 'main' && (
    isSelectingSiteType || 
    isSelectingWorkType || 
    isEnteringGeneralInfo || 
    (!showInitialMenu && generationType === 'text' && !finalAnalysis)
  );
  
  // 선택된 작업 종류들에 따른 예시 데이터 가져오기
  const getDynamicPlaceholder = () => {
    if (!workTypes || workTypes.length === 0) return workTypeExamples['기타'];
    const firstType = workTypes[0];
    return workTypeExamples[firstType] || workTypeExamples['기타'];
  };

  const dynamicPlaceholder = getDynamicPlaceholder();
  
  // 위험성평가 데이터를 카드로 렌더링 (모바일용)
  const renderRiskAssessmentCards = (data: any[]) => {
    return (
      <div className="md:hidden space-y-4">
        {/* 모바일 결재칸 표시 */}
        {approvalCount > 0 && (
          <div className="bg-white border-2 border-indigo-100 rounded-2xl p-5 shadow-sm mb-6 animate-fadeIn">
            <h4 className="text-xs font-bold text-indigo-500 mb-3 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              결재칸
            </h4>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {Array(approvalCount).fill(0).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-20 border border-gray-200 rounded-lg overflow-hidden text-center bg-white shadow-sm">
                  <div className="bg-gray-50 h-6 border-b border-gray-200"></div>
                  <div className="h-20"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.map((row, index) => (
          <div key={index} className="bg-white border-2 border-gray-100 rounded-2xl p-5 shadow-sm overflow-hidden animate-fadeIn" style={{ animationDelay: `${index * 50}ms` }}>
            <div className="flex justify-between items-start mb-4">
              <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-black max-w-[70%] truncate">
                {row.processName}
              </span>
              <div className={`px-2 py-1 rounded text-[10px] font-black shrink-0 ${
                (row.riskLevel || '').includes('상') || (row.riskLevel || '').includes('높음') ? 'bg-red-50 text-red-600' :
                (row.riskLevel || '').includes('중') ? 'bg-yellow-50 text-yellow-600' :
                'bg-green-50 text-green-600'
              }`}>
                {row.riskLevel}
              </div>
            </div>
            
            <div className="mb-4">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider text-left">위험 요소</h4>
              <p className="text-gray-900 font-bold leading-snug break-all text-left">{row.riskFactor}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 text-center">
                <span className="text-[10px] text-gray-400 block mb-0.5 font-bold">중대성</span>
                <span className="font-black text-gray-700 text-sm">{row.severity}</span>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 text-center">
                <span className="text-[10px] text-gray-400 block mb-0.5 font-bold">가능성</span>
                <span className="font-black text-gray-700 text-sm">{row.probability}</span>
              </div>
            </div>
            
            <div className="bg-blue-50/30 p-3 rounded-xl border border-blue-100/50">
              <h4 className="text-[10px] font-bold text-blue-400 uppercase mb-1 tracking-wider text-left">개선 대책</h4>
              <p className="text-xs text-gray-700 leading-relaxed break-all text-left">{row.countermeasure}</p>
            </div>
          </div>
        ))}

        {/* 모바일 근로자 서명란 표시 */}
        {showWorkerSignatures && (
          <div className="bg-white border-2 border-amber-100 rounded-2xl p-5 shadow-sm mt-6 animate-fadeIn">
            <h4 className="text-xs font-bold text-amber-500 mb-3 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              근로자 명단 및 서명
            </h4>
            <div className="space-y-3">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-1 border border-gray-100 rounded-lg p-2.5 bg-gray-50/50 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-bold">성명</span>
                    <div className="w-1/2 border-b border-gray-200"></div>
                  </div>
                  <div className="flex-1 border border-gray-100 rounded-lg p-2.5 bg-gray-50/50 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-bold">서명</span>
                    <div className="w-1/2 border-b border-gray-200"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 결과가 생성되었을 때 결과 영역으로 자동 스크롤
  useEffect(() => {
    if (finalAnalysis && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [finalAnalysis]);

  // 사용자가 있을 때 저장된 위험성평가 불러오기
  useEffect(() => {
    if (user) {
      loadSavedAssessments();
    }
  }, [user]);

  // 저장된 위험성평가 불러오기
  useEffect(() => {
    // 기존 코드 삭제 - 인증 관련 코드
  }, []);
  
  // Firestore에서 저장된 위험성평가 불러오기
  const loadSavedAssessments = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const q = query(
        collection(db, 'assessments'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const assessments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedAssessment[];
      
      setSavedAssessments(assessments);
    } catch (error) {
      console.error('위험성평가 불러오기 중 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 저장 다이얼로그 열기
  const openSaveDialog = () => {
    if (!finalAnalysis || editableTableData.length === 0) {
      alert('저장할 위험성평가 결과가 없습니다.');
      return;
    }
    
    setSaveTitle(`위험성평가 ${new Date().toLocaleDateString()}`);
    setShowSaveDialog(true);
  };
  
  // 위험성평가 저장 (Firebase)
  const saveAssessment = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!finalAnalysis || !editableTableData.length) {
      alert('저장에 필요한 데이터가 없습니다. 위험성평가 생성 후 다시 시도해주세요.');
      return;
    }
    
    try {
      setIsLoading(true);
      
      await addDoc(collection(db, 'assessments'), {
        title: saveTitle,
        createdAt: serverTimestamp(),
        tableData: editableTableData,
        tableHTML: finalAnalysis,
        userId: user.uid,
        approvalCount: approvalCount,
        showWorkerSignatures: showWorkerSignatures
      });
      
      alert('위험성평가가 성공적으로 저장되었습니다.');
      setShowSaveDialog(false);
      
      // 목록 업데이트를 위해 다시 불러오기
      loadSavedAssessments();
    } catch (error) {
      console.error('위험성평가 저장 중 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 위험성평가 생성 페이지 초기화 함수
  const resetAssessmentPage = () => {
    // 분석 항목 초기화 (첫 번째 항목만 남기고 비움)
    setAnalysisItems([
      { id: 1, image: null, imageUrl: null, analysis: null, loading: false, selectedRows: [], processName: '' }
    ]);
    
    // 최종 분석 결과 초기화
    setFinalAnalysis(null);
    
    // 테이블 데이터 초기화
    setEditableTableData([]);
    
    // 편집 모드 초기화
    setIsEditingFinal(false);
    
    // 신규 상태 초기화
    setShowInitialMenu(true);
    setGenerationType(null);
    setTextProcesses(['']);
    setCurrentTextProcessIndex(0);
    setIsGeneratingFromText(false);
    setGeneralInfo('');
    setIsEnteringGeneralInfo(false);
    setSiteType('');
    setWorkTypes([]);
    setIsSelectingSiteType(false);
    setIsSelectingWorkType(false);
    
    // 각종 상태 초기화
    setIsGeneratingFinal(false);
    setIsRequestingAdditional(false);
    setAdditionalAnalysisIndex(null);
    
    // 메인 화면 전환은 호출하는 측에서 처리하도록 수정
    // setCurrentView('main');
    
    // 화면 최상단으로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    console.log('위험성평가 생성 페이지가 초기화되었습니다.');
  };
  
  // 저장된 위험성평가 삭제
  const deleteAssessment = async (id: string) => {
    if (confirm('정말로 이 위험성평가 결과를 삭제하시겠습니까?')) {
      try {
        setIsLoading(true);
        
        await deleteDoc(doc(db, 'assessments', id));
        
        // 로컬 상태 업데이트
        const updatedAssessments = savedAssessments.filter(item => item.id !== id);
        setSavedAssessments(updatedAssessments);
        
        // 상세 보기 화면에서 삭제한 경우 목록 화면으로 돌아가기
        if (selectedAssessment && selectedAssessment.id === id) {
          changeView('saved');
          setSelectedAssessment(null);
        }
        
        alert('위험성평가 결과가 삭제되었습니다.');
      } catch (error) {
        console.error('삭제 중 오류 발생:', error);
        alert('위험성평가 결과 삭제에 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  // 저장된 위험성평가 상세 보기
  const viewAssessment = (assessment: SavedAssessment) => {
    setSelectedAssessment(assessment);
    changeView('detail');
    
    // 편집 가능한 테이블 데이터 설정
    setEditableTableData(assessment.tableData);
    setFinalAnalysis(assessment.tableHTML);
  };
  
  // 위험성평가 화면으로 돌아가기
  const goBackToMain = () => {
    // 상세 화면(detail)에서 메인 화면으로 가는 경우만 초기화
    // 저장된 위험성평가 보기(saved)에서 메인 화면으로 가는 경우는 초기화하지 않음
    if (currentView === 'detail') {
      resetAssessmentPage();
    }
    changeView('main');
    setSelectedAssessment(null);
  };
  
  // 저장된 위험성평가 목록으로 돌아가기
  const goBackToSaved = () => {
    changeView('saved');
    setSelectedAssessment(null);
  };
  
  const handleImageUpload = async (file: File, itemId: number) => {
    // 새로운 이미지 파일이 없으면 함수 종료
    if (!file) return;

    // 임시 파일과 아이템 ID 저장 후 모달 표시
    setTempImageFile(file);
    setTempItemId(itemId);
    setProcessNameInput(''); // 입력 필드 초기화
    
    // 모달 표시
    setShowProcessNameModal(true);
  };
  
  // 공정/장비 명칭 입력 후 이미지 분석 처리
  const handleProcessNameSubmit = async () => {
    if (!tempImageFile || tempItemId === null || !processNameInput.trim()) {
      alert('공정 또는 장비의 명칭을 입력해주세요.');
      return;
    }
    
    // 모달 닫기
    setShowProcessNameModal(false);
    
    let file = tempImageFile;
    const itemId = tempItemId;
    const processName = processNameInput.trim();

    // 이미지 압축 처리 (최대 1600px, 품질 0.7)
    try {
      const compressed = await compressImage(file, 1600, 1600, 0.7);
      if (compressed instanceof File || compressed instanceof Blob) {
        // Blob일 경우 File로 변환 시도
        if (!(compressed instanceof File)) {
          file = new File([compressed], tempImageFile.name, { type: 'image/jpeg' });
        } else {
          file = compressed;
        }
        console.log(`압축 전: ${(tempImageFile.size / 1024 / 1024).toFixed(2)}MB, 압축 후: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      }
    } catch (e) {
      console.error('이미지 압축 중 오류:', e);
      // 압축 실패 시 원본 파일 사용
    }
    
    // 해당 항목의 상태 업데이트
    setAnalysisItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId 
          ? { ...item, image: file, imageUrl: URL.createObjectURL(file), loading: true, analysis: null, selectedRows: [], processName: processName } 
          : item
      )
    );

    try {
      // 요청 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 50000); // 50초 타임아웃
      
      const formData = new FormData();
      formData.append('image', file);
      formData.append('processName', processName);
      formData.append('assessmentMethod', assessmentMethod);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      // 타이머 해제
      clearTimeout(timeoutId);

      // 응답 확인
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '이미지 분석 중 오류가 발생했습니다.');
      }

      // 응답 데이터 파싱
      const data = await response.json();
      
      // 분석 결과가 없으면 에러 처리
      if (!data.analysis) {
        throw new Error('분석 결과를 받지 못했습니다.');
      }
      
      // 분석 결과 업데이트
      setAnalysisItems(prevItems => 
        prevItems.map(item => 
          item.id === itemId 
            ? { ...item, analysis: data.analysis, loading: false } 
            : item
        )
      );
    } catch (error: any) {
      console.error('이미지 분석 오류:', error);
      
      // 타임아웃 오류 특별 처리
      if (error.name === 'AbortError') {
        alert('이미지 분석 시간이 초과되었습니다. 이미지 크기를 줄이거나 다른 이미지를 시도해 보세요.');
      } else {
        alert(`이미지 분석 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
      }
      
      // 오류 상태 업데이트
      setAnalysisItems(prevItems => 
        prevItems.map(item => 
          item.id === itemId 
            ? { ...item, analysis: null, loading: false } 
            : item
        )
      );
    }
  };

  // 새 분석 항목 추가
  const addNewAnalysisItem = () => {
    const newId = Math.max(...analysisItems.map(item => item.id), 0) + 1;
    setAnalysisItems([...analysisItems, { id: newId, image: null, imageUrl: null, analysis: null, loading: false, selectedRows: [], processName: '' }]);
  };
  
  // 분석 항목 삭제
  const removeAnalysisItem = (itemId: number) => {
    // 항목이 하나만 있으면 삭제하지 않음
    if (analysisItems.length <= 1) {
      alert('최소 하나의 이미지 분석 항목이 필요합니다.');
      return;
    }
    
    // 사용자 확인
    if (window.confirm('이 분석 항목을 삭제하시겠습니까?')) {
      // 해당 ID의 항목을 제외한 새 배열 생성
      setAnalysisItems(prevItems => prevItems.filter(item => item.id !== itemId));
    }
  };
  
  // 선택된 행 업데이트 처리
  const handleSelectionChange = (itemId: number, selectedRows: string[]) => {
    setAnalysisItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId 
          ? { ...item, selectedRows } 
          : item
      )
    );
  };

  // 텍스트 기반 위험성평가 생성
  const generateAssessmentFromText = async () => {
    if (textProcesses.every(p => !p.trim())) {
      alert('최소 하나의 예상 위험을 입력해주세요.');
      return;
    }

    setIsGeneratingFromText(true);
    setIsGeneratingFinal(true);

    try {
      const formData = new FormData();
      formData.append('processNames', JSON.stringify(textProcesses.filter(p => p.trim())));
      formData.append('generalInfo', generalInfo);
      formData.append('siteType', siteType);
      formData.append('workTypes', JSON.stringify(workTypes));
      formData.append('assessmentMethod', assessmentMethod);
      formData.append('severityLevels', JSON.stringify(assessmentMethod === '5x5' ? 5 : 3));
      formData.append('probabilityLevels', JSON.stringify(assessmentMethod === '5x5' ? 5 : 3));
      formData.append('images', JSON.stringify([]));
      formData.append('riskMatrix', JSON.stringify({}));

      const response = await fetch('/api/risk-assessment', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('위험성평가 생성 중 오류가 발생했습니다.');
      }

      const data = await response.json();
      const tableHTML = generateTableHTML(data.tableData, approvalCount, showWorkerSignatures);
      setFinalAnalysis(tableHTML);
      setEditableTableData(data.tableData);
      
      // 성공 토스트 표시
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
      
    } catch (error) {
      console.error('Text analysis error:', error);
      alert('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsGeneratingFromText(false);
      setIsGeneratingFinal(false);
    }
  };
  
  // 근로자 서명란 토글
  const toggleWorkerSignatures = () => {
    const nextState = !showWorkerSignatures;
    setShowWorkerSignatures(nextState);
    const newHTML = generateTableHTML(editableTableData, approvalCount, nextState);
    setFinalAnalysis(newHTML);
  };

  // 결재칸 수 선택 처리
  const handleApprovalCountSelect = (count: number) => {
    setApprovalCount(count);
    setShowApprovalSelect(false);
    const newHTML = generateTableHTML(editableTableData, count, showWorkerSignatures);
    setFinalAnalysis(newHTML);
  };

  // 선택된 항목들을 모아서 테이블로 표시 (API 호출 없이 직접 생성)
  const generateFinalAnalysis = () => {
    // 선택된 모든 행 수집
    const allSelectedRows = analysisItems.flatMap((item, index) => 
      item.selectedRows.map(row => ({
        row,
        processName: item.processName,
        itemIndex: index
      }))
    );
    
    if (allSelectedRows.length === 0) {
      alert('선택된 위험 요소가 없습니다. 하나 이상의 항목을 선택해주세요.');
      return;
    }
    
    setIsGeneratingFinal(true);
    
    try {
      // 선택된 행 데이터를 파싱하여 테이블 데이터로 변환
      const tableData = allSelectedRows.map(({row, processName}) => {
        const [riskFactor, severity, probability, riskLevel, countermeasure] = row.split('|');
        return {
          processName: processName || '',
          riskFactor: riskFactor || '',
          severity: severity || '',
          probability: probability || '',
          riskLevel: riskLevel || '',
          countermeasure: countermeasure || ''
        };
      });
      
      // 최종 테이블 설정
      const tableHTML = generateTableHTML(tableData, approvalCount, showWorkerSignatures);
      setFinalAnalysis(tableHTML);
      
      // 편집 가능한 테이블 데이터 설정
      setEditableTableData(tableData);
      
      // 성공 토스트 표시
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
      
    } catch (error) {
      console.error('최종 위험성평가표 생성 오류:', error);
      alert('최종 위험성평가표 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsGeneratingFinal(false);
    }
  };

  // 최종 위험성평가표 수정 모드 전환
  const toggleEditMode = () => {
    if (!isEditingFinal) {
      // 수정 모드로 전환할 때 HTML에서 테이블 데이터 추출
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = finalAnalysis || '';
      
      // 결재칸이 추가되었을 경우를 대비하여 본문 테이블을 정확히 찾기 위해 .main-assessment-table 클래스 사용
      const table = tempDiv.querySelector('.main-assessment-table') || tempDiv.querySelector('table');
      if (!table) {
        // 만약 테이블을 찾을 수 없다면 기존에 가지고 있던 editableTableData를 그대로 유지 (초기화 방지)
        if (editableTableData && editableTableData.length > 0) {
          setIsEditingFinal(true);
          return;
        }
        return;
      }
      
      const tbody = table.querySelector('tbody');
      if (!tbody) {
        if (editableTableData && editableTableData.length > 0) {
          setIsEditingFinal(true);
          return;
        }
        return;
      }
      
      const rows = tbody.querySelectorAll('tr');
      const extractedData = Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        
        return {
          processName: cells[0]?.textContent?.trim() || '',
          riskFactor: cells[1]?.textContent?.trim() || '',
          severity: cells[2]?.textContent?.trim() || '',
          probability: cells[3]?.textContent?.trim() || '',
          riskLevel: cells[4]?.textContent?.trim() || '',
          countermeasure: cells[5]?.textContent?.trim() || ''
        };
      });
      
      setEditableTableData(extractedData);
    } else {
      // 수정 모드에서 나갈 때 변경사항 적용
      applyTableChanges();
    }
    
    setIsEditingFinal(!isEditingFinal);
  };
  
  // 테이블 데이터 수정 처리
  const handleTableDataChange = (index: number, field: string, value: string) => {
    setEditableTableData(prevData => {
      const newData = [...prevData];
      newData[index] = {
        ...newData[index],
        [field]: value
      };
      return newData;
    });
  };
  
  // 테이블 행 추가
  const addTableRow = () => {
    setEditableTableData(prevData => [
      ...prevData, 
      {
        processName: '',
        riskFactor: '',
        severity: '',
        probability: '',
        riskLevel: '',
        countermeasure: ''
      }
    ]);
  };
  
  // 테이블 행 삭제
  const removeTableRow = (index: number) => {
    setEditableTableData(prevData => 
      prevData.filter((_, i) => i !== index)
    );
  };
  
  // 수정된 테이블 변경사항 적용
  const applyTableChanges = () => {
    // 수정된 데이터로 HTML 테이블 생성
    const tableHTML = generateTableHTML(editableTableData, approvalCount, showWorkerSignatures);
    setFinalAnalysis(tableHTML);
  };

  // 위험성평가 추가 요청 함수 수정
  const requestAdditionalAssessment = async () => {
    // 이미 요청 중이면 중복 실행 방지
    if (isRequestingAdditional) {
      return;
    }
    
    setIsRequestingAdditional(true);
    
    // 기존 항목이 없는 경우 확인
    if (!analysisItems.some(item => item.analysis && !item.loading)) {
      alert('기존 분석 결과가 없습니다. 이미지를 먼저 분석해주세요.');
      setIsRequestingAdditional(false);
      return;
    }
    
    // 마지막 분석 항목 찾기
    const lastItemIndex = analysisItems.length - 1;
    const lastItem = analysisItems[lastItemIndex];
    
    // 추가 분석 중인 항목 인덱스 설정
    setAdditionalAnalysisIndex(lastItemIndex);
    
    try {
      console.log('추가 위험성평가 요청 시작...');
      
      // 분석 항목 중 실제 데이터가 있는 항목만 필터링
      const validItems = analysisItems.filter(item => 
        item.analysis && typeof item.analysis === 'string' && !item.loading
      );
      
      // 요청 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초 타임아웃 (서버 타임아웃보다 길게)
      
      try {
        const response = await fetch('/api/additional-assessment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            analysisItems: validItems,
          }),
          signal: controller.signal
        });
        
        // 타이머 해제
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // 응답 파싱 시도
          const errorData = await response.json().catch(() => ({ error: `HTTP 오류: ${response.status}` }));
          throw new Error(errorData.error || `HTTP 오류: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 응답 데이터 유효성 검사
        if (!data.additionalItems || !data.additionalItems.length) {
          throw new Error('유효한 응답 데이터가 없습니다');
        }
        
        if (!data.additionalItems[0].analysis) {
          throw new Error('분석 결과가 비어있습니다');
        }
      
        console.log('추가 위험성평가 응답 수신 완료');
        
        // 마지막 항목의 분석 결과에 새로운 위험성평가 결과 추가
        setAnalysisItems(prevItems => {
          const updatedItems = [...prevItems];
          const lastItemIndex = updatedItems.length - 1;
          const additionalAnalysis = data.additionalItems[0].analysis;
          
          // 기존 테이블에 추가 분석 결과를 병합
          if (updatedItems[lastItemIndex].analysis && additionalAnalysis) {
            try {
              // HTML 파싱을 위한 임시 div 생성
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = updatedItems[lastItemIndex].analysis;
              const existingTable = tempDiv.querySelector('table');
              
              // 추가 분석 결과에서 테이블 행 추출
              const additionalDiv = document.createElement('div');
              additionalDiv.innerHTML = additionalAnalysis;
              const additionalTable = additionalDiv.querySelector('table');
              
              if (existingTable && additionalTable) {
                const additionalRows = additionalTable.querySelectorAll('tbody tr');
                
                // 기존 테이블의 tbody에 추가 행 삽입
                const existingTbody = existingTable.querySelector('tbody');
                if (existingTbody && additionalRows.length > 0) {
                  additionalRows.forEach(row => {
                    existingTbody.appendChild(row.cloneNode(true));
                  });
                  
                  // 업데이트된 테이블로 HTML 업데이트
                  updatedItems[lastItemIndex].analysis = tempDiv.innerHTML;
                  console.log(`${additionalRows.length}개의 행이 기존 테이블에 추가됨`);
                } else {
                  console.warn('테이블 요소를 찾을 수 없거나 추가 행이 없습니다. 결과를 추가합니다.');
                  updatedItems[lastItemIndex].analysis += `<hr class="my-4" /><h3 class="text-lg font-semibold mb-2">추가 위험성평가:</h3>${additionalAnalysis}`;
                }
              } else {
                // 테이블이 없는 경우 분석 결과 연결
                updatedItems[lastItemIndex].analysis += `<hr class="my-4" /><h3 class="text-lg font-semibold mb-2">추가 위험성평가:</h3>${additionalAnalysis}`;
              }
            } catch (parseError) {
              console.error('HTML 파싱 오류:', parseError);
              updatedItems[lastItemIndex].analysis += `<hr class="my-4" /><h3 class="text-lg font-semibold mb-2">추가 위험성평가:</h3>${additionalAnalysis}`;
            }
          } else if (additionalAnalysis) {
            // 기존 분석이 없는 경우 새 분석으로 설정
            updatedItems[lastItemIndex].analysis = additionalAnalysis;
          }
          
          // processName 전달
          if (data.additionalItems[0].processName) {
            updatedItems[lastItemIndex].processName = data.additionalItems[0].processName;
          }
          
          return updatedItems;
        });
      } catch (fetchError: any) {
        console.error('네트워크 오류:', fetchError);
        throw new Error(fetchError.name === 'AbortError' 
          ? '요청 시간이 초과되었습니다. 서버 응답이 지연되고 있습니다.' 
          : fetchError.message);
      }
      
      // 추가 분석 완료 후 상태 업데이트
      setIsRequestingAdditional(false);
      setAdditionalAnalysisIndex(null);
      
    } catch (error: any) {
      console.error('추가 위험성평가 오류:', error);
      
      // 오류 메시지 처리
      let errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
      
      // 특정 오류 패턴 확인 및 처리
      if (errorMessage.includes('timeout') || errorMessage.includes('시간 초과')) {
        errorMessage = '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
      } else if (errorMessage.includes('network') || errorMessage.includes('네트워크')) {
        errorMessage = '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.';
      }
      
      // 사용자에게 알림
      alert(`추가 위험성평가 중 오류가 발생했습니다: ${errorMessage}`);
      
      // 오류 상태를 분석 결과에 표시
      setAnalysisItems(prevItems => {
        const updatedItems = [...prevItems];
        const lastIndex = prevItems.findIndex(item => item.id === (additionalAnalysisIndex !== null 
          ? prevItems[additionalAnalysisIndex].id 
          : Math.max(...prevItems.map(i => i.id))));
        
        if (lastIndex >= 0 && updatedItems[lastIndex].analysis) {
          updatedItems[lastIndex].analysis += `
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mt-4" role="alert">
            <p class="font-medium">추가 위험성평가 오류</p>
            <p class="text-sm">${errorMessage}</p>
            <p class="text-sm mt-1">다시 시도하려면 '위험성평가 추가요청' 버튼을 클릭하세요.</p>
          </div>`;
        }
        
        return updatedItems;
      });
      
      // 오류 발생 시에도 상태 초기화
      setIsRequestingAdditional(false);
      setAdditionalAnalysisIndex(null);
    }
  };

  // 현재 화면 변경 함수 - 이전 화면 상태 추적 추가
  const changeView = (newView: 'main' | 'saved' | 'detail') => {
    setPreviousView(currentView);
    setCurrentView(newView);
  };

  // 저장된 위험성평가 편집 모드 토글
  const toggleSavedEditMode = () => {
    if (!isEditingSaved) {
      // 수정 모드로 전환할 때 HTML에서 테이블 데이터 추출
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = selectedAssessment?.tableHTML || '';
      
      const table = tempDiv.querySelector('table');
      if (!table) return;
      
      const tbody = table.querySelector('tbody');
      if (!tbody) return;
      
      const rows = tbody.querySelectorAll('tr');
      const extractedData = Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        
        return {
          processName: cells[0]?.textContent?.trim() || '',
          riskFactor: cells[1]?.textContent?.trim() || '',
          severity: cells[2]?.textContent?.trim() || '',
          probability: cells[3]?.textContent?.trim() || '',
          riskLevel: cells[4]?.textContent?.trim() || '',
          countermeasure: cells[5]?.textContent?.trim() || ''
        };
      });
      
      setEditableTableData(extractedData);
    } else {
      // 수정 모드에서 나갈 때 변경사항 적용
      applyTableChanges();
    }
    
    setIsEditingSaved(!isEditingSaved);
  };

  // 수정된 위험성평가 업데이트
  const updateAssessment = async () => {
    alert('기능 미구현: 인증 연결이 필요합니다.');
    return;
    
    // 기존 코드 주석 처리
    /*
    if (!selectedAssessment || !editableTableData.length) {
      console.error('업데이트에 필요한 데이터 미비:', {
        selectedAssessment: !!selectedAssessment,
        editableTableData: editableTableData.length
      });
      alert('업데이트에 필요한 데이터가 없습니다.');
      return;
    }
    
    // ... 나머지 파이어베이스 관련 코드 삭제
    */
  };

  // 위험성추정 기준 모달 열기/닫기 함수
  const toggleCriteriaModal = () => {
    setShowCriteriaModal(!showCriteriaModal);
  };

  // 공정/장비 명칭 입력 모달 취소 처리
  const handleProcessNameCancel = () => {
    // 모달 닫기
    setShowProcessNameModal(false);
    
    // 임시 파일 초기화
    setTempImageFile(null);
    
    // 해당 항목의 image 상태 초기화
    if (tempItemId !== null) {
      setAnalysisItems(prevItems => 
        prevItems.map(item => 
          item.id === tempItemId 
            ? { ...item, image: null, imageUrl: null }
            : item
        )
      );
    }
    
    // 기타 임시 상태 초기화
    setTempItemId(null);
    setProcessNameInput('');
  };

  // 쿠팡 파트너스 배너 관리
  const bannerContainerRef = useRef<HTMLDivElement>(null);
  const [bannerInitialized, setBannerInitialized] = useState(false);
  
  // 배너 초기화 함수 - 정적 이미지를 사용하므로 사용하지 않음
  const initializeBanner = useCallback(() => {
    console.log('정적 배너를 사용하므로 동적 초기화는 실행되지 않음');
  }, []);
  
  // 컴포넌트 마운트 시 배너 초기화 - 정적 이미지를 사용하므로 불필요
  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.log('정적 배너 사용 중');
  }, []);
  
  // 화면 전환 시 배너 재초기화
  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.log('정적 배너 유지됨');
  }, [currentView]);
  
  // 라우터 이벤트 감지 - 정적 이미지를 사용하므로 불필요
  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.log('정적 배너는 라우터 이벤트에 영향 없음');
  }, []);

  useEffect(() => {
    // URL이 변경될 때마다 실행
    return () => {
      // 클린업 함수 (필요한 경우 추가 로직)
    };
  }, [pathname, searchParams]); // pathname, searchParams가 변경될 때마다 useEffect 실행

  useEffect(() => {
    return () => {
      // 필요한 경우 클린업 로직 추가
    };
  }, []);

  // 모바일 환경 감지를 위한 useEffect 추가
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // 초기 화면 크기 확인
    const checkIfMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    // 초기 실행
    checkIfMobile();
    
    // 화면 크기 변경 시 감지
    window.addEventListener('resize', checkIfMobile);
    
    // 클린업 함수
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  return (
    <WorkspaceShell
      serviceHref="/assessment"
      title="스마트 위험성 평가"
      description="사진과 텍스트를 기반으로 위험 요인을 분석하고, 체계적인 위험성평가표를 즉시 생성합니다."
    >
      <div>
        <div className="w-full min-w-0">
          <div className={`mb-6 flex flex-wrap items-center justify-between gap-4 ${isInputStep && isMobileView ? 'hidden' : ''}`}>
            <div className={`flex flex-nowrap items-center gap-1.5 md:gap-3 no-scrollbar ${showMethodDropdown ? 'overflow-visible' : 'overflow-x-auto'}`}>
              {/* 빈도/강도 수정 드롭다운 버튼 */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowMethodDropdown(!showMethodDropdown)}
                  className="h-8 md:h-9 px-3 md:px-4 bg-white border border-slate-200 rounded-full text-[10px] md:text-xs font-black text-slate-700 hover:text-blue-600 hover:border-blue-100 transition-all duration-300 shadow-sm flex items-center gap-1 md:gap-1.5"
                >
                  <span>빈도강도법: {assessmentMethod}</span>
                  <svg className={`w-2.5 h-2.5 md:w-3 md:h-3 transition-transform duration-300 ${showMethodDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                
                {showMethodDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-[60]" 
                      onClick={() => setShowMethodDropdown(false)}
                    ></div>
                    <div className="absolute top-full left-0 mt-2 w-24 md:w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-[70] animate-fadeIn">
                      <button
                        onClick={() => {
                          setAssessmentMethod('3x3');
                          setShowMethodDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-[10px] md:text-sm font-bold hover:bg-blue-50 transition-colors ${assessmentMethod === '3x3' ? 'text-blue-600 bg-blue-50/50' : 'text-gray-600'}`}
                      >
                        3x3 방식
                      </button>
                      <button
                        onClick={() => {
                          setAssessmentMethod('5x5');
                          setShowMethodDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-[10px] md:text-sm font-bold hover:bg-blue-50 transition-colors ${assessmentMethod === '5x5' ? 'text-blue-600 bg-blue-50/50' : 'text-gray-600'}`}
                      >
                        5x5 방식
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={toggleCriteriaModal}
                className="h-8 md:h-9 px-3 md:px-4 bg-white border border-slate-200 rounded-full text-[10px] md:text-xs font-black text-slate-500 hover:text-blue-600 hover:border-blue-100 transition-all duration-300 shadow-sm flex items-center gap-1 md:gap-1.5 shrink-0"
              >
                <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span className="whitespace-nowrap">추정 기준표</span>
              </button>
            </div>
          </div>
          
          {/* 위험성평가 생성 화면 - 모바일 대응 개선 */}
          {currentView === 'main' && (
            <>
              {showInitialMenu ? (
                <div className="bg-white rounded-xl md:rounded-[2.5rem] shadow-md md:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.05)] overflow-hidden mb-8 md:mb-16 border border-gray-50 p-6 md:p-16 text-center">
                  {isSelectingSiteType ? (
                    <div className="max-w-4xl mx-auto">
                      <h2 className="text-xl md:text-3xl font-black text-gray-900 mb-6 md:mb-8">사업장의 종류를 선택해주세요</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                        {['건설업', '제조업', '서비스업', '사무직', '운수/창고업', '기타'].map((type) => (
                          <button
                            key={type}
                            onClick={() => {
                              setSiteType(type);
                              setIsSelectingSiteType(false);
                              setIsSelectingWorkType(true);
                            }}
                            className="p-4 md:p-6 bg-gray-50 border-2 border-gray-100 rounded-xl md:rounded-2xl hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 font-bold transition-all text-sm md:text-base"
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={() => {
                          setIsSelectingSiteType(false);
                          setGenerationType('text');
                        }}
                        className="mt-8 text-gray-400 hover:text-gray-600 font-bold flex items-center justify-center mx-auto gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        이전으로
                      </button>
                    </div>
                  ) : isSelectingWorkType ? (
                    <div className="max-w-4xl mx-auto">
                      <h2 className="text-xl md:text-3xl font-black text-gray-900 mb-6 md:mb-8 text-center md:text-left leading-tight">작업의 종류를 선택해주세요<br className="md:hidden" /><span className="text-sm md:text-xl text-blue-600 md:ml-3">(중복 선택 가능)</span></h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                        {(siteType === '건설업' ? ['토공사', '골조공사', '마감공사', '전기/설비공사', '도장공사', '기타'] :
                          siteType === '제조업' ? ['금속가공', '조립라인', '용접작업', '포장/물류', '기계정비', '기타'] :
                          siteType === '서비스업' ? ['시설관리', '청소/방역', '조리/식당', '판매/영업', '배송/배달', '기타'] :
                          siteType === '사무직' ? ['일반사무', 'IT/컴퓨터', '고객응대', '기획/설계', '안전 관리', '기타'] :
                          ['상하차', '창고관리', '운전/운송', '장비운용', '기타']).map((type) => {
                          const isSelected = workTypes.includes(type);
                          return (
                            <button
                              key={type}
                              onClick={() => {
                                if (isSelected) {
                                  setWorkTypes(workTypes.filter(t => t !== type));
                                } else {
                                  setWorkTypes([...workTypes, type]);
                                }
                              }}
                              className={`p-4 md:p-6 border-2 rounded-xl md:rounded-2xl font-bold transition-all text-sm md:text-base flex items-center justify-center gap-2 ${
                                isSelected 
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' 
                                  : 'bg-gray-50 border-gray-100 text-gray-900 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600'
                              }`}
                            >
                              {type}
                              {isSelected && (
                                <svg className="w-4 h-4 md:w-5 md:h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      
                      <div className="flex flex-col md:flex-row gap-3 md:gap-4 mt-8 md:mt-12">
                        <button 
                          onClick={() => {
                            setIsSelectingWorkType(false);
                            setIsSelectingSiteType(true);
                          }}
                          className="flex-1 px-6 py-4 md:px-8 md:py-5 bg-gray-100 text-gray-600 rounded-xl md:rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                          </svg>
                          이전으로
                        </button>
                        <button 
                          onClick={() => {
                            if (workTypes.length === 0) {
                              alert('최소 하나 이상의 작업 종류를 선택해주세요.');
                              return;
                            }
                            setIsSelectingWorkType(false);
                            setIsEnteringGeneralInfo(true);
                          }}
                          className={`flex-[2] px-6 py-4 md:px-8 md:py-5 rounded-xl md:rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-sm md:text-base ${
                            workTypes.length > 0
                              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          다음 단계로 (일반 사항 입력)
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : isEnteringGeneralInfo ? (
                    <div className="max-w-3xl mx-auto">
                      <h2 className="text-xl md:text-3xl font-black text-gray-900 mb-4 text-left">일반적인 사항을 입력해주세요</h2>
                      <div className="flex flex-wrap gap-1.5 md:gap-2 mb-4 md:mb-6">
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg md:rounded-full text-[10px] md:text-sm font-bold">{siteType}</span>
                        {workTypes.map(type => (
                          <span key={type} className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg md:rounded-full text-[10px] md:text-sm font-bold">{type}</span>
                        ))}
                      </div>
                      <p className="text-gray-500 mb-6 md:mb-8 text-xs md:text-base text-left leading-relaxed">전반적인 상황이나 공통적인 안전 수칙 등을 입력하시면 분석에 반영됩니다.</p>
                      
                      <textarea
                        value={generalInfo}
                        onChange={(e) => setGeneralInfo(e.target.value)}
                        className="w-full h-40 md:h-48 p-4 md:p-6 bg-gray-50 border-2 border-gray-100 rounded-2xl md:rounded-[2rem] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none text-gray-700 text-base md:text-lg leading-relaxed placeholder-gray-300 transition-all mb-6 md:mb-8 shadow-inner"
                        placeholder={`예: ${dynamicPlaceholder.general}`}
                      ></textarea>
                      
                      <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                        <button 
                          onClick={() => {
                            setIsEnteringGeneralInfo(false);
                            setIsSelectingWorkType(true);
                          }}
                          className="flex-1 px-6 py-4 md:px-8 md:py-5 bg-gray-100 text-gray-600 rounded-xl md:rounded-2xl font-bold hover:bg-gray-200 transition-all text-sm md:text-base"
                        >
                          이전으로
                        </button>
                        <button 
                          onClick={() => {
                            setShowInitialMenu(false);
                            setIsEnteringGeneralInfo(false);
                          }}
                          className="flex-[2] px-6 py-4 md:px-8 md:py-5 bg-blue-600 text-white rounded-xl md:rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                          다음 단계로 (위험 상황 입력)
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : !generationType ? (
                    <div className="max-w-4xl mx-auto">
                      <h2 className="text-xl md:text-3xl font-black text-gray-900 mb-6 md:mb-10">어떤 방식으로<br className="md:hidden" /> 위험성평가를 생성할까요?</h2>
                      <div className="flex flex-col md:flex-row gap-4 md:gap-8 justify-center">
                        <button
                          onClick={() => setGenerationType('photo')}
                          className="flex-1 p-5 md:p-10 bg-blue-50 border-2 border-blue-200 rounded-2xl md:rounded-[2.5rem] hover:bg-blue-100 transition-all group flex flex-row md:flex-col items-center gap-4 md:gap-0"
                        >
                          <div className="bg-white w-12 h-12 md:w-20 md:h-20 rounded-xl md:rounded-3xl flex items-center justify-center shrink-0 md:mx-auto md:mb-6 shadow-sm group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 md:w-10 md:h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div className="text-left md:text-center">
                            <h3 className="text-base md:text-2xl font-black text-gray-900 mb-1 md:mb-3">사진으로 위험성평가</h3>
                            <p className="text-gray-500 text-[10px] md:text-sm font-medium leading-tight">사진 분석 기반</p>
                          </div>
                        </button>
                        <button
                          onClick={() => setGenerationType('text')}
                          className="flex-1 p-5 md:p-10 bg-indigo-50 border-2 border-indigo-200 rounded-2xl md:rounded-[2.5rem] hover:bg-indigo-100 transition-all group flex flex-row md:flex-col items-center gap-4 md:gap-0"
                        >
                          <div className="bg-white w-12 h-12 md:w-20 md:h-20 rounded-xl md:rounded-3xl flex items-center justify-center shrink-0 md:mx-auto md:mb-6 shadow-sm group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 md:w-10 md:h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </div>
                          <div className="text-left md:text-center">
                            <h3 className="text-base md:text-2xl font-black text-gray-900 mb-1 md:mb-3">사진 없이 위험성평가</h3>
                            <p className="text-gray-500 text-[10px] md:text-sm font-medium leading-tight">예상 위험 설명 기반</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl md:text-3xl font-black text-gray-900 mb-6 md:mb-10">평가 방식을 선택해주세요</h2>
                      <div className="flex flex-col md:flex-row gap-4 md:gap-8 justify-center">
                        <button
                          onClick={() => {
                            setAssessmentMethod('3x3');
                            if (generationType === 'text') {
                              setIsSelectingSiteType(true);
                            } else {
                              setShowInitialMenu(false);
                            }
                          }}
                          className="flex-1 p-5 md:p-10 bg-emerald-50 border-2 border-emerald-200 rounded-2xl md:rounded-[2.5rem] hover:bg-emerald-100 transition-all group flex flex-col items-center"
                        >
                          <h3 className="text-xl md:text-3xl font-black text-emerald-700 mb-1 md:mb-2">3 x 3</h3>
                          <p className="text-emerald-600 font-bold mb-2 md:mb-4 italic text-[10px] md:text-base">중대성(3) x 가능성(3)</p>
                          <p className="text-gray-500 text-[10px] md:text-sm font-medium leading-tight">소규모 사업장에 적합한<br className="md:hidden" /> 간소화된 방식</p>
                        </button>
                        <button
                          onClick={() => {
                            setAssessmentMethod('5x5');
                            if (generationType === 'text') {
                              setIsSelectingSiteType(true);
                            } else {
                              setShowInitialMenu(false);
                            }
                          }}
                          className="flex-1 p-5 md:p-10 bg-violet-50 border-2 border-violet-200 rounded-2xl md:rounded-[2.5rem] hover:bg-violet-100 transition-all group flex flex-col items-center"
                        >
                          <h3 className="text-xl md:text-3xl font-black text-violet-700 mb-1 md:mb-2">5 x 5</h3>
                          <p className="text-violet-600 font-bold mb-2 md:mb-4 italic text-[10px] md:text-base">중대성(5) x 가능성(5)</p>
                          <p className="text-gray-500 text-[10px] md:text-sm font-medium leading-tight">정밀한 분석이 필요한<br className="md:hidden" /> 사업장에 권장</p>
                        </button>
                      </div>
                      <button 
                        onClick={() => setGenerationType(null)}
                        className="mt-8 text-gray-400 hover:text-gray-600 font-bold flex items-center justify-center mx-auto gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        이전으로
                      </button>
                    </>
                  )}
                </div>
              ) : generationType === 'photo' ? (
                <div className="bg-white rounded-xl md:rounded-[2.5rem] shadow-md md:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.05)] overflow-hidden mb-8 md:mb-16 border border-gray-50">
                  {analysisItems.map((item, index) => (
                    <div key={item.id} className={`${index > 0 ? 'border-t border-gray-100' : ''}`}>
                      <div className="p-4 md:p-12">
                        <div className="flex justify-between items-center mb-8 md:mb-12">
                          <h2 className="text-xl md:text-4xl font-black text-gray-900 flex items-center">
                            <span className="flex items-center justify-center w-8 h-8 md:w-14 md:h-14 bg-blue-600 text-white rounded-2xl md:rounded-[1.25rem] mr-3 md:mr-6 text-sm md:text-2xl shadow-lg shadow-blue-200">
                              {item.id}
                            </span>
                            이미지 분석
                            {item.processName && (
                              <span className="ml-3 md:ml-6 text-blue-600 font-black bg-blue-50 px-3 md:px-6 py-1 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-lg border border-blue-100">
                                {item.processName}
                              </span>
                            )}
                          </h2>
                          
                          {/* 항목이 비어있거나 여러 개 있는 경우에만 삭제 버튼 표시 */}
                          {(!item.analysis || analysisItems.length > 1) && (
                            <button
                              onClick={() => removeAnalysisItem(item.id)}
                              className="p-2 md:p-4 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl md:rounded-3xl transition-all duration-300 focus:outline-none"
                              title="이 분석 항목 삭제"
                            >
                              <svg className="w-5 h-5 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                        
                        <div className="flex flex-col xl:flex-row gap-8 md:gap-16">
                          {/* 왼쪽: 이미지 업로더 */}
                          <div className={`xl:w-[350px] shrink-0 ${item.analysis ? 'hidden md:block' : ''}`}>
                            <div className="bg-gray-50/50 rounded-2xl md:rounded-[2.5rem] p-4 md:p-10 border border-gray-100 shadow-inner sticky top-24">
                              <ImageUploader onImageUpload={(file) => handleImageUpload(file, item.id)} />
                            </div>
                          </div>
                          
                          {/* 오른쪽: 분석 결과 */}
                          <div className="flex-1 min-w-0">
                            {item.loading ? (
                              <div className="p-12 md:p-24 bg-gray-50/50 rounded-[2.5rem] border border-gray-100 text-center h-full flex flex-col justify-center items-center">
                                <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-10"></div>
                                <p className="text-xl md:text-3xl font-black text-gray-900 mb-3">분석 결과 생성 중</p>
                                <p className="text-gray-400 text-base md:text-lg">AI가 실시간으로 데이터를 가공하고 있습니다</p>
                              </div>
                            ) : item.analysis ? (
                              <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden relative shadow-sm">
                                <ImageAnalysis 
                                  analysis={item.analysis} 
                                  itemId={item.id}
                                  imageUrl={item.imageUrl}
                                  onSelectionChange={handleSelectionChange}
                                />
                                
                                {/* 추가 분석 중인 경우 오버레이 표시 */}
                                {isRequestingAdditional && additionalAnalysisIndex === index && (
                                  <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col justify-center items-center z-10 animate-fadeIn">
                                    <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-10"></div>
                                    <p className="text-2xl md:text-3xl font-black text-gray-900 mb-3">정밀 평가 추가 중</p>
                                    <p className="text-gray-500 text-lg">기존 데이터는 소중히 유지됩니다</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div 
                                className="p-12 md:p-24 bg-gray-50/50 rounded-[3rem] border border-gray-100 border-dashed text-center h-full flex flex-col justify-center items-center cursor-pointer hover:bg-gray-100/50 transition-all duration-500 group min-h-[400px]"
                                onClick={() => analysisItems.length > 1 ? removeAnalysisItem(item.id) : null}
                              >
                                <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-sm text-gray-200 mb-10 transform transition-all duration-700 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-xl group-hover:shadow-blue-50">
                                  <svg className="w-20 h-20 md:w-32 md:h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                  </svg>
                                </div>
                                <p className="text-xl md:text-3xl font-black text-gray-400 mb-4">
                                  {analysisItems.length > 1 ? "새 이미지를 업로드해 주세요" : "업로드 대기 중"}
                                </p>
                                <p className="text-gray-400 text-base md:text-xl font-medium max-w-sm mx-auto leading-relaxed">
                                  분석할 사진을 업로드하시면 즉시 상세 평가표가 작성됩니다
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* 마지막 항목이고, 분석 결과가 있을 때만 버튼들 표시 */}
                        {index === analysisItems.length - 1 && item.analysis && (
                          <div className="mt-12 md:mt-20 flex flex-col lg:flex-row justify-center gap-6 md:gap-8">
                            <button
                              onClick={addNewAnalysisItem}
                              className="group px-10 py-5 md:px-14 md:py-6 bg-white border-2 border-blue-600 text-blue-600 rounded-[2.5rem] font-black text-base md:text-xl hover:bg-blue-600 hover:text-white transition-all duration-500 shadow-xl shadow-blue-50 flex items-center justify-center gap-4 order-1 lg:order-2"
                            >
                              <svg className="w-6 h-6 md:w-8 md:h-8 transition-transform duration-500 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                              </svg>
                              항목 추가
                            </button>
                            <button
                              onClick={generateFinalAnalysis}
                              disabled={isGeneratingFinal}
                              className="px-10 py-5 md:px-14 md:py-6 bg-blue-600 text-white rounded-[2.5rem] font-black text-base md:text-xl hover:bg-blue-700 transition-all duration-500 shadow-[0_20px_50px_-10px_rgba(59,130,246,0.5)] flex items-center justify-center gap-4 disabled:opacity-50"
                            >
                              {isGeneratingFinal ? (
                                <div className="w-6 h-6 md:w-8 md:h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                              ) : (
                                <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                              )}
                              최종 결과표 발행
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="pb-12 text-center">
                    <button 
                      onClick={resetAssessmentPage}
                      className="text-gray-400 hover:text-gray-600 font-bold flex items-center justify-center mx-auto gap-2 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      처음으로 돌아가기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl md:rounded-[2.5rem] shadow-md md:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.05)] overflow-hidden mb-8 md:mb-16 border border-gray-50 p-5 md:p-16 text-left">
                  <div className="max-w-3xl mx-auto">
                    <div className="flex items-center justify-between mb-6 md:mb-8">
                      <h2 className="text-xl md:text-3xl font-black text-gray-900">예상되는 위험을<br className="md:hidden" /> 생각나는대로 작성해주세요</h2>
                      <div className="text-blue-600 font-bold bg-blue-50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-blue-100 text-xs md:text-base shrink-0">
                        {currentTextProcessIndex + 1} / {textProcesses.length}
                      </div>
                    </div>
                    
                    <textarea
                      value={textProcesses[currentTextProcessIndex]}
                      onChange={(e) => {
                        const newProcesses = [...textProcesses];
                        newProcesses[currentTextProcessIndex] = e.target.value;
                        setTextProcesses(newProcesses);
                      }}
                      placeholder={`예: ${dynamicPlaceholder.process}`}
                      className="w-full h-40 md:h-64 p-5 md:p-8 bg-gray-50 border-2 border-gray-100 rounded-2xl md:rounded-[2rem] text-base md:text-xl outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner mb-6 md:mb-8"
                    />
                    
                    <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                      <button
                        onClick={() => {
                          setTextProcesses([...textProcesses, '']);
                          setCurrentTextProcessIndex(textProcesses.length);
                        }}
                        className="flex-1 py-4 md:py-5 bg-white border-2 border-blue-600 text-blue-600 rounded-xl md:rounded-2xl font-black text-sm md:text-lg hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        예상위험 추가
                      </button>
                      
                      {textProcesses.length > 1 && (
                        <div className="flex gap-2">
                          <button
                            disabled={currentTextProcessIndex === 0}
                            onClick={() => setCurrentTextProcessIndex(prev => prev - 1)}
                            className="flex-1 p-4 md:p-5 bg-gray-100 text-gray-500 rounded-xl md:rounded-2xl disabled:opacity-30 flex items-center justify-center"
                          >
                            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            disabled={currentTextProcessIndex === textProcesses.length - 1}
                            onClick={() => setCurrentTextProcessIndex(prev => prev + 1)}
                            className="flex-1 p-4 md:p-5 bg-gray-100 text-gray-500 rounded-xl md:rounded-2xl disabled:opacity-30 flex items-center justify-center"
                          >
                            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      )}
                      
                      <button
                        onClick={generateAssessmentFromText}
                        disabled={isGeneratingFinal}
                        className="flex-[2] py-4 md:py-5 bg-blue-600 text-white rounded-xl md:rounded-2xl font-black text-sm md:text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isGeneratingFinal ? (
                          <div className="w-5 h-5 md:w-6 md:h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        결과 생성하기
                      </button>
                    </div>

                    <button 
                      onClick={resetAssessmentPage}
                      className="mt-12 text-gray-400 hover:text-gray-600 font-bold flex items-center justify-center mx-auto gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      처음으로 돌아가기
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* 모바일 전용 배너 (데스크톱에서는 숨김) */}
      <div className="lg:hidden mt-12 mb-8 animate-fadeIn">
      </div>
              
              {/* 최종 위험성평가표 표시 */}
              {finalAnalysis && (
                <div className="mb-16 animate-fadeIn" ref={resultsRef}>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-8 flex items-center gap-4 shadow-sm">
                    <div className="bg-emerald-500 text-white p-2 rounded-full">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-emerald-900 font-black text-lg">위험성평가표 생성 완료!</h3>
                      <p className="text-emerald-700 font-medium">AI가 분석한 최적의 안전 대책이 아래 표에 정리되었습니다.</p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-5 md:px-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                      <h2 className="text-xl md:text-2xl font-bold text-gray-800">위험성평가표 (최종)</h2>
                      <div className="flex flex-wrap gap-2 items-center">
                        {!isEditingFinal && (
                          <button
                            onClick={() => setShowApprovalSelect(true)}
                            className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-all flex items-center justify-center shadow-sm text-xs font-bold"
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            결재칸
                          </button>
                        )}

                        {!isEditingFinal && (
                          <button
                            onClick={toggleWorkerSignatures}
                            className={`px-3 py-1.5 ${showWorkerSignatures ? 'bg-amber-600' : 'bg-amber-500'} text-white rounded-lg hover:bg-amber-600 transition-all flex items-center justify-center shadow-sm text-xs font-bold`}
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            서명란
                          </button>
                        )}

                        <button
                          onClick={toggleEditMode}
                          className={`px-3 py-1.5 rounded-lg transition-all flex items-center justify-center shadow-sm text-xs font-bold ${isEditingFinal 
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                            : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isEditingFinal ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            )}
                          </svg>
                          {isEditingFinal ? '완료' : '수정'}
                        </button>

                        {!isEditingFinal && (
                          <button
                            onClick={() => {
                              setSaveTitle(`위험성평가표_${new Date().toLocaleDateString()}`);
                              setShowSaveDialog(true);
                            }}
                            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all flex items-center justify-center shadow-sm text-xs font-bold"
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            저장
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-6 md:p-8">
                      {/* 모바일 화면 알림 추가 */}
                      {!isEditingFinal && (
                        <div className="md:hidden bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-xl shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-500 text-white p-1.5 rounded-lg shrink-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-blue-900 text-xs font-black">모바일 최적화 뷰 활성 중</p>
                              <p className="text-blue-700 text-[10px] font-medium mt-0.5 leading-relaxed">작은 화면에서도 보기 편하도록 카드 형태로 변환되었습니다. 데스크톱 환경에서는 정식 표(Table) 형식으로 제공됩니다.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {isEditingFinal ? (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse min-w-[800px]">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50">공정/장비</th>
                                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50">위험 요소</th>
                                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50">중대성</th>
                                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50">가능성</th>
                                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50">위험도</th>
                                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50">대책</th>
                                <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50 w-20">작업</th>
                              </tr>
                            </thead>
                            <tbody>
                              {editableTableData.map((row, index) => (
                                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-5 py-4 border border-gray-200">
                                    <input
                                      type="text"
                                      value={row.processName}
                                      onChange={(e) => handleTableDataChange(index, 'processName', e.target.value)}
                                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="px-5 py-4 border border-gray-200">
                                    <input
                                      type="text"
                                      value={row.riskFactor}
                                      onChange={(e) => handleTableDataChange(index, 'riskFactor', e.target.value)}
                                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="px-5 py-4 border border-gray-200">
                                    <input
                                      type="number"
                                      min="1"
                                      max="5"
                                      value={row.severity}
                                      onChange={(e) => handleTableDataChange(index, 'severity', e.target.value)}
                                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                      placeholder="1-5"
                                    />
                                  </td>
                                  <td className="px-5 py-4 border border-gray-200">
                                    <input
                                      type="number"
                                      min="1"
                                      max="5"
                                      value={row.probability}
                                      onChange={(e) => handleTableDataChange(index, 'probability', e.target.value)}
                                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                      placeholder="1-5"
                                    />
                                  </td>
                                  <td className="px-5 py-4 border border-gray-200">
                                    <select
                                      value={row.riskLevel}
                                      onChange={(e) => handleTableDataChange(index, 'riskLevel', e.target.value)}
                                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                    >
                                      <option value="">선택</option>
                                      <option value="높음">높음</option>
                                      <option value="중간">중간</option>
                                      <option value="낮음">낮음</option>
                                    </select>
                                  </td>
                                  <td className="px-5 py-4 border border-gray-200">
                                    <textarea
                                      value={row.countermeasure}
                                      onChange={(e) => handleTableDataChange(index, 'countermeasure', e.target.value)}
                                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                      rows={2}
                                    />
                                  </td>
                                  <td className="px-5 py-4 border border-gray-200">
                                    <button
                                      onClick={() => removeTableRow(index)}
                                      className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-50 transition-all duration-200 w-full flex items-center justify-center"
                                      title="행 삭제"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          
                          <div className="mt-8 flex justify-center">
                            <button
                              onClick={addTableRow}
                              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-50 transition-all duration-300 flex items-center shadow-md"
                            >
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                              </svg>
                              행 추가하기
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          {/* 데스크탑 테이블 뷰 */}
                          <div className="hidden md:block overflow-x-auto scrollbar-hide">
                            <div 
                              className="final-analysis-content" 
                              dangerouslySetInnerHTML={{ __html: finalAnalysis }}
                            ></div>
                          </div>
                          
                          {/* 모바일 카드 뷰 */}
                          {renderRiskAssessmentCards(editableTableData)}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-100 bg-gray-50 px-8 py-4">
                      <p className="text-sm text-gray-600">
                        {isEditingFinal 
                          ? "테이블을 직접 수정하고 완료 버튼을 클릭하세요." 
                          : "선택한 위험 요소들로 최종 위험성평가표가 생성되었습니다. 수정하기 버튼을 눌러 내용을 편집할 수 있습니다."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            
            {/* 저장된 위험성평가 목록 화면 */}
          {currentView === 'saved' && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="px-8 py-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800">저장된 위험성평가 결과</h2>
              </div>
              
              <div className="p-8">
                {isLoading ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="w-16 h-16 border-t-4 border-blue-600 border-solid rounded-full animate-spin"></div>
                  </div>
                ) : (savedAssessments || []).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {savedAssessments.map((savedAssessment) => (
                      <div 
                        key={savedAssessment.id} 
                        className="bg-white rounded-xl overflow-hidden shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                        onClick={() => viewAssessment(savedAssessment)}
                      >
                        <div className="h-3 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                        <div className="p-6">
                          <h3 className="font-bold text-lg mb-2 text-gray-800 group-hover:text-blue-600 transition-colors duration-300">{savedAssessment.title}</h3>
                          <div className="flex items-center mb-4 text-sm text-gray-500">
                            <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            {new Date(savedAssessment.createdAt).toLocaleDateString()}
                            
                            <span className="mx-2">•</span>
                            
                            <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                            </svg>
                            위험요소 {savedAssessment.tableData.length}개
                          </div>
                          <div className="flex justify-between">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                viewAssessment(savedAssessment);
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center group-hover:translate-x-1 transition-transform duration-300"
                            >
                              자세히 보기
                              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAssessment(savedAssessment.id);
                              }}
                              className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-100">
                    <svg className="w-20 h-20 mx-auto mb-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m4-6v6m-4 6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    <p className="text-xl font-medium text-gray-600 mb-4">저장된 위험성평가 결과가 없습니다.</p>
                    <button 
                      onClick={() => changeView('main')}
                      className="mt-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-md"
                    >
                      위험성평가 생성하기
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 상세 보기 화면 */}
          {currentView === 'detail' && selectedAssessment && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-6 md:px-8 flex flex-col md:flex-row md:justify-between md:items-center gap-6">
                <div className="flex items-center">
                  <button 
                    onClick={goBackToSaved}
                    className="mr-4 p-2.5 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors flex items-center justify-center shrink-0"
                    aria-label="뒤로 가기"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-xl md:text-2xl font-bold mb-1 truncate">{selectedAssessment.title}</h2>
                    <div className="text-xs md:text-sm text-blue-100 flex items-center gap-2">
                      <span className="shrink-0">저장일: {new Date(selectedAssessment.createdAt).toLocaleDateString()}</span>
                      <span className="opacity-50">|</span>
                      <span className="shrink-0">위험요소 {selectedAssessment.tableData.length}개</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 md:space-x-3">
                  {/* 수정 버튼 */}
                  <button
                    onClick={toggleSavedEditMode}
                    className={`px-4 py-2.5 md:px-5 bg-white bg-opacity-20 text-white rounded-xl hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center text-sm md:text-base font-bold ${isUpdating ? 'opacity-70 cursor-not-allowed' : ''}`}
                    disabled={isUpdating}
                  >
                    {isEditingSaved ? (
                      <>
                        <svg className="w-4 h-4 md:w-5 md:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path>
                        </svg>
                        완료
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 md:w-5 md:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                        </svg>
                        수정
                      </>
                    )}
                  </button>
                  
                  {/* 저장 버튼 */}
                  {isEditingSaved && (
                    <button
                      onClick={updateAssessment}
                      disabled={isUpdating}
                      className="px-4 py-2.5 md:px-5 bg-white bg-opacity-20 text-white rounded-xl hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center text-sm md:text-base font-bold"
                    >
                      {isUpdating ? (
                        <>
                          <div className="w-4 h-4 md:w-5 md:h-5 border-t-2 border-white border-solid rounded-full animate-spin mr-2"></div>
                          ..
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 md:w-5 md:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          저장
                        </>
                      )}
                    </button>
                  )}
                  
                  {/* 삭제 버튼 (모바일에서 grid 배치를 위해 Col 조정) */}
                  {!isEditingSaved && (
                    <button 
                      onClick={() => deleteAssessment(selectedAssessment.id)}
                      className="px-4 py-2.5 md:px-5 bg-white bg-opacity-20 text-white rounded-xl hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center text-sm md:text-base font-bold"
                      aria-label="삭제"
                    >
                      <svg className="w-4 h-4 md:w-5 md:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      삭제
                    </button>
                  )}
                </div>
              </div>
              
              <div className="p-6 md:p-8">
                {/* 모바일 화면 알림 추가 */}
                {!isEditingSaved && (
                  <div className="md:hidden bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-500 text-white p-1.5 rounded-lg shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-blue-900 text-xs font-black">모바일 최적화 뷰 활성 중</p>
                        <p className="text-blue-700 text-[10px] font-medium mt-0.5 leading-relaxed">작은 화면에서도 보기 편하도록 카드 형태로 변환되었습니다. 데스크톱 환경에서는 정식 표(Table) 형식으로 제공됩니다.</p>
                      </div>
                    </div>
                  </div>
                )}

                {isEditingSaved ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50">공정/장비</th>
                          <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50">위험 요소</th>
                          <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50">중대성</th>
                          <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50">가능성</th>
                          <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50">위험도</th>
                          <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50">대책</th>
                          <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700 border border-gray-200 bg-gray-50 w-20">작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editableTableData.map((row, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-5 py-4 border border-gray-200">
                              <input
                                type="text"
                                value={row.processName}
                                onChange={(e) => handleTableDataChange(index, 'processName', e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-5 py-4 border border-gray-200">
                              <input
                                type="text"
                                value={row.riskFactor}
                                onChange={(e) => handleTableDataChange(index, 'riskFactor', e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-5 py-4 border border-gray-200">
                              <input
                                type="number"
                                min="1"
                                max="5"
                                value={row.severity}
                                onChange={(e) => handleTableDataChange(index, 'severity', e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                placeholder="1-5"
                              />
                            </td>
                            <td className="px-5 py-4 border border-gray-200">
                              <input
                                type="number"
                                min="1"
                                max="5"
                                value={row.probability}
                                onChange={(e) => handleTableDataChange(index, 'probability', e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                placeholder="1-5"
                              />
                            </td>
                            <td className="px-5 py-4 border border-gray-200">
                              <select
                                value={row.riskLevel}
                                onChange={(e) => handleTableDataChange(index, 'riskLevel', e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                              >
                                <option value="">선택</option>
                                <option value="높음">높음</option>
                                <option value="중간">중간</option>
                                <option value="낮음">낮음</option>
                              </select>
                            </td>
                            <td className="px-5 py-4 border border-gray-200">
                              <textarea
                                value={row.countermeasure}
                                onChange={(e) => handleTableDataChange(index, 'countermeasure', e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                                rows={2}
                              />
                            </td>
                            <td className="px-5 py-4 border border-gray-200">
                              <button
                                onClick={() => removeTableRow(index)}
                                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-50 transition-all duration-200 w-full flex items-center justify-center"
                                title="행 삭제"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    <div className="mt-8 flex justify-center">
                      <button
                        onClick={addTableRow}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-50 transition-all duration-300 flex items-center shadow-md"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                        </svg>
                        행 추가하기
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    {/* 데스크탑 테이블 뷰 */}
                    <div className="hidden md:block overflow-x-auto scrollbar-hide">
                      <div 
                        className="final-analysis-content" 
                        dangerouslySetInnerHTML={{ __html: selectedAssessment.tableHTML }}
                      ></div>
                    </div>
                    
                    {/* 모바일 카드 뷰 */}
                    {renderRiskAssessmentCards(editableTableData)}
                  </div>
                )}
              </div>
              
              {isEditingSaved && (
                <div className="border-t border-gray-100 bg-gray-50 px-8 py-4">
                  <p className="text-sm text-gray-600">
                    테이블을 직접 수정하고 저장하기 버튼을 클릭하세요. 취소하려면 '완료' 버튼을 클릭한 후 뒤로 가기를 눌러주세요.
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* 푸터 영역 제거됨 */}

          
          {/* 린터 오류 수정을 위한 타입 정의 */}
          {(() => {
            // 타입 가드 함수 추가
            const isCurrentViewMain = (view: 'main' | 'saved' | 'detail'): view is 'main' => view === 'main';
            const isCurrentViewSaved = (view: 'main' | 'saved' | 'detail'): view is 'saved' => view === 'saved';
            const isCurrentViewDetail = (view: 'main' | 'saved' | 'detail'): view is 'detail' => view === 'detail';
            
            return null;
          })()}
          
          {/* 공정/장비 명칭 입력 모달 */}
          {showProcessNameModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-100 animate-scaleIn">
                <h3 className="text-2xl font-bold text-gray-800 mb-5">공정 또는 장비의 명칭을 입력하세요</h3>
                <input
                  type="text"
                  value={processNameInput}
                  onChange={(e) => setProcessNameInput(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none mb-6 text-gray-700 placeholder-gray-400 transition-all duration-300"
                  placeholder="예: 용접 작업, 지게차 운반, 높이 작업 등"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleProcessNameCancel}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 transition-all duration-300"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleProcessNameSubmit}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-300 shadow-md"
                    disabled={!processNameInput.trim()}
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* 저장 대화상자 */}
          {showSaveDialog && (
            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-100 animate-scaleIn">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-2xl font-bold text-gray-800">위험성평가 저장</h3>
                  <button 
                    onClick={() => setShowSaveDialog(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all duration-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
                
                <p className="text-gray-600 mb-6">
                  이 위험성평가를 저장하면 나중에 저장소에서 다시 확인할 수 있습니다.
                </p>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">위험성평가 제목</label>
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none text-gray-700 placeholder-gray-400 transition-all duration-300"
                    placeholder="예: 용접 작업 위험성평가 (2023년 9월)"
                    autoFocus
                  />
                </div>
                
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 transition-all duration-300"
                  >
                    취소
                  </button>
                  <button
                    onClick={saveAssessment}
                    disabled={!saveTitle.trim() || isSaving}
                    className={`px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-300 shadow-md flex items-center ${!saveTitle.trim() || isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isSaving ? (
                      <>
                        <div className="w-5 h-5 border-t-2 border-white border-solid rounded-full animate-spin mr-2"></div>
                        저장 중...
                      </>
                    ) : '저장하기'}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* 애니메이션용 CSS */}
          <style jsx global>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            
            @keyframes scaleIn {
              from { transform: scale(0.95); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            
            @keyframes marquee {
              0% { transform: translateX(100%); }
              100% { transform: translateX(-100%); }
            }

            @keyframes bounceIn {
              0% { transform: translate(-50%, 100%); opacity: 0; }
              60% { transform: translate(-50%, -20px); opacity: 1; }
              80% { transform: translate(-50%, 10px); }
              100% { transform: translate(-50%, 0); opacity: 1; }
            }

            .animate-fadeIn {
              animation: fadeIn 0.3s ease-out forwards;
            }
            
            .animate-scaleIn {
              animation: scaleIn 0.3s ease-out forwards;
            }

            .animate-marquee {
              animation: marquee 15s linear infinite;
            }

            .animate-bounceIn {
              animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
            }

            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
            .scrollbar-hide {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
            
            .final-analysis-content table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 1.5rem;
              font-size: 0.95rem;
            }
            
            @media (max-width: 767px) {
              .final-analysis-content {
                overflow-x: auto;
                display: block;
                -webkit-overflow-scrolling: touch;
              }
              
              .final-analysis-content table {
                min-width: 800px; /* 모바일에서 충분한 너비 확보하여 세로 쓰기 방지 */
              }

              .final-analysis-content th,
              .final-analysis-content td {
                padding: 0.5rem;
                font-size: 0.85rem;
                white-space: normal;
                word-break: keep-all;
              }
            }
            
            .final-analysis-content th,
            .final-analysis-content td {
              border: 1px solid #e2e8f0;
              padding: 0.75rem;
              text-align: left;
            }
            
            .final-analysis-content th {
              background-color: #f8fafc;
              font-weight: 600;
              color: #334155;
            }
            
            .final-analysis-content tr:nth-child(even) {
              background-color: #f8fafc;
            }
            
            .final-analysis-content tr:hover {
              background-color: #f1f5f9;
            }
          `}</style>
          
          {/* 위험성추정 기준 모달 */}
          {/* 결재칸 수 선택 모달 */}
          {showApprovalSelect && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-scaleIn">
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-5 text-white">
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    결재칸 생성
                  </h3>
                  <p className="text-indigo-100 text-sm mt-1 font-medium">생성할 결재칸의 개수를 선택해주세요.</p>
                </div>
                
                <div className="p-8">
                  <div className="grid grid-cols-5 gap-3 mb-8">
                    {[1, 2, 3, 4, 5].map((count) => (
                      <button
                        key={count}
                        onClick={() => handleApprovalCountSelect(count)}
                        className={`aspect-square flex items-center justify-center rounded-2xl text-xl font-bold transition-all duration-300 border-2 ${
                          approvalCount === count 
                            ? 'bg-indigo-500 text-white border-indigo-500 scale-110 shadow-lg shadow-indigo-200' 
                            : 'bg-white text-gray-700 border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowApprovalSelect(false)}
                      className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                    >
                      취소
                    </button>
                    {approvalCount > 0 && (
                       <button
                       onClick={() => handleApprovalCountSelect(0)}
                       className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all"
                     >
                       제거
                     </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showCriteriaModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-auto">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-auto animate-scaleIn">
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 flex justify-between items-center z-10">
                  <h2 className="text-2xl font-bold">위험성추정 기준</h2>
                  <button 
                    onClick={toggleCriteriaModal}
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
                    aria-label="닫기"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="p-6 md:p-8 space-y-8">
                  <div className="flex justify-center mb-8">
                    <div className="flex items-center bg-gray-100 p-1.5 rounded-2xl w-full max-w-xs shadow-inner">
                      <button
                        onClick={() => setAssessmentMethod('3x3')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                          assessmentMethod === '3x3'
                            ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        3x3 방식
                      </button>
                      <button
                        onClick={() => setAssessmentMethod('5x5')}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                          assessmentMethod === '5x5'
                            ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        5x5 방식
                      </button>
                    </div>
                  </div>

                  {assessmentMethod === '5x5' ? (
                    <>
                      {/* 5x5 가능성 구분표 */}
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">위험성 추정(가능성) 구분표 (5x5)</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border-collapse min-w-[600px]">
                            <thead>
                              <tr className="bg-blue-700 text-white">
                                <th className="px-4 py-3 border border-blue-800 text-left">구분</th>
                                <th className="px-4 py-3 border border-blue-800 text-left">가능성</th>
                                <th className="px-4 py-3 border border-blue-800 text-left">내용</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="bg-blue-50">
                                <td className="px-4 py-3 border border-blue-200 font-medium">최상</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">5</td>
                                <td className="px-4 py-3 border border-blue-200">매우 빈번하게 발생 (일일 또는 주간 단위 발생)</td>
                              </tr>
                              <tr className="bg-white">
                                <td className="px-4 py-3 border border-blue-200 font-medium">상</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">4</td>
                                <td className="px-4 py-3 border border-blue-200">자주 발생 (월간 단위 발생 가능성)</td>
                              </tr>
                              <tr className="bg-blue-50">
                                <td className="px-4 py-3 border border-blue-200 font-medium">중</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">3</td>
                                <td className="px-4 py-3 border border-blue-200">보통 (분기 또는 연간 단위 발생 가능성)</td>
                              </tr>
                              <tr className="bg-white">
                                <td className="px-4 py-3 border border-blue-200 font-medium">하</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">2</td>
                                <td className="px-4 py-3 border border-blue-200">거의 발생하지 않음 (수년 내 1회 정도)</td>
                              </tr>
                              <tr className="bg-blue-50">
                                <td className="px-4 py-3 border border-blue-200 font-medium">최하</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">1</td>
                                <td className="px-4 py-3 border border-blue-200">발생 가능성이 매우 희박함</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                      
                      {/* 5x5 중대성 구분표 */}
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">위험성 추정(중대성) 구분표 (5x5)</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border-collapse min-w-[600px]">
                            <thead>
                              <tr className="bg-blue-700 text-white">
                                <th className="px-4 py-3 border border-blue-800 text-left">구분</th>
                                <th className="px-4 py-3 border border-blue-800 text-left">중대성</th>
                                <th className="px-4 py-3 border border-blue-800 text-left">내용</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="bg-blue-50">
                                <td className="px-4 py-3 border border-blue-200 font-medium">최대</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">5</td>
                                <td className="px-4 py-3 border border-blue-200">사망, 1급 장해, 중대재해 발생</td>
                              </tr>
                              <tr className="bg-white">
                                <td className="px-4 py-3 border border-blue-200 font-medium">대</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">4</td>
                                <td className="px-4 py-3 border border-blue-200">30일 이상 휴업이 필요한 심각한 부상/질병</td>
                              </tr>
                              <tr className="bg-blue-50">
                                <td className="px-4 py-3 border border-blue-200 font-medium">중</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">3</td>
                                <td className="px-4 py-3 border border-blue-200">3일 이상 30일 미만 휴업이 필요한 부상/질병</td>
                              </tr>
                              <tr className="bg-white">
                                <td className="px-4 py-3 border border-blue-200 font-medium">소</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">2</td>
                                <td className="px-4 py-3 border border-blue-200">3일 미만 휴업 또는 구급처치 초과 재해</td>
                              </tr>
                              <tr className="bg-blue-50">
                                <td className="px-4 py-3 border border-blue-200 font-medium">극소</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">1</td>
                                <td className="px-4 py-3 border border-blue-200">구급처치 이하, 아차사고, 피해 미미</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 3x3 가능성 구분표 */}
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">위험성 추정(가능성) 구분표 (3x3)</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border-collapse min-w-[600px]">
                            <thead>
                              <tr className="bg-blue-700 text-white">
                                <th className="px-4 py-3 border border-blue-800 text-left">구분</th>
                                <th className="px-4 py-3 border border-blue-800 text-left">가능성</th>
                                <th className="px-4 py-3 border border-blue-800 text-left">내용</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="bg-blue-50">
                                <td className="px-4 py-3 border border-blue-200 font-medium">상</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">3</td>
                                <td className="px-4 py-3 border border-blue-200">피해가 발생할 가능성이 높음</td>
                              </tr>
                              <tr className="bg-white">
                                <td className="px-4 py-3 border border-blue-200 font-medium">중</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">2</td>
                                <td className="px-4 py-3 border border-blue-200">피해가 발생할 가능성이 보통</td>
                              </tr>
                              <tr className="bg-blue-50">
                                <td className="px-4 py-3 border border-blue-200 font-medium">하</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">1</td>
                                <td className="px-4 py-3 border border-blue-200">피해가 발생할 가능성이 낮음</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 3x3 중대성 구분표 */}
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">위험성 추정(중대성) 구분표 (3x3)</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border-collapse min-w-[600px]">
                            <thead>
                              <tr className="bg-blue-700 text-white">
                                <th className="px-4 py-3 border border-blue-800 text-left">구분</th>
                                <th className="px-4 py-3 border border-blue-800 text-left">중대성</th>
                                <th className="px-4 py-3 border border-blue-800 text-left">내용</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="bg-blue-50">
                                <td className="px-4 py-3 border border-blue-200 font-medium">상</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">3</td>
                                <td className="px-4 py-3 border border-blue-200">사망 또는 30일 이상 휴업 재해 (영구 노동불능)</td>
                              </tr>
                              <tr className="bg-white">
                                <td className="px-4 py-3 border border-blue-200 font-medium">중</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">2</td>
                                <td className="px-4 py-3 border border-blue-200">3일 이상 30일 미만 휴업 재해 (일시 노동불능)</td>
                              </tr>
                              <tr className="bg-blue-50">
                                <td className="px-4 py-3 border border-blue-200 font-medium">하</td>
                                <td className="px-4 py-3 border border-blue-200 text-center">1</td>
                                <td className="px-4 py-3 border border-blue-200">3일 미만 휴업 또는 의학적 처치 이하 재해</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 공통: 위험성 결정 기준 */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">위험성 결정 및 조치 기준</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-green-100">
                            <th className="px-4 py-3 border border-gray-300 text-center">위험도</th>
                            <th className="px-4 py-3 border border-gray-300 text-center">관리 기준</th>
                            <th className="px-4 py-3 border border-gray-300 text-center">조치 내용</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assessmentMethod === '5x5' ? (
                            <>
                              <tr>
                                <td className="px-4 py-3 border border-gray-300 text-center font-bold text-red-600 italic">상 (16~25)</td>
                                <td className="px-4 py-3 border border-gray-300 text-center font-bold">허용 불가능</td>
                                <td className="px-4 py-3 border border-gray-300">즉시 개선 조치 및 작업 중지 고려</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-gray-300 text-center font-bold text-orange-500">중 (8~15)</td>
                                <td className="px-4 py-3 border border-gray-300 text-center">주의 (개선 필요)</td>
                                <td className="px-4 py-3 border border-gray-300">계획을 수립하여 개선 조치 시행</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-gray-300 text-center font-bold text-green-600 italic">하 (1~7)</td>
                                <td className="px-4 py-3 border border-gray-300 text-center">허용 가능</td>
                                <td className="px-4 py-3 border border-gray-300">현재 상태 유지 및 지속적 관리</td>
                              </tr>
                            </>
                          ) : (
                            <>
                              <tr>
                                <td className="px-4 py-3 border border-gray-300 text-center font-bold text-red-600">높음 (6~9)</td>
                                <td className="px-4 py-3 border border-gray-300 text-center font-bold">허용 불가능</td>
                                <td className="px-4 py-3 border border-gray-300">신속하게 개선 조치 시행</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-gray-300 text-center font-bold text-orange-500">중간 (3~4)</td>
                                <td className="px-4 py-3 border border-gray-300 text-center">주의</td>
                                <td className="px-4 py-3 border border-gray-300">가급적 빨리 개선 조치 시행</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 border border-gray-300 text-center font-bold text-green-600">낮음 (1~2)</td>
                                <td className="px-4 py-3 border border-gray-300 text-center">허용 가능</td>
                                <td className="px-4 py-3 border border-gray-300">필요에 따라 개선 또는 현상 유지</td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end sticky bottom-0 z-10">
                  <button
                    onClick={toggleCriteriaModal}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 성공 토스트 알림 */}
          {showSuccessToast && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-bounceIn">
              <div className="bg-emerald-600 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 border-2 border-white/20 backdrop-blur-sm">
                <div className="bg-white/20 p-1 rounded-full">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="font-black text-lg whitespace-nowrap">위험성평가표가 성공적으로 생성되었습니다!</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <ClientSideContent />
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </Suspense>
  );
} 