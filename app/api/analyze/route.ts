import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireActiveSubscription } from '@/lib/server-subscription';

// API 응답 타입 정의
interface ApiResponse {
  analysis?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  const sub = await requireActiveSubscription(request);
  if (!sub.ok) return sub.response;

  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const processName = formData.get('processName') as string || ''; // 프로세스 이름 추출
    const assessmentMethod = formData.get('assessmentMethod') as string || '5x5'; // 평가 방법 (3x3 또는 5x5)

    if (!imageFile) {
      return NextResponse.json<ApiResponse>(
        { error: '이미지 파일이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 이미지 유효성 검사
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(imageFile.type)) {
      return NextResponse.json<ApiResponse>(
        { error: '지원되지 않는 이미지 형식입니다. JPEG, PNG, GIF, WebP 형식만 허용됩니다.' },
        { status: 400 }
      );
    }

    // 이미지를 base64로 변환
    const imageBytes = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBytes).toString('base64');

    // Gemini API 키 확인
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('API 키가 설정되지 않음 - 환경 변수 누락');
      return NextResponse.json<ApiResponse>(
        { error: 'API 키가 설정되지 않았습니다. 서버 관리자에게 문의하세요.' },
        { status: 500 }
      );
    }
    
    // Gemini API 초기화 - 최신 모델 사용
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    console.log('이미지 분석 API 요청 시작');
    
    try {
      // 타임아웃 설정 - AbortController 사용 (50초로 조정 - Vercel 제한 60초 내로 설정)
      const timeoutMs = 50000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('이미지 분석 API 타임아웃 발생 - ' + timeoutMs + 'ms 초과');
      }, timeoutMs);
      
      // 프로세스 이름에 따른 프롬프트 추가
      const processNamePrompt = processName 
        ? `이 사진은 "${processName}"입니다. ` 
        : '';
      
      // 평가 방법에 따른 가이드라인 설정
      const methodGuide = assessmentMethod === '3x3' 
        ? `중대성(Severity)은 1~3 사이의 정수로 평가해 주세요.
   - 3: 상 (사망 또는 30일 이상 휴업 재해)
   - 2: 중 (3일 이상 30일 미만 휴업 재해)
   - 1: 하 (3일 미만 휴업 또는 의학적 처치 이하 재해)
가능성(Probability)은 1~3 사이의 정수로 평가해 주세요.
   - 3: 상 (발생 빈도가 높거나 발생 가능성이 매우 높음)
   - 2: 중 (발생 빈도가 보통임)
   - 1: 하 (발생 가능성이 거의 없음)
위험도는 중대성과 가능성을 곱하여 다음과 같이 표시합니다:
   - 높음(6~9점): 위험도 '높음(점수)' 형식으로 표시 (예: 높음(9))
   - 중간(3~4점): 위험도 '중간(점수)' 형식으로 표시 (예: 중간(4))
   - 낮음(1~2점): 위험도 '낮음(점수)' 형식으로 표시 (예: 낮음(2))`
        : `중대성(Severity)은 1~5 사이의 정수로 평가해 주세요.
   - 5: 최대 (사망, 1급 장해, 중대재해)
   - 4: 대 (30일 이상 휴업이 필요한 심각한 부상/질병)
   - 3: 중 (3일 이상 30일 미만 휴업이 필요한 부상/질병)
   - 2: 소 (3일 미만 휴업 또는 구급처치 초과 재해)
   - 1: 극소 (구급처치 이하, 아차사고, 피해 미미)
가능성(Probability)은 1~5 사이의 정수로 평가해 주세요.
   - 5: 최상 (매우 빈번하게 발생 - 일일/주간 단위)
   - 4: 상 (자주 발생 - 월간 단위)
   - 3: 중 (보통 발생 - 분기/연간 단위)
   - 2: 하 (거의 발생하지 않음 - 수년 내 1회)
   - 1: 최하 (발생 가능성이 매우 희박함)
위험도는 중대성과 가능성을 곱하여 다음과 같이 표시합니다:
   - 상(16~25점): 위험도 '상(점수)' 형식으로 표시 (예: 상(20))
   - 중(8~15점): 위험도 '중(점수)' 형식으로 표시 (예: 중(12))
   - 하(1~7점): 위험도 '하(점수)' 형식으로 표시 (예: 하(4))`;

      // 이미지 분석 요청
      const result = await Promise.race([
        model.generateContent([
          {
            text: `${processNamePrompt}업로드된 이미지를 산업안전 측면에서 면밀히 분석해주세요.

### 분석 지침 ###
1. **분류 단계**: 이미지가 작업장, 사업장, 건설 및 공사 구역 등 안전 분석이 가능한 환경인지 먼저 판단하세요.
2. **엄격한 분석**: 일반 풍경, 텍스트 문서, 평범한 실내 등 산업안전 위험 요소가 존재하지 않거나 분석이 부적절한 경우 억지로 위험을 찾지 마세요.
3. **위험 요소 없음**: 만약 위험 요소가 발견되지 않거나 분석에 부적절한 이미지라면 반드시 아래와 같이 한 줄의 테이블로만 응답하세요:
<table border="1">
<thead><tr><th>위험 요소</th><th>중대성</th><th>가능성</th><th>위험도</th><th>공학적 개선방안</th><th>관리적 개선방안</th></tr></thead>
<tbody><tr><td>사진에서 발견된 위험요인이 없습니다.</td><td>-</td><td>-</td><td>-</td><td>추가적인 공학적 안전 조치가 필요하지 않습니다.</td><td>추가적인 관리적 안전 조치가 필요하지 않습니다.</td></tr></tbody>
</table>

4. **위험 요소 발견 시**: 산업안전 관련 위험 요소가 명확히 식별된 경우에만 아래와 같은 HTML <table> 구조로 응답해주세요:
<table border="1">
<thead>
  <tr style="background-color: #f2f2f2;">
    <th>위험 요소</th>
    <th>중대성</th>
    <th>가능성</th>
    <th>위험도</th>
    <th>공학적 개선방안</th>
    <th>관리적 개선방안</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td>위험 요소 내용</td>
    <td>점수(1-5)</td>
    <td>점수(1-5)</td>
    <td>등급(점수)</td>
    <td>물리적/공학적 개선방안</td>
    <td>관리적/절차적 개선방안</td>
  </tr>
</tbody>
</table>

### 평가 방법 가이드 ###
${methodGuide}

HTML 테이블만 제공해주세요. 코드 블록 마크다운(\`\`\`html)을 사용하지 말고 순수 HTML만 반환해주세요. 한국어로 응답해주세요.`
          },
          {
            inlineData: {
              mimeType: `image/${imageFile.type.split('/')[1]}`,
              data: base64Image
            }
          }
        ]),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('요청 시간이 초과되었습니다.'));
          }, timeoutMs);
        })
      ]);
      
      // 타임아웃 해제
      clearTimeout(timeoutId);
      
      const response = result.response;
      let analysis = response.text();
      console.log('이미지 분석 API 응답 수신 완료 (길이: ' + analysis.length + ')');
      
      // 코드 블록 마크다운 제거 및 HTML 정리
      analysis = analysis.replace(/```html|```/g, '').trim();
      
      // 결과가 비어있는 경우 체크
      if (!analysis || analysis.length < 10) {
        return NextResponse.json<ApiResponse>(
          { error: '분석 결과가 비어있습니다. 다른 이미지로 다시 시도해주세요.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json<ApiResponse>({ analysis });
      
    } catch (error: any) {
      console.error('이미지 분석 요청 오류:', error.message);
      
      if (error.message.includes('시간이 초과')) {
        return NextResponse.json<ApiResponse>(
          { error: '분석 요청 시간이 초과되었습니다. 서버 부하가 높거나 이미지가 너무 복잡합니다. 다시 시도해주세요.' },
          { status: 504 }
        );
      }
      
      throw error; // 다른 오류는 외부 catch 블록으로 전달
    }
    
  } catch (error: any) {
    console.error('이미지 분석 오류:', error);
    return NextResponse.json<ApiResponse>(
      { error: `이미지 분석 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}` },
      { status: 500 }
    );
  }
} 