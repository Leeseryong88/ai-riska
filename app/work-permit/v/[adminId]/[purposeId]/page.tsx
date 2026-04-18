'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, addDoc, collection, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { VisitPurpose, AdminUser } from '../../../_lib/types';
import { Card, Button } from '../../../_components/ui/Button';
import { DynamicForm } from '../../../_components/DynamicForm';
import { uploadBase64 } from '../../../_lib/storage';
import { ChevronLeft, Loader2, Download, Bell, ClipboardList, AlertCircle, ShieldAlert, Info } from 'lucide-react';
import dynamic from 'next/dynamic';

const SignaturePad = dynamic(() => import('../../../_components/SignaturePad').then(mod => mod.SignaturePad), { ssr: false });
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../_lib/utils';
// import { domToPng } from 'modern-screenshot'; // Moved to dynamic import inside handleDownloadImage

export default function VisitorFormPage() {
  const params = useParams();
  const adminId = params.adminId as string;
  const purposeId = params.purposeId as string;
  const router = useRouter();

  const [purpose, setPurpose] = useState<VisitPurpose | null>(null);
  const [adminData, setAdminData] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [signature, setSignature] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedLog, setSubmittedLog] = useState<any>(null);
  
  // Modal states
  const [showSafetyInfo, setShowSafetyInfo] = useState(true);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const getFieldLabel = (key: string) => {
    if (!purpose) return key;
    const field = purpose.fields.find(f => f.id === key);
    if (field) return field.label;

    const commonMap: Record<string, string> = {
      work_start: '작업 시작 일시',
      work_end: '작업 종료 예정 일시',
      worker_company: '소속 (업체명)',
      worker_name: '작업자 성함',
      worker_contact: '작업자 연락처',
    };
    return commonMap[key] || key;
  };

  useEffect(() => {
    if (!purposeId || !adminId) return;
    
    setLoading(true);
    setError(null);
    
    const fetchAdmin = async () => {
      try {
        const adminDoc = await getDoc(doc(db, 'users', adminId));
        if (adminDoc.exists()) {
          setAdminData(adminDoc.data() as AdminUser);
        }
      } catch (err: any) {
        console.error('Error fetching admin:', err);
      }
    };
    
    fetchAdmin();

    const docRef = doc(db, 'purposes', purposeId);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.data() as VisitPurpose;
          if (data.ownerId === adminId) {
            setPurpose({ ...data, id: snapshot.id });
          } else {
            setError('권한이 없는 접근입니다.');
          }
        } else {
          setError('해당 허가서 양식을 찾을 수 없습니다.');
        }
      } catch (err: any) {
        console.error('Data parsing error:', err);
        setError('데이터를 처리하는 중 오류가 발생했습니다.');
      }
      setLoading(false);
    }, (err) => {
      console.error('Firestore purpose snapshot error:', err);
      setError('서버와 연결할 수 없습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [purposeId, adminId]);

  const safetyInfo = purpose?.showSafetyInfo ? {
    hazards: purpose.safetyHazards || [],
    precautions: purpose.safetyPrecautions || [],
  } : null;

  const handleFieldChange = (id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!purpose) return false;

    purpose.fields.forEach(field => {
      if (field.required && !formData[field.id]) {
        newErrors[field.id] = '필수 입력 항목입니다.';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setShowPrivacyModal(true);
  };

  const handlePrivacyAgree = () => {
    setShowPrivacyModal(false);
    if (purpose?.notificationEnabled) {
      setShowNotificationModal(true);
    } else {
      setShowSignatureModal(true);
    }
  };

  const handleFinalSubmit = async (signatureData: string) => {
    if (!purpose || !adminId) return;
    setSignature(signatureData);
    setSubmitting(true);
    
    try {
      const timestamp = new Date().getTime();
      const signatureUrl = await uploadBase64(`logs/${adminId}/${timestamp}_signature.png`, signatureData);
      
      const updatedFormData = { ...formData };

      const visitorNameField = purpose.fields.find(f => f.id === 'worker_name' || f.label.includes('성함') || f.label.includes('이름'));
      const visitorContactField = purpose.fields.find(f => f.id === 'worker_contact' || f.label.includes('연락처'));

      const logData = {
        purposeId: purpose.id,
        purposeName: purpose.name,
        visitorName: visitorNameField ? updatedFormData[visitorNameField.id] : 'Unknown',
        visitorContact: visitorContactField ? updatedFormData[visitorContactField.id] : 'Unknown',
        data: updatedFormData,
        signature: signatureUrl,
        ownerId: adminId,
        visitDate: new Date(),
        createdAt: serverTimestamp(),
        safetyInfoSnapshot: purpose.showSafetyInfo ? {
          hazards: purpose.safetyHazards || [],
          precautions: purpose.safetyPrecautions || [],
        } : null,
      };

      await addDoc(collection(db, 'logs'), {
        ...logData,
        visitDate: serverTimestamp(),
      });
      
      setSubmittedLog(logData);
      setSubmitted(true);
      setShowSignatureModal(false);
    } catch (error) {
      console.error('Error submitting log:', error);
      alert('제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadImage = async () => {
    const element = document.getElementById('submission-summary');
    if (!element) return;
    
    try {
      const { domToPng } = await import('modern-screenshot');
      const dataUrl = await domToPng(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        quality: 1,
      });
      
      const link = document.createElement('a');
      link.download = `work-permit-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error: any) {
      console.error('Error generating image:', error);
      alert('이미지 저장 중 오류가 발생했습니다. 화면을 캡처해 주세요.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">접속 오류</h1>
        <p className="text-gray-500 mb-8 whitespace-pre-wrap">{error}</p>
        <Button className="w-full max-w-xs" onClick={() => router.push(`/work-permit/v/${adminId}`)}>
          돌아가기
        </Button>
      </div>
    );
  }

  if (submitted && submittedLog) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center py-6 px-4 md:py-12">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-[210mm] space-y-6"
        >
          {/* Document Container for Image Generation */}
          <div 
            id="submission-summary" 
            className="bg-white shadow-2xl border border-gray-200 p-6 md:p-12 w-full mx-auto"
            style={{ minHeight: '297mm' }}
          >
            {/* Document Header */}
            <div className="text-center space-y-4 mb-10 border-b-4 border-double border-gray-900 pb-6">
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-[0.2em] underline underline-offset-8">안전작업 허가서</h1>
              <div className="flex justify-between items-end pt-2">
                <p className="text-[10px] font-bold text-gray-400">제출번호: {new Date().getTime().toString().slice(-8)}</p>
              </div>
            </div>

            {/* Basic Info Table */}
            <section className="mb-8">
              <h3 className="text-xs font-black text-gray-900 mb-2 flex items-center gap-2">
                <div className="w-1 h-3 bg-gray-900" />
                1. 기본 인적 사항
              </h3>
              <div className="grid grid-cols-2 border-t-2 border-gray-900">
                <div className="border-b border-r border-gray-200 p-2 bg-gray-50/50">
                  <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">소속 (업체명)</p>
                  <p className="text-xs font-bold text-gray-900">{submittedLog.data.worker_company || '-'}</p>
                </div>
                <div className="border-b border-gray-200 p-2 bg-gray-50/50">
                  <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">작업자 성함</p>
                  <p className="text-xs font-bold text-gray-900">{submittedLog.visitorName}</p>
                </div>
                <div className="border-b border-r border-gray-200 p-2">
                  <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">연락처</p>
                  <p className="text-xs font-bold text-gray-900">{submittedLog.visitorContact}</p>
                </div>
                <div className="border-b border-gray-200 p-2">
                  <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">작업 종류</p>
                  <p className="text-xs font-bold text-blue-700">{submittedLog.purposeName}</p>
                </div>
              </div>
            </section>

            {/* Safety Info Section */}
            {submittedLog.safetyInfoSnapshot && (
              <section className="mb-8">
                <h3 className="text-xs font-black text-gray-900 mb-2 flex items-center gap-2">
                  <div className="w-1 h-3 bg-gray-900" />
                  2. 위험요인 및 안전 주의사항 (숙지 확인됨)
                </h3>
                <div className="border border-gray-200 p-3 rounded-sm space-y-3 bg-gray-50/30">
                  {submittedLog.safetyInfoSnapshot.hazards?.length > 0 && (
                    <div>
                      <p className="text-[8px] font-bold text-red-500 mb-1">● 주요 위험요인</p>
                      <ul className="grid grid-cols-1 gap-0.5">
                        {submittedLog.safetyInfoSnapshot.hazards.map((h: string, i: number) => (
                          <li key={i} className="text-[10px] text-gray-600 flex items-start gap-1">
                            <span>-</span> {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {submittedLog.safetyInfoSnapshot.precautions?.length > 0 && (
                    <div>
                      <p className="text-[8px] font-bold text-blue-500 mb-1">● 안전 주의사항</p>
                      <ul className="grid grid-cols-1 gap-0.5">
                        {submittedLog.safetyInfoSnapshot.precautions.map((p: string, i: number) => (
                          <li key={i} className="text-[10px] text-gray-600 flex items-start gap-1">
                            <span>-</span> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Dynamic Data Section */}
            <section className="mb-8">
              <h3 className="text-xs font-black text-gray-900 mb-2 flex items-center gap-2">
                <div className="w-1 h-3 bg-gray-900" />
                3. 작업 상세 내용 및 체크리스트
              </h3>
              <div className="border-t border-gray-200">
                {/* 통합된 작업 기간 표시 */}
                {(submittedLog.data.work_start || submittedLog.data.work_start_date) && (
                  <div className="flex border-b border-gray-200 min-h-[32px]">
                    <div className="w-1/3 bg-gray-50/50 p-1.5 flex items-center border-r border-gray-200">
                      <span className="text-[9px] font-bold text-gray-500">작업 기간</span>
                    </div>
                    <div className="w-2/3 p-1.5 flex items-center">
                      <div className="text-[10px] font-medium text-gray-900">
                        {submittedLog.data.work_start ? (
                          `${new Date(submittedLog.data.work_start).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\./g, '-').replace(/\s/g, ' ').replace(/- /g, ' ')} ~ ${submittedLog.data.work_end ? new Date(submittedLog.data.work_end).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\./g, '-').replace(/\s/g, ' ').replace(/- /g, ' ') : '-'}`
                        ) : (
                          `${submittedLog.data.work_start_date} ${submittedLog.data.work_start_time} ~ ${submittedLog.data.work_end_date} ${submittedLog.data.work_end_time}`
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {Object.entries(submittedLog.data).map(([key, value]) => {
                  const skipKeys = [
                    'name', 'contact', 'worker_name', 'worker_contact', 'visitorName', 'visitorContact',
                    'work_start_date', 'work_start_time', 'work_end_date', 'work_end_time',
                    'work_start', 'work_end'
                  ];
                  if (skipKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) return null;
                  return (
                    <div key={key} className="flex border-b border-gray-200 min-h-[32px]">
                      <div className="w-1/3 bg-gray-50/50 p-1.5 flex items-center border-r border-gray-200">
                        <span className="text-[9px] font-bold text-gray-500">{getFieldLabel(key)}</span>
                      </div>
                      <div className="w-2/3 p-1.5 flex items-center">
                        <div className="text-[10px] font-medium text-gray-900">
                          {typeof value === 'string' && value.startsWith('data:image/') ? (
                            <img src={value} alt={key} className="h-16 w-auto object-contain rounded-sm border border-gray-100" />
                          ) : Array.isArray(value) ? (
                            <div className="flex flex-wrap gap-1">
                              {value.map((v, i) => (
                                <span key={i} className="bg-gray-100 px-1 py-0.5 rounded text-[8px] border border-gray-200">✓ {v}</span>
                              ))}
                            </div>
                          ) : typeof value === 'boolean' ? (
                            value ? '예' : '아니오'
                          ) : (
                            String(value)
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Signature Section */}
            <section className="mt-12 pt-6 border-t-2 border-gray-900">
              <div className="flex flex-col items-center space-y-4">
                <p className="text-[10px] font-bold text-gray-900 text-center">위와 같이 안전작업 허가서를 제출하며, 현장 안전 수칙을 준수할 것을 서약합니다.</p>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-[8px] font-bold text-gray-400 mb-1">작업자 확인</p>
                    <div className="relative w-24 h-16 border border-gray-100 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                      <img src={submittedLog.signature} alt="Signature" className="h-full w-full object-contain mix-blend-multiply" />
                      <p className="absolute bottom-1 right-2 text-[7px] text-gray-300">(인)</p>
                    </div>
                    <p className="text-[10px] font-bold mt-1 text-gray-900">{submittedLog.visitorName}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-bold text-gray-400 mb-1">안전관리자 확인</p>
                    <div className="relative w-24 h-16 border border-gray-100 rounded-lg bg-gray-50 flex items-center justify-center">
                      <span className="text-[9px] text-gray-300 italic">서명 대기</span>
                    </div>
                    <p className="text-[10px] font-bold mt-1 text-gray-400">(서명)</p>
                  </div>
                </div>
                <p className="text-[9px] text-gray-400 pt-4">제출일: {new Date().toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </section>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 px-4">
            <Button className="w-full h-12 gap-2 shadow-lg" onClick={handleDownloadImage}>
              <Download className="w-4 h-4" /> 이미지로 저장하기
            </Button>
            <Button variant="outline" className="w-full h-12 bg-white" onClick={() => router.push(`/work-permit/v/${adminId}`)}>
              처음으로 돌아가기
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => router.push(`/work-permit/v/${adminId}`)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="font-bold text-gray-900 truncate">{adminData?.brandingTitle || '안전작업 허가서'}</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 mt-6">
        {!purpose ? (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          </div>
        ) : (
          <form onSubmit={handleInitialSubmit} className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-600 rounded-full" />
                허가서 정보 입력
              </h2>
              
              <DynamicForm
                fields={purpose.fields}
                values={formData}
                onChange={handleFieldChange}
                errors={errors}
              />
            </Card>

            <Button
              type="submit"
              className="w-full h-14 text-lg font-bold shadow-lg"
            >
              작업 허가서 제출하기
            </Button>
          </form>
        )}
      </main>

      {/* Safety Info Modal */}
      <AnimatePresence>
        {showSafetyInfo && safetyInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 bg-red-50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{purpose?.name}</h2>
                  <p className="text-xs text-red-600 font-bold">작업 전 위험요인 및 주의사항 숙지</p>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-8">
                <section className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    주요 위험요인
                  </h3>
                  <ul className="space-y-2">
                    {safetyInfo.hazards.map((hazard, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                        {hazard}
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500" />
                    안전 주의사항
                  </h3>
                  <ul className="space-y-2">
                    {safetyInfo.precautions.map((precaution, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                        {precaution}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100">
                <Button 
                  className="w-full h-14 text-lg font-bold shadow-lg bg-red-600 hover:bg-red-700" 
                  onClick={() => setShowSafetyInfo(false)}
                >
                  위험요인 숙지 완료
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Modal */}
      <AnimatePresence>
        {showPrivacyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">개인정보 수집 및 이용 동의</h2>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto text-sm text-gray-600 space-y-4">
                <p>안전작업 허가서 시스템은 원활한 작업 안전 관리를 위해 아래와 같이 개인정보를 수집합니다.</p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p><strong>1. 수집 항목:</strong> 성함, 연락처, 소속, 작업 종류 등 작성 항목 일체</p>
                  <p><strong>2. 수집 목적:</strong> 현장 안전 관리, 작업자 확인, 비상 시 연락</p>
                  <p><strong>3. 보유 기간:</strong> 수집일로부터 1년 또는 현장 규정 완료 시까지</p>
                </div>
              </div>
              <div className="p-6 bg-gray-50 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowPrivacyModal(false)}>취소</Button>
                <Button className="flex-1" onClick={handlePrivacyAgree}>동의 및 계속</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Signature Modal */}
      <AnimatePresence>
        {showSignatureModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">전자서명</h2>
                <p className="text-sm text-gray-500 mt-1">본인 확인을 위해 서명해 주세요.</p>
              </div>
              <div className="p-6">
                <SignaturePad
                  onSave={(data) => setSignature(data)}
                  onClear={() => setSignature('')}
                />
              </div>
              <div className="p-6 bg-gray-50 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowSignatureModal(false)}>이전</Button>
                <Button 
                  className="flex-1" 
                  onClick={() => handleFinalSubmit(signature)}
                  disabled={!signature || submitting}
                  isLoading={submitting}
                >
                  작성 완료
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
