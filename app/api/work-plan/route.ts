import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireActiveSubscription } from '@/lib/server-subscription';
import {
  COMMON_WORK_PLAN_FIELDS,
  WorkPlanAttachment,
  WorkPlanTemplate,
  getWorkPlanFieldLabel,
  getWorkPlanTemplate,
} from '@/app/work-plan/_lib/work-plan-templates';

interface WorkPlanRequestBody {
  templateId?: string;
  fields?: Record<string, string>;
  attachments?: WorkPlanAttachment[];
}

interface WorkSequenceItem {
  step: string;
  detail: string;
  risk: string;
  control: string;
  responsible: string;
}

interface HazardControlItem {
  hazard: string;
  cause: string;
  control: string;
  checkPoint: string;
}

interface GeneratedPlan {
  workScope: string;
  preSurveySummary: string;
  planningItemDetails: string[];
  equipmentAndMaterials: string;
  personnelPlan: string;
  workSequence: WorkSequenceItem[];
  hazardsAndControls: HazardControlItem[];
  requiredPpe: string[];
  communicationPlan: string;
  emergencyPlan: string;
  preStartChecklist: string[];
  workerBriefing: string;
  additionalNotes: string[];
  imageCaptions: Array<{ name: string; caption: string }>;
}

interface ImagePart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

const MAX_ATTACHMENTS = 6;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compactText(value: unknown, fallback = '미입력'): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.map((item) => compactText(item, '')).filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function asSequence(value: unknown): WorkSequenceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const data = item as Partial<WorkSequenceItem>;
      return {
        step: compactText(data.step, ''),
        detail: compactText(data.detail, ''),
        risk: compactText(data.risk, ''),
        control: compactText(data.control, ''),
        responsible: compactText(data.responsible, ''),
      };
    })
    .filter((item): item is WorkSequenceItem => !!item && !!item.step && !!item.detail)
    .slice(0, 8);
}

function asHazards(value: unknown): HazardControlItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const data = item as Partial<HazardControlItem>;
      return {
        hazard: compactText(data.hazard, ''),
        cause: compactText(data.cause, ''),
        control: compactText(data.control, ''),
        checkPoint: compactText(data.checkPoint, ''),
      };
    })
    .filter((item): item is HazardControlItem => !!item && !!item.hazard && !!item.control)
    .slice(0, 10);
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) return null;
  const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  return { mimeType, base64: match[2].replace(/\s/g, '') };
}

function normalizeAttachments(input: unknown): WorkPlanAttachment[] {
  if (!Array.isArray(input)) return [];
  const normalized: Array<WorkPlanAttachment | null> = input
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const data = item as Partial<WorkPlanAttachment>;
      const parsed = parseDataUrl(String(data.dataUrl || ''));
      if (!parsed) return null;
      return {
        id: compactText(data.id, `attachment-${index}`),
        name: compactText(data.name, `첨부 이미지 ${index + 1}`).slice(0, 80),
        dataUrl: `data:${parsed.mimeType};base64,${parsed.base64}`,
        note: compactText(data.note, '').slice(0, 300) || undefined,
      };
    })
    .slice(0, MAX_ATTACHMENTS);

  return normalized.filter((item): item is WorkPlanAttachment => item !== null);
}

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const jsonText = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(jsonText);
}

function buildFallbackPlan(template: WorkPlanTemplate, fields: Record<string, string>): GeneratedPlan {
  const workSummary = compactText(fields.workSummary, '입력된 작업개요를 기준으로 작업 전 위험요인을 확인하고 계획에 따라 작업한다.');
  return {
    workScope: workSummary,
    preSurveySummary: `${template.surveyItems.join(', ')} 항목을 작업 전 확인하고 이상 상태가 있으면 작업을 중지한다.`,
    planningItemDetails: template.planningItems.map((item) => `${item}을 현장 조건에 맞게 확인하고 작업 전 근로자에게 공유한다.`),
    equipmentAndMaterials: '사용 장비와 자재는 작업 전 점검하고 정격하중, 방호장치, 손상 여부를 확인한다.',
    personnelPlan: '작업책임자, 작업지휘자, 신호수 및 작업자의 역할을 작업 전 TBM에서 공유한다.',
    workSequence: [
      { step: '1', detail: '작업구역 통제 및 사전점검', risk: '관계자 외 접근, 미확인 위험요인', control: '출입통제, 작업 전 점검표 확인', responsible: compactText(fields.siteManager, '현장 책임자') },
      { step: '2', detail: '주요 작업 수행', risk: '충돌, 협착, 낙하 등 작업별 위험', control: '작업계획서와 신호체계 준수', responsible: compactText(fields.workCommander, '작업지휘자') },
      { step: '3', detail: '정리 및 복구', risk: '잔여 위험, 통제 해제 전 접근', control: '장비 정지, 작업장 정리, 최종 확인 후 통제 해제', responsible: compactText(fields.siteManager, '현장 책임자') },
    ],
    hazardsAndControls: [
      { hazard: '관계자 외 접근', cause: '작업구역 통제 미흡', control: '라바콘, 안전띠, 감시자를 배치한다.', checkPoint: '통제구역 유지 여부' },
      { hazard: '작업 중 의사소통 오류', cause: '신호체계 미공유', control: '신호수 지정 및 무전 채널을 통일한다.', checkPoint: 'TBM 시 신호체계 공유' },
      { hazard: '작업계획 변경', cause: '현장 조건 변동', control: '변경 시 작업 중지 후 계획서를 수정ㆍ재승인한다.', checkPoint: '변경사항 승인 여부' },
    ],
    requiredPpe: ['안전모', '안전화', '보안경', '작업별 지정 보호구'],
    communicationPlan: '작업지휘자의 지시에 따라 신호수와 작업자가 무전 또는 수신호로 상호 확인한다.',
    emergencyPlan: '사고 발생 시 작업을 즉시 중지하고 119 및 현장 비상연락망에 연락하며, 통제구역을 확보한다.',
    preStartChecklist: ['작업계획서 공유', '작업구역 통제 확인', '장비ㆍ공구 점검', '보호구 착용 확인', '비상연락망 확인'],
    workerBriefing: '작업 시작 전 TBM을 통해 작업순서, 위험요인, 통제구역, 비상조치 및 역할을 설명한다.',
    additionalNotes: ['AI 초안은 현장 책임자 검토 후 실제 조건에 맞게 보완해야 한다.'],
    imageCaptions: [],
  };
}

function normalizeGeneratedPlan(raw: unknown, fallback: GeneratedPlan): GeneratedPlan {
  if (!raw || typeof raw !== 'object') return fallback;
  const data = raw as Partial<GeneratedPlan>;
  const sequence = asSequence(data.workSequence);
  const hazards = asHazards(data.hazardsAndControls);
  const captions = Array.isArray(data.imageCaptions)
    ? data.imageCaptions
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const value = item as { name?: unknown; caption?: unknown };
          return { name: compactText(value.name, ''), caption: compactText(value.caption, '') };
        })
        .filter((item): item is { name: string; caption: string } => !!item && !!item.name)
    : [];

  return {
    workScope: compactText(data.workScope, fallback.workScope),
    preSurveySummary: compactText(data.preSurveySummary, fallback.preSurveySummary),
    planningItemDetails: asStringArray(data.planningItemDetails, fallback.planningItemDetails),
    equipmentAndMaterials: compactText(data.equipmentAndMaterials, fallback.equipmentAndMaterials),
    personnelPlan: compactText(data.personnelPlan, fallback.personnelPlan),
    workSequence: sequence.length > 0 ? sequence : fallback.workSequence,
    hazardsAndControls: hazards.length > 0 ? hazards : fallback.hazardsAndControls,
    requiredPpe: asStringArray(data.requiredPpe, fallback.requiredPpe),
    communicationPlan: compactText(data.communicationPlan, fallback.communicationPlan),
    emergencyPlan: compactText(data.emergencyPlan, fallback.emergencyPlan),
    preStartChecklist: asStringArray(data.preStartChecklist, fallback.preStartChecklist),
    workerBriefing: compactText(data.workerBriefing, fallback.workerBriefing),
    additionalNotes: asStringArray(data.additionalNotes, fallback.additionalNotes),
    imageCaptions: captions,
  };
}

function fieldRows(template: WorkPlanTemplate, fields: Record<string, string>): string {
  const allFields = [...COMMON_WORK_PLAN_FIELDS, ...template.requiredFields, ...template.optionalFields];
  return allFields
    .map((field) => {
      const value = compactText(fields[field.id]);
      return `<tr><th>${escapeHtml(field.label)}</th><td>${escapeHtml(value)}</td></tr>`;
    })
    .join('');
}

function listItems(items: string[]): string {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function paragraph(value: string): string {
  return escapeHtml(value)
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join('');
}

function planningRows(template: WorkPlanTemplate, plan: GeneratedPlan): string {
  return template.planningItems
    .map((item, index) => {
      const detail = plan.planningItemDetails[index] || '현장 조건에 맞게 작업 전 확인하고 계획에 반영한다.';
      return `<tr><td class="wp-no">${index + 1}</td><td>${escapeHtml(item)}</td><td>${escapeHtml(detail)}</td></tr>`;
    })
    .join('');
}

function sequenceRows(plan: GeneratedPlan): string {
  return plan.workSequence
    .map(
      (item, index) => `<tr>
        <td class="wp-no">${index + 1}</td>
        <td>${escapeHtml(item.detail)}</td>
        <td>${escapeHtml(item.risk)}</td>
        <td>${escapeHtml(item.control)}</td>
        <td>${escapeHtml(item.responsible)}</td>
      </tr>`
    )
    .join('');
}

function hazardRows(plan: GeneratedPlan): string {
  return plan.hazardsAndControls
    .map(
      (item, index) => `<tr>
        <td class="wp-no">${index + 1}</td>
        <td>${escapeHtml(item.hazard)}</td>
        <td>${escapeHtml(item.cause)}</td>
        <td>${escapeHtml(item.control)}</td>
        <td>${escapeHtml(item.checkPoint)}</td>
      </tr>`
    )
    .join('');
}

function attachmentSection(attachments: WorkPlanAttachment[], plan: GeneratedPlan): string {
  if (attachments.length === 0) {
    return '<div class="wp-empty-attachment">첨부된 도면 또는 이미지가 없습니다. 현장 배치도, 운행경로도, 작업순서도 등이 필요한 경우 추가 첨부 후 재생성할 수 있습니다.</div>';
  }

  return `<div class="wp-attachment-grid">${attachments
    .map((attachment, index) => {
      const caption =
        plan.imageCaptions.find((item) => item.name === attachment.name)?.caption ||
        attachment.note ||
        '작업계획서 참고 이미지';
      return `<figure class="wp-attachment">
        <img src="${escapeHtml(attachment.dataUrl)}" alt="${escapeHtml(attachment.name)}" />
        <figcaption>
          <strong>${index + 1}. ${escapeHtml(attachment.name)}</strong>
          <span>${escapeHtml(caption)}</span>
        </figcaption>
      </figure>`;
    })
    .join('')}</div>`;
}

function buildWorkPlanHtml(template: WorkPlanTemplate, fields: Record<string, string>, attachments: WorkPlanAttachment[], plan: GeneratedPlan): string {
  const generatedAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const projectName = compactText(fields.projectName, template.title);
  const workDate = compactText(fields.workDate);
  const workplace = compactText(fields.workplace);
  const siteManager = compactText(fields.siteManager);
  const workCommander = compactText(fields.workCommander);

  return `<style>
  .work-plan-doc { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', Arial, sans-serif; color: #111827; line-height: 1.5; font-size: 10.5pt; }
  .work-plan-doc * { box-sizing: border-box; }
  .work-plan-title { margin: 0 0 18px; border: 2px solid #111827; padding: 16px 18px; text-align: center; font-size: 22pt; font-weight: 900; letter-spacing: 0; }
  .work-plan-subtitle { margin: -8px 0 18px; text-align: center; color: #475569; font-size: 10pt; }
  .wp-section { margin: 22px 0 0; page-break-inside: avoid; break-inside: avoid; }
  .wp-section h2 { margin: 0 0 8px; border-left: 6px solid #2563eb; background: #eff6ff; padding: 8px 10px; color: #0f172a; font-size: 14pt; font-weight: 900; }
  .wp-section h3 { margin: 12px 0 8px; font-size: 11.5pt; font-weight: 900; color: #1e293b; }
  .wp-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0 0 12px; }
  .wp-table th, .wp-table td { border: 1px solid #64748b; padding: 7px 8px; vertical-align: top; word-break: break-word; }
  .wp-table th { background: #f8fafc; color: #1e293b; text-align: center; font-weight: 900; }
  .wp-meta th { width: 18%; }
  .wp-no { width: 44px; text-align: center; }
  .wp-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .wp-box { border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px; min-height: 72px; }
  .wp-box p { margin: 0 0 6px; }
  .wp-list { margin: 0; padding-left: 20px; }
  .wp-list li { margin: 3px 0; }
  .wp-attachment-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .wp-attachment { margin: 0; border: 1px solid #cbd5e1; padding: 8px; background: #fff; page-break-inside: avoid; break-inside: avoid; }
  .wp-attachment img { display: block; width: 100%; max-height: 360px; object-fit: contain; border: 1px solid #e5e7eb; background: #f8fafc; }
  .wp-attachment figcaption { display: grid; gap: 2px; margin-top: 6px; font-size: 9pt; color: #475569; }
  .wp-empty-attachment { border: 1px dashed #94a3b8; padding: 16px; color: #64748b; background: #f8fafc; text-align: center; }
  .wp-sign td { height: 62px; text-align: center; vertical-align: top; }
  .wp-footer { margin-top: 18px; border-top: 1px solid #cbd5e1; padding-top: 8px; color: #64748b; font-size: 8.5pt; }
  @media print {
    .work-plan-doc { font-size: 9.5pt; }
    .wp-section { page-break-inside: avoid; break-inside: avoid; }
    .wp-table tr, .wp-attachment { page-break-inside: avoid; break-inside: avoid; }
  }
</style>
<div class="work-plan-doc">
  <h1 class="work-plan-title">${escapeHtml(template.title)}</h1>
  <p class="work-plan-subtitle">고정 양식 ID: ${escapeHtml(template.id)} · 생성일시: ${escapeHtml(generatedAt)}</p>

  <section class="wp-section">
    <h2>1. 문서 기본정보</h2>
    <table class="wp-table wp-meta">
      <tbody>
        <tr><th>현장명/작업명</th><td>${escapeHtml(projectName)}</td><th>작업일자</th><td>${escapeHtml(workDate)}</td></tr>
        <tr><th>작업장소</th><td>${escapeHtml(workplace)}</td><th>수행업체</th><td>${escapeHtml(compactText(fields.companyName))}</td></tr>
        <tr><th>현장 책임자</th><td>${escapeHtml(siteManager)}</td><th>작업지휘자/신호수</th><td>${escapeHtml(workCommander)}</td></tr>
        <tr><th>작업 인원</th><td>${escapeHtml(compactText(fields.workerCount))}</td><th>작업 시간</th><td>${escapeHtml(compactText(fields.workTime))}</td></tr>
        <tr><th>법정 근거</th><td colspan="3">${escapeHtml(template.legalBasis)}</td></tr>
        <tr><th>대상 작업</th><td colspan="3">${escapeHtml(template.appliesTo)}</td></tr>
      </tbody>
    </table>
  </section>

  <section class="wp-section">
    <h2>2. 입력 정보 요약</h2>
    <table class="wp-table wp-meta"><tbody>${fieldRows(template, fields)}</tbody></table>
  </section>

  <section class="wp-section">
    <h2>3. 작업 개요 및 사전조사 결과</h2>
    <div class="wp-two-col">
      <div class="wp-box"><h3>작업 범위</h3>${paragraph(plan.workScope)}</div>
      <div class="wp-box"><h3>사전조사 요약</h3>${paragraph(plan.preSurveySummary)}</div>
    </div>
    <h3>사전조사 확인 항목</h3>
    <ul class="wp-list">${listItems(template.surveyItems)}</ul>
  </section>

  <section class="wp-section">
    <h2>4. 별표 4 포함사항 반영표</h2>
    <table class="wp-table">
      <thead><tr><th class="wp-no">No</th><th>법정 포함사항</th><th>계획 반영 내용</th></tr></thead>
      <tbody>${planningRows(template, plan)}</tbody>
    </table>
  </section>

  <section class="wp-section">
    <h2>5. 장비ㆍ인원ㆍ자재 계획</h2>
    <div class="wp-two-col">
      <div class="wp-box"><h3>장비ㆍ자재</h3>${paragraph(plan.equipmentAndMaterials)}</div>
      <div class="wp-box"><h3>인원ㆍ역할</h3>${paragraph(plan.personnelPlan)}</div>
    </div>
  </section>

  <section class="wp-section">
    <h2>6. 작업순서별 작업계획</h2>
    <table class="wp-table">
      <thead><tr><th class="wp-no">No</th><th>작업 내용</th><th>주요 위험</th><th>통제 방법</th><th>담당</th></tr></thead>
      <tbody>${sequenceRows(plan)}</tbody>
    </table>
  </section>

  <section class="wp-section">
    <h2>7. 위험요인 및 예방대책</h2>
    <table class="wp-table">
      <thead><tr><th class="wp-no">No</th><th>위험요인</th><th>발생 원인</th><th>예방대책</th><th>확인 포인트</th></tr></thead>
      <tbody>${hazardRows(plan)}</tbody>
    </table>
  </section>

  <section class="wp-section">
    <h2>8. 보호구ㆍ작업 전 점검ㆍ교육</h2>
    <div class="wp-two-col">
      <div class="wp-box"><h3>필수 보호구</h3><ul class="wp-list">${listItems(plan.requiredPpe)}</ul></div>
      <div class="wp-box"><h3>작업 전 점검</h3><ul class="wp-list">${listItems(plan.preStartChecklist)}</ul></div>
    </div>
    <div class="wp-box"><h3>근로자 주지 및 TBM 내용</h3>${paragraph(plan.workerBriefing)}</div>
  </section>

  <section class="wp-section">
    <h2>9. 연락ㆍ신호 및 비상조치</h2>
    <table class="wp-table">
      <tbody>
        <tr><th>연락ㆍ신호 방법</th><td>${paragraph(plan.communicationPlan)}</td></tr>
        <tr><th>비상조치 계획</th><td>${paragraph(plan.emergencyPlan)}</td></tr>
        <tr><th>추가 확인사항</th><td><ul class="wp-list">${listItems(plan.additionalNotes)}</ul></td></tr>
      </tbody>
    </table>
  </section>

  <section class="wp-section">
    <h2>10. 도면ㆍ사진 첨부</h2>
    ${attachmentSection(attachments, plan)}
  </section>

  <section class="wp-section">
    <h2>11. 확인 및 승인</h2>
    <table class="wp-table wp-sign">
      <thead><tr><th>작성</th><th>검토</th><th>승인</th><th>근로자 주지 확인</th></tr></thead>
      <tbody><tr><td>성명/서명</td><td>성명/서명</td><td>성명/서명</td><td>교육일시/서명</td></tr></tbody>
    </table>
  </section>

  <div class="wp-footer">
    본 문서는 AI가 입력 정보를 바탕으로 작성한 작업계획서 초안입니다. 법령, 발주처 요구사항, 실제 현장 조건, 장비 제원, 구조검토 결과 및 안전관리자의 검토를 반영해 최종 확인 후 사용하십시오.
  </div>
</div>`;
}

function buildPrompt(template: WorkPlanTemplate, fields: Record<string, string>, attachments: WorkPlanAttachment[]): string {
  const fieldSummary = [...COMMON_WORK_PLAN_FIELDS, ...template.requiredFields, ...template.optionalFields]
    .map((field) => `- ${getWorkPlanFieldLabel(field.id, template)}: ${compactText(fields[field.id])}`)
    .join('\n');
  const attachmentSummary =
    attachments.length > 0
      ? attachments.map((item, index) => `- ${index + 1}. ${item.name}${item.note ? `: ${item.note}` : ''}`).join('\n')
      : '- 첨부 이미지 없음';

  return `당신은 한국 산업안전보건 작업계획서 초안 작성 보조자입니다.
고정 HTML 양식은 서버에서 별도로 작성하므로, 절대 HTML이나 마크다운을 출력하지 말고 JSON만 출력하세요.
양식 자체, 섹션명, 표 구조를 바꾸려 하지 말고 각 섹션에 들어갈 내용만 작성하세요.

[선택 양식]
- 제목: ${template.title}
- 법정 근거: ${template.legalBasis}
- 대상 작업: ${template.appliesTo}
- 별표 4 포함사항:
${template.planningItems.map((item, index) => `  ${index + 1}. ${item}`).join('\n')}
- 사전조사 항목:
${template.surveyItems.map((item, index) => `  ${index + 1}. ${item}`).join('\n')}

[사용자 입력]
${fieldSummary}

[선택 첨부 이미지]
${attachmentSummary}

[작성 기준]
1. 사용자가 입력하지 않은 내용은 단정하지 말고 "현장 확인 필요" 또는 "작업 전 확인"으로 표현하세요.
2. 법정 포함사항은 planningItemDetails 배열에 위 순서와 같은 개수로 작성하세요.
3. 작업순서는 3~8단계, 위험요인 및 예방대책은 4~10개로 작성하세요.
4. 현장 제출용 초안이므로 문장은 간결하고 실행 가능한 조치로 작성하세요.
5. 이미지가 있으면 imageCaptions에 파일명과 문서에 표시할 설명을 작성하세요.

[반환 JSON 스키마]
{
  "workScope": "작업 범위 요약",
  "preSurveySummary": "사전조사 결과 요약",
  "planningItemDetails": ["별표4 포함사항 1에 대한 계획", "..."],
  "equipmentAndMaterials": "장비ㆍ자재 계획",
  "personnelPlan": "인원ㆍ역할 계획",
  "workSequence": [
    { "step": "1", "detail": "작업 내용", "risk": "주요 위험", "control": "통제 방법", "responsible": "담당" }
  ],
  "hazardsAndControls": [
    { "hazard": "위험요인", "cause": "발생 원인", "control": "예방대책", "checkPoint": "확인 포인트" }
  ],
  "requiredPpe": ["보호구"],
  "communicationPlan": "연락ㆍ신호 방법",
  "emergencyPlan": "비상조치 계획",
  "preStartChecklist": ["작업 전 점검 항목"],
  "workerBriefing": "근로자 주지 및 TBM 내용",
  "additionalNotes": ["추가 확인사항"],
  "imageCaptions": [{ "name": "첨부 파일명", "caption": "설명" }]
}`;
}

export async function POST(request: NextRequest) {
  const sub = await requireActiveSubscription(request);
  if (!sub.ok) return sub.response;

  try {
    const body = (await request.json()) as WorkPlanRequestBody;
    const template = getWorkPlanTemplate(body.templateId);
    if (!template) {
      return NextResponse.json({ error: '지원하지 않는 작업계획서 양식입니다.' }, { status: 400 });
    }

    const fields = body.fields || {};
    const requiredFields = [...COMMON_WORK_PLAN_FIELDS, ...template.requiredFields].filter((field) => field.required);
    const missing = requiredFields.filter((field) => !compactText(fields[field.id], '').trim());
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `필수 입력값이 부족합니다: ${missing.map((field) => field.label).join(', ')}` },
        { status: 400 }
      );
    }

    const fallback = buildFallbackPlan(template, fields);
    const attachments = normalizeAttachments(body.attachments);
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      const planHtml = buildWorkPlanHtml(template, fields, attachments, fallback);
      return NextResponse.json({ planHtml, warning: 'Gemini API 키가 없어 기본 초안으로 생성했습니다.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const prompt = buildPrompt(template, fields, attachments);
    const imageParts: ImagePart[] = attachments
      .map((attachment) => parseDataUrl(attachment.dataUrl))
      .filter((item): item is { mimeType: string; base64: string } => !!item)
      .map((item) => ({
        inlineData: {
          data: item.base64,
          mimeType: item.mimeType,
        },
      }));

    let generated = fallback;
    try {
      const result = await model.generateContent([{ text: prompt }, ...imageParts]);
      const text = result.response.text();
      generated = normalizeGeneratedPlan(extractJson(text), fallback);
    } catch (error) {
      console.error('작업계획서 AI 생성 오류:', error);
      generated = fallback;
    }

    const planHtml = buildWorkPlanHtml(template, fields, attachments, generated);
    return NextResponse.json({ planHtml });
  } catch (error) {
    console.error('작업계획서 생성 API 오류:', error);
    return NextResponse.json({ error: '작업계획서 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
