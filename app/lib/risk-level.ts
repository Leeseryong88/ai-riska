/**
 * API `app/api/risk-assessment/route.ts`와 동일한 기준(강도×빈도)으로 위험도 문자열을 만듭니다.
 * 5x5: 상(16+), 하(1~7), 그 외 중
 * 3x3: 상(15+), 하(1~6), 그 외 중
 */
export function computeRiskLevelLabel(
  severity: string,
  probability: string,
  method: '3x3' | '5x5'
): string {
  const sMax = method === '5x5' ? 5 : 3;
  const pMax = method === '5x5' ? 5 : 3;
  const sNum = parseInt(String(severity).trim(), 10);
  const pNum = parseInt(String(probability).trim(), 10);
  const s = Math.min(sMax, Math.max(1, Number.isNaN(sNum) ? 3 : sNum));
  const p = Math.min(pMax, Math.max(1, Number.isNaN(pNum) ? 3 : pNum));
  const score = s * p;

  let level: '상' | '중' | '하' = '중';
  if (method === '5x5') {
    if (score >= 16) level = '상';
    else if (score <= 7) level = '하';
  } else {
    if (score >= 15) level = '상';
    else if (score <= 6) level = '하';
  }
  return `${level}(${score})`;
}

/** 저장 데이터 등에서 5x5 / 3x3 추론(값 4·5가 있으면 5x5) */
export function inferAssessmentMethod(
  rows: { severity?: string; probability?: string }[]
): '3x3' | '5x5' {
  if (!rows || rows.length === 0) return '5x5';
  for (const r of rows) {
    const s = parseInt(String(r.severity).trim(), 10);
    const p = parseInt(String(r.probability).trim(), 10);
    if (!Number.isNaN(s) && s > 3) return '5x5';
    if (!Number.isNaN(p) && p > 3) return '5x5';
  }
  return '3x3';
}

export function enrichTableRowsWithRisk<T extends { severity?: string; probability?: string; riskLevel?: string }>(
  rows: T[],
  method: '3x3' | '5x5'
): (T & { riskLevel: string })[] {
  return rows.map((row) => ({
    ...row,
    riskLevel: computeRiskLevelLabel(
      String(row.severity ?? ''),
      String(row.probability ?? ''),
      method
    ),
  }));
}

/** 위험도 표시(상·중·하, 구형 높음/중간/낮음)에 맞는 배지 스타일 (인라인 CSS 문자열) */
export function riskLevelBadgeStyle(risk: string): string {
  const t = (risk || '').trim();
  if (t.startsWith('상') || t.includes('높음')) {
    return 'background-color: #FEE2E2; color: #991B1B;';
  }
  if (t.startsWith('하') || t.includes('낮음')) {
    return 'background-color: #D1FAE5; color: #065F46;';
  }
  if (t.startsWith('중') || t.includes('중간')) {
    return 'background-color: #FEF3C7; color: #92400E;';
  }
  return 'background-color: #D1FAE5; color: #065F46;';
}
