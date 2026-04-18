'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Edit2, ExternalLink, Loader2, Pencil, Printer, Save } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { Button, Card, Input } from '@/app/work-permit/_components/ui/Button';
import { useWorkerFeedbackTemplate } from '../_hooks/useWorkerFeedbackTemplate';
import { WorkerFeedbackSubmissionPreview } from './WorkerFeedbackSubmissionPreview';

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function LinkTab() {
  const { user } = useAuth();
  const [origin, setOrigin] = useState('');

  const {
    content,
    draft,
    editing,
    loading: templateLoading,
    saving,
    openEdit,
    cancelEdit,
    save,
    setDraftTitle,
    setDraftLead,
    setDraftBullet,
    addDraftBullet,
    removeDraftBullet,
    qrTitle,
    qrText,
    qrDecorEditing,
    tempQrTitle,
    tempQrText,
    setTempQrTitle,
    setTempQrText,
    openQrDecorEdit,
    cancelQrDecorEdit,
    saveQrDecor,
    savingQr,
  } = useWorkerFeedbackTemplate();

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const url = user && origin ? `${origin}/worker-feedback/v/${user.uid}` : '';

  const titleForPrint = qrDecorEditing ? tempQrTitle : qrTitle;
  const textForPrint = qrDecorEditing ? tempQrText : qrText;

  const downloadQR = useCallback(() => {
    const svg = document.getElementById('wf-qr');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    const safeName = (titleForPrint || '근로자의견_QR').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `qr_${safeName}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [titleForPrint]);

  const printQR = useCallback(() => {
    const svg = document.getElementById('wf-qr');
    if (!svg) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svgHtml = svg.outerHTML;
    const formattedText = escapeHtml(textForPrint).replace(/\n/g, '<br />');
    const safeTitle = escapeHtml(titleForPrint);

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${safeTitle}</title>
          <style>
            @page { size: auto; margin: 0; }
            body {
              margin: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              font-family: sans-serif;
              background: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              width: 100%;
              max-width: 500px;
              box-sizing: border-box;
            }
            .qr-wrapper {
              margin-bottom: 30px;
            }
            .qr-wrapper svg {
              width: 300px !important;
              height: 300px !important;
            }
            h1 {
              margin: 20px 0;
              font-size: 32px;
              font-weight: bold;
              color: #000;
            }
            p {
              color: #333;
              margin-top: 15px;
              font-size: 18px;
              line-height: 1.6;
              white-space: pre-wrap;
            }
            @media print {
              body { height: auto; }
              .container { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="qr-wrapper">${svgHtml}</div>
            <h1>${safeTitle}</h1>
            <p>${formattedText}</p>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [titleForPrint, textForPrint]);

  if (!user) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-start lg:justify-center">
        {/* 왼쪽: QR 꾸미기 (작업허가서 접근 QR 패턴) */}
        <Card className="flex h-fit w-full max-w-md shrink-0 flex-col items-center border-2 border-blue-100 bg-blue-50/30 p-6 text-center sm:p-10">
          <div className="mb-8 rounded-3xl bg-white p-6 shadow-md">
            {url ? (
              <QRCodeSVG id="wf-qr" value={url} size={240} level="H" includeMargin />
            ) : (
              <div className="flex h-[240px] w-[240px] items-center justify-center text-xs text-gray-400">로딩 중...</div>
            )}
          </div>

          <div className="w-full space-y-6">
            {qrDecorEditing ? (
              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-gray-400">QR 제목</label>
                  <Input
                    value={tempQrTitle}
                    onChange={(e) => setTempQrTitle(e.target.value)}
                    placeholder="QR코드 제목을 입력하세요"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase text-gray-400">하단 안내 문구</label>
                  <textarea
                    className="min-h-[100px] w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={tempQrText}
                    onChange={(e) => setTempQrText(e.target.value)}
                    placeholder="QR코드 아래에 표시될 문구를 입력하세요"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" className="h-11 flex-1 gap-2" onClick={() => void saveQrDecor()} isLoading={savingQr}>
                    <Save className="h-4 w-4" /> 설정 저장
                  </Button>
                  <Button type="button" variant="outline" className="h-11 px-4" onClick={cancelQrDecorEdit}>
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="group relative inline-block">
                  <h3 className="text-xl font-bold text-gray-900">{qrTitle}</h3>
                  <button
                    type="button"
                    onClick={openQrDecorEdit}
                    className="absolute -right-8 top-1/2 -translate-y-1/2 p-1 text-blue-600 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="QR 안내 편집"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-500">{qrText}</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex w-full gap-3">
            <Button type="button" variant="outline" className="h-12 flex-1 gap-2" onClick={downloadQR} disabled={!url}>
              <Download className="h-4 w-4" /> 이미지 저장
            </Button>
            <Button type="button" variant="outline" className="h-12 flex-1 gap-2" onClick={printQR} disabled={!url}>
              <Printer className="h-4 w-4" /> 인쇄하기
            </Button>
          </div>
        </Card>

        {/* 오른쪽: 접수 페이지 미리보기 또는 편집 (폭은 QR 카드와 동일 max-w-md, 미리보기는 비율 유지 축소) */}
        <Card className="w-full max-w-md shrink-0 p-4 sm:p-6">
          <div className="min-w-0 flex-1 space-y-3">
            {templateLoading && !editing ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                안내 문구 불러오는 중…
              </div>
            ) : !editing ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-400">접수 페이지 미리보기</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-fit shrink-0 gap-1.5 px-2.5 py-0 text-xs self-start sm:self-auto"
                    onClick={openEdit}
                  >
                    <Pencil className="h-3 w-3" />
                    수정하기
                  </Button>
                </div>
                <div className="overflow-hidden rounded-xl border-2 border-dashed border-blue-200">
                  <div className="[zoom:0.82] origin-top">
                    <WorkerFeedbackSubmissionPreview content={content} />
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-4">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 p-4 font-bold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      근로자 의견청취 테스트 하기
                      <span className="text-xs font-normal text-blue-400 transition-transform group-hover:translate-x-1">→</span>
                    </a>
                  ) : (
                    <div className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-gray-100 p-4 font-bold text-gray-400">
                      <ExternalLink className="h-4 w-4" />
                      근로자 의견청취 테스트 하기
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-400">접수 페이지 미리보기 · 편집</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving}>
                      취소
                    </Button>
                    <Button type="button" className="gap-2" onClick={() => void save()} disabled={saving} isLoading={saving}>
                      <Save className="h-4 w-4" />
                      저장
                    </Button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border-2 border-dashed border-blue-200">
                  <div className="[zoom:0.82] origin-top">
                    <WorkerFeedbackSubmissionPreview
                      content={draft}
                      editable
                      onTitleChange={setDraftTitle}
                      onLeadChange={setDraftLead}
                      onBulletChange={setDraftBullet}
                      onAddBullet={addDraftBullet}
                      onRemoveBullet={removeDraftBullet}
                    />
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-4">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 p-4 font-bold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      근로자 의견청취 테스트 하기
                      <span className="text-xs font-normal text-blue-400 transition-transform group-hover:translate-x-1">→</span>
                    </a>
                  ) : (
                    <div className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-gray-100 p-4 font-bold text-gray-400">
                      <ExternalLink className="h-4 w-4" />
                      근로자 의견청취 테스트 하기
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
    </div>
  );
}
