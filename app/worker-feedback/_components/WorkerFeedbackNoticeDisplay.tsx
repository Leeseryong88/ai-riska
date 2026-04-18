'use client';

import React from 'react';
import { cn } from '@/app/work-permit/_lib/utils';
import type { WorkerFeedbackTemplateContent } from '../_lib/templateContent';

interface Props {
  content: WorkerFeedbackTemplateContent;
  className?: string;
}

/** 접수 페이지·관리자 미리보기 공통: 편집 내용이 그대로 보이도록 동일 마크업 */
export function WorkerFeedbackNoticeDisplay({ content, className }: Props) {
  const bullets = content.bullets.map((b) => b.trim()).filter(Boolean);

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm sm:p-5',
        className
      )}
    >
      <h2 className="text-base font-black leading-snug text-gray-900 sm:text-lg">{content.title.trim() || '근로자 의견·제보'}</h2>
      <p className="mt-2 whitespace-pre-wrap leading-relaxed text-gray-600">{content.lead}</p>
      {bullets.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-gray-600">
          {bullets.map((line, i) => (
            <li key={i} className="flex min-w-0 gap-2 leading-normal">
              <span className="shrink-0 select-none" aria-hidden>
                •
              </span>
              <span className="min-w-0 truncate" title={line}>
                {line}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
