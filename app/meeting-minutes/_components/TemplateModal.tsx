'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, Pencil, Check, Save } from 'lucide-react';
import { MeetingTemplate, type MeetingTemplateHandle } from './MeetingTemplate';
import { MEETING_TYPE_CYCLE, MEETING_TYPE_LABEL, type MeetingType } from '../_lib/types';

interface TemplateModalProps {
  type: MeetingType | null;
  onClose: () => void;
  /** 저장·목록 갱신이 필요할 때 호출 (현재는 사용되지 않지만 호환 유지) */
  onSaved?: () => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({ type, onClose }) => {
  const [editing, setEditing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const templateRef = useRef<MeetingTemplateHandle | null>(null);

  // 모달이 새로 열릴 때 편집 상태 초기화
  useEffect(() => {
    if (type) {
      setEditing(false);
      setSavedFlash(false);
    }
  }, [type]);

  const handleSaveBasics = () => {
    templateRef.current?.saveValues();
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  if (!type) return null;

  const accent =
    type === 'oshc'
      ? { dot: 'bg-blue-600', chip: 'bg-blue-50 text-blue-700' }
      : type === 'partner_council'
      ? { dot: 'bg-purple-600', chip: 'bg-purple-50 text-purple-700' }
      : { dot: 'bg-emerald-600', chip: 'bg-emerald-50 text-emerald-700' };

  const handlePrint = () => {
    const src = document.getElementById('template-modal-print-area');
    if (!src) {
      window.print();
      return;
    }

    // 현재 입력된 값을 보존하기 위해 복제 후 동기화
    const clone = src.cloneNode(true) as HTMLElement;

    // 편집 컨트롤 제거 (수정 버튼, 행 추가/삭제 버튼, 제외 토글 등)
    clone.querySelectorAll('[data-edit-control="true"]').forEach((el) => el.remove());
    // 제외된 섹션 제거
    clone.querySelectorAll('[data-section-excluded="true"]').forEach((el) => el.remove());

    // 원본 DOM의 입력값을 clone의 HTML 속성으로 옮겨 인쇄창에 반영되도록 함
    const srcInputs = Array.from(src.querySelectorAll('input, textarea, select')) as (
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
    )[];
    const cloneInputs = Array.from(clone.querySelectorAll('input, textarea, select')) as (
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
    )[];
    srcInputs.forEach((el, i) => {
      const c = cloneInputs[i];
      if (!c) return;
      if (el instanceof HTMLInputElement) {
        c.setAttribute('value', el.value);
      } else if (el instanceof HTMLTextAreaElement) {
        (c as HTMLTextAreaElement).textContent = el.value;
      } else if (el instanceof HTMLSelectElement) {
        const value = el.value;
        (c as HTMLSelectElement).querySelectorAll('option').forEach((o) => {
          if (o.getAttribute('value') === value || o.textContent === value) {
            o.setAttribute('selected', 'selected');
          } else {
            o.removeAttribute('selected');
          }
        });
      }
    });

    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) return;
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('\n');
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${MEETING_TYPE_LABEL[type]} 회의록 양식</title>${styles}<style>
      body { background: white; margin: 0; padding: 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      input, textarea, select { border: none !important; outline: none !important; background: transparent !important; }
      input[type="date"]::-webkit-calendar-picker-indicator,
      input[type="datetime-local"]::-webkit-calendar-picker-indicator { display: none; }
      @page { size: A4; margin: 12mm; }
      @media print { body { padding: 0; } }
    </style></head><body>${clone.outerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${accent.dot}`} />
              <h3 className="text-base font-black text-slate-900">{MEETING_TYPE_LABEL[type]} 회의록 양식</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${accent.chip}`}>
                {MEETING_TYPE_CYCLE[type]}
              </span>
              {editing && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                  수정 모드
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-500">
              {editing
                ? '행을 추가·삭제하거나 섹션을 제외·재사용하여 양식을 원하는 형태로 편집하세요. (변경 사항은 자동 저장)'
                : '"양식 수정"으로 구성 자체를 바꾸거나, "기본정보 저장"으로 자주 쓰는 값을 저장해두세요.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-6 py-3">
          <p className="hidden text-[11px] font-bold text-slate-400 sm:block">
            {editing
              ? '각 섹션 제목 옆의 [제외] 버튼으로 회의록에서 해당 섹션을 빼거나 다시 사용할 수 있습니다.'
              : savedFlash
              ? '기본정보가 저장되었습니다. 다음에 양식을 열면 자동으로 채워집니다.'
              : '자주 쓰는 값을 입력하고 [기본정보 저장]을 누르면 다음에도 그대로 유지됩니다.'}
          </p>
          <div className="flex flex-1 justify-end gap-2 sm:flex-none">
            <button
              onClick={() => setEditing((prev) => !prev)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${
                editing
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {editing ? '수정 완료' : '양식 수정'}
            </button>
            <button
              onClick={handleSaveBasics}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${
                savedFlash
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {savedFlash ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {savedFlash ? '저장됨' : '기본정보 저장'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              양식 인쇄
            </button>
          </div>
        </div>

        {/* Template body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-4 sm:p-6">
          <div
            id="template-modal-print-area"
            className="mx-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"
          >
            <MeetingTemplate ref={templateRef} type={type} editing={editing} />
          </div>
        </div>
      </div>
    </div>
  );
};
