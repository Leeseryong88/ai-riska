'use client';

import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  deleteUser,
  signOut
} from 'firebase/auth';
import { auth, db } from '@/app/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGoogleSignUp, setIsGoogleSignUp] = useState(false);
  
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();

  useEffect(() => {
    // 유저와 프로필이 모두 있으면 대시보드로 이동
    if (!authLoading && user && userProfile) {
      router.push('/');
    }
  }, [user, userProfile, authLoading, router]);

  useEffect(() => {
    // 유저는 있지만 프로필이 없는 경우 (구글 로그인 직후 등) 회원가입 모드로 강제 전환
    if (!authLoading && user && !userProfile) {
      setIsSignUp(true);
      // 구글 로그인 시도 중인 경우에만 구글 가입 상태로 표시
      if (user.providerData.some(p => p.providerId === 'google.com')) {
        setIsGoogleSignUp(true);
        setName(user.displayName || '');
        setEmail(user.email || '');
      }
    }
  }, [user, userProfile, authLoading]);

  // 전화번호 자동 하이픈 포맷팅 함수
  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Firestore에서 유저 정보 확인
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // 신규 사용자면 가입 모드로 전환
        setIsSignUp(true);
        setIsGoogleSignUp(true);
        setName(user.displayName || '');
        setEmail(user.email || '');
        setError('추가 정보를 입력하여 회원가입을 완료해주세요. 취소 시 계정 정보가 삭제됩니다.');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSignUp = async () => {
    const currentUser = auth.currentUser;
    if (currentUser && isGoogleSignUp) {
      try {
        setLoading(true);
        // 가입을 완료하지 않은 구글 계정 삭제
        await deleteUser(currentUser);
        setIsSignUp(false);
        setIsGoogleSignUp(false);
        setName('');
        setEmail('');
        setOrganization('');
        setPhone('');
        setError('가입이 취소되었습니다.');
      } catch (err: any) {
        console.error('Account cleanup error:', err);
        // 재인증이 필요한 경우 로그아웃만 진행
        await signOut(auth);
        setIsSignUp(false);
        setIsGoogleSignUp(false);
      } finally {
        setLoading(false);
      }
    } else {
      setIsSignUp(false);
      setIsGoogleSignUp(false);
      setError('');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        let currentUser = auth.currentUser;

        if (!isGoogleSignUp) {
          // 일반 이메일 회원가입
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            currentUser = userCredential.user;
            await updateProfile(currentUser, { displayName: name });
          } catch (err: any) {
            throw new Error(`인증 계정 생성 실패: ${err.message}`);
          }
        }
        
        if (currentUser) {
          try {
            // Firestore에 추가 정보 저장 (소속, 이름, 전화번호 등)
            await setDoc(doc(db, 'users', currentUser.uid), {
              uid: currentUser.uid,
              email: currentUser.email,
              name,
              organization,
              phone,
              createdAt: new Date().toISOString(),
              subscriptionActive: false,
              subscriptionPlanAmount: 28900,
            });
            // 성공 시 페이지 이동은 AuthGuard 또는 useEffect가 처리
          } catch (err: any) {
            // Firestore 저장 실패 시 생성된 인증 계정 삭제 (데이터 불일치 방지)
            if (!isGoogleSignUp) {
              await deleteUser(currentUser);
            }
            throw new Error(`사용자 정보 저장 실패: ${err.message}`);
          }
        }
      } else {
        // 로그인
        await signInWithEmailAndPassword(auth, email, password);
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false); // 에러 발생 시 로딩 해제
    }
  };

  if (authLoading && !isGoogleSignUp) return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">모두의 안전</h1>
          <p className="text-gray-600">{isSignUp ? '회원가입' : '로그인'}하여 안전관리 실무를 시작하세요</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">소속</label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                  placeholder="010-0000-0000"
                  maxLength={13}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
              required
              disabled={isGoogleSignUp}
            />
          </div>

          {!isGoogleSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required={!isGoogleSignUp}
                minLength={6}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? '처리 중...' : (isSignUp ? '가입하기' : '로그인')}
          </button>

          {isGoogleSignUp && (
            <button
              type="button"
              onClick={handleCancelSignUp}
              disabled={loading}
              className="w-full mt-2 text-gray-500 text-sm font-medium hover:underline"
            >
              가입 취소 (계정 삭제)
            </button>
          )}
        </form>

        <div className="mt-6">
          <div className="relative flex items-center justify-center mb-4">
            <div className="border-t w-full"></div>
            <span className="bg-white px-3 text-sm text-gray-500 absolute">또는</span>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border p-3 rounded-lg hover:bg-gray-50 transition"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            <span>Google로 로그인</span>
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-gray-600">
          {isSignUp ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}
          <button
            onClick={() => isSignUp ? handleCancelSignUp() : setIsSignUp(true)}
            className="ml-2 text-blue-600 font-bold hover:underline"
          >
            {isSignUp ? '로그인' : '회원가입'}
          </button>
        </div>
      </div>
    </div>
  );
}
