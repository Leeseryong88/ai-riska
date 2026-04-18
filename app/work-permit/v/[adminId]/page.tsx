'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { VisitPurpose, AdminUser } from '../../_lib/types';
import { Card, Button } from '../../_components/ui/Button';
import { useParams, useRouter } from 'next/navigation';
import { ClipboardList, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../_lib/utils';

export default function VisitorHomePage() {
  const params = useParams();
  const adminId = params.adminId as string;
  const router = useRouter();
  
  const [purposes, setPurposes] = useState<VisitPurpose[]>([]);
  const [adminData, setAdminData] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminId) {
      setError('올바르지 않은 접근입니다. QR코드를 다시 확인해 주세요.');
      setLoading(false);
      return;
    }

    const cleanAdminId = adminId.trim();

    setLoading(true);
    setError(null);

    const fetchAdmin = async () => {
      try {
        const adminDoc = await getDoc(doc(db, 'users', cleanAdminId));
        if (adminDoc.exists()) {
          setAdminData(adminDoc.data() as AdminUser);
        } else {
          setError('등록되지 않은 관리자 계정입니다.');
        }
      } catch (err) {
        console.error('Error fetching admin:', err);
      }
    };

    fetchAdmin();

    const q = query(
      collection(db, 'purposes'),
      where('ownerId', '==', cleanAdminId),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as VisitPurpose));
      
      const sortedData = data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      
      setPurposes(sortedData);
      setLoading(false);
    }, (err) => {
      console.error('Firestore purposes snapshot error:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [adminId]);

  const handleNavigateToForm = (purposeId: string) => {
    router.push(`/work-permit/v/${adminId}/${purposeId}`);
  };

  if (loading || !adminData) {
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
        <Button className="w-full max-w-xs" onClick={() => window.location.reload()}>
          다시 시도하기
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center relative">
      {adminData?.brandingType === 'banner' && adminData?.brandingLogo && (
        <div className="w-full h-48 md:h-64 flex-shrink-0 relative overflow-hidden shadow-md">
          <img 
            src={adminData.brandingLogo} 
            className="w-full h-full object-cover" 
            style={{ objectPosition: `center ${adminData.brandingBannerPosition ?? 50}%` }}
            alt="Banner" 
            crossOrigin="anonymous"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>
      )}

      <header className={cn(
        "w-full max-w-md text-center mb-10",
        adminData?.brandingType === 'banner' ? "mt-8 px-6" : "mt-12 px-6"
      )}>
        {(!adminData?.brandingType || adminData.brandingType === 'icon') && (
          <div 
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl shadow-xl mb-6 overflow-hidden transition-colors"
            style={{ backgroundColor: adminData?.brandingColor || '#2563eb' }}
          >
            {adminData?.brandingLogo ? (
              <img src={adminData.brandingLogo} alt="Logo" className="w-full h-full object-contain p-3" crossOrigin="anonymous" />
            ) : (
              <ClipboardList className="w-10 h-10 text-white" />
            )}
          </div>
        )}
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{adminData?.brandingTitle || '안전작업 허가서'}</h1>
        <p className="text-gray-500 mt-3 font-medium">진행할 작업 종류를 선택해 주세요.</p>
      </header>

      <main className="w-full max-w-md px-6 space-y-4">
        {purposes.length === 0 ? (
          <Card className="p-10 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
              <ClipboardList className="w-8 h-8 text-gray-300" />
            </div>
            <div>
              <p className="text-gray-600 font-bold">등록된 작업 허가서 양식이 없습니다.</p>
              <p className="text-sm text-gray-400 mt-2">관리자가 아직 허가서 서식을 생성하지 않았거나<br />일시적인 오류일 수 있습니다.</p>
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => window.location.reload()}>
              새로고침
            </Button>
          </Card>
        ) : (
          purposes.map((purpose, index) => (
            <motion.div
              key={purpose.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <button
                onClick={() => handleNavigateToForm(purpose.id)}
                className="w-full text-left group"
              >
                <Card className="p-5 flex items-center justify-between hover:border-blue-500 hover:shadow-md transition-all active:scale-[0.98]">
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {purpose.name}
                    </h3>
                    {purpose.description && (
                      <p className="text-sm text-gray-500 mt-1">{purpose.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </Card>
              </button>
            </motion.div>
          ))
        )}
      </main>

      <footer className="mt-auto pt-10 pb-6 text-center space-y-2">
        <p className="text-[10px] text-gray-300 tracking-widest uppercase">Safe Work Permit System</p>
      </footer>
    </div>
  );
}
