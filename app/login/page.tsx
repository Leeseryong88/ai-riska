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
  const [duplicateAccountEmail, setDuplicateAccountEmail] = useState('');
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [activeTermsModal, setActiveTermsModal] = useState<'privacy' | 'service' | null>(null);
  const [verificationPopup, setVerificationPopup] = useState<{
    title: string;
    message: string;
  } | null>(null);
  
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();

  const normalizedEmail = email.trim().toLowerCase();
  const passwordRequirements = [
    { label: '8자 이상', met: password.length >= 8 },
    { label: '영문 포함', met: /[A-Za-z]/.test(password) },
    { label: '숫자 포함', met: /\d/.test(password) },
    { label: '특수문자 포함', met: /[^A-Za-z0-9]/.test(password) },
  ];
  const isPasswordReady = passwordRequirements.every((requirement) => requirement.met);
  const passwordMismatch = isSignUp && confirmPassword.length > 0 && password !== confirmPassword;

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

  const isValidPhoneNumber = (value: string) => /^010-\d{4}-\d{4}$/.test(value);

  const resetSignUpState = () => {
    setName('');
    setOrganization('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setDuplicateAccountEmail('');
    setPrivacyAgreed(false);
    setTermsAgreed(false);
  };

  const handleCancelSignUp = () => {
    setIsSignUp(false);
    setError('');
    setNotice('');
    resetSignUpState();
  };

  const switchToLoginWithCurrentEmail = () => {
    setIsSignUp(false);
    setError('');
    setNotice('가입된 이메일로 로그인해주세요. 비밀번호가 기억나지 않으면 비밀번호 찾기를 이용할 수 있습니다.');
    setPassword('');
    setConfirmPassword('');
    setDuplicateAccountEmail('');
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

  const isDuplicateEmailError = (err: any) => err?.code === 'auth/email-already-in-use';

  const handlePasswordReset = async () => {
    if (resetLoading) return;

    const targetEmail = normalizedEmail;
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
      effectiveDate: '2025년 5월 1일',
      sections: [
        {
          heading: '제1조 개인정보의 처리 목적',
          body: '개인사업자 모두컴퍼니는 모두의 안전 서비스를 운영함에 있어 이용자의 개인정보를 중요하게 생각하며, 개인정보 보호법 등 관련 법령에 따라 개인정보를 안전하게 처리하고 보호하기 위하여 본 개인정보 처리방침을 공개합니다. 회사는 회원가입 및 계정 관리, 서비스 제공 및 운영, 결제 및 구독 관리, 고객 상담 및 민원 처리, 서비스 개선과 통계 분석, 이용자가 별도로 동의한 마케팅 안내를 위하여 개인정보를 처리합니다. 처리한 개인정보는 고지한 목적 외의 용도로 이용하지 않으며, 이용 목적이 변경되는 경우 관련 법령에 따라 별도 동의를 받는 등 필요한 조치를 이행합니다.',
        },
        {
          heading: '제2조 처리하는 개인정보 항목',
          body: '회사는 서비스 제공에 필요한 최소한의 개인정보를 수집합니다. 회원가입 및 계정 관리를 위해 이름, 이메일, 비밀번호, 소속, 전화번호, 이메일 인증 여부, 가입일시를 처리합니다. 서비스 이용 과정에서는 현장명, 작업 정보, 안전관리 문서, 현장 사진, 위험성평가 내용, 안전점검 기록, 작업허가 기록, 회의록, 협력업체 정보, 근로자 의견, 첨부파일 등 이용자가 직접 입력하거나 업로드한 정보가 처리될 수 있습니다. 결제 및 구독 관리를 위해 결제금액, 결제일시, 결제상태, 구독상태, 결제수단 식별정보, 결제 승인번호, 환불 내역, 사업자명, 사업자등록번호, 담당자 정보, 세금계산서 발행에 필요한 정보를 처리할 수 있습니다. 단, 신용카드 번호 등 결제수단의 민감한 원본 정보는 원칙적으로 회사가 직접 저장하지 않으며, 정기결제 처리는 토스페이먼츠를 통해 이루어집니다. 고객 상담 시에는 이름, 이메일, 전화번호, 소속, 문의 내용, 상담 이력이 처리될 수 있으며, 서비스 이용 과정에서 접속 IP, 쿠키, 접속 일시, 브라우저 정보, 기기 정보, 운영체제 정보, 오류 및 장애 기록, 보안 관련 로그가 자동 생성될 수 있습니다.',
        },
        {
          heading: '제3조 개인정보의 처리 및 보유 기간',
          body: '회사는 개인정보의 수집·이용 목적이 달성되면 지체 없이 해당 정보를 파기합니다. 회원 정보는 회원 탈퇴 또는 계정 삭제 시까지 보관하며, 분쟁 대응, 부정 이용 방지, 법령상 보존 의무가 있는 경우 필요한 기간 동안 보관할 수 있습니다. 서비스 이용 데이터는 서비스 이용 기간 동안 보관하며, 이용계약 종료 또는 삭제 요청 시 관련 법령 및 내부 정책에 따라 삭제합니다. 다만 백업 데이터는 시스템 운영 정책에 따라 일정 기간 후 순차적으로 삭제될 수 있습니다. 고객 상담 및 문의 기록은 상담 완료 후 3년간 보관할 수 있습니다. 계약 또는 청약철회 등에 관한 기록, 대금결제 및 재화 등의 공급에 관한 기록, 전자금융거래에 관한 기록, 세금계산서 발행에 관한 기록은 5년간 보관하며, 소비자 불만 또는 분쟁처리에 관한 기록은 3년, 웹사이트 방문 기록은 3개월간 보관합니다.',
        },
        {
          heading: '제4조 개인정보의 제3자 제공',
          body: '회사는 이용자의 개인정보를 본 처리방침에서 정한 목적 범위 내에서만 처리하며, 원칙적으로 제3자에게 제공하지 않습니다. 다만 이용자가 사전에 동의한 경우, 법령에 특별한 규정이 있는 경우, 수사기관·법원·감독기관 등 관계기관이 적법한 절차에 따라 요청한 경우, 이용자 또는 제3자의 생명·신체·재산상 이익을 보호하기 위해 필요한 경우에는 개인정보를 제공할 수 있습니다.',
        },
        {
          heading: '제5조 개인정보 처리업무의 위탁',
          body: '회사는 안정적인 서비스 제공을 위하여 개인정보 처리업무의 일부를 외부 업체에 위탁할 수 있습니다. Firebase(서울 리전)는 회원 인증, 데이터 저장, 파일 보관, 서비스 인프라 운영 업무를 수행하며, 보유 및 이용기간은 회원 탈퇴 또는 위탁계약 종료 시까지입니다. 토스페이먼츠는 정기결제, 결제 승인, 결제 취소, 결제 내역 관리 업무를 수행하며, 보유 및 이용기간은 회원 탈퇴, 결제 목적 달성 또는 관계 법령상 보관기간까지입니다. 회사는 위탁계약 체결 시 개인정보 보호법에 따라 위탁업무 수행 목적 외 개인정보 처리 금지, 안전성 확보조치, 재위탁 제한, 수탁자 관리·감독, 손해배상 책임 등에 관한 사항을 문서로 정하고, 수탁자가 개인정보를 안전하게 처리하는지 관리·감독합니다. 위탁업체 또는 위탁업무의 내용이 변경되는 경우 본 개인정보 처리방침을 통해 공개합니다.',
        },
        {
          heading: '제6조 개인정보의 파기',
          body: '회사는 개인정보 보유기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 해당 개인정보를 파기합니다. 전자적 파일 형태의 개인정보는 복구 또는 재생이 어렵도록 안전한 방법으로 삭제합니다. 종이 문서에 기록된 개인정보는 분쇄하거나 소각하는 방식으로 파기합니다. 다른 법령에 따라 개인정보를 계속 보존해야 하는 경우에는 해당 정보를 별도의 저장 공간에 분리하여 보관하고, 법령상 목적 외로 이용하지 않습니다.',
        },
        {
          heading: '제7조 이용자와 법정대리인의 권리',
          body: '이용자는 언제든지 회사에 대해 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다. 권리 행사는 이메일 등을 통해 요청할 수 있으며, 회사는 본인 여부를 확인한 후 관련 법령에 따라 지체 없이 조치합니다. 이용자의 법정대리인 또는 위임을 받은 자도 이용자를 대신하여 권리를 행사할 수 있으며, 이 경우 회사는 위임장 등 정당한 대리권을 확인할 수 있는 자료를 요청할 수 있습니다. 다만 다른 법령에서 해당 개인정보의 보관을 요구하거나, 서비스 제공 및 계약 이행을 위해 필요한 경우에는 삭제 또는 처리정지 요청이 제한될 수 있습니다.',
        },
        {
          heading: '제8조 만 14세 미만 아동의 개인정보',
          body: '회사는 원칙적으로 만 14세 미만 아동의 회원가입을 허용하지 않습니다. 만 14세 미만 아동의 개인정보가 수집된 사실을 확인한 경우, 회사는 지체 없이 해당 정보를 삭제하거나 필요한 조치를 취합니다.',
        },
        {
          heading: '제9조 개인정보의 안전성 확보조치',
          body: '회사는 개인정보의 안전한 처리를 위하여 개인정보 접근 권한의 최소화, 비밀번호 등 인증정보의 암호화 또는 안전한 방식의 처리, 개인정보 처리 시스템에 대한 접근 통제, 보안 프로그램 및 클라우드 보안 기능을 활용한 보호조치, 개인정보 취급자에 대한 관리 및 교육, 접속 기록 보관 및 이상 행위 점검, 개인정보가 포함된 파일과 데이터의 안전한 저장 및 관리 조치를 시행합니다.',
        },
        {
          heading: '제10조 쿠키의 사용',
          body: '회사는 로그인 상태 유지, 이용자 환경 설정, 서비스 이용 현황 분석, 보안 관리 등을 위해 쿠키를 사용할 수 있습니다. 이용자는 웹브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있습니다. 다만 쿠키 사용을 제한할 경우 로그인 유지, 일부 기능 이용 또는 맞춤형 서비스 제공에 어려움이 발생할 수 있습니다.',
        },
        {
          heading: '제11조 개인정보 보호책임자',
          body: '회사는 개인정보 처리와 관련한 업무를 총괄하고, 이용자의 개인정보 관련 문의, 불만 처리 및 피해 구제를 위하여 개인정보 보호책임자를 지정합니다. 개인정보 보호책임자는 이세룡 대표이며, 이메일 주소는 airiska2025@gmail.com 입니다.',
        },
        {
          heading: '제12조 권익침해 구제방법',
          body: '이용자는 개인정보 침해로 인한 상담이나 구제를 위해 개인정보분쟁조정위원회 1833-6972(www.kopico.go.kr), 개인정보침해신고센터 118(privacy.kisa.or.kr), 대검찰청 1301(www.spo.go.kr), 경찰청 182(ecrm.cyber.go.kr)에 문의할 수 있습니다. 개인정보 열람, 정정·삭제, 처리정지 요구에 대한 공공기관의 처분 또는 부작위로 권리나 이익을 침해받은 경우에는 행정심판법에 따라 중앙행정심판위원회 110(www.simpan.go.kr)에 행정심판을 청구할 수 있습니다.',
        },
        {
          heading: '제13조 개인정보 처리방침의 변경',
          body: '본 개인정보 처리방침은 관련 법령, 서비스 내용, 개인정보 처리 방식의 변경에 따라 개정될 수 있습니다. 회사는 처리방침을 변경하는 경우 서비스 화면 또는 홈페이지를 통해 변경 사항과 시행일을 안내합니다.',
        },
        {
          heading: '제14조 시행일',
          body: '본 개인정보 처리방침은 2025년 5월 1일부터 적용됩니다.',
        },
      ],
    }
    : {
      title: '서비스 이용약관',
      effectiveDate: '2025년 5월 1일',
      sections: [
        {
          heading: '제1조 목적',
          body: '본 약관은 개인사업자 모두컴퍼니가 제공하는 모두의 안전 서비스의 이용과 관련하여 회사와 이용자 사이의 권리, 의무, 책임사항 및 서비스 이용에 필요한 기본 사항을 정하는 것을 목적으로 합니다.',
        },
        {
          heading: '제2조 용어의 정의',
          body: '본 약관에서 사용하는 용어의 뜻은 다음과 같습니다. 1. 서비스란 모두컴퍼니가 제공하는 산업안전관리, 안전점검, 교육관리, 문서관리, 현장관리 등 안전관리 업무를 지원하는 클라우드 기반 소프트웨어 서비스인 모두의 안전을 말합니다. 2. 회사란 모두의 안전 서비스를 운영하는 개인사업자 모두컴퍼니를 말합니다. 3. 이용자란 본 약관에 동의하고 회사와 서비스 이용계약을 체결한 개인, 개인사업자, 법인 또는 단체를 말합니다. 4. 계정이란 이용자가 서비스를 이용하기 위하여 등록한 아이디, 이메일, 비밀번호 등 인증 정보를 말합니다. 5. 데이터란 이용자가 서비스 이용 과정에서 입력, 등록, 업로드, 생성 또는 저장한 정보, 문서, 이미지, 파일, 기록 등을 말합니다.',
        },
        {
          heading: '제3조 약관의 효력 및 변경',
          body: '본 약관은 이용자가 약관에 동의하고 서비스를 신청하거나 이용함으로써 효력이 발생합니다. 회사는 이용자가 약관의 내용을 쉽게 확인할 수 있도록 서비스 화면, 홈페이지 또는 기타 적절한 방법으로 게시합니다. 회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있으며, 약관을 변경하는 경우 적용일자, 변경 내용 및 변경 사유를 명시하여 적용일 7일 전부터 공지합니다. 다만 이용자에게 불리하거나 중요한 사항을 변경하는 경우에는 최소 30일 전에 공지하거나 이메일, 문자메시지, 서비스 내 알림 등으로 개별 통지합니다. 회사가 변경 약관을 공지 또는 통지하면서 적용일까지 거부 의사를 표시하지 않으면 동의한 것으로 본다는 뜻을 명확히 알렸음에도 이용자가 거부 의사를 표시하지 않은 경우, 이용자는 변경 약관에 동의한 것으로 봅니다. 이용자가 변경 약관에 동의하지 않는 경우 이용계약을 해지할 수 있으며, 회사는 기존 약관을 계속 적용하기 어려운 사정이 있는 경우 이용계약을 해지할 수 있습니다.',
        },
        {
          heading: '제4조 약관 외 준칙',
          body: '본 약관에서 정하지 않은 사항은 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보 보호법, 전자상거래 등에서의 소비자보호에 관한 법률, 약관의 규제에 관한 법률 등 관련 법령 및 일반 상관례에 따릅니다.',
        },
        {
          heading: '제5조 이용계약의 성립',
          body: '이용계약은 이용자가 회사가 정한 절차에 따라 서비스 이용을 신청하고, 회사가 이를 승낙함으로써 성립합니다. 회사는 원칙적으로 이용자의 신청을 승낙합니다. 다만 실명이 아니거나 타인의 명의를 사용한 경우, 허위 정보를 기재하거나 회사가 요청한 정보를 제공하지 않은 경우, 만 14세 미만인 경우, 이전에 약관 위반 등으로 서비스 이용이 제한되거나 계약이 해지된 이력이 있는 경우, 서비스의 정상적인 운영을 방해할 우려가 있는 경우, 관련 법령 또는 공서양속에 반하는 목적으로 서비스를 이용하려는 경우, 기타 회사가 합리적인 사유로 승낙이 어렵다고 판단하는 경우에는 신청을 거절하거나 사후에 이용계약을 해지할 수 있습니다. 회사는 이용자의 유형이나 서비스 상품에 따라 본인확인, 사업자 확인 또는 추가 자료 제출을 요청할 수 있습니다. 기술상, 운영상 문제가 있는 경우 회사는 신청 승낙을 보류할 수 있습니다. 회사와 이용자가 별도의 서면 계약 또는 개별 약정을 체결한 경우, 해당 약정이 본 약관보다 우선 적용됩니다.',
        },
        {
          heading: '제6조 서비스의 내용',
          body: '회사는 이용자에게 산업안전관리 업무를 지원하기 위한 기능을 제공합니다. 서비스의 구체적인 기능, 제공 범위, 이용 조건은 서비스 화면, 홈페이지, 견적서, 신청서 또는 별도 안내에 따릅니다. 회사는 서비스 개선, 운영상 필요, 기술 환경 변화 등에 따라 서비스의 일부 또는 전부를 변경할 수 있습니다. 서비스 변경이 이용자에게 중대한 영향을 미치는 경우 회사는 사전에 서비스 화면, 이메일, 문자메시지 등 적절한 방법으로 안내합니다.',
        },
        {
          heading: '제7조 서비스 이용 시 유의사항',
          body: '서비스는 산업안전 관련 업무를 효율적으로 관리하기 위한 보조 도구이며, 이용자의 법령상 안전관리 의무를 대체하지 않습니다. 이용자는 산업안전보건법 등 관련 법령에 따른 의무를 스스로 확인하고 준수하여야 합니다. 회사가 제공하는 양식, 알림, 통계, 안내 자료 등은 참고용이며, 개별 사업장 또는 현장의 법적 적합성을 보장하지 않습니다. 이용자는 서비스에 입력한 정보의 정확성, 최신성 및 적법성에 대한 책임을 부담합니다.',
        },
        {
          heading: '제8조 개인정보의 수집 및 보호',
          body: '회사는 서비스 제공에 필요한 범위에서 최소한의 개인정보를 수집합니다. 회사는 개인정보를 수집·이용하는 경우 그 목적, 항목, 보유기간 등을 이용자에게 고지하고 동의를 받습니다. 회사는 관련 법령에 따라 이용자의 개인정보를 보호하기 위하여 필요한 기술적·관리적 조치를 취합니다. 개인정보의 처리에 관한 구체적인 사항은 회사의 개인정보 처리방침에 따릅니다.',
        },
        {
          heading: '제9조 계정 관리',
          body: '계정과 비밀번호의 관리 책임은 이용자에게 있습니다. 이용자는 자신의 계정을 제3자에게 양도, 대여, 공유하거나 담보로 제공할 수 없습니다. 이용자의 관리 소홀, 부정 사용, 비밀번호 유출 등으로 발생한 손해에 대하여 회사는 회사의 고의 또는 중대한 과실이 없는 한 책임을 부담하지 않습니다. 이용자는 계정 도용 또는 무단 사용을 알게 된 경우 즉시 회사에 통지하고 회사의 안내에 따라야 합니다. 회사는 계정이 타인의 권리를 침해하거나 회사 또는 운영자로 오인될 우려가 있는 경우 해당 계정의 사용을 제한할 수 있습니다.',
        },
        {
          heading: '제10조 이용자 정보의 변경',
          body: '이용자는 서비스 내 설정 화면 또는 회사가 정한 방법을 통해 자신의 정보를 확인하고 수정할 수 있습니다. 이용자는 신청 또는 가입 시 제공한 정보가 변경된 경우 지체 없이 수정하여야 합니다. 변경된 정보를 수정하지 않아 발생한 불이익에 대하여 회사는 책임을 부담하지 않습니다.',
        },
        {
          heading: '제11조 이용자에 대한 통지',
          body: '회사는 이용자가 등록한 이메일, 휴대전화번호, 서비스 내 알림, 공지사항 등으로 이용자에게 통지할 수 있습니다. 이용자가 연락처를 잘못 기재하거나 변경된 정보를 수정하지 않은 경우, 회사가 기존 등록 정보로 통지한 때에 통지가 도달한 것으로 봅니다. 전체 이용자에게 적용되는 사항은 7일 이상 서비스 화면 또는 홈페이지에 게시함으로써 개별 통지를 갈음할 수 있습니다. 다만 이용자에게 중대한 영향을 미치는 사항은 가능한 범위에서 개별 통지합니다.',
        },
        {
          heading: '제12조 회사의 의무',
          body: '회사는 관련 법령과 본 약관을 준수하며 안정적인 서비스 제공을 위하여 노력합니다. 회사는 서비스 제공과 관련하여 알게 된 이용자의 정보를 법령 또는 이용자의 동의 없이 제3자에게 제공하지 않습니다. 회사는 서비스 장애가 발생한 경우 합리적인 범위에서 신속히 복구하도록 노력합니다. 천재지변, 비상사태, 시스템 장애, 외부 서비스 장애, 정기점검 등 부득이한 사유가 있는 경우 회사는 서비스의 전부 또는 일부를 일시 중단할 수 있습니다.',
        },
        {
          heading: '제13조 이용자의 의무',
          body: '이용자는 허위 정보를 등록하거나 타인의 정보를 도용하는 행위, 회사 또는 제3자의 권리·명예·신용·영업상 이익을 침해하는 행위, 서비스의 정상적인 운영을 방해하거나 시스템에 무단 접근하는 행위, 악성코드·바이러스·불법 프로그램 등을 유포하거나 업로드하는 행위, 회사의 사전 동의 없이 서비스를 복제·분해·분석·변경하거나 유사 서비스를 개발하기 위하여 사용하는 행위, 서비스를 본래 목적과 다르게 불법적 또는 부당한 목적으로 이용하는 행위, 음란·폭력·혐오·비방·광고성 정보 등 공서양속에 반하는 내용을 게시하거나 전송하는 행위, 관련 법령·본 약관·서비스 이용 안내 또는 회사의 합리적인 요청을 위반하는 행위를 하여서는 안 됩니다.',
        },
        {
          heading: '제14조 이용요금 및 결제',
          body: '유료 서비스의 이용요금, 결제 주기, 결제 방식은 회사가 정한 요금 정책, 견적서, 신청서 또는 별도 계약에 따릅니다. 이용자는 회사가 정한 기한과 방법에 따라 이용요금을 납부하여야 합니다. 결제 방식은 무통장 입금, 계좌이체, 신용카드 결제, 자동결제 등 회사가 제공하는 방식 중에서 선택할 수 있습니다. 결제대행사, 금융기관, 통신사 등 회사의 관리 범위 밖의 사유로 결제 오류 또는 손해가 발생한 경우 회사는 책임을 부담하지 않습니다. 이용요금, 결제 조건, 할인, 위약금 등에 관하여 별도 약정이 있는 경우 해당 약정이 우선 적용됩니다.',
        },
        {
          heading: '제15조 미납 및 이용 제한',
          body: '이용자가 이용요금을 기한 내 납부하지 않은 경우 회사는 상당한 기간을 정하여 납부를 요청할 수 있습니다. 미납 상태가 지속되는 경우 회사는 서비스 이용을 제한하거나 계약을 해지할 수 있습니다. 이용자의 미납 또는 귀책사유로 서비스 이용이 제한되어 발생한 손해에 대하여 회사는 책임을 부담하지 않습니다.',
        },
        {
          heading: '제16조 청약철회, 취소 및 환불',
          body: '이용자는 관련 법령에서 정한 범위 내에서 서비스 이용계약의 청약철회를 요청할 수 있습니다. 서비스의 성격상 이용자가 서비스를 이미 사용하였거나, 이용자의 요청에 따라 서비스 제공이 개시된 경우에는 관련 법령상 허용되는 범위 내에서 청약철회 또는 환불이 제한될 수 있습니다. 회사는 이용자의 환불 요청이 있는 경우 이용 내역, 결제 내역, 계약 조건, 관련 법령을 확인하여 환불 가능 여부를 안내합니다. 연간 계약, 할인 계약, 맞춤 구축 또는 별도 약정이 있는 경우 환불 및 위약금은 해당 약정에 따릅니다.',
        },
        {
          heading: '제17조 서비스 이용의 제한',
          body: '회사는 이용자가 본 약관을 위반하거나 서비스 운영을 방해하는 경우 서비스 이용을 제한할 수 있습니다. 명의도용, 결제수단 도용 등 불법행위가 확인된 경우, 해킹·악성코드 배포·비정상적인 접속 등 보안상 위험이 있는 경우, 타인의 개인정보 또는 영업비밀을 침해한 경우, 관련 법령을 중대하게 위반한 경우에는 사전 통지 없이 서비스 이용을 즉시 제한할 수 있습니다. 회사는 이용 제한 사유가 해소되었다고 판단되는 경우 이용 제한을 해제할 수 있습니다.',
        },
        {
          heading: '제18조 계약의 해지',
          body: '이용자는 회사가 정한 절차에 따라 언제든지 이용계약 해지를 신청할 수 있습니다. 회사는 이용자의 해지 신청을 확인한 후 관련 법령 및 계약 조건에 따라 해지 절차를 진행합니다. 회사는 이용자가 본 약관을 위반하고도 상당한 기간 내에 시정하지 않은 경우, 이용요금을 장기간 미납한 경우, 서비스를 불법적 목적 또는 계약 범위를 벗어난 목적으로 이용한 경우, 회사 또는 다른 이용자에게 중대한 손해를 발생시킨 경우 이용계약을 해지할 수 있습니다. 계약 해지 후에도 미지급 요금, 손해배상, 데이터 처리, 비밀유지 등 성질상 존속이 필요한 조항은 계속 효력을 가집니다.',
        },
        {
          heading: '제19조 데이터의 보관 및 삭제',
          body: '이용자가 서비스에 등록한 데이터의 권리는 원칙적으로 이용자에게 귀속됩니다. 이용자는 필요한 데이터를 스스로 백업하여야 하며, 회사가 별도로 보장하지 않는 한 데이터 백업 의무는 이용자에게 있습니다. 서비스 이용계약이 종료된 경우 회사는 개인정보 처리방침 및 관련 법령에 따라 데이터를 보관 또는 삭제합니다. 계약 종료 후 일정 기간이 지나면 데이터 복구가 어려울 수 있으므로 이용자는 계약 종료 전 필요한 자료를 내려받거나 백업하여야 합니다.',
        },
        {
          heading: '제20조 지식재산권',
          body: '서비스, 소프트웨어, 화면 구성, 디자인, 상표, 로고, 콘텐츠 등에 관한 지식재산권은 회사 또는 정당한 권리자에게 귀속됩니다. 이용자가 서비스에 입력하거나 업로드한 데이터의 권리는 이용자에게 귀속됩니다. 이용자는 회사의 사전 서면 동의 없이 서비스를 복제, 배포, 판매, 대여, 양도, 역설계하거나 유사 서비스 개발 목적으로 사용할 수 없습니다. 이용자가 본 조를 위반하여 회사 또는 제3자에게 손해가 발생한 경우 이용자는 그 손해를 배상하여야 합니다.',
        },
        {
          heading: '제21조 비밀유지',
          body: '회사와 이용자는 서비스 이용 또는 계약 이행 과정에서 알게 된 상대방의 영업상·기술상 비밀을 상대방의 사전 동의 없이 제3자에게 공개하거나 목적 외로 사용하여서는 안 됩니다. 다만 수령 전부터 이미 알고 있던 정보, 공지의 사실이 된 정보, 정당한 권한을 가진 제3자로부터 적법하게 취득한 정보, 법령 또는 정부기관·법원의 명령에 따라 공개가 요구되는 정보는 비밀정보에서 제외됩니다.',
        },
        {
          heading: '제22조 의견 접수 및 불만 처리',
          body: '이용자는 서비스 내 문의 기능, 이메일, 고객센터 등 회사가 안내하는 방법으로 불만사항 또는 의견을 제출할 수 있습니다. 회사는 접수된 의견이나 불만사항을 합리적인 범위에서 신속히 처리하기 위해 노력합니다. 처리가 지연되는 경우 회사는 지연 사유와 처리 예정 일정을 안내할 수 있습니다.',
        },
        {
          heading: '제23조 손해배상',
          body: '회사 또는 이용자가 본 약관을 위반하여 상대방에게 손해를 발생시킨 경우, 귀책 있는 당사자는 그 손해를 배상하여야 합니다. 이용자가 서비스를 이용하면서 제3자와 분쟁을 일으킨 경우 이용자는 자신의 책임과 비용으로 이를 해결하여야 하며, 그로 인해 회사에 손해가 발생한 경우 이를 배상하여야 합니다.',
        },
        {
          heading: '제24조 면책',
          body: '회사는 천재지변, 전쟁, 테러, 화재, 정전, 감염병, 정부 조치 등 불가항력 사유, 이용자의 귀책사유로 인한 서비스 장애 또는 데이터 손실, 이용자의 장비·네트워크·브라우저·보안 설정 등 이용 환경의 문제, 통신사·클라우드 사업자·결제대행사 등 외부 사업자의 장애, 사전에 공지된 점검 또는 서비스 개선 작업, 현재의 기술 수준으로 방지하기 어려운 보안 사고로 발생한 손해에 대하여 회사의 고의 또는 중대한 과실이 없는 한 책임을 부담하지 않습니다. 회사는 이용자가 서비스를 통해 얻은 정보 또는 자료를 활용하여 발생한 사업상 손실, 기대수익 상실, 간접손해, 특별손해에 대하여 책임을 부담하지 않습니다. 회사는 이용자가 입력한 데이터의 정확성, 적법성, 최신성에 대하여 책임을 부담하지 않습니다. 무료로 제공되는 서비스 또는 시험 제공 서비스에 대해서는 관련 법령에 특별한 규정이 없는 한 책임을 부담하지 않습니다.',
        },
        {
          heading: '제25조 준거법 및 관할',
          body: '본 약관은 대한민국 법령에 따라 해석되고 적용됩니다. 서비스 이용과 관련하여 회사와 이용자 사이에 분쟁이 발생한 경우, 양 당사자는 성실히 협의하여 해결하도록 노력합니다. 협의로 해결되지 않는 분쟁에 관한 소송은 관련 법령에 따른 관할 법원을 제1심 관할 법원으로 합니다.',
        },
        {
          heading: '제26조 시행일',
          body: '본 약관은 2025년 5월 1일부터 적용됩니다.',
        },
      ],
    };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');
    setNotice('');
    setDuplicateAccountEmail('');

    try {
      if (!normalizedEmail) {
        throw new Error('이메일을 입력해주세요.');
      }

      if (isSignUp) {
        const cleanName = name.trim();
        const cleanOrganization = organization.trim();
        const cleanPhone = phone.trim();

        if (!cleanName) {
          throw new Error('이름을 입력해주세요.');
        }

        if (!cleanOrganization) {
          throw new Error('소속을 입력해주세요.');
        }

        if (!isValidPhoneNumber(cleanPhone)) {
          throw new Error('전화번호는 010-0000-0000 형식으로 입력해주세요.');
        }

        if (!isPasswordReady) {
          throw new Error('비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.');
        }

        if (password !== confirmPassword) {
          throw new Error('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
        }

        if (!privacyAgreed || !termsAgreed) {
          throw new Error('개인정보 처리방침과 서비스 이용약관에 모두 동의해주세요.');
        }

        let currentUser = null;

        try {
          const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          currentUser = userCredential.user;
          await updateProfile(currentUser, { displayName: cleanName });
          await sendEmailVerification(currentUser);
        } catch (err: any) {
          if (isDuplicateEmailError(err)) {
            setDuplicateAccountEmail(normalizedEmail);
          }
          throw new Error(getAuthErrorMessage(err));
        }

        if (currentUser) {
          try {
            await setDoc(doc(db, 'users', currentUser.uid), {
              uid: currentUser.uid,
              email: currentUser.email,
              name: cleanName,
              organization: cleanOrganization,
              phone: cleanPhone,
              emailVerified: false,
              createdAt: new Date().toISOString(),
              subscriptionActive: false,
              subscriptionPlanAmount: 28900,
              terms: {
                privacyAgreed: true,
                privacyAgreedAt: new Date().toISOString(),
                privacyVersion: '2025-05-01',
                serviceTermsAgreed: true,
                serviceTermsAgreedAt: new Date().toISOString(),
                serviceTermsVersion: '2025-05-01',
                version: '2025-05-01',
              },
            });
          } catch (err: any) {
            await deleteUser(currentUser);
            throw new Error(`사용자 정보 저장 실패: ${err.message}`);
          }
        }

        const signUpEmail = currentUser?.email || normalizedEmail;
        setIsSignUp(false);
        resetSignUpState();
        setVerificationPopup({
          title: '인증 메일을 보냈습니다',
          message: `${signUpEmail} 주소로 인증 메일을 보냈습니다. 최초 로그인 전에 메일함에서 인증 링크를 눌러 계정을 활성화해주세요. 메일이 보이지 않으면 스팸함도 확인해주세요.`,
        });
        await signOut(auth);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        await userCredential.user.reload();

        if (!userCredential.user.emailVerified) {
          try {
            await sendEmailVerification(userCredential.user);
          } catch (err: any) {
            if (err?.code !== 'auth/too-many-requests') {
              throw err;
            }
          }
          setVerificationPopup({
            title: '이메일 인증이 필요합니다',
            message: '이미 발송된 인증 메일을 확인해주세요. 메일함에서 인증 링크를 눌러 계정을 활성화한 뒤 다시 로그인할 수 있습니다. 메일이 보이지 않으면 스팸함도 확인해주세요.',
          });
          await signOut(auth);
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

  if (authLoading && !verificationPopup) return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;

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

        {duplicateAccountEmail && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">이미 가입된 이메일입니다.</p>
            <p className="mt-1">
              {duplicateAccountEmail} 계정으로 로그인하거나 비밀번호를 재설정해주세요.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={switchToLoginWithCurrentEmail}
                className="rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white transition hover:bg-amber-700"
              >
                로그인으로 이동
              </button>
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={resetLoading}
                className="rounded-lg border border-amber-300 px-3 py-2 font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
              >
                {resetLoading ? '메일 발송 중...' : '비밀번호 찾기'}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setDuplicateAccountEmail('');
              }}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
              autoComplete="email"
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
              minLength={isSignUp ? 8 : 6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
            {isSignUp && (
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                {passwordRequirements.map((requirement) => (
                  <span
                    key={requirement.label}
                    className={requirement.met ? 'text-green-600' : 'text-gray-400'}
                  >
                    {requirement.met ? '✓' : '•'} {requirement.label}
                  </span>
                ))}
              </div>
            )}
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
                minLength={8}
                autoComplete="new-password"
              />
              {passwordMismatch && (
                <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
          )}

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
                  autoComplete="name"
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
                  autoComplete="organization"
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
                  autoComplete="tel"
                  inputMode="tel"
                />
                {phone && !isValidPhoneNumber(phone) && (
                  <p className="mt-1 text-xs text-red-500">휴대폰 번호 형식에 맞게 입력해주세요.</p>
                )}
              </div>
            </>
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
                <p className="mt-1 text-xs text-gray-500">시행일: {termsModalContent.effectiveDate}</p>
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
