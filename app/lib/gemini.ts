import { GoogleGenerativeAI } from '@google/generative-ai';

interface Analysis {
  risk_factors: string[];
  improvements: string[];
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

// Gemini 2.5 Flash-Lite 모델 사용
export const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// 이미지 분석을 위한 vision 모델
export const geminiVisionModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

export const analyzeImage = async (imageParts: any): Promise<Analysis> => {
  try {
    const result = await geminiModel.generateContent([
      "당신은 산업 안전 전문가입니다. 이 이미지를 산업 안전 측면에서 분석해주세요.\n\n" +
      "### 분석 지침 ###\n" +
      "1. 먼저 이미지가 산업 현장, 공사 현장, 작업장 등 안전 분석이 가능한 환경인지 판단하세요.\n" +
      "2. 일반 풍경, 문서, 일상적인 실내 사진 등 산업안전 위험 요소가 존재하지 않거나 분석이 부적절한 경우에는 억지로 위험을 찾지 마세요.\n" +
      "3. 위험 요소가 발견되지 않거나 분석에 부적절한 이미지라면 '1. 위험 요인: 발견된 위험요인이 없습니다.'라고만 답변하세요.\n" +
      "4. 위험 요소가 발견된 경우에만 다음 형식으로 답변해주세요:\n\n" +
      "1. 위험 요인: (발견된 구체적인 위험 요소들을 나열)\n" +
      "2. 개선 방안: (각 위험 요소에 대한 구체적인 개선 방안 제시)",
      imageParts,
    ]);

    const response = result.response;
    const text = response.text();
    
    // 응답 텍스트를 파싱하여 구조화된 데이터로 변환
    const sections = text.split('\n\n');
    const analysis: Analysis = {
      risk_factors: [],
      improvements: []
    };

    sections.forEach(section => {
      if (section.startsWith('1. 위험 요인:')) {
        const content = section.replace('1. 위험 요인:', '').trim();
        if (content.includes('없습니다') || content === '') {
          analysis.risk_factors = ['사진에서 발견된 위험요인이 없습니다.'];
        } else {
          analysis.risk_factors = content
            .split('\n')
            .filter(item => item.trim())
            .map(item => item.trim().replace(/^[-•*]\s*/, ''));
        }
      } else if (section.startsWith('2. 개선 방안:')) {
        analysis.improvements = section
          .replace('2. 개선 방안:', '')
          .split('\n')
          .filter(item => item.trim())
          .map(item => item.trim().replace(/^[-•*]\s*/, ''));
      }
    });

    if (analysis.risk_factors.length === 0) {
      analysis.risk_factors = ['사진에서 발견된 위험요인이 없습니다.'];
    }

    return analysis;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}; 