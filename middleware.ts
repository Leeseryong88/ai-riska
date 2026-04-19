import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // 1. 세션 쿠키나 토큰이 있는지 확인하는 방식이 표준이지만, 
  // Firebase Client SDK의 인증 상태는 미들웨어(Server side)에서 바로 알기 어렵습니다.
  // 따라서 여기서는 /login 페이지가 아닌 모든 경로에서 
  // 클라이언트 측에서 체크하도록 하거나, Firebase Admin SDK를 사용해야 합니다.
  
  // 간단한 구현을 위해 여기서는 미들웨어 대신 Root Layout이나 각 페이지에서 
  // AuthContext를 이용한 리다이렉션을 권장하지만, 
  // 사용자의 요청대로 "접속하자마자"를 구현하기 위해 
  // 쿠키 기반의 체크가 필요할 수 있습니다.
  
  // 하지만 Firebase Client SDK만 사용하는 경우, 미들웨어에서 인증 여부를 알 수 없습니다.
  // 대신 클라이언트 컴포넌트에서 리다이렉트 처리를 하는 방식으로 진행하겠습니다.
  
  return NextResponse.next();
}

export const config = {
  // 정적 자산·파비콘·아이콘은 미들웨어 제외 (불필요한 Edge 실행 및 이슈 방지)
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|icon\\.png|landing-hero\\.png|og-image\\.png|ads\\.txt|login).*)',
  ],
};
