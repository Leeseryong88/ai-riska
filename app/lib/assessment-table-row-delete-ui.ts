const ATTR = 'data-assessment-row-delete';

/**
 * 수동 편집용 위험성평가 본문 표 오른쪽에 "삭제" 열(버튼)을 붙이고, 클릭 시 `onDeleteRow(행index)` 를 호출합니다.
 * 최종 HTML은 6열이며, 이 함수는 DOM에만 7번째 셀을 추가합니다(재렌더 시 사라짐 → 이펙트가 다시 붙음).
 * 정리: 반환 함수로 리스너 제거
 */
export function installAssessmentRowDeleteColumn(
  table: HTMLTableElement,
  root: HTMLElement,
  onDeleteRow: (rowIndex: number) => void
): () => void {
  const thead = table.querySelector('thead tr');
  if (thead && !thead.querySelector(`th[${ATTR}]`)) {
    const th = document.createElement('th');
    th.setAttribute(ATTR, '1');
    th.textContent = '삭제';
    th.setAttribute('scope', 'col');
    th.style.cssText = [
      'padding:8px 6px',
      'text-align:center',
      'font-size:12px',
      'border:1px solid #94A3B8',
      'background-color:#F1F5F9',
      'color:#334155',
      'width:3.75rem',
      'min-width:3.5rem',
      'white-space:nowrap',
    ].join(';');
    thead.appendChild(th);
  }

  const tbody = table.querySelector('tbody');
  if (!tbody) return () => undefined;

  const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr'));
  for (const tr of rows) {
    if (tr.querySelector(`td[${ATTR}]`)) continue;
    const td = document.createElement('td');
    td.setAttribute(ATTR, '1');
    td.contentEditable = 'false';
    td.style.cssText = [
      'padding:6px 4px',
      'text-align:center',
      'vertical-align:middle',
      'border:1px solid #94A3B8',
      'background:#FFFFFF',
    ].join(';');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute(ATTR, '1');
    btn.setAttribute('aria-label', '이 행 삭제');
    btn.title = '행 삭제';
    btn.textContent = '삭제';
    btn.style.cssText = [
      'display:inline-block',
      'width:100%',
      'min-width:3rem',
      'padding:6px 8px',
      'border-radius:8px',
      'font-size:11px',
      'font-weight:700',
      'color:#fff',
      'background:#ef4444',
      'border:none',
      'cursor:pointer',
    ].join(';');
    td.appendChild(btn);
    tr.appendChild(td);
  }

  const onClick = (e: Event) => {
    const t = (e.target as HTMLElement).closest(`button[${ATTR}]`);
    if (!t || !root.contains(t)) return;
    e.preventDefault();
    e.stopPropagation();
    const tr = t.closest('tr') as HTMLTableRowElement;
    if (!tr || tr.closest('table') !== table) return;
    if (tr.parentElement !== tbody) return;
    const list = Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr'));
    const idx = list.indexOf(tr);
    if (idx < 0) return;
    onDeleteRow(idx);
  };
  root.addEventListener('click', onClick, true);
  return () => {
    root.removeEventListener('click', onClick, true);
  };
}
