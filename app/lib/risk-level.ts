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

/** contentEditable 중대성·가능성: 1~5 한 자리만 (그 외는 제거, 여러 자리는 마지막 유효 숫자) */
export function sanitizeOneToFiveInput(text: string): string {
  const m = (text || '').match(/[1-5]/g);
  if (!m || m.length === 0) return '';
  return m[m.length - 1]!;
}

export function placeCaretAtEndInContentEditable(el: HTMLElement): void {
  requestAnimationFrame(() => {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  });
}

/** 1~5로 정규화(내용이 바뀌면) 후 커서를 셀 끝에 둡니다. */
export function applyOneToFiveToContentEditableCell(td: HTMLElement): void {
  const next = sanitizeOneToFiveInput(td.textContent || '');
  if ((td.textContent || '') === next) return;
  td.textContent = next;
  placeCaretAtEndInContentEditable(td);
}

export type SpCellContext = {
  tr: HTMLTableRowElement;
  tds: NodeListOf<HTMLElement>;
  td: HTMLTableCellElement;
};

/** 이벤트 타깃이 본문 표의 중대성(2열)·가능성(3열) 셀인지 */
export function getSpCellContext(
  target: EventTarget | null,
  root: HTMLElement,
  table: HTMLTableElement
): SpCellContext | null {
  const n = target as Node;
  const host = n.nodeType === Node.TEXT_NODE ? (n.parentElement as HTMLElement | null) : (n as HTMLElement);
  const td = host?.closest?.('td') as HTMLTableCellElement | null;
  if (!td || !root.contains(td)) return null;
  const tr = td.closest('tr') as HTMLTableRowElement | null;
  if (!tr || tr.closest('table') !== table) return null;
  const tds = tr.querySelectorAll<HTMLElement>('td');
  if (tds.length < 6) return null;
  const col = Array.prototype.indexOf.call(tds, td);
  if (col !== 2 && col !== 3) return null;
  return { tr, tds, td };
}

/**
 * beforeinput: 숫자 1~5·삭제만 브라우저 기본 동작을 허용. 그 외 타이핑(문자, 0·6~9)은 preventDefault.
 * 이미 1~5가 있을 때 한 글자 입력은 그 글자로 대체(한 자리 유지).
 */
export function onBeforeInputSpCell(
  e: Event,
  root: HTMLElement,
  table: HTMLTableElement,
  onSpChanged: (ctx: SpCellContext) => void
): void {
  const ie = e as InputEvent;
  if (ie.isComposing) return;
  const ctx = getSpCellContext(ie.target, root, table);
  if (!ctx) return;
  const { td, tr } = ctx;
  const it = ie.inputType || '';

  if (it.startsWith('delete') || it === 'historyUndo' || it === 'historyRedo') return;

  if (it === 'insertLineBreak' || it === 'insertParagraph') {
    e.preventDefault();
    return;
  }

  if (it === 'insertCompositionText' || it === 'insertFromComposition' || it === 'insertFromYank') return;

  if (it === 'insertFromPaste' || it === 'insertFromDrop') {
    e.preventDefault();
    return;
  }

  if (it === 'insertText' && ie.data != null) {
    if (ie.data.length === 0) return;
    if (ie.data.length === 1) {
      if (!'12345'.includes(ie.data)) {
        e.preventDefault();
        return;
      }
      if ((td.textContent || '').match(/[1-5]/)) {
        e.preventDefault();
        td.textContent = ie.data;
        placeCaretAtEndInContentEditable(td);
        onSpChanged(ctx);
      }
      return;
    }
    e.preventDefault();
    const next = sanitizeOneToFiveInput(ie.data);
    td.textContent = next;
    placeCaretAtEndInContentEditable(td);
    onSpChanged(ctx);
  }
}

/**
 * paste: 붙여넣기 기본동작 취소 후 1~5 한 자리만 반영
 */
export function onPasteSpCell(
  e: ClipboardEvent,
  root: HTMLElement,
  table: HTMLTableElement,
  onSpChanged: (ctx: SpCellContext) => void
): void {
  if (e.isComposing) return;
  const ctx = getSpCellContext(e.target, root, table);
  if (!ctx) return;
  e.preventDefault();
  const text = e.clipboardData?.getData('text/plain') || '';
  const next = sanitizeOneToFiveInput(text);
  ctx.td.textContent = next;
  placeCaretAtEndInContentEditable(ctx.td);
  onSpChanged(ctx);
}
