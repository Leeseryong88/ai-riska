'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Save } from 'lucide-react';

const CONSTRUCTION_TYPES = [
  { id: 'type1', title: '일반건설(갑)', desc: '아파트, 상가, 공장 등 일반적인 모든 건축물 신축/증축 공사' },
  { id: 'type2', title: '일반건설(을)', desc: '도로, 교량, 댐, 상하수도 등 사회기반시설을 구축하는 토목 공사' },
  { id: 'type3', title: '중건설', desc: '터널, 지하철, 복합 수력발전소 등 규모가 크고 위험도가 높은 고난이도 공사' },
  { id: 'type4', title: '철도 또는 궤도설', desc: '열차가 다니는 철로의 신설, 복선화, 개량 및 유지보수 관련 공사' },
  { id: 'type5', title: '특수 및 기타건설', desc: '조경, 준설, 전기, 통신, 소방 등 타 공종에 속하지 않는 전문/특수 공사' }
];

// 요율 정의 (평균치 적용)
const CONSTRUCTION_RATES: { [key: string]: number } = {
  '일반건설(갑)': 0.021,
  '일반건설(을)': 0.022,
  '중건설': 0.024,
  '철도 또는 궤도설': 0.018,
  '특수 및 기타건설': 0.012
};

export default function SafetyManagementFeePage() {
  const router = useRouter();
  const [subStep, setSubStep] = useState<'disclaimer' | 'mode' | 'info' | 'type' | 'priority' | 'amount'>('disclaimer');
  const [mode, setMode] = useState<'both' | 'total'>('both'); // both: 계상대상액+관리비 알때, total: 공사금액만 알때
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    constructionDescription: '', // 공정 대략적인 내용
    constructionType: '',
    targetAmount: '', // 계상 대상 금액
    managementFee: '', // 관리비
    totalAmount: '', // 총 공사금액
    directMaterialCost: '', // 직접재료비
    directLaborCost: '', // 직접노무비
    govMaterialCost: '', // 관급재료비
  });

  // 실시간 관리비 자동 계산
  useEffect(() => {
    if (mode === 'both') {
      const mat = parseInt(formData.directMaterialCost.replace(/[^0-9]/g, '')) || 0;
      const lab = parseInt(formData.directLaborCost.replace(/[^0-9]/g, '')) || 0;
      const gov = parseInt(formData.govMaterialCost.replace(/[^0-9]/g, '')) || 0;
      
      const targetSum = mat + lab + gov;
      const rate = CONSTRUCTION_RATES[formData.constructionType] || 0.021;
      const calculatedFee = Math.floor(targetSum * rate / 1000) * 1000;

      setFormData(prev => ({
        ...prev,
        targetAmount: targetSum > 0 ? targetSum.toString() : prev.targetAmount,
        managementFee: calculatedFee > 0 ? calculatedFee.toString() : prev.managementFee
      }));
    } else if (mode === 'total') {
      const total = parseInt(formData.totalAmount.replace(/[^0-9]/g, '')) || 0;
      const targetAmount = Math.floor(total * 0.7 / 1000) * 1000;
      const rate = CONSTRUCTION_RATES[formData.constructionType] || 0.021;
      const calculatedFee = Math.floor(targetAmount * rate / 1000) * 1000;

      setFormData(prev => ({
        ...prev,
        targetAmount: targetAmount > 0 ? targetAmount.toString() : prev.targetAmount,
        managementFee: calculatedFee > 0 ? calculatedFee.toString() : prev.managementFee
      }));
    }
  }, [formData.directMaterialCost, formData.directLaborCost, formData.govMaterialCost, formData.totalAmount, formData.constructionType, mode]);
  const [priorities, setPriorities] = useState({
    hasSafetyManager: 'no', // 전담 안전관리자 선임 여부 (기본 미선임)
    safetyManagerSalary: '4000000', // 안전관리자 월 급여 (기본 400만원)
    safetyManagerCount: '1', // 안전관리자 수
    constructionPeriod: '12', // 공사 기간 (개월)
    stage: 'early', // 공사 단계
    workerCount: '20', // 일평균 근로자 수
    hasTechGuidance: 'no', // 기술지도 계약 여부 (기본 해당없음)
    hasHeadquarters: 'no', // 본사 유무 (기본 개인/현장단독)
    includeEvents: 'no', // 안전보건 행사 포함 여부 (기본 미실시)
    includeDiagnosis: 'no', // 안전진단 포함 여부 (기본 미실시)
    includeHealthCheckup: 'no', // 건강검진 실시 여부 (기본 미실시)
    customPriority: '', 
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [planHtml, setPlanHtml] = useState('');
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [planMetadata, setPlanMetadata] = useState<any>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  const calculatePlanData = () => {
    const mat = parseInt(formData.directMaterialCost.replace(/[^0-9]/g, '')) || 0;
    const lab = parseInt(formData.directLaborCost.replace(/[^0-9]/g, '')) || 0;
    const gov = parseInt(formData.govMaterialCost.replace(/[^0-9]/g, '')) || 0;

    let targetAmountNum = mat + lab + gov;
    let feeNum = parseInt(formData.managementFee.replace(/[^0-9]/g, '')) || Math.floor(targetAmountNum * (CONSTRUCTION_RATES[formData.constructionType] || 0.021) / 1000) * 1000;
    let totalContractAmount = mode === 'total' ? (parseInt(formData.totalAmount.replace(/[^0-9]/g, '')) || 1000000000) : 0;
    
    if (mode === 'total') {
      const totalNum = parseInt(formData.totalAmount.replace(/[^0-9]/g, '')) || 1000000000;
      targetAmountNum = Math.floor(totalNum * 0.7 / 1000) * 1000;
      const rate = CONSTRUCTION_RATES[formData.constructionType] || 0.021;
      feeNum = Math.floor(targetAmountNum * rate / 1000) * 1000;
    }

    const matValue = mode === 'both' ? mat : Math.floor(targetAmountNum * 0.6 / 1000) * 1000;
    const labValue = mode === 'both' ? lab : Math.floor(targetAmountNum * 0.4 / 1000) * 1000;
    const govValue = mode === 'both' ? gov : 0;

    const period = parseInt(priorities.constructionPeriod) || 12;
    const workerCount = parseInt(priorities.workerCount) || 0;

    let laborTotal = 0;
    if (priorities.hasSafetyManager === 'yes') {
      laborTotal = (parseInt(priorities.safetyManagerSalary) || 4000000) * (parseInt(priorities.safetyManagerCount) || 1) * period;
    }

    let guidanceTotal = 0;
    if (priorities.hasTechGuidance === 'yes') {
      guidanceTotal = 400000 * 2 * period; 
    }

    let healthTotal = 0;
    if (workerCount > 0 && priorities.includeHealthCheckup === 'yes') {
      healthTotal = (workerCount * 100000) + (workerCount * 2000 * period);
    }
    healthTotal = Math.floor(healthTotal / 1000) * 1000;

    let headquartersTotal = 0;
    if (priorities.hasHeadquarters === 'yes') {
      headquartersTotal = Math.floor(feeNum * 0.05 / 1000) * 1000;
    }

    let diagnosisTotal = 0;
    if (priorities.includeDiagnosis === 'yes') {
      diagnosisTotal = Math.floor(feeNum * 0.05 / 1000) * 1000;
    }

    let educationTotal = 0;
    if (priorities.includeEvents === 'yes') {
      educationTotal = Math.floor(feeNum * 0.05 / 1000) * 1000;
    }

    const fixedCostsTotal = laborTotal + guidanceTotal + healthTotal + headquartersTotal + diagnosisTotal + educationTotal;

    let facilityTotal = 0;
    let equipmentTotal = 0;

    if (fixedCostsTotal > feeNum) {
      facilityTotal = Math.floor(feeNum * 0.05 / 1000) * 1000; 
      equipmentTotal = Math.floor(feeNum * 0.05 / 1000) * 1000;
    } else {
      const remainingFee = feeNum - fixedCostsTotal;
      facilityTotal = Math.floor(remainingFee * 0.6 / 1000) * 1000;
      equipmentTotal = remainingFee - facilityTotal;
    }

    const getFacilityItems = (description: string, amount: number) => {
      const lowerDesc = (description || '').toLowerCase();
      if (lowerDesc.includes('인테리어') || lowerDesc.includes('내부') || lowerDesc.includes('목공')) {
        return [
          { detail: '이동식 비계(BT아시바) 안전난간', unit: '조', count: Math.floor(amount * 0.5 / 150000) || 1, unitPrice: 150000, spec: '고소작업 시 추락 방지용 난간' },
          { detail: '작업발판 및 안전사다리', unit: '개', count: Math.floor(amount * 0.3 / 80000) || 1, unitPrice: 80000, spec: '실내 고소작업 안전통로 확보' },
          { detail: '소화기 및 화재예방 설비', unit: '식', count: 1, unitPrice: amount - ((Math.floor(amount * 0.5 / 150000) || 1) * 150000) - ((Math.floor(amount * 0.3 / 80000) || 1) * 80000), spec: '인테리어 현장 화재 감시용' }
        ];
      }
      if (lowerDesc.includes('도로') || lowerDesc.includes('관로') || lowerDesc.includes('토목') || lowerDesc.includes('포장')) {
        return [
          { detail: '교통안전표지판 및 신호등', unit: '세트', count: Math.floor(amount * 0.4 / 120000) || 1, unitPrice: 120000, spec: '도로 공사 구간 교통 통제용' },
          { detail: '안전휀스 및 라바콘', unit: 'm', count: Math.floor(amount * 0.4 / 15000) || 1, unitPrice: 15000, spec: '작업 구역 및 굴착 구간 통제' },
          { detail: '차선 규제봉 및 유도등', unit: '식', count: 1, unitPrice: amount - ((Math.floor(amount * 0.4 / 120000) || 1) * 120000) - ((Math.floor(amount * 0.4 / 15000) || 1) * 15000), spec: '야간 작업 시 시인성 확보' }
        ];
      }
      if (lowerDesc.includes('전기') || lowerDesc.includes('설비') || lowerDesc.includes('통신')) {
        return [
          { detail: '절연발판 및 절연용구', unit: '개', count: Math.floor(amount * 0.5 / 50000) || 1, unitPrice: 50000, spec: '활선작업 시 감전 사고 예방' },
          { detail: '임시 배전반(누전차단기함)', unit: '개', count: Math.floor(amount * 0.3 / 200000) || 1, unitPrice: 200000, spec: '가설 전기 화재 및 감전 방지' },
          { detail: '검전기 및 접지기구', unit: '식', count: 1, unitPrice: amount - ((Math.floor(amount * 0.5 / 50000) || 1) * 50000) - ((Math.floor(amount * 0.3 / 200000) || 1) * 200000), spec: '전기 설비 점검 및 안전 확보' }
        ];
      }
      return [
        { detail: '안전난간대 및 추락방지 시설', unit: 'm', count: Math.floor(amount * 0.6 / 25000) || 1, unitPrice: 25000, spec: '현장 개구부 및 단부 추락방지' },
        { detail: '수직보호망 및 낙하물방지', unit: '식', count: 1, unitPrice: amount - ((Math.floor(amount * 0.6 / 25000) || 1) * 25000), spec: '낙하물 비산 방지 조치' }
      ];
    };

    const items = [
      { 
        id: 'labor',
        name: '안전관리자 등의 인건비 및 각종 업무수당 등', 
        amount: laborTotal,
        details: priorities.hasSafetyManager === 'yes' ? [
          { detail: '전담 안전관리자 급여', unit: '월', count: period, unitPrice: parseInt(priorities.safetyManagerSalary) * (parseInt(priorities.safetyManagerCount) || 1), spec: `안전관리자 ${priorities.safetyManagerCount}명 (월 ${new Intl.NumberFormat('ko-KR').format(parseInt(priorities.safetyManagerSalary))}원)` }
        ] : []
      },
      { id: 'facility', name: '안전시설비 등', amount: facilityTotal, details: facilityTotal > 0 ? getFacilityItems(formData.constructionDescription, facilityTotal) : [] },
      { id: 'equipment', name: '개인보호구 및 안전장구 구입비 등', amount: equipmentTotal, details: equipmentTotal > 0 ? [
          { detail: '안전모, 안전화, 안전대', unit: '세트', count: workerCount, unitPrice: Math.floor(Math.min(120000, equipmentTotal / workerCount) / 1000) * 1000, spec: `투입 근로자 ${workerCount}인 지급용` },
          { detail: '기타 소모성 장구', unit: '식', count: 1, unitPrice: equipmentTotal - (workerCount * (Math.floor(Math.min(120000, equipmentTotal / workerCount) / 1000) * 1000)), spec: '장갑, 마스크, 보안경 등' }
        ] : [] 
      },
      { id: 'diagnosis', name: '안전진단비 등', amount: diagnosisTotal, details: diagnosisTotal > 0 ? (priorities.includeDiagnosis === 'yes' ? [
          { detail: '외부 안전 정밀 진단비', unit: '회', count: Math.ceil(period / 6), unitPrice: Math.floor(diagnosisTotal / Math.ceil(period / 6) / 1000) * 1000, spec: '반기별 전문가 정밀 진단' }
        ] : [
          { detail: '자체 안전점검 지원비', unit: '식', count: 1, unitPrice: Math.floor(diagnosisTotal / 1000) * 1000, spec: '자체 점검용 장비 유지 등' }
        ]) : []
      },
      { id: 'education', name: '안전·보건교육비 및 행사비 등', amount: educationTotal, details: educationTotal > 0 ? (priorities.includeEvents === 'yes' ? [
          { detail: '안전교육 교재 및 홍보물', unit: '식', count: 1, unitPrice: Math.floor(educationTotal * 0.4 / 1000) * 1000, spec: '정기/특별 교육용 자료 제작' },
          { detail: '무재해 달성 기념 행사비', unit: '회', count: Math.ceil(period / 3), unitPrice: Math.floor(educationTotal * 0.6 / Math.ceil(period / 3) / 1000) * 1000, spec: '안전의 날 행사 및 포상' }
        ] : [
          { detail: '정기 교육 자료 제작', unit: '식', count: 1, unitPrice: Math.floor(educationTotal / 1000) * 1000, spec: '법정 교육용 교재 및 자료' }
        ]) : []
      },
      { id: 'health', name: '근로자 건강관리비 등', amount: healthTotal, details: healthTotal > 0 ? [
          { detail: '일반/특수 건강진단비', unit: '인', count: workerCount, unitPrice: 100000, spec: `근로자 ${workerCount}인 건강검진` },
          { detail: '구급약품 및 보건용품 구입', unit: '식', count: period, unitPrice: Math.floor(Math.max(0, (healthTotal - (workerCount * 100000)) / period) / 1000) * 1000, spec: '매월 소모약품 보충' }
        ] : []
      },
      { id: 'guidance', name: '건설재해 예방 기술지도비', amount: guidanceTotal, details: priorities.hasTechGuidance === 'yes' ? [
          { detail: '건설재해예방 기술지도료', unit: '회', count: period * 2, unitPrice: 400000, spec: '월 2회 전문기관 기술지도' }
        ] : []
      },
      { id: 'headquarters', name: '본사 사용비', amount: headquartersTotal, details: priorities.hasHeadquarters === 'yes' ? [
          { detail: '본사 안전관리비 사용분', unit: '식', count: 1, unitPrice: headquartersTotal, spec: '법정 비율 내 본사 집행 비용' }
        ] : []
      },
    ];

    return {
      items: items.map(item => ({
        ...item,
        amount: item.details.reduce((sum, d) => sum + (d.unitPrice * d.count), 0)
      })),
      metadata: {
        targetAmountNum,
        feeNum,
        totalContractAmount,
        matValue,
        govValue,
        labValue,
        period,
        workerCount,
        fixedCostsTotal
      }
    };
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const data = calculatePlanData();
      setEditableItems(data.items);
      setPlanMetadata(data.metadata);
      setPlanHtml('generated');
      setIsGenerating(false);
    }, 4000);
  };

  const handleDetailAmountChange = (itemId: string, detailIdx: number, newUnitPrice: number) => {
    setEditableItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updatedDetails = [...item.details];
        updatedDetails[detailIdx] = { ...updatedDetails[detailIdx], unitPrice: newUnitPrice };
        const newTotal = updatedDetails.reduce((sum, d) => sum + (d.unitPrice * d.count), 0);
        return { ...item, amount: newTotal, details: updatedDetails };
      }
      return item;
    }));
  };

  const loadingMessages = [
    { title: "데이터를 분석하고 있습니다...", desc: "입력하신 정보를 체계적으로 검토 중입니다." },
    { title: "비용 계획을 수립 중입니다...", desc: "산업안전보건법 요율을 바탕으로 예시 항목을 구성하고 있습니다." },
    { title: "세부 명세를 생성 중입니다...", desc: "현장 상황에 맞는 합리적인 사용 계획을 도출하고 있습니다." },
    { title: "최종 계획서를 정리 중입니다...", desc: "법정 서식에 맞춰 문서를 마무리하고 있습니다." }
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % loadingMessages.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleReset = () => {
    setPlanHtml('');
    setIsEditing(false);
    setSubStep('mode');
  };

  const handleSavePlan = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    // Get the HTML content of the plan
    const planElement = document.querySelector('.printable-document');
    if (!planElement) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'managementFeePlans'), {
        userId: user.uid,
        title: saveTitle || `관리비 계획서 ${new Date().toLocaleDateString()}`,
        planHtml: planElement.innerHTML,
        createdAt: serverTimestamp(),
      });
      alert('관리비 계획서가 저장되었습니다.');
      setShowSaveModal(false);
    } catch (error) {
      console.error('Error saving management fee plan:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (planHtml && planMetadata) {
    const formatter = new Intl.NumberFormat('ko-KR');
    const finalTotalAmount = editableItems.reduce((sum, item) => sum + item.amount, 0);
    const feeNum = planMetadata.feeNum;
    
    // 초과 항목 파악
    let exceededItems: string[] = [];
    editableItems.forEach(item => {
      if (item.id === 'labor' && item.amount > feeNum * 0.3) exceededItems.push("안전관리자 인건비");
      if (item.id === 'health' && item.amount > feeNum * 0.15) exceededItems.push("근로자 건강관리비");
      if (item.id === 'guidance' && item.amount > feeNum * 0.1) exceededItems.push("기술지도비");
      if (item.id === 'headquarters' && item.amount > feeNum * 0.05) exceededItems.push("본사 사용비");
      if (item.id === 'diagnosis' && item.amount > feeNum * 0.05) exceededItems.push("안전진단비");
      if (item.id === 'education' && item.amount > feeNum * 0.05) exceededItems.push("교육 및 행사비");
    });
    
    const exceededText = exceededItems.length > 0 ? exceededItems.join(", ") : "필수 고정비";
    const isExceeded = finalTotalAmount > feeNum;

    return (
      <WorkspaceShell
        serviceHref="/safety-management-fee"
        title="안전보건관리비 계획서"
        description="공사 금액과 조건을 바탕으로 사용계획서를 계산하고 문서 형태로 편집할 수 있습니다."
        contentClassName="pb-20"
      >
        <div className="mx-auto max-w-4xl px-4 pt-10">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">산업안전보건관리비 사용계획서 (예시)</h1>
            <div className="space-x-2 flex items-center">
              <button onClick={handleReset} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-bold">다시 만들기</button>
              <button 
                onClick={() => setIsEditing(!isEditing)} 
                className={`px-4 py-2 ${isEditing ? 'bg-blue-600' : 'bg-gray-800'} text-white rounded-lg hover:opacity-90 transition-colors text-sm font-bold flex items-center gap-2`}
              >
                {isEditing ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    수정 완료
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    직접 수정
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setSaveTitle(`안전보건관리비 계획서 ${new Date().toLocaleDateString()}`);
                  setShowSaveModal(true);
                }}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-bold flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                저장하기
              </button>
            </div>
          </div>
          
          <div className="bg-white p-10 shadow-xl rounded-lg border border-gray-200 overflow-auto printable-document">
            <div className="safety-plan-document" style={{ fontFamily: "'Malgun Gothic', sans-serif" }}>
              <h1 style={{ textAlign: 'center', fontSize: '24pt', marginBottom: '30px', textDecoration: 'underline' }}>산업안전보건관리비 사용계획서</h1>
              
              <h2 style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '10px' }}>1. 일반사항</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <tbody>
                  <tr>
                    <th style={{ border: '1px solid #000', padding: '10px', width: '20%', background: '#f3f4f6', textAlign: 'center' }}>발주자</th>
                    <td colSpan={2} style={{ border: '1px solid #000', padding: '10px' }}>{formData.client}</td>
                    <th style={{ border: '1px solid #000', padding: '10px', width: '15%', background: '#f3f4f6', textAlign: 'center' }}>계</th>
                    <td colSpan={2} style={{ border: '1px solid #000', padding: '10px', width: '20%', textAlign: 'right' }}>{formatter.format(mode === 'total' ? planMetadata.totalContractAmount : planMetadata.targetAmountNum)} 원</td>
                  </tr>
                  <tr>
                    <th style={{ border: '1px solid #000', padding: '10px', background: '#f3f4f6', textAlign: 'center' }}>공정개요</th>
                    <td colSpan={5} style={{ border: '1px solid #000', padding: '10px', fontSize: '10pt', color: '#374151' }}>{formData.constructionDescription || '해당 현장의 공사 공정 및 내용에 따라 계획이 수립되었습니다.'}</td>
                  </tr>
                  <tr>
                    <th rowSpan={4} style={{ border: '1px solid #000', padding: '10px', background: '#f3f4f6', textAlign: 'center' }}>공사종류</th>
                    <td rowSpan={4} style={{ border: '1px solid #000', padding: '10px' }}>
                      {formData.constructionType || '일반건설(갑)'}
                    </td>
                    <th rowSpan={4} style={{ border: '1px solid #000', padding: '10px', width: '10%', background: '#f3f4f6', textAlign: 'center' }}>공사<br/>금액</th>
                    <td style={{ border: '1px solid #000', padding: '10px', width: '20%' }}>① 재료비(직접재료비)</td>
                    <td colSpan={2} style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{formatter.format(planMetadata.matValue)} 원</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '10px' }}>② 관급재료비</td>
                    <td colSpan={2} style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{formatter.format(planMetadata.govValue)} 원</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '10px' }}>③ 직접노무비</td>
                    <td colSpan={2} style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{formatter.format(planMetadata.labValue)} 원</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '10px' }}>④ 그 밖의 사항</td>
                    <td colSpan={2} style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{formatter.format(mode === 'total' ? planMetadata.totalContractAmount - planMetadata.targetAmountNum : 0)} 원</td>
                  </tr>
                  <tr>
                    <th style={{ border: '1px solid #000', padding: '10px', background: '#f3f4f6', textAlign: 'center' }}>산업안전보건관리비</th>
                    <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{formatter.format(feeNum)} 원</td>
                    <th colSpan={2} style={{ border: '1px solid #000', padding: '10px', background: '#f3f4f6', textAlign: 'center' }}>산업안전보건관리비 계상<br/>대상금액 [공사금액 중 ①+②+③]</th>
                    <td colSpan={2} style={{ border: '1px solid #000', padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{formatter.format(planMetadata.targetAmountNum)} 원</td>
                  </tr>
                </tbody>
              </table>

              <h2 style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '10px' }}>2. 항목별 실행계획</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                <thead style={{ background: '#f3f4f6' }}>
                  <tr>
                    <th style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>항목</th>
                    <th style={{ border: '1px solid #000', padding: '10px', width: '25%', textAlign: 'center' }}>금액</th>
                    <th style={{ border: '1px solid #000', padding: '10px', width: '15%', textAlign: 'center' }}>비율(%)</th>
                  </tr>
                </thead>
                <tbody>
                  {editableItems.map(item => (
                    <tr key={item.id}>
                      <td style={{ border: '1px solid #000', padding: '10px' }}>{item.name}</td>
                      <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-end">
                            <input 
                              type="text" 
                              className="w-32 p-1 border border-blue-400 rounded text-right outline-none focus:ring-2 focus:ring-blue-500"
                              value={item.amount.toLocaleString()}
                              onChange={(e) => {
                                const val = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                                // 전체 금액 수정 로직은 세부 항목 수정을 통해 반영되도록 하거나,
                                // 여기서는 간단하게 첫 번째 상세 항목의 단가를 조정하여 합계를 맞춤
                                setEditableItems(prev => prev.map(p => {
                                  if (p.id === item.id) {
                                    const updatedDetails = [...p.details];
                                    if (updatedDetails.length > 0) {
                                      updatedDetails[0] = { ...updatedDetails[0], unitPrice: Math.floor(val / updatedDetails[0].count) };
                                    }
                                    return { ...p, amount: val, details: updatedDetails };
                                  }
                                  return p;
                                }));
                              }}
                            />
                            <span className="text-xs">원</span>
                          </div>
                        ) : (
                          `${formatter.format(item.amount)} 원`
                        )}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
                        {finalTotalAmount > 0 ? ((item.amount / finalTotalAmount) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f9fafb', fontWeight: 'bold' }}>
                    <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>총계</td>
                    <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'right' }}>{formatter.format(finalTotalAmount)} 원</td>
                    <td style={{ border: '1px solid #000', padding: '10px', textAlign: 'center' }}>100.0%</td>
                  </tr>
                </tbody>
              </table>

              {isExceeded && (
                <div style={{ marginTop: '-20px', marginBottom: '40px', padding: '20px', border: '2px solid #ef4444', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
                  <p style={{ color: '#b91c1c', fontWeight: 'bold', margin: 0, fontSize: '12pt' }}>⚠️ 예산 초과 알림 (사용자 설정 반영)</p>
                  <p style={{ color: '#b91c1c', margin: '8px 0 0 0', fontSize: '10.5pt', lineHeight: 1.6 }}>
                    사용자가 설정한 <strong>{exceededText} ({formatter.format(planMetadata.fixedCostsTotal)}원)</strong>가 법정 계상된 <strong>산업안전보건관리비 총액({formatter.format(feeNum)}원)</strong>을 초과하고 있습니다.<br/>
                    본 계획서는 사용자님의 요청을 우선 반영하여 작성되었으나, 실제 집행 시에는 안전보건관리비 증액이나 예산 재배분이 필요할 수 있음을 알려드립니다.
                  </p>
                </div>
              )}

              <div className="page-break" style={{ pageBreakAfter: 'always' }}></div>
              
              <h2 style={{ fontSize: '14pt', fontWeight: 'bold', marginTop: '40px', marginBottom: '10px' }}>3. 세부 사용계획</h2>
              <div style={{ fontSize: '9pt', color: '#4b5563', marginBottom: '8px' }}>※ 공정개요: {formData.constructionDescription || '-'}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                <thead style={{ background: '#f3f4f6' }}>
                  <tr>
                    <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>항목</th>
                    <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>세부항목</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '40px', textAlign: 'center' }}>단위</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '40px', textAlign: 'center' }}>수량</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '80px', textAlign: 'center' }}>단가</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '90px', textAlign: 'center' }}>금액</th>
                    <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>산출 명세</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '60px', textAlign: 'center' }}>사용시기</th>
                  </tr>
                </thead>
                <tbody>
                  {editableItems.filter(item => item.amount > 0).map(item => {
                    const rowCount = item.details.length || 1;
                    return item.details.map((detail: any, idx: number) => (
                      <tr key={`${item.id}-${idx}`}>
                        {idx === 0 && <td rowSpan={rowCount} style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold', fontSize: '8pt' }}>{item.name.split(' ')[0]}...</td>}
                        <td style={{ border: '1px solid #000', padding: '5px' }}>{detail.detail}</td>
                        <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{detail.unit}</td>
                        <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{detail.count}</td>
                        <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>
                          {isEditing ? (
                            <input 
                              type="text" 
                              className="w-full p-1 border border-blue-400 rounded text-right outline-none focus:ring-2 focus:ring-blue-500"
                              value={detail.unitPrice.toLocaleString()}
                              onChange={(e) => {
                                const val = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                                handleDetailAmountChange(item.id, idx, val);
                              }}
                            />
                          ) : (
                            formatter.format(detail.unitPrice)
                          )}
                        </td>
                        <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }}>{formatter.format(detail.unitPrice * detail.count)}</td>
                        <td style={{ border: '1px solid #000', padding: '5px' }}>{detail.spec}</td>
                        <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>공기중</td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 저장 모달 추가 */}
          {showSaveModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setShowSaveModal(false)}
              ></div>
              <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative z-[110]">
                <h3 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                  <Save className="w-8 h-8 text-amber-600" />
                  관리비 계획서 저장
                </h3>
                <div className="mb-8">
                  <label className="block text-sm font-bold text-gray-500 mb-2 ml-1">저장 제목</label>
                  <input
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder="예: OO현장 관리비 계획서"
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-amber-500 focus:bg-white outline-none transition-all font-bold text-gray-900"
                    autoFocus
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-black text-lg hover:bg-gray-200 transition-all"
                  >
                    취소
                  </button>
                  <button 
                    onClick={handleSavePlan}
                    disabled={isSaving}
                    className="flex-1 py-4 bg-amber-600 text-white rounded-xl font-black text-lg hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 disabled:opacity-50"
                  >
                    {isSaving ? '저장 중...' : '저장하기'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      serviceHref="/safety-management-fee"
      title="안전보건관리비 계획서"
      description="AI 기술로 현장의 안전보건관리비 계획을 자동 산출하고 체계적인 문서로 만들어줍니다."
    >
      <div className="mx-auto max-w-2xl px-4 py-8">
        {!isGenerating ? (
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
            {subStep === 'disclaimer' && (
              <div className="text-left">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">관리비 사용계획서 자동 작성</h2>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8 text-blue-900 leading-relaxed text-sm md:text-base">
                  <p className="mb-4 font-bold text-lg">👷 본 서비스는 예시 작성을 보조합니다</p>
                  <p className="mb-3">입력하신 최소한의 정보를 바탕으로 산업안전보건법에 따른 <strong>합리적인 사용계획서 예시</strong>를 자동으로 구성해드립니다.</p>
                  <p className="mb-3">생성된 내용은 참고용이며, 실제 현장 상황과 시공 계획에 맞춰 반드시 수정 및 보완하여 사용하시기 바랍니다.</p>
                </div>
                <button onClick={() => setSubStep('mode')} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition-all text-lg">시작하기</button>
              </div>
            )}

            {subStep === 'mode' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">알고 계신 정보를 선택해주세요</h2>
                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => { setMode('both'); setSubStep('info'); }}
                    className="group p-6 text-left border-2 border-gray-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1">계상대상액과 관리비를 알고 있음</h3>
                        <p className="text-sm text-gray-500 font-medium">정확한 대상금액과 관리비 총액을 직접 입력합니다.</p>
                      </div>
                    </div>
                  </button>

                  <button 
                    onClick={() => { setMode('total'); setSubStep('info'); }}
                    className="group p-6 text-left border-2 border-gray-100 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1">총 공사금액만 알고 있음</h3>
                        <p className="text-sm text-gray-500 font-medium">총액을 바탕으로 대상액과 관리비를 자동 추산합니다.</p>
                      </div>
                    </div>
                  </button>
                </div>
                <button onClick={() => setSubStep('disclaimer')} className="w-full mt-6 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-lg">이전으로</button>
              </div>
            )}

            {subStep === 'info' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">공사의 기본 정보를 입력해주세요</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">공사 명칭</label>
                    <input 
                      type="text" 
                      className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="예: 00지구 신축공사 현장"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">발주자 (계약처)</label>
                    <input 
                      type="text" 
                      className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="예: 00건설주식회사"
                      value={formData.client}
                      onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">공정 개요 (공사 범위 및 내용)</label>
                    <textarea 
                      className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 h-24 text-sm"
                      placeholder="예: 철근콘크리트 구조물 신축, 외부 비계 설치 및 마감 공사 등"
                      value={formData.constructionDescription}
                      onChange={(e) => setFormData({ ...formData, constructionDescription: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[
                        '철근콘크리트 구조물 신축 및 마감',
                        '도로 포장 및 하수관로 부설 공사',
                        '내부 인테리어 목공 및 전기 설비',
                        '노후 교량 보수 및 보강 공사',
                        '조경 식재 및 부대 토목 공사'
                      ].map((item) => (
                        <button
                          key={item}
                          onClick={() => setFormData({ ...formData, constructionDescription: item })}
                          className="px-3 py-1.5 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 text-gray-500 text-[11px] font-bold rounded-full transition-colors border border-gray-200"
                        >
                          + {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setSubStep('mode')} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-lg">이전으로</button>
                  <button onClick={() => setSubStep('type')} className="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition-all text-lg">다음 단계</button>
                </div>
              </div>
            )}

            {subStep === 'type' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">공사의 종류를 선택해주세요</h2>
                <div className="space-y-3">
                  {CONSTRUCTION_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => { setFormData({ ...formData, constructionType: type.title }); setSubStep('amount'); }}
                      className={`w-full p-5 text-left border-2 rounded-2xl transition-all ${formData.constructionType === type.title ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-blue-200 bg-gray-50'}`}
                    >
                      <h4 className="font-bold text-gray-900 mb-1">{type.title}</h4>
                      <p className="text-sm text-gray-500">{type.desc}</p>
                    </button>
                  ))}
                </div>
                <button onClick={() => setSubStep('info')} className="w-full mt-6 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-lg">이전으로</button>
              </div>
            )}

            {subStep === 'priority' && (
              <div className="space-y-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">합리적 배분을 위한 현장 상황 확인</h2>
                
                <div className="space-y-6">
                  {/* 공사 기간 관련 */}
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                    <label className="block text-sm font-bold text-gray-700">1. 공사 기간 및 인력 현황</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-gray-400 ml-1">총 공사 기간 (개월)</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 text-center bg-white"
                            value={priorities.constructionPeriod}
                            onChange={(e) => setPriorities({ ...priorities, constructionPeriod: e.target.value.replace(/[^0-9]/g, '') })}
                          />
                          <span className="text-sm text-gray-500 font-bold">개월</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-gray-400 ml-1">일평균 투입 근로자 (명)</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 text-center bg-white"
                            value={priorities.workerCount}
                            onChange={(e) => setPriorities({ ...priorities, workerCount: e.target.value.replace(/[^0-9]/g, '') })}
                          />
                          <span className="text-sm text-gray-500 font-bold">명</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-tight">* 기간은 인건비와 기술지도비 산출에, 근로자 수는 건강관리비와 보호구 수량 산출에 사용됩니다.</p>
                  </div>

                  {/* 안전관리자 인건비 관련 */}
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                    <label className="block text-sm font-bold text-gray-700">2. 전담 안전관리자 선임 계획</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'yes', label: '전담 안전관리자 선임' },
                        { id: 'no', label: '미선임' }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setPriorities({ 
                              ...priorities, 
                              hasSafetyManager: opt.id,
                              // 안전관리자 선임 시 기술지도는 자동으로 '해당없음' 처리하는 법적 로직은 유지하되, 
                              // 미선임 시 기술지도 체결 여부를 사용자가 선택하도록 함
                              hasTechGuidance: opt.id === 'yes' ? 'no' : priorities.hasTechGuidance
                            });
                          }}
                          className={`p-3 rounded-xl border-2 font-bold transition-all text-sm ${priorities.hasSafetyManager === opt.id ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-100 text-gray-500 bg-white'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {priorities.hasSafetyManager === 'yes' && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-400 mb-1 ml-1">월 평균 급여 (원)</label>
                          <input 
                            type="text" 
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="예: 4,000,000"
                            value={priorities.safetyManagerSalary}
                            onChange={(e) => setPriorities({ ...priorities, safetyManagerSalary: e.target.value.replace(/[^0-9]/g, '') })}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-400 mb-1 ml-1">선임 인원 (명)</label>
                          <input 
                            type="text" 
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="1"
                            value={priorities.safetyManagerCount}
                            onChange={(e) => setPriorities({ ...priorities, safetyManagerCount: e.target.value.replace(/[^0-9]/g, '') })}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 기술지도 계약 관련 */}
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                    <label className="block text-sm font-bold text-gray-700">3. 건설재해예방 기술지도 계약</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'yes', label: '기술지도 계약 체결' },
                        { id: 'no', label: '해당 없음 (또는 미체결)' }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          disabled={priorities.hasSafetyManager === 'yes'}
                          onClick={() => setPriorities({ ...priorities, hasTechGuidance: opt.id })}
                          className={`p-3 rounded-xl border-2 font-bold transition-all text-sm ${priorities.hasTechGuidance === opt.id ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-100 text-gray-500 bg-white'} ${priorities.hasSafetyManager === 'yes' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 px-1">
                      <div className={`w-2 h-2 rounded-full ${priorities.hasTechGuidance === 'yes' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className="text-[11px] font-bold text-gray-500">
                        {priorities.hasSafetyManager === 'yes' 
                          ? '안전관리자 선임 현장으로 기술지도 면제 대상입니다.' 
                          : '공사금액 1억 이상 120억 미만(토목 150억 미만)은 기술지도 대상입니다.'}
                      </span>
                    </div>
                  </div>

                  {/* 안전보건 활동 계획 (업그레이드) */}
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                    <label className="block text-sm font-bold text-gray-700">4. 추가 활동 및 사용 계획 (해당 시 체크)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center p-3 rounded-xl border-2 border-gray-100 hover:border-blue-200 cursor-pointer transition-all bg-white has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                          checked={priorities.includeEvents === 'yes'}
                          onChange={(e) => setPriorities({ ...priorities, includeEvents: e.target.checked ? 'yes' : 'no' })}
                        />
                        <span className="text-xs font-bold text-gray-600">안전보건 행사</span>
                      </label>
                      <label className="flex items-center p-3 rounded-xl border-2 border-gray-100 hover:border-blue-200 cursor-pointer transition-all bg-white has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                          checked={priorities.includeDiagnosis === 'yes'}
                          onChange={(e) => setPriorities({ ...priorities, includeDiagnosis: e.target.checked ? 'yes' : 'no' })}
                        />
                        <span className="text-xs font-bold text-gray-600">외부 안전진단</span>
                      </label>
                      <label className="flex items-center p-3 rounded-xl border-2 border-gray-100 hover:border-blue-200 cursor-pointer transition-all bg-white has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                          checked={priorities.includeHealthCheckup === 'yes'}
                          onChange={(e) => setPriorities({ ...priorities, includeHealthCheckup: e.target.checked ? 'yes' : 'no' })}
                        />
                        <span className="text-xs font-bold text-gray-600">근로자 건강진단</span>
                      </label>
                      <label className="flex items-center p-3 rounded-xl border-2 border-gray-100 hover:border-blue-200 cursor-pointer transition-all bg-white has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                          checked={priorities.hasHeadquarters === 'yes'}
                          onChange={(e) => setPriorities({ ...priorities, hasHeadquarters: e.target.checked ? 'yes' : 'no' })}
                        />
                        <span className="text-xs font-bold text-gray-600">본사 안전관리비 사용</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-gray-700">5. 추가 요청사항 (선택)</label>
                    <textarea 
                      className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 h-24 text-sm"
                      placeholder="예: 장마철 안전시설 강화 필요..."
                      value={priorities.customPriority}
                      onChange={(e) => setPriorities({ ...priorities, customPriority: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[
                        '장마철/동절기 안전시설 강화',
                        '스마트 안전장비(IoT) 도입',
                        '외국인 근로자 맞춤형 교육',
                        '고위험 공정 집중 관리',
                        '혹서기 근로자 건강 보호'
                      ].map((item) => (
                        <button
                          key={item}
                          onClick={() => {
                            const newValue = priorities.customPriority 
                              ? `${priorities.customPriority}, ${item}`
                              : item;
                            setPriorities({ ...priorities, customPriority: newValue });
                          }}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-600 text-[11px] font-bold rounded-full transition-colors border border-gray-200"
                        >
                          + {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setSubStep('amount')} className="flex-1 py-4 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-all">이전</button>
                  <button onClick={handleGenerate} className="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition-all text-lg">계획서 생성하기</button>
                </div>
              </div>
            )}

            {subStep === 'amount' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">금액 정보를 입력해주세요</h2>
                <div className="space-y-4">
                  {mode === 'both' ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">직접재료비</label>
                          <input 
                            type="text" 
                            placeholder="예: 200,000,000"
                            className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.directMaterialCost ? parseInt(formData.directMaterialCost).toLocaleString() : ''}
                            onChange={(e) => setFormData({ ...formData, directMaterialCost: e.target.value.replace(/[^0-9]/g, '') })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">직접노무비</label>
                          <input 
                            type="text" 
                            placeholder="예: 200,000,000"
                            className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.directLaborCost ? parseInt(formData.directLaborCost).toLocaleString() : ''}
                            onChange={(e) => setFormData({ ...formData, directLaborCost: e.target.value.replace(/[^0-9]/g, '') })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">관급재료비</label>
                          <input 
                            type="text" 
                            placeholder="예: 100,000,000"
                            className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.govMaterialCost ? parseInt(formData.govMaterialCost).toLocaleString() : ''}
                            onChange={(e) => setFormData({ ...formData, govMaterialCost: e.target.value.replace(/[^0-9]/g, '') })}
                          />
                        </div>
                      </div>

                      <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-blue-800">계상 대상 금액 합계</span>
                          <span className="text-lg font-black text-blue-600">
                            {formData.targetAmount ? parseInt(formData.targetAmount).toLocaleString() : '0'} 원
                          </span>
                        </div>
                        <div className="pt-3 border-t border-blue-200 flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-700">산업안전보건관리비 총액</span>
                            <span className="text-[10px] text-blue-500 font-bold">* {formData.constructionType} 요율 ({((CONSTRUCTION_RATES[formData.constructionType] || 0.021) * 100).toFixed(2)}%) 적용됨</span>
                          </div>
                          <div className="flex items-center gap-2 w-1/2">
                            <input 
                              type="text" 
                              className="w-full p-3 bg-white border-2 border-blue-400 rounded-xl text-right font-black text-blue-600 outline-none focus:ring-2 focus:ring-blue-500"
                              value={formData.managementFee ? parseInt(formData.managementFee).toLocaleString() : ''}
                              onChange={(e) => setFormData({ ...formData, managementFee: e.target.value.replace(/[^0-9]/g, '') })}
                            />
                            <span className="text-sm font-bold text-gray-500 shrink-0">원</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">총 공사금액 (VAT 포함)</label>
                        <input 
                          type="text" 
                          placeholder="예: 1,000,000,000"
                          className="w-full p-4 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                          value={formData.totalAmount ? parseInt(formData.totalAmount).toLocaleString() : ''}
                          onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value.replace(/[^0-9]/g, '') })}
                        />
                      </div>

                      <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-indigo-800">추정 계상 대상 금액</span>
                            <span className="text-[10px] text-indigo-500 font-bold">* 총 공사금액의 70%로 자동 추산</span>
                          </div>
                          <span className="text-lg font-black text-indigo-600">{formData.targetAmount ? parseInt(formData.targetAmount).toLocaleString() : '0'} 원</span>
                        </div>
                        <div className="pt-3 border-t border-indigo-200 flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-700">추정 산업안전보건관리비</span>
                            <span className="text-[10px] text-indigo-500 font-bold">* {formData.constructionType} 요율 ({((CONSTRUCTION_RATES[formData.constructionType] || 0.021) * 100).toFixed(2)}%) 적용</span>
                          </div>
                          <div className="flex items-center gap-2 w-1/2">
                            <input 
                              type="text" 
                              className="w-full p-3 bg-white border-2 border-indigo-400 rounded-xl text-right font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                              value={formData.managementFee ? parseInt(formData.managementFee).toLocaleString() : ''}
                              onChange={(e) => setFormData({ ...formData, managementFee: e.target.value.replace(/[^0-9]/g, '') })}
                            />
                            <span className="text-sm font-bold text-gray-500 shrink-0">원</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setSubStep('type')} className="flex-1 py-4 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-all">이전</button>
                  <button 
                    onClick={() => setSubStep('priority')} 
                    className="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition-all text-lg"
                  >
                    다음 단계
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-8"></div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-3">{loadingMessages[loadingStep].title}</h2>
              <p className="text-gray-500 text-lg">{loadingMessages[loadingStep].desc}</p>
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
