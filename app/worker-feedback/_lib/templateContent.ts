export interface WorkerFeedbackTemplateContent {
  title: string;
  lead: string;
  bullets: string[];
}

export function getDefaultTemplateContent(): WorkerFeedbackTemplateContent {
  return {
    title: '근로자 의견·제보',
    lead:
      '산업안전보건법에 따라 근로자의 의견을 청취하고 있습니다. 현장의 안전·보건과 관련된 제보, 개선 의견, 문의를 자유롭게 남겨 주세요.',
    bullets: [
      '익명으로 제출할 수 있습니다. (이름·소속은 선택 사항입니다.)',
      '제출된 내용은 해당 현장의 안전관리 책임자에게 전달됩니다.',
      '긴급한 위험 상황은 즉시 관리감독자에게 직접 알려 주시기 바랍니다.',
    ],
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 하위 호환·내보내기용 안전한 HTML */
export function templateContentToHtml(c: WorkerFeedbackTemplateContent): string {
  const bullets = c.bullets
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join('');
  return `
<section class="wf-notice">
  <h2>${escapeHtml(c.title.trim() || '근로자 의견·제보')}</h2>
  <p>${escapeHtml(c.lead).replace(/\n/g, '<br/>')}</p>
  ${bullets ? `<ul>${bullets}</ul>` : ''}
</section>`.trim();
}

export function normalizeTemplateContent(raw: unknown): WorkerFeedbackTemplateContent {
  const d = raw as Partial<WorkerFeedbackTemplateContent>;
  const def = getDefaultTemplateContent();
  return {
    title: typeof d.title === 'string' ? d.title : def.title,
    lead: typeof d.lead === 'string' ? d.lead : def.lead,
    bullets: Array.isArray(d.bullets) ? d.bullets.filter((x): x is string => typeof x === 'string') : def.bullets,
  };
}
