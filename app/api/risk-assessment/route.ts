import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imagesData = JSON.parse(formData.get('images') as string);
    const processNames = JSON.parse(formData.get('processNames') as string);
    const generalInfo = formData.get('generalInfo') as string || '';
    const siteType = formData.get('siteType') as string || '';
    const workTypesRaw = formData.get('workTypes') as string || '[]';
    const workTypes = JSON.parse(workTypesRaw) as string[];
    
    // 위험성평가 매트릭스 데이터 파싱
    const severityLevels = JSON.parse(formData.get('severityLevels') as string);
    const probabilityLevels = JSON.parse(formData.get('probabilityLevels') as string);
    const assessmentMethod = formData.get('assessmentMethod') as string || '5x5';
    
    // 기존 데이터가 있으면 파싱
    const existingData = formData.has('existingData') 
      ? JSON.parse(formData.get('existingData') as string) 
      : [];

    // Gemini API 설정
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    // 프롬프트 구성
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

    const prompt = `
    위험성평가표를 작성해주세요. 다음 정보를 사용하세요:
    
    [현장 정보]
    - 업종: ${siteType || '정보 없음'}
    - 선택된 작업 유형들: ${workTypes.length > 0 ? workTypes.join(', ') : '정보 없음'}
    - 일반 사항: ${generalInfo || '정보 없음'}
    
    [공정 정보]
    ${processNames.map((name: string) => `- ${name}`).join('\n')}
    
    [작성 지침]
    1. 사용자가 입력한 구체적인 [공정 정보]들에 대한 위험성평가를 상세히 작성하세요.
    2. **중요: 선택된 모든 [작업 유형들](${workTypes.join(', ')}) 각각에 대해, 해당 작업에서 일반적으로 발생하는 주요 위험 요인을 작업 종류별로 최소 3~5개 항목씩 반드시 추가하세요.**
       - 예를 들어, '토공사'와 '골조공사'를 선택했다면, 토공사 관련 위험 3~5개, 골조공사 관련 위험 3~5개를 반드시 포함해야 합니다.
       - 각 작업의 특성(예: 추락, 낙하, 끼임, 감전 등)이 잘 드러나도록 작성하세요.
    3. [현장 정보]의 '일반 사항'에 기재된 현장 상황과 안전 수칙을 분석에 적극적으로 반영하세요.

[위험성평가 기준]
${methodGuide}

위험도는 반드시 '등급(점수)' 형식을 사용해주세요. 

[기존 위험요소]
${existingData.length > 0 ? existingData.map((item: any) => 
  `공정: ${item.processName}, 위험요소: ${item.riskFactor}, 중대성: ${item.severity}, 가능성: ${item.probability}, 위험도: ${item.riskLevel}, 개선대책: ${item.countermeasure}`
).join('\n') : '기존 데이터 없음'}

응답은 반드시 다음 형식을 정확히 지켜주세요:

1. HTML 테이블 형식:
<TABLE>
<table border="1">
  <thead>
    <tr>
      <th>공정/장비</th>
      <th>위험 요소</th>
      <th>중대성</th>
      <th>가능성</th>
      <th>위험도</th>
      <th>개선대책</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>공정명</td>
      <td>위험요소 내용</td>
      <td>숫자</td>
      <td>숫자</td>
      <td>등급(점수)</td>
      <td>대책 내용</td>
    </tr>
  </tbody>
</table>
</TABLE>

2. JSON 데이터 형식:
<JSON>
[
  {
    "processName": "공정명",
    "riskFactor": "위험요소",
    "severity": "중대성 숫자",
    "probability": "가능성 숫자",
    "riskLevel": "위험도 등급(점수)",
    "riskScore": "위험도 점수",
    "countermeasure": "개선대책"
  }
]
</JSON>

반드시 <TABLE> 태그 안에는 <table>로 시작하는 유효한 HTML 표 구조를 넣어주세요. 텍스트만 넣지 마세요.
    `;

    // API 요청
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // 응답에서 표와 JSON 데이터 추출
    const tableMatch = text.match(/<TABLE>([\s\S]*?)<\/TABLE>/i);
    const jsonMatch = text.match(/<JSON>([\s\S]*?)<\/JSON>/i);

    let tableHTML = '';
    let tableData = [];

    if (tableMatch && tableMatch[1]) {
      tableHTML = tableMatch[1].replace(/```html|```/g, '').trim();
      
      // HTML에서 "중간" -> "중"으로 변경 및 위험도 형식 통일
      tableHTML = tableHTML.replace(/중간(?!\([0-9]+\))/g, '중');
      
      // 위험도 열에서 숫자가 없는 값을 찾아 숫자를 추가
      // "상", "중", "하" 형식을 "상(15)" 같은 형식으로 변환
      // 테이블의 4번째 열(위험도)을 찾아서 처리
      const tdRegex = /<tr[^>]*>(?:[^<]*<td[^>]*>[^<]*<\/td>){3}\s*<td[^>]*>\s*(상|중|하)(?!\s*\([0-9]+\))\s*<\/td>/gi;
      tableHTML = tableHTML.replace(tdRegex, (match, level) => {
        let score = 0;
        if (level === '상') score = 15;
        else if (level === '중') score = 9;
        else if (level === '하') score = 4;
        return match.replace(level, `${level}(${score})`);
      });
      
      // 특정 단어(중간/중)를 찾아서 일관되게 "중"으로 변경
      tableHTML = tableHTML.replace(/>(\s*)중간(\s*)</g, '>$1중$2<');
    }

    if (jsonMatch && jsonMatch[1]) {
      try {
        const jsonText = jsonMatch[1].replace(/```json|```/g, '').trim();
        tableData = JSON.parse(jsonText);
        
        // JSON 데이터에서 위험도 점수와 등급이 없는 경우 계산
        tableData = tableData.map((row: any) => {
          const severity = parseInt(row.severity) || 3;
          const probability = parseInt(row.probability) || 3;
          const score = severity * probability;
          
          let level = '중';
          if (assessmentMethod === '5x5') {
            if (score >= 16) level = '상';
            else if (score <= 7) level = '하';
          } else {
            if (score >= 15) level = '상';
            else if (score <= 6) level = '하';
          }
          
          // 위험도에서 "중간"을 "중"으로 변경
          if (row.riskLevel && typeof row.riskLevel === 'string') {
            row.riskLevel = row.riskLevel.replace(/중간/g, '중');
          }
          
          // 위험도를 "등급(점수)" 형식으로 통일
          // 이미 "()" 형식이 있는지 확인
          const hasFormat = row.riskLevel && row.riskLevel.match(/\([0-9]+\)/);
          const formattedRiskLevel = hasFormat ? row.riskLevel : `${level}(${score})`;
          
          return {
            ...row,
            riskScore: row.riskScore || score.toString(),
            riskLevel: formattedRiskLevel
          };
        });

        // 만약 HTML 테이블이 없거나 유효하지 않은 경우 JSON 데이터를 바탕으로 HTML 생성
        if (!tableHTML || !tableHTML.includes('<table')) {
          tableHTML = `
            <div style="width: 100%; overflow-x: auto;">
              <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; min-width: 700px; width: 100%; border: 1px solid #E5E7EB; font-size: 14px;">
                <thead style="background-color: #F3F4F6;">
                  <tr>
                    <th style="padding: 12px; text-align: left; border: 1px solid #E5E7EB; color: #1F2937; width: 15%;">공정/장비</th>
                    <th style="padding: 12px; text-align: left; border: 1px solid #E5E7EB; color: #1F2937; width: 25%;">위험 요소</th>
                    <th style="padding: 12px; text-align: left; border: 1px solid #E5E7EB; color: #1F2937; width: 8%;">중대성</th>
                    <th style="padding: 12px; text-align: left; border: 1px solid #E5E7EB; color: #1F2937; width: 8%;">가능성</th>
                    <th style="padding: 12px; text-align: left; border: 1px solid #E5E7EB; color: #1F2937; width: 12%;">위험도</th>
                    <th style="padding: 12px; text-align: left; border: 1px solid #E5E7EB; color: #1F2937; width: 32%;">개선대책</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableData.map((row: any, index: number) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#FFFFFF' : '#F9FAFB'};">
                      <td style="padding: 12px; border: 1px solid #E5E7EB; color: #374151; word-break: break-all;">${row.processName || ''}</td>
                      <td style="padding: 12px; border: 1px solid #E5E7EB; color: #374151; word-break: break-all;">${row.riskFactor || ''}</td>
                      <td style="padding: 12px; border: 1px solid #E5E7EB; color: #374151; text-align: center;">${row.severity || ''}</td>
                      <td style="padding: 12px; border: 1px solid #E5E7EB; color: #374151; text-align: center;">${row.probability || ''}</td>
                      <td style="padding: 12px; border: 1px solid #E5E7EB; color: #374151; font-weight: bold;">${row.riskLevel || ''}</td>
                      <td style="padding: 12px; border: 1px solid #E5E7EB; color: #374151; word-break: break-all;">${row.countermeasure || ''}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
      } catch (e) {
        console.error('JSON 파싱 오류:', e);
      }
    }

    return NextResponse.json({
      tableHTML,
      tableData
    });
  } catch (error) {
    console.error('위험성평가 API 오류:', error);
    return NextResponse.json(
      { error: '위험성평가 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 