'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { compressImage as compressImageUtil } from '@/app/lib/image-utils';
import { useAuth } from '@/app/context/AuthContext';
import { apiAuthHeaders } from '@/lib/api-client';
import { db, storage } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Save } from 'lucide-react';
import AIDisclaimer from '@/components/common/AIDisclaimer';

interface Analysis {
  risk_factors: string[];
  engineering_improvements: string[]; // 공학적 개선방안
  management_improvements: string[]; // 관리적 개선방안
  date?: string; // 저장 날짜
  title?: string; // 저장 제목
}

interface RiskAssessmentData {
  processName: string;
  riskFactor: string;
  severity: string;
  probability: string;
  riskLevel: string;
  countermeasure: string;
}

// 클라이언트 컴포넌트 - useSearchParams 사용
function ClientSideCamera() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showReanalyzeDialog, setShowReanalyzeDialog] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          const compressedImage = await compressImage(base64);
          setCapturedImage(compressedImage);
          
          const response = await fetch(compressedImage);
          const blob = await response.blob();
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          
          setImageFile(compressedFile);
          await analyzeImage(compressedFile);
        } catch (error) {
          console.error('이미지 압축/처리 중 오류:', error);
          const errorMessage = error instanceof Error ? error.message : '이미지 처리 중 오류가 발생했습니다.';
          setAnalysisError(`${errorMessage} 새로운 사진으로 다시 시작해주세요.`);
          setCapturedImage(null);
          setImageFile(null);
          setAnalysis(null);
          alert(`이미지 처리 중 오류가 발생했습니다. 새로운 사진으로 다시 시작해주세요.`);
        }
      };
      reader.onerror = () => {
        setAnalysisError('이미지 파일을 읽을 수 없습니다. 새로운 사진으로 다시 시작해주세요.');
        setCapturedImage(null);
        setImageFile(null);
        setAnalysis(null);
        alert('이미지 파일을 읽을 수 없습니다. 새로운 사진으로 다시 시작해주세요.');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('파일 리더 설정 중 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '파일 처리 중 오류가 발생했습니다.';
      setAnalysisError(`${errorMessage} 새로운 사진으로 다시 시작해주세요.`);
      alert(`파일 처리 중 오류가 발생했습니다. 새로운 사진으로 다시 시작해주세요.`);
    }
  };

  const analyzeImage = async (file: File) => {
    setIsLoading(true);
    setAnalysisError(null);
    try {
      let processedFile = file;
      if (file.type.includes('image/')) {
        try {
          processedFile = await extractStaticImageFromFile(file);
        } catch (conversionError) {
          console.warn('모션포토 변환 시도 중 오류, 원본 파일 사용:', conversionError);
          processedFile = file;
        }
      }

      const formData = new FormData();
      formData.append('image', processedFile);
      formData.append('processName', '사진');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: await apiAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '이미지 분석 중 오류가 발생했습니다.');
      }

      const data = await response.json();
      if (!data.analysis) {
        throw new Error('분석 결과를 받지 못했습니다.');
      }

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = data.analysis;
      const tables = tempDiv.querySelectorAll('table');
      const analysisData: Analysis = {
        risk_factors: [],
        engineering_improvements: [],
        management_improvements: [],
      };

      if (tables.length > 0) {
        const rows = tables[0].querySelectorAll('tbody tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 6) {
            const riskFactor = cells[0]?.textContent?.trim();
            const engineeringImprovement = cells[4]?.textContent?.trim();
            const managementImprovement = cells[5]?.textContent?.trim();
            if (riskFactor && !riskFactor.includes('사진에서 발견된 위험성은 없습니다')) 
              analysisData.risk_factors.push(riskFactor);
            if (engineeringImprovement && !engineeringImprovement.includes('추가적인 공학적 안전 조치가 필요하지 않습니다')) 
              analysisData.engineering_improvements.push(engineeringImprovement);
            if (managementImprovement && !managementImprovement.includes('추가적인 관리적 안전 조치가 필요하지 않습니다')) 
              analysisData.management_improvements.push(managementImprovement);
          }
        });
      }
      setAnalysis(analysisData);
    } catch (error: any) {
      console.error('Error:', error);
      const errorMessage = error.message || '이미지 분석 중 오류가 발생했습니다.';
      setAnalysisError(`${errorMessage} 새로운 사진으로 다시 시작해주세요.`);
      setAnalysis(null);
      alert(`${errorMessage} 새로운 사진으로 다시 시작해주세요.`);
    } finally {
      setIsLoading(false);
    }
  };

  const extractStaticImageFromFile = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      try {
        const url = URL.createObjectURL(file);
        const img: HTMLImageElement = document.createElement('img');
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              URL.revokeObjectURL(url);
              return reject(new Error('Canvas 컨텍스트를 생성할 수 없습니다. 일반 사진으로 다시 시도해주세요.'));
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
              if (!blob) {
                URL.revokeObjectURL(url);
                return reject(new Error('이미지 변환에 실패했습니다. 다른 형식의 사진을 시도해주세요.'));
              }
              const convertedFile = new File([blob], file.name, { 
                type: 'image/jpeg',
                lastModified: file.lastModified 
              });
              URL.revokeObjectURL(url);
              resolve(convertedFile);
            }, 'image/jpeg', 0.95);
          } catch (error) {
            URL.revokeObjectURL(url);
            const errorMessage = error instanceof Error ? `이미지 변환 중 오류: ${error.message}` : '이미지 변환 중 알 수 없는 오류가 발생했습니다.';
            reject(new Error(`${errorMessage} 다른 사진으로 다시 시도해주세요.`));
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('이미지를 로드할 수 없습니다. 유효한 이미지 파일인지 확인하고 다시 시도해주세요.'));
        };
        img.src = url;
      } catch (error) {
        const errorMessage = error instanceof Error ? `이미지 처리 중 오류: ${error.message}` : '이미지 처리 중 알 수 없는 오류가 발생했습니다.';
        reject(new Error(`${errorMessage} 다른 사진으로 다시 시도해주세요.`));
      }
    });
  };

  const handleReanalyzeClick = () => {
    setShowReanalyzeDialog(true);
  };
  
  const reanalyzeCurrentImage = async () => {
    setShowReanalyzeDialog(false);
    if (!imageFile && !capturedImage) {
      alert('분석할 이미지가 없습니다. 먼저 사진을 촬영해주세요.');
      return;
    }
    if (imageFile) {
      await analyzeImage(imageFile);
    } else if (capturedImage) {
      try {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        const file = new File([blob], "recaptured-image.jpg", { type: 'image/jpeg' });
        setImageFile(file);
        await analyzeImage(file);
      } catch (error) {
        console.error("이미지 변환 중 오류 발생:", error);
        setAnalysisError("이미지를 다시 분석할 수 없습니다. 새 이미지를 촬영해주세요.");
      }
    }
  };
  
  const reanalyzeWithNewImage = () => {
    setShowReanalyzeDialog(false);
    setCapturedImage(null);
    setImageFile(null);
    setAnalysis(null);
    setAnalysisError(null);
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 100);
  };

  const handleSaveResult = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!analysis || !capturedImage) return;
    
    setIsSaving(true);
    try {
      // 1. Firebase Storage에 이미지 업로드
      // Base64 문자열을 Blob으로 변환
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      // 파일 이름 생성 (사용자ID + 시간)
      const fileName = `photoAnalysis/${user.uid}/${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      
      // 업로드
      const uploadResult = await uploadBytes(storageRef, blob);
      
      // 2. 다운로드 URL 가져오기
      const downloadURL = await getDownloadURL(uploadResult.ref);
      
      // 3. Firestore에 데이터 저장 (이미지 URL 포함)
      await addDoc(collection(db, 'photoAnalysis'), {
        userId: user.uid,
        title: saveTitle || `사진분석 ${new Date().toLocaleDateString()}`,
        analysis: analysis,
        imageUrl: downloadURL, // Storage URL 저장
        createdAt: serverTimestamp(),
      });
      
      alert('분석 결과가 저장되었습니다.');
      setShowSaveModal(false);
    } catch (error) {
      console.error('Error saving analysis:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // 모바일 환경 감지를 위한 useEffect 추가
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkIfMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);
  
  const renderReanalyzeDialog = () => {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowReanalyzeDialog(false)}
        ></div>
        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative z-[110] animate-scaleIn">
          <h3 className="text-2xl font-black text-gray-900 mb-4 flex items-center gap-3">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            분석 방법 선택
          </h3>
          <p className="text-gray-500 font-medium mb-8 leading-relaxed">현재 사진으로 다시 분석하시겠습니까,<br/>아니면 새로운 사진을 선택하시겠습니까?</p>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={reanalyzeCurrentImage}
              className="flex items-center justify-center px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
            >
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              현재 사진으로 다시 분석
            </button>
            <button
              onClick={reanalyzeWithNewImage}
              className="flex items-center justify-center px-6 py-4 bg-green-600 text-white rounded-2xl font-black text-lg hover:bg-green-700 transition-all shadow-lg shadow-green-100 active:scale-95"
            >
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              새로운 사진으로 분석
            </button>
            <button
              onClick={() => setShowReanalyzeDialog(false)}
              className="mt-2 px-6 py-4 text-gray-500 bg-gray-100 rounded-2xl font-black text-lg hover:bg-gray-200 transition-all active:scale-95"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    );
  };

  const openCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const convertToRiskAssessmentData = (analysis: Analysis, processName: string = '작업'): RiskAssessmentData[] => {
    const result: RiskAssessmentData[] = [];
    if (!analysis.risk_factors || analysis.risk_factors.length === 0) {
      return result;
    }
    analysis.risk_factors.forEach((riskFactor, index) => {
      const engineeringImprovement = analysis.engineering_improvements[index] || '';
      const managementImprovement = analysis.management_improvements[index] || '';
      let countermeasure = '';
      if (engineeringImprovement && managementImprovement) {
        countermeasure = `[공학적] ${engineeringImprovement} [관리적] ${managementImprovement}`;
      } else if (engineeringImprovement) {
        countermeasure = `[공학적] ${engineeringImprovement}`;
      } else if (managementImprovement) {
        countermeasure = `[관리적] ${managementImprovement}`;
      }
      result.push({
        processName,
        riskFactor,
        severity: '3', 
        probability: '3', 
        riskLevel: '중간', 
        countermeasure
      });
    });
    return result;
  };

  const renderAnalysisTable = (analysis: Analysis) => {
    if (!analysis) return null;
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            위험 요인
          </h3>
          <div className="pl-4">
            <ul className="list-disc list-inside space-y-3">
              {analysis.risk_factors && analysis.risk_factors.length > 0 ? (
                analysis.risk_factors.map((factor, index) => (
                  <li key={index} className="text-gray-700">{factor}</li>
                ))
              ) : (
                <li className="text-gray-500">식별된 위험 요인이 없습니다.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            공학적 개선방안
          </h3>
          <div className="pl-4">
            <ul className="list-disc list-inside space-y-3">
              {analysis.engineering_improvements && analysis.engineering_improvements.length > 0 ? (
                analysis.engineering_improvements.map((improvement, index) => (
                  <li key={index} className="text-gray-700">{improvement}</li>
                ))
              ) : (
                <li className="text-gray-500">제안된 공학적 개선 방안이 없습니다.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            관리적 개선방안
          </h3>
          <div className="pl-4">
            <ul className="list-disc list-inside space-y-3">
              {analysis.management_improvements && analysis.management_improvements.length > 0 ? (
                analysis.management_improvements.map((improvement, index) => (
                  <li key={index} className="text-gray-700">{improvement}</li>
                ))
              ) : (
                <li className="text-gray-500">제안된 관리적 개선 방안이 없습니다.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const compressImage = async (
    imageDataUrl: string, 
    options: { maxWidth?: number; quality?: number; maxSize?: number } = {}
  ): Promise<string> => {
    try {
      const result = await compressImageUtil(
        imageDataUrl, 
        options.maxWidth || 1200, 
        options.maxWidth || 1200, 
        options.quality || 0.6
      );
      return result as string;
    } catch (error) {
      console.error('이미지 압축 중 오류:', error);
      return imageDataUrl;
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          const compressedImage = await compressImage(base64);
          setCapturedImage(compressedImage);
          const response = await fetch(compressedImage);
          const blob = await response.blob();
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          setImageFile(compressedFile);
          await analyzeImage(compressedFile);
        } catch (error) {
          console.error('드롭된 이미지 압축/처리 중 오류:', error);
          const errorMessage = error instanceof Error ? error.message : '이미지 처리 중 오류가 발생했습니다.';
          setAnalysisError(`${errorMessage} 새로운 사진으로 다시 시작해주세요.`);
          setCapturedImage(null);
          setImageFile(null);
          setAnalysis(null);
          alert(`이미지 처리 중 오류가 발생했습니다. 새로운 사진으로 다시 시작해주세요.`);
        }
      };
      reader.onerror = () => {
        setAnalysisError('이미지 파일을 읽을 수 없습니다. 새로운 사진으로 다시 시작해주세요.');
        setCapturedImage(null);
        setImageFile(null);
        setAnalysis(null);
        alert('이미지 파일을 읽을 수 없습니다. 새로운 사진으로 다시 시작해주세요.');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('드롭된 파일 리더 설정 중 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '파일 처리 중 오류가 발생했습니다.';
      setAnalysisError(`${errorMessage} 새로운 사진으로 다시 시작해주세요.`);
      alert(`파일 처리 중 오류가 발생했습니다. 새로운 사진으로 다시 시작해주세요.`);
    }
  };

  useEffect(() => {
    return () => {
      // 필요한 경우 클린업 로직 추가
    };
  }, [pathname, searchParams]);

  if (showDisclaimer) {
    return (
      <WorkspaceShell
        serviceHref="/camera"
        title="실시간 사진 위험 분석"
        description="사진을 즉시 분석하여 위험요인을 찾습니다."
      >
        <AIDisclaimer
          serviceName="사진 위험 분석 결과"
          accentColor="blue"
          onAgree={() => setShowDisclaimer(false)}
        />
      </WorkspaceShell>
    );
  }

  return (
    <>
    <WorkspaceShell
      serviceHref="/camera"
      title="실시간 사진 위험 분석"
      description="사진을 즉시 분석하여 위험요인을 찾습니다."
    >
      <div className="selection:bg-blue-100 selection:text-blue-700">
        <div className="w-full min-w-0">
          <div className="bg-white rounded-[2.5rem] shadow-md md:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.05)] border border-gray-50 overflow-hidden">
                <div className="p-6 md:p-12">
                  <div className="flex flex-col xl:flex-row gap-8 md:gap-16">
                    {/* 왼쪽: 사진 업로드 영역 */}
                    <div className="xl:w-[350px] shrink-0">
                      <div 
                        className={`rounded-[2.5rem] p-4 border-2 transition-all duration-500 cursor-pointer shadow-inner relative group ${
                          isDragging 
                            ? 'border-blue-500 bg-blue-50/50 scale-[0.98]' 
                            : 'border-gray-100 bg-gray-50/50 hover:bg-gray-100 hover:border-blue-100'
                        }`}
                        onClick={openCamera}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCapture}
                          ref={fileInputRef}
                          className="hidden"
                        />
                        {capturedImage ? (
                          <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden shadow-2xl">
                            <Image
                              src={capturedImage}
                              alt="Captured"
                              fill
                              className="object-cover"
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="bg-white/90 backdrop-blur-md p-4 rounded-full text-blue-600 shadow-xl">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-[4/3] flex flex-col items-center justify-center text-center p-6">
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm mb-8 text-blue-600 transform transition-all duration-700 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-xl group-hover:shadow-blue-50">
                              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                            <p className="text-gray-400 font-black text-xs uppercase tracking-[0.2em] mb-3">사진 업로드</p>
                            <p className="text-gray-500 text-base font-medium max-w-[200px] leading-relaxed">클릭하거나 사진을 이곳에 끌어다 놓으세요</p>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-300 font-bold uppercase tracking-[0.2em] text-center mt-8">최대 크기: 10MB (JPG, PNG, GIF)</p>
                    </div>

                    {/* 오른쪽: 분석 결과 영역 */}
                    <div className="flex-1 min-w-0">
                      {isLoading ? (
                        <div className="bg-gray-50/50 rounded-[3rem] p-12 md:p-24 flex flex-col items-center justify-center min-h-[450px] border border-gray-100">
                          <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-10"></div>
                          <p className="text-gray-900 font-black text-2xl md:text-3xl mb-3">정밀 분석 중</p>
                          <p className="text-gray-400 text-base md:text-lg">이미지에서 잠재적 위험 요소를 탐색하고 있습니다</p>
                        </div>
                      ) : analysis ? (
                        <div id="current-analysis-content" className="animate-scaleIn space-y-10">
                          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                            {renderAnalysisTable(analysis)}
                          </div>
                          <div className="flex flex-row justify-center items-center gap-3 md:gap-4 pb-4">
                            <button
                              onClick={handleReanalyzeClick}
                              className="group px-6 md:px-10 py-4 md:py-5 bg-white border-2 border-blue-600 text-blue-600 rounded-[2rem] font-black text-sm md:text-xl hover:bg-blue-600 hover:text-white transition-all duration-500 shadow-xl shadow-blue-50 flex items-center gap-2 md:gap-4 shrink-0"
                              disabled={isLoading}
                            >
                              <svg className="w-5 h-5 md:w-8 md:h-8 transition-transform duration-700 group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              다른 사진 분석
                            </button>
                            <button
                              onClick={() => {
                                setSaveTitle(`사진분석 ${new Date().toLocaleDateString()}`);
                                setShowSaveModal(true);
                              }}
                              className="p-4 md:p-5 text-gray-400 bg-white border-2 border-gray-100 rounded-[2rem] hover:text-amber-600 hover:border-amber-100 hover:bg-amber-50 transition-all duration-500 shadow-lg shadow-gray-100 flex items-center justify-center shrink-0"
                              title="저장하기"
                            >
                              <Save className="w-6 h-6 md:w-8 md:h-8" />
                            </button>
                          </div>
                        </div>
                      ) : analysisError ? (
                        <div className="bg-red-50 rounded-[3rem] p-12 md:p-20 flex flex-col items-center justify-center text-center border border-red-100 min-h-[450px]">
                          <div className="bg-white p-6 rounded-[2rem] shadow-sm text-red-500 mb-8">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <p className="text-red-900 font-black text-2xl mb-4">분석 오류 발생</p>
                          <p className="text-red-600 text-base font-medium mb-10 leading-relaxed max-w-md">{analysisError}</p>
                          <button onClick={reanalyzeWithNewImage} className="px-10 py-4 bg-red-600 text-white rounded-[2rem] font-black text-base uppercase tracking-widest shadow-xl shadow-red-200 hover:bg-red-700 transition-all">
                            다시 시도하기
                          </button>
                        </div>
                      ) : (
                        <div className="bg-gray-50/50 rounded-[3rem] p-12 md:p-24 flex flex-col items-center justify-center min-h-[450px] border border-gray-100 border-dashed group hover:bg-gray-100/50 transition-all duration-500">
                          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm text-gray-200 mb-10 transform transition-all duration-700 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-xl group-hover:shadow-blue-50">
                            <svg className="w-16 h-16 md:w-24 md:h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <p className="text-gray-400 font-black text-xl md:text-2xl tracking-tight mb-4 text-center">분석할 사진을 업로드해 주세요</p>
                          <p className="text-gray-400/60 text-sm md:text-base font-medium text-center max-w-[280px]">위험 요소를 AI가 즉시 감지하여 안전 수칙을 제안합니다</p>
                        </div>
                      )}
                    </div>
                  </div>
        </div>
      </div>
    </div>
  </div>

    <style jsx global>{`
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleIn {
        from { transform: scale(0.98); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .animate-fadeIn { animation: fadeIn 0.5s ease-out forwards; }
      .animate-scaleIn { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    `}</style>

    {/* 다른 사진 분석 선택 모달 추가 */}
    {showReanalyzeDialog && renderReanalyzeDialog()}

    {/* 저장 모달 추가 */}
    {showSaveModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowSaveModal(false)}
        ></div>
        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative z-[110] animate-scaleIn">
          <h3 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
            <Save className="w-8 h-8 text-amber-600" />
            분석 결과 저장
          </h3>
          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-500 mb-2 ml-1">저장 제목</label>
            <input
              type="text"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder="예: OO 1층 작업구역 분석"
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-amber-500 focus:bg-white outline-none transition-all font-bold text-gray-900"
              autoFocus
            />
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setShowSaveModal(false)}
              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-lg hover:bg-gray-200 transition-all"
            >
              취소
            </button>
            <button 
              onClick={handleSaveResult}
              disabled={isSaving}
              className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black text-lg hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </div>
      </div>
    )}
    </WorkspaceShell>
  </>
  );
}

export default function CameraPage() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <ClientSideCamera />
    </Suspense>
  );
}