import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireActiveSubscription } from '@/lib/server-subscription';

type ChoiceObject = { choice?: string; freeText?: string };
type ChoicesObject = { choices?: string[]; freeText?: string };

interface RequestBody {
  when: ChoiceObject;
  where: ChoiceObject;
  who: ChoicesObject;
  what: ChoicesObject;
  how: ChoicesObject;
  questionCount: number;
  format: string;
}

interface FormatTemplate {
  id: string;
  label: string;
  headerCells: string;
  bodyCellsTemplate: string;
  colCount: number;
}

function getFormatTemplate(format: string): FormatTemplate {
  if (format.startsWith('2단계')) {
    return {
      id: '2stage',
      label: '2단계 (적합 / 부적합)',
      headerCells: `<th class="no-cell">No</th><th>점검 항목</th><th class="check-cell">적합</th><th class="check-cell">부적합</th><th class="remark-cell">비고</th>`,
      bodyCellsTemplate: `<td class="no-cell">{N}</td><td>{ITEM}</td><td class="check-cell"></td><td class="check-cell"></td><td class="remark-cell"></td>`,
      colCount: 5,
    };
  }
  if (format.startsWith('3단계')) {
    return {
      id: '3stage',
      label: '3단계 (적정 / 미흡 / 부적합)',
      headerCells: `<th class="no-cell">No</th><th>점검 항목</th><th class="check-cell">적정</th><th class="check-cell">미흡</th><th class="check-cell">부적합</th><th class="remark-cell">비고</th>`,
      bodyCellsTemplate: `<td class="no-cell">{N}</td><td>{ITEM}</td><td class="check-cell"></td><td class="check-cell"></td><td class="check-cell"></td><td class="remark-cell"></td>`,
      colCount: 6,
    };
  }
  if (format.startsWith('OX')) {
    return {
      id: 'ox',
      label: 'OX (O / X / N/A)',
      headerCells: `<th class="no-cell">No</th><th>점검 항목</th><th class="check-cell">O</th><th class="check-cell">X</th><th class="check-cell">N/A</th><th class="remark-cell">비고</th>`,
      bodyCellsTemplate: `<td class="no-cell">{N}</td><td>{ITEM}</td><td class="check-cell"></td><td class="check-cell"></td><td class="check-cell"></td><td class="remark-cell"></td>`,
      colCount: 6,
    };
  }
  if (format.startsWith('예/아니오')) {
    return {
      id: 'yesno',
      label: '예 / 아니오 / 해당없음',
      headerCells: `<th class="no-cell">No</th><th>점검 항목</th><th class="check-cell">예</th><th class="check-cell">아니오</th><th class="check-cell">해당없음</th><th class="remark-cell">비고</th>`,
      bodyCellsTemplate: `<td class="no-cell">{N}</td><td>{ITEM}</td><td class="check-cell"></td><td class="check-cell"></td><td class="check-cell"></td><td class="remark-cell"></td>`,
      colCount: 6,
    };
  }
  // 5점 척도
  return {
    id: 'scale5',
    label: '5점 척도 (1~5)',
    headerCells: `<th class="no-cell">No</th><th>점검 항목</th><th class="check-cell">1</th><th class="check-cell">2</th><th class="check-cell">3</th><th class="check-cell">4</th><th class="check-cell">5</th><th class="remark-cell">비고</th>`,
    bodyCellsTemplate: `<td class="no-cell">{N}</td><td>{ITEM}</td><td class="check-cell"></td><td class="check-cell"></td><td class="check-cell"></td><td class="check-cell"></td><td class="check-cell"></td><td class="remark-cell"></td>`,
    colCount: 8,
  };
}

function joinChoices(choices?: string[], freeText?: string): string {
  const parts: string[] = [];
  if (choices && choices.length > 0) parts.push(...choices);
  if (freeText && freeText.trim()) parts.push(freeText.trim());
  return parts.length > 0 ? parts.join(', ') : '정보 없음';
}

function whenText(v: ChoiceObject): string {
  const parts = [v.choice].filter(Boolean) as string[];
  if (v.freeText && v.freeText.trim()) parts.push(`(${v.freeText.trim()})`);
  return parts.length > 0 ? parts.join(' ') : '정보 없음';
}

function whereText(v: ChoiceObject): string {
  const parts: string[] = [];
  if (v.choice) parts.push(v.choice);
  if (v.freeText && v.freeText.trim()) parts.push(v.freeText.trim());
  return parts.length > 0 ? parts.join(' / ') : '정보 없음';
}

const STYLE_BLOCK = `<style>
  .checklist-wrapper { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #1f2937; line-height: 1.5; padding: 10px; }
  .checklist-title { font-size: 22pt; font-weight: bold; text-align: center; margin-bottom: 20px; padding: 16px; border: 2px solid #111827; letter-spacing: 1px; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10.5pt; table-layout: fixed; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid !important; break-inside: avoid !important; page-break-after: auto; }
  th { background-color: #f1f5f9; border: 1px solid #475569; padding: 8px; font-weight: bold; text-align: center; color: #0f172a; page-break-inside: avoid; break-inside: avoid; }
  td { border: 1px solid #475569; padding: 8px; vertical-align: middle; word-break: break-word; page-break-inside: avoid; break-inside: avoid; }
  .meta-table { page-break-inside: avoid; break-inside: avoid; }
  .meta-table td.meta-label { background: #f8fafc; font-weight: bold; text-align: center; width: 15%; }
  .check-cell { text-align: center; width: 8%; }
  .no-cell { text-align: center; width: 6%; }
  .remark-cell { width: 18%; }
  .sign-table { page-break-inside: avoid; break-inside: avoid; }
  .sign-table td { height: 60px; text-align: center; vertical-align: top; padding-top: 10px; }
  .disclaimer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 9pt; color: #6b7280; page-break-inside: avoid; break-inside: avoid; }
  @media print {
    .checklist-wrapper { padding: 0; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    .sign-table, .meta-table, .disclaimer { page-break-inside: avoid !important; break-inside: avoid !important; }
  }
</style>`;

function buildSkeleton(tpl: FormatTemplate, count: number, meta: {
  when: string; where: string; who: string; what: string; how: string;
}): string {
  const rows: string[] = [];
  for (let i = 1; i <= count; i++) {
    rows.push(`<tr>${tpl.bodyCellsTemplate.replace('{N}', String(i)).replace('{ITEM}', `__ITEM_${i}__`)}</tr>`);
  }
  return `${STYLE_BLOCK}
<div class="checklist-wrapper">
  <h1 class="checklist-title">안전점검 체크리스트</h1>

  <table class="meta-table">
    <colgroup>
      <col style="width:15%"><col style="width:35%"><col style="width:15%"><col style="width:35%">
    </colgroup>
    <tbody>
      <tr>
        <td class="meta-label">점검 일시</td><td>${meta.when}</td>
        <td class="meta-label">점검 장소</td><td>${meta.where}</td>
      </tr>
      <tr>
        <td class="meta-label">점검자</td><td>${meta.who}</td>
        <td class="meta-label">점검 방법</td><td>${meta.how}</td>
      </tr>
      <tr>
        <td class="meta-label">점검 대상</td><td colspan="3">${meta.what}</td>
      </tr>
      <tr>
        <td class="meta-label">평가 형식</td><td colspan="3">${tpl.label}</td>
      </tr>
    </tbody>
  </table>

  <table class="body-table">
    <thead>
      <tr>${tpl.headerCells}</tr>
    </thead>
    <tbody>
${rows.join('\n')}
    </tbody>
  </table>

  <table class="sign-table">
    <thead>
      <tr>
        <th>점검자 (서명)</th>
        <th>안전관리자 (서명)</th>
        <th>소장 (서명)</th>
      </tr>
    </thead>
    <tbody>
      <tr><td></td><td></td><td></td></tr>
    </tbody>
  </table>

  <div class="disclaimer">※ 본 체크리스트는 AI로 생성된 참고 자료이며, 현장 상황과 법적 요구사항에 맞춰 반드시 전문가 검토 후 사용하시기 바랍니다.</div>
</div>`;
}

export async function POST(request: NextRequest) {
  const sub = await requireActiveSubscription(request);
  if (!sub.ok) return sub.response;

  try {
    const body = (await request.json()) as RequestBody;
    const {
      when = {},
      where = {},
      who = {},
      what = {},
      how = {},
      questionCount,
      format,
    } = body;

    const safeCount = Math.max(1, Math.min(100, Number(questionCount) || 15));
    const tpl = getFormatTemplate(format || '3단계');

    const meta = {
      when: whenText(when),
      where: whereText(where),
      who: joinChoices(who.choices),
      what: joinChoices(what.choices, what.freeText),
      how: joinChoices(how.choices),
    };

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `
당신은 한국 건설/산업 현장의 안전보건 전문가입니다. 아래 [수집된 정보]를 바탕으로 총 ${safeCount}개의 **안전 점검 항목(점검 문구)** 만 작성해주세요.

[수집된 정보]
- 점검 시점/주기: ${meta.when}
- 점검 장소: ${meta.where}
- 점검자(주체): ${meta.who}
- 점검 대상(공종/영역): ${meta.what}
- 점검 방법: ${meta.how}
- 평가 형식: ${tpl.label}

[작성 규칙]
1. 점검 항목은 **명확하고 검사 가능한 하나의 문장**으로 작성합니다. (예: "안전난간이 높이 90cm 이상 설치되어 있는가?")
2. "${tpl.label}" 형식으로 체크할 수 있도록 **평가 가능한 문장**으로 작성합니다.
3. 점검 대상 공종이 여러 개인 경우, 해당 공종들을 **고르게 커버**하도록 항목을 분배합니다.
4. 산업안전보건법·KOSHA 가이드·고용노동부 기준을 참고하되, **일반 현장에서 즉시 확인 가능한 수준**으로 작성하세요.
5. 각 항목 앞뒤에 불필요한 공백/번호를 붙이지 마세요. (번호는 시스템이 자동 부여)
6. 항목 수는 **정확히 ${safeCount}개**여야 합니다.
7. 반드시 아래 JSON 형식으로만 응답하세요. 다른 설명/주석/마크다운 금지.

[응답 형식 - JSON만]
{
  "items": [
    "점검항목1",
    "점검항목2",
    ...
    "점검항목${safeCount}"
  ]
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // JSON 파싱 (코드블록 래핑 포함 케이스 고려)
    let items: string[] = [];
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      const core = firstBrace >= 0 && lastBrace > firstBrace ? jsonText.slice(firstBrace, lastBrace + 1) : jsonText;
      const parsed = JSON.parse(core);
      if (Array.isArray(parsed.items)) {
        items = parsed.items.map((x: unknown) => String(x).trim()).filter(Boolean);
      }
    } catch (e) {
      console.error('체크리스트 JSON 파싱 실패:', e);
    }

    // 항목 수 보정
    if (items.length < safeCount) {
      const fillers = [
        '작업 전 TBM(Tool Box Meeting)이 실시되고 참석자 서명이 확인되는가?',
        '개인보호구(안전모·안전화·안전대 등)를 모든 작업자가 착용하고 있는가?',
        '작업 구역 출입 통제 및 안전 표지판이 명확히 설치되어 있는가?',
        '비상 연락망과 비상 대피로가 식별 가능하게 게시되어 있는가?',
        '전기·가설 배선의 절연 및 누전차단기 설치 상태가 양호한가?',
        '고소 작업 시 안전난간 또는 추락 방지 조치가 확보되어 있는가?',
        '작업 장비(공구·계측기·크레인 등)의 점검표가 작성되어 있는가?',
        '작업 중 발생한 폐기물·잔재물이 즉시 정리되고 있는가?',
        '화기 작업 시 소화기와 화재감시자가 배치되어 있는가?',
        '유해·위험 물질의 MSDS가 비치되고 근로자에게 교육되었는가?',
      ];
      let fi = 0;
      while (items.length < safeCount) {
        items.push(fillers[fi % fillers.length]);
        fi++;
      }
    } else if (items.length > safeCount) {
      items = items.slice(0, safeCount);
    }

    // 고정 스켈레톤 생성 후 플레이스홀더 치환 (이렇게 하면 AI 응답과 무관하게 결과 폼 구조 고정)
    let checklistHtml = buildSkeleton(tpl, safeCount, meta);
    for (let i = 1; i <= safeCount; i++) {
      const safeItem = items[i - 1]
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      checklistHtml = checklistHtml.replace(`__ITEM_${i}__`, safeItem);
    }

    return NextResponse.json({ checklistHtml });
  } catch (error) {
    console.error('안전점검 체크리스트 생성 오류:', error);
    return NextResponse.json(
      { error: '체크리스트 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
