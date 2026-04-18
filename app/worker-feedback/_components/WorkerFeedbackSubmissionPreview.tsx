'use client';

import React from 'react';
import { Plus, Send, Trash2 } from 'lucide-react';
import { Button, Card, Input, Label } from '@/app/work-permit/_components/ui/Button';
import { cn } from '@/app/work-permit/_lib/utils';
import type { WorkerFeedbackTemplateContent } from '../_lib/templateContent';
import { WorkerFeedbackNoticeDisplay } from './WorkerFeedbackNoticeDisplay';

interface Props {
  content: WorkerFeedbackTemplateContent;
  /** 관리자 미리보기 영역용 바깥 래퍼 */
  className?: string;
  /** true면 안내 블록을 미리보기 카드 안에서 직접 편집 */
  editable?: boolean;
  onTitleChange?: (value: string) => void;
  onLeadChange?: (value: string) => void;
  onBulletChange?: (index: number, value: string) => void;
  onAddBullet?: () => void;
  onRemoveBullet?: (index: number) => void;
}

/**
 * 근로자 접수 페이지(`/worker-feedback/v/...`)와 동일한 레이아웃의 미리보기.
 * `editable`일 때는 동일 카드 안에서 안내 문구만 입력 필드로 바뀜.
 */
export function WorkerFeedbackSubmissionPreview({
  content,
  className,
  editable = false,
  onTitleChange,
  onLeadChange,
  onBulletChange,
  onAddBullet,
  onRemoveBullet,
}: Props) {
  const bullets = content.bullets;

  return (
    <div className={cn('bg-gray-50 px-2 py-4 sm:px-4', className)}>
      <div className="mx-auto max-w-lg">
        <Card className="overflow-hidden border-gray-200 shadow-md">
          <div className="border-b border-blue-100 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-4">
            <h1 className="text-center text-lg font-black tracking-tight text-white">근로자 의견·제보</h1>
            <p className="mt-1 text-center text-[11px] font-medium text-blue-100">
              안전·보건 관련 의견을 남겨 주세요
            </p>
          </div>

          <div className="p-4 sm:p-6">
            {editable ? (
              <div
                className={cn(
                  'rounded-xl border-2 border-dashed border-blue-300 bg-white p-3 text-left shadow-sm sm:p-4',
                  '[&_label]:text-[10px] [&_label]:font-bold [&_label]:uppercase [&_label]:text-gray-400'
                )}
              >
                <div>
                  <Label htmlFor="wf-inline-title">제목</Label>
                  <Input
                    id="wf-inline-title"
                    value={content.title}
                    onChange={(e) => onTitleChange?.(e.target.value)}
                    placeholder="예: 근로자 의견·제보"
                    className="mt-1 text-base font-black text-gray-900"
                  />
                </div>
                <div className="mt-3">
                  <Label htmlFor="wf-inline-lead">본문 안내</Label>
                  <textarea
                    id="wf-inline-lead"
                    value={content.lead}
                    onChange={(e) => onLeadChange?.(e.target.value)}
                    rows={5}
                    placeholder="접수 목적과 안내 문구를 입력하세요."
                    className={cn(
                      'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900',
                      'placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
                    )}
                  />
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="!mb-0">안내 목록 (글머리)</Label>
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1 shrink-0" onClick={onAddBullet}>
                      <Plus className="h-3.5 w-3.5" />
                      항목 추가
                    </Button>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {bullets.map((line, index) => (
                      <li key={index} className="flex gap-2">
                        <Input
                          value={line}
                          onChange={(e) => onBulletChange?.(index, e.target.value)}
                          placeholder={`안내 문장 ${index + 1}`}
                          className="min-w-0 flex-1 text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-red-600 hover:bg-red-50"
                          onClick={() => onRemoveBullet?.(index)}
                          aria-label="항목 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {bullets.length === 0 && (
                    <p className="mt-2 text-xs text-gray-500">&quot;항목 추가&quot;로 안내 문장을 넣을 수 있습니다.</p>
                  )}
                </div>
              </div>
            ) : (
              <WorkerFeedbackNoticeDisplay content={content} className="mb-0 shadow-none" />
            )}

            {/* 데모용 폼: 미리보기 전용(클릭·포커스 불가) */}
            <div className="mt-6 space-y-4 border-t border-gray-100 pt-6 [&_input]:pointer-events-none [&_textarea]:pointer-events-none [&_button]:pointer-events-none">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="block text-sm font-medium text-gray-700">이름 (선택)</span>
                  <Input
                    id="wf-preview-name"
                    disabled
                    tabIndex={-1}
                    placeholder="미입력 시 익명"
                    className="mt-1 bg-white disabled:cursor-default disabled:opacity-100"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700">소속·현장 (선택)</span>
                  <Input
                    id="wf-preview-dept"
                    disabled
                    tabIndex={-1}
                    placeholder="예: ○○팀"
                    className="mt-1 bg-white disabled:cursor-default disabled:opacity-100"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700">의견·제보 내용 *</span>
                <textarea
                  id="wf-preview-body"
                  disabled
                  tabIndex={-1}
                  rows={6}
                  placeholder="안전·보건과 관련된 내용을 구체적으로 적어 주세요."
                  className={cn(
                    'mt-1 w-full cursor-default rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
                    'disabled:resize-none disabled:opacity-100',
                    'focus-visible:outline-none'
                  )}
                />
              </div>
              <Button type="button" disabled className="w-full cursor-default gap-2" tabIndex={-1}>
                <Send className="h-4 w-4" />
                제출하기
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
