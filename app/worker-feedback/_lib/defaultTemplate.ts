import { getDefaultTemplateContent, templateContentToHtml } from './templateContent';

/** 레거시(HTML만 저장된 문서) 폴백용 */
export const DEFAULT_WORKER_FEEDBACK_TEMPLATE_HTML = templateContentToHtml(getDefaultTemplateContent());
