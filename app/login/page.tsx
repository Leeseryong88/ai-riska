'use client';

import React, { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
  signOut
} from 'firebase/auth';
import { auth, db } from '@/app/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [activeTermsModal, setActiveTermsModal] = useState<'privacy' | 'service' | null>(null);
  const [verificationPopup, setVerificationPopup] = useState<{
    title: string;
    message: string;
  } | null>(null);
  
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && user.emailVerified && userProfile) {
      router.push('/');
    }
  }, [user, userProfile, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && user.emailVerified && !userProfile) {
      setIsSignUp(true);
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

  const resetSignUpState = () => {
    setName('');
    setOrganization('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setPrivacyAgreed(false);
    setTermsAgreed(false);
  };

  const handleCancelSignUp = () => {
    setIsSignUp(false);
    setError('');
    setNotice('');
    resetSignUpState();
  };

  const getAuthErrorMessage = (err: any) => {
    const code = err?.code || '';
    if (code === 'auth/email-already-in-use') return '이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해주세요.';
    if (code === 'auth/invalid-email') return '이메일 형식이 올바르지 않습니다.';
    if (code === 'auth/weak-password') return '비밀번호는 6자 이상으로 입력해주세요.';
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    }
    if (code === 'auth/too-many-requests') return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
    return err?.message || '처리 중 오류가 발생했습니다.';
  };

  const handlePasswordReset = async () => {
    if (resetLoading) return;

    const targetEmail = email.trim();
    setError('');
    setNotice('');

    if (!targetEmail) {
      setError('비밀번호를 재설정할 이메일을 입력해주세요.');
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setVerificationPopup({
        title: '비밀번호 재설정 안내',
        message: `${targetEmail} 주소가 가입된 계정이라면 비밀번호 변경 링크가 발송됩니다. 메일함에서 링크를 눌러 새 비밀번호를 설정한 뒤 다시 로그인해주세요. 메일이 보이지 않으면 스팸함도 확인해주세요.`,
      });
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    } finally {
      setResetLoading(false);
    }
  };

  const termsModalContent = activeTermsModal === 'privacy'
    ? {
      title: '개인정보 처리방침',
      sections: [
        {
          heading: '1. 수집하는 개인정보',
          body: '회원가입 및 계정 관리를 위해 이메일, 비밀번호, 이름, 소속, 전화번호를 수집합니다. 서비스 이용 과정에서 안전관리 문서, 현장 사진, 위험성평가 내용, 작업허가 기록, 회의록, 협력업체 정보, 근로자 의견, 파일 업로드 내역 등 사용자가 입력하거나 저장한 업무 데이터가 함께 처리될 수 있습니다.',
        },
        {
          heading: '2. 이용 목적',
          body: '수집한 정보는 회원 식별, 이메일 인증, 로그인 보안, 구독 및 이용 권한 확인, AI 위험 분석과 문서 초안 생성, 안전보건계획서·작업계획서·체크리스트·안전일지·작업허가서·회의록·협력업체 관리 등 서비스 제공과 고객 문의 대응에 사용됩니다.',
        },
        {
          heading: '3. 보관 및 삭제',
          body: '회원 정보와 사용자가 저장한 업무 데이터는 서비스 제공 기간 동안 보관하며, 회원 탈퇴 또는 삭제 요청 시 관련 법령상 보존 의무가 있는 정보를 제외하고 지체 없이 삭제합니다. 법령 또는 분쟁 대응을 위해 필요한 최소 정보는 정해진 기간 동안 별도로 보관할 수 있습니다.',
        },
        {
          heading: '4. 제3자 제공 및 외부 처리',
          body: '서비스 제공을 위해 Firebase 인증·데이터베이스·스토리지, AI 분석 API, 이메일 발송 서비스 등 외부 인프라가 사용될 수 있습니다. 이 경우 개인정보와 업무 데이터는 인증, 저장, 분석, 알림 발송 등 필요한 목적 범위에서만 처리됩니다.',
        },
        {
          heading: '5. 이용자의 권리',
          body: '이용자는 본인의 개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다. 현장 사진이나 문서에는 개인정보 또는 민감한 현장 정보가 포함될 수 있으므로 업로드 전 필요한 권한과 동의를 확보해야 합니다.',
        },
      ],
    }
    : {
      title: '서비스 이용약관',
      sections: [
        {
          heading: '1. 서비스의 성격',
          body: '모두의 안전은 현장 사진 위험 분석, 위험성평가, 안전보건계획서, 작업계획서, 안전점검 체크리스트, 안전보건관리비 계획, 일일 안전일지, 조직도, 회의록, 유해위험기계기구, 안전작업 허가서, 협력업체 관리, 근로자 의견청취, 결과 저장소를 지원하는 안전관리 실무 보조 서비스입니다.',
        },
        {
          heading: '2. AI 결과와 사용자 책임',
          body: 'AI가 생성한 분석 결과와 문서 초안은 참고용 보조 자료입니다. 최종 적용 전 현장 책임자와 안전관리자가 실제 작업 조건, 관련 법령, 발주처 기준, 사업장 내부 규정에 맞는지 반드시 검토하고 수정해야 합니다.',
        },
        {
          heading: '3. 입력 자료와 권한',
          body: '이용자는 현장 사진, 작업 정보, 근로자 의견, 협력업체 서류, 회의록, 작업허가 기록 등 입력 자료를 사용할 권한이 있어야 합니다. 타인의 개인정보, 영업비밀, 법령상 제한 정보는 필요한 동의와 권한 없이 업로드하거나 공유할 수 없습니다.',
        },
        {
          heading: '4. 금지 행위',
          body: '허위 정보 입력, 타인 계정 사용, 서비스 무단 복제·분해·우회, 보안 취약점 악용, 불법 자료 업로드, AI 결과를 검토 없이 법적 확정 문서처럼 사용하는 행위, 서비스 운영을 방해하는 행위를 금지합니다.',
        },
        {
          heading: '5. 서비스 변경 및 제한',
          body: '서비스 기능, 요금, 제공 범위는 운영 상황과 법령 변경에 따라 변경될 수 있습니다. 시스템 점검, 장애, 보안 위험, 이용약관 위반이 있는 경우 서비스 이용이 일시적으로 제한될 수 있습니다.',
        },
      ],
    };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');
    setNotice('');

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
        }

        if (!privacyAgreed || !termsAgreed) {
          throw new Error('개인정보 처리방침과 서비스 이용약관에 모두 동의해주세요.');
        }

        let currentUser = null;

        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          currentUser = userCredential.user;
          await updateProfile(currentUser, { displayName: name });
          await sendEmailVerification(currentUser);
        } catch (err: any) {
          throw new Error(getAuthErrorMessage(err));
        }

        if (currentUser) {
          try {
            await setDoc(doc(db, 'users', currentUser.uid), {
              uid: currentUser.uid,
              email: currentUser.email,
              name,
              organization,
              phone,
              emailVerified: false,
              createdAt: new Date().toISOString(),
              subscriptionActive: false,
              subscriptionPlanAmount: 28900,
              terms: {
                privacyAgreed: true,
                privacyAgreedAt: new Date().toISOString(),
                serviceTermsAgreed: true,
                serviceTermsAgreedAt: new Date().toISOString(),
                version: '2026-04-27',
              },
            });
          } catch (err: any) {
            await deleteUser(currentUser);
            throw new Error(`사용자 정보 저장 실패: ${err.message}`);
          }
        }

        await signOut(auth);
        setIsSignUp(false);
        resetSignUpState();
        setNotice('인증 메일을 보냈습니다. 이메일의 인증 링크를 누른 뒤 로그인해주세요.');
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await userCredential.user.reload();

        if (!userCredential.user.emailVerified) {
          await sendEmailVerification(userCredential.user);
          await signOut(auth);
          setVerificationPopup({
            title: '이메일 인증이 필요합니다',
            message: '회원가입한 이메일로 인증 메일을 다시 보냈습니다. 메일함에서 인증 링크를 누른 뒤 다시 로그인해주세요. 메일이 보이지 않으면 스팸함도 확인해주세요.',
          });
          return;
        }

        await setDoc(doc(db, 'users', userCredential.user.uid), {
          emailVerified: true,
          emailVerifiedAt: new Date().toISOString(),
        }, { merge: true });

        router.push('/');
      }
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false); // 에러 발생 시 로딩 해제
    }
  };

  if (authLoading) return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;

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

        {notice && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg mb-4 text-sm">
            {notice}
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
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
              minLength={6}
            />
            {!isSignUp && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetLoading}
                  className="text-sm font-semibold text-blue-600 hover:underline disabled:opacity-50"
                >
                  {resetLoading ? '메일 발송 중...' : '비밀번호 찾기'}
                </button>
              </div>
            )}
          </div>

          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                required
                minLength={6}
              />
            </div>
          )}

          {isSignUp && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <div className="flex gap-3">
                <input
                  id="privacy-agreement"
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4"
                  required
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="privacy-agreement" className="font-semibold">
                      개인정보 처리방침에 동의합니다.
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTermsModal('privacy')}
                      className="shrink-0 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      자세히 보기
                    </button>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    회원 식별과 현장 안전관리 서비스 제공을 위해 이메일, 이름, 소속, 전화번호를 수집하며,
                    AI 분석·문서 생성·저장소·작업허가·협력업체 관리 등 서비스 운영 목적 범위에서 이용합니다.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <input
                  id="service-terms-agreement"
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4"
                  required
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="service-terms-agreement" className="font-semibold">
                      서비스 이용약관에 동의합니다.
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTermsModal('service')}
                      className="shrink-0 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      자세히 보기
                    </button>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    모두의 안전은 위험성평가, 안전보건계획서, 작업계획서, 체크리스트, 안전일지 등 실무 보조 도구를
                    제공하며, 생성 결과는 현장 책임자가 검토한 뒤 관련 법령과 사업장 기준에 맞게 사용해야 합니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? '처리 중...' : (isSignUp ? '가입하기' : '로그인')}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-600">
          {isSignUp ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}
          <button
            onClick={() => {
              if (isSignUp) {
                handleCancelSignUp();
              } else {
                setIsSignUp(true);
                setError('');
                setNotice('');
              }
            }}
            className="ml-2 text-blue-600 font-bold hover:underline"
          >
            {isSignUp ? '로그인' : '회원가입'}
          </button>
        </div>
      </div>

      {activeTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{termsModalContent.title}</h2>
                <p className="mt-1 text-xs text-gray-500">시행일: 2026년 4월 27일</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTermsModal(null)}
                className="rounded-full px-3 py-1 text-sm font-semibold text-gray-500 hover:bg-gray-100"
                aria-label="약관 닫기"
              >
                닫기
              </button>
            </div>
            <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5 text-sm leading-6 text-gray-700">
              {termsModalContent.sections.map((section) => (
                <section key={section.heading}>
                  <h3 className="mb-2 font-bold text-gray-900">{section.heading}</h3>
                  <p>{section.body}</p>
                </section>
              ))}
              <div className="rounded-lg bg-blue-50 p-4 text-xs leading-5 text-blue-800">
                본 약관은 서비스 화면에서 동의한 시점의 버전으로 기록됩니다. 세부 운영 정책이나 법령 변경이 있는 경우
                내용이 개정될 수 있으며, 중요한 변경은 서비스 내 안내를 통해 고지합니다.
              </div>
            </div>
          </div>
        </div>
      )}

      {verificationPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
              !
            </div>
            <h2 className="text-xl font-bold text-gray-900">{verificationPopup.title}</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">{verificationPopup.message}</p>
            <button
              type="button"
              onClick={() => setVerificationPopup(null)}
              className="mt-6 w-full rounded-lg bg-blue-600 p-3 font-bold text-white transition hover:bg-blue-700"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
