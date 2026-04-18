'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { Loader2, Send } from 'lucide-react';
import { Button, Input, Label, Card } from '@/app/work-permit/_components/ui/Button';
import { cn } from '@/app/work-permit/_lib/utils';
import {
  getDefaultTemplateContent,
  normalizeTemplateContent,
  type WorkerFeedbackTemplateContent,
} from '../../_lib/templateContent';
import { WorkerFeedbackNoticeDisplay } from '../../_components/WorkerFeedbackNoticeDisplay';

export default function WorkerFeedbackPublicPage() {
  const params = useParams();
  const managerId = typeof params.managerId === 'string' ? params.managerId : '';

  const [structured, setStructured] = useState<WorkerFeedbackTemplateContent | null>(null);
  const [legacyHtml, setLegacyHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState('');
  const [department, setDepartment] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!managerId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'worker_feedback_settings', managerId));
        if (snap.exists()) {
          const data = snap.data();
          if (data?.templateContent) {
            setStructured(normalizeTemplateContent(data.templateContent));
            setLegacyHtml(null);
          } else if (data?.templateHtml) {
            setStructured(null);
            setLegacyHtml(String(data.templateHtml));
          } else {
            setStructured(getDefaultTemplateContent());
            setLegacyHtml(null);
          }
        } else {
          setStructured(getDefaultTemplateContent());
          setLegacyHtml(null);
        }
      } catch (e) {
        console.error(e);
        setStructured(getDefaultTemplateContent());
        setLegacyHtml(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [managerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = body.trim();
    if (!t) {
      alert('의견 내용을 입력해 주세요.');
      return;
    }
    if (!managerId) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        managerId,
        body: t,
        createdAt: serverTimestamp(),
      };
      const n = authorName.trim();
      const d = department.trim();
      if (n) payload.authorName = n;
      if (d) payload.department = d;
      await addDoc(collection(db, 'worker_feedback_submissions'), payload);
      setDone(true);
      setBody('');
      setAuthorName('');
      setDepartment('');
    } catch (err) {
      console.error(err);
      alert('제출에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!managerId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 text-center text-sm text-gray-600">잘못된 링크입니다.</div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="mt-4 text-sm font-medium text-gray-500">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Card className="overflow-hidden border-gray-200 shadow-md">
          <div className="border-b border-blue-100 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-4">
            <h1 className="text-center text-lg font-black tracking-tight text-white">근로자 의견·제보</h1>
            <p className="mt-1 text-center text-[11px] font-medium text-blue-100">
              안전·보건 관련 의견을 남겨 주세요
            </p>
          </div>

          <div className="p-4 sm:p-6">
            {structured && (
              <WorkerFeedbackNoticeDisplay content={structured} className="mb-0 shadow-none" truncateBullets={false} />
            )}
            {!structured && legacyHtml && (
              <div
                className="rounded-xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-700 shadow-sm [&_h2]:text-base [&_h2]:font-black [&_h2]:text-gray-900 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
                dangerouslySetInnerHTML={{ __html: legacyHtml }}
              />
            )}

            {done ? (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
                <p className="text-sm font-bold text-emerald-900">제출되었습니다. 감사합니다.</p>
                <p className="mt-2 text-xs text-emerald-800/90">추가로 의견을 남기려면 아래 버튼을 눌러 주세요.</p>
                <Button type="button" className="mt-4" onClick={() => setDone(false)}>
                  새 의견 작성
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4 border-t border-gray-100 pt-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="wf-name" className="text-gray-700">
                      이름 (선택)
                    </Label>
                    <Input
                      id="wf-name"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="미입력 시 익명"
                      className="mt-1"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wf-dept" className="text-gray-700">
                      소속·현장 (선택)
                    </Label>
                    <Input
                      id="wf-dept"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="예: ○○팀"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="wf-body" className="text-gray-700">
                    의견·제보 내용 *
                  </Label>
                  <textarea
                    id="wf-body"
                    required
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    placeholder="안전·보건과 관련된 내용을 구체적으로 적어 주세요."
                    className={cn(
                      'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
                    )}
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={submitting} isLoading={submitting}>
                  <Send className="h-4 w-4" />
                  제출하기
                </Button>
              </form>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
