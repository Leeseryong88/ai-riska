'use client';

import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Eye, EyeOff, Minus, Plus } from 'lucide-react';
import type { MeetingType } from '../_lib/types';

/* ============================================================
 * 수정 모드 + 커스터마이징 영속화 컨텍스트
 * ============================================================ */

interface EditContextValue {
  editing: boolean;
  isExcluded: (id: string) => boolean;
  toggleExclude: (id: string) => void;
  getRowCount: (id: string, def: number) => number;
  addRow: (id: string, def: number) => void;
  removeRow: (id: string, def: number) => void;
  getValue: (name: string) => string;
  setValue: (name: string, value: string) => void;
}

const EditContext = createContext<EditContextValue | null>(null);

const useEdit = () => {
  const v = useContext(EditContext);
  if (!v) throw new Error('useEdit must be used within MeetingTemplate');
  return v;
};

/* ============================================================
 * 영속화 유틸
 * ============================================================ */

interface PersistedState {
  excluded: string[];
  rowCounts: Record<string, number>;
  values: Record<string, string>;
}

const EMPTY_STATE: PersistedState = { excluded: [], rowCounts: {}, values: {} };

const storageKey = (type: MeetingType) => `meeting-template:${type}`;

function loadPersisted(type: MeetingType): PersistedState {
  if (typeof window === 'undefined') return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(storageKey(type));
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      excluded: Array.isArray(parsed.excluded) ? parsed.excluded : [],
      rowCounts:
        parsed.rowCounts && typeof parsed.rowCounts === 'object' ? parsed.rowCounts : {},
      values: parsed.values && typeof parsed.values === 'object' ? parsed.values : {},
    };
  } catch {
    return EMPTY_STATE;
  }
}

function savePartial(type: MeetingType, patch: Partial<PersistedState>) {
  if (typeof window === 'undefined') return;
  const current = loadPersisted(type);
  const next: PersistedState = { ...current, ...patch };
  window.localStorage.setItem(storageKey(type), JSON.stringify(next));
}

/* ============================================================
 * 최상위 래퍼 (forwardRef 로 saveValues 노출)
 * ============================================================ */

export interface MeetingTemplateHandle {
  /** 현재 입력값들을 localStorage 에 저장 */
  saveValues: () => void;
  /** 저장된 입력값을 초기화 (유지보수용) */
  clearValues: () => void;
}

interface MeetingTemplateProps {
  type: MeetingType;
  editing?: boolean;
}

export const MeetingTemplate = forwardRef<MeetingTemplateHandle, MeetingTemplateProps>(
  function MeetingTemplate({ type, editing = false }, ref) {
    const [excluded, setExcluded] = useState<Set<string>>(new Set());
    const [rowCounts, setRowCounts] = useState<Record<string, number>>({});
    const [values, setValues] = useState<Record<string, string>>({});
    // 로드 직후 첫 save 이펙트가 빈 초기값을 덮어쓰지 않도록 건너뛰기 위한 플래그
    const skipNextSaveRef = useRef(true);

    // 양식 타입 바뀔 때마다 저장된 상태 복원
    useEffect(() => {
      const saved = loadPersisted(type);
      setExcluded(new Set(saved.excluded));
      setRowCounts(saved.rowCounts);
      setValues(saved.values);
      skipNextSaveRef.current = true;
    }, [type]);

    // 구조(제외/행 수) 는 변경 즉시 자동 저장
    useEffect(() => {
      if (skipNextSaveRef.current) {
        skipNextSaveRef.current = false;
        return;
      }
      savePartial(type, {
        excluded: Array.from(excluded),
        rowCounts,
      });
    }, [type, excluded, rowCounts]);

    useImperativeHandle(
      ref,
      () => ({
        saveValues: () => {
          savePartial(type, { values });
        },
        clearValues: () => {
          setValues({});
          savePartial(type, { values: {} });
        },
      }),
      [type, values],
    );

    const toggleExclude = useCallback((id: string) => {
      setExcluded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }, []);

    const addRow = useCallback((id: string, def: number) => {
      setRowCounts((prev) => ({ ...prev, [id]: (prev[id] ?? def) + 1 }));
    }, []);

    const removeRow = useCallback((id: string, def: number) => {
      setRowCounts((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] ?? def) - 1) }));
    }, []);

    const setValue = useCallback((name: string, value: string) => {
      setValues((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }));
    }, []);

    const ctx: EditContextValue = useMemo(
      () => ({
        editing,
        isExcluded: (id) => excluded.has(id),
        toggleExclude,
        getRowCount: (id, def) => rowCounts[id] ?? def,
        addRow,
        removeRow,
        getValue: (name) => values[name] ?? '',
        setValue,
      }),
      [editing, excluded, rowCounts, values, toggleExclude, addRow, removeRow, setValue],
    );

    return (
      <EditContext.Provider value={ctx}>
        {type === 'oshc' && <OshcTemplate />}
        {type === 'partner_council' && <PartnerCouncilTemplate />}
        {type === 'other' && <OtherMeetingTemplate />}
      </EditContext.Provider>
    );
  },
);

/* ============================================================
 * 공용 스타일
 * ============================================================ */

const inputCls =
  'w-full border-b border-slate-300 bg-transparent py-1 text-sm text-slate-800 outline-none focus:border-blue-500 print:border-slate-400';
const textareaCls =
  'w-full rounded-lg border border-slate-200 bg-transparent p-2 text-sm text-slate-800 outline-none focus:border-blue-500 print:border-slate-300';
const cellCls =
  'border border-slate-300 p-2 align-top text-sm text-slate-800 print:text-black';
const headCls =
  'border border-slate-300 bg-slate-50 p-2 text-center text-xs font-bold text-slate-600 print:bg-slate-100 print:text-black';

/* ============================================================
 * 이름 기반 입력 컴포넌트 (값 영속화)
 * ============================================================ */

const Txt: React.FC<{
  name: string;
  type?: string;
  placeholder?: string;
}> = ({ name, type = 'text', placeholder }) => {
  const { getValue, setValue } = useEdit();
  return (
    <input
      name={name}
      className={inputCls}
      type={type}
      value={getValue(name)}
      onChange={(e) => setValue(name, e.target.value)}
      placeholder={placeholder}
    />
  );
};

const Area: React.FC<{ name: string; rows?: number; placeholder?: string }> = ({
  name,
  rows = 3,
  placeholder,
}) => {
  const { getValue, setValue } = useEdit();
  return (
    <textarea
      name={name}
      className={textareaCls}
      rows={rows}
      value={getValue(name)}
      onChange={(e) => setValue(name, e.target.value)}
      placeholder={placeholder}
    />
  );
};

const Sel: React.FC<{ name: string; options: string[] }> = ({ name, options }) => {
  const { getValue, setValue } = useEdit();
  return (
    <select
      name={name}
      className={inputCls}
      value={getValue(name)}
      onChange={(e) => setValue(name, e.target.value)}
    >
      <option value="">선택</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
};

/* ============================================================
 * 섹션 래퍼 (번호 자동 · 제외 토글)
 * ============================================================ */

interface EditableSectionProps {
  id: string;
  num: number;
  title: string;
  children: React.ReactNode;
}

const EditableSection: React.FC<EditableSectionProps> = ({ id, num, title, children }) => {
  const { editing, isExcluded, toggleExclude } = useEdit();
  const excluded = isExcluded(id);

  if (excluded && !editing) return null;

  return (
    <section
      data-section-excluded={excluded ? 'true' : undefined}
      className={excluded ? 'relative rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-3 opacity-60' : ''}
    >
      <div className="mt-6 mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white ${
              excluded ? 'bg-slate-400' : 'bg-blue-600'
            }`}
          >
            {num}
          </span>
          <span className={excluded ? 'text-slate-500 line-through' : ''}>{title}</span>
          {excluded && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">
              제외됨
            </span>
          )}
        </h3>
        {editing && (
          <button
            type="button"
            data-edit-control="true"
            onClick={() => toggleExclude(id)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-black transition ${
              excluded
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-500'
            }`}
          >
            {excluded ? (
              <>
                <Eye className="h-3 w-3" /> 다시 사용
              </>
            ) : (
              <>
                <EyeOff className="h-3 w-3" /> 제외
              </>
            )}
          </button>
        )}
      </div>
      <div className={excluded ? 'pointer-events-none' : ''}>{children}</div>
    </section>
  );
};

/* ============================================================
 * 동적 행 제어
 * ============================================================ */

interface DynamicRowsProps {
  id: string;
  defaultCount: number;
  renderRow: (index: number) => React.ReactNode;
}

const DynamicRows: React.FC<DynamicRowsProps> = ({ id, defaultCount, renderRow }) => {
  const { getRowCount } = useEdit();
  const count = getRowCount(id, defaultCount);
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>{renderRow(i)}</React.Fragment>
      ))}
    </>
  );
};

const RowControls: React.FC<{ id: string; defaultCount: number; label?: string }> = ({
  id,
  defaultCount,
  label = '행',
}) => {
  const { editing, getRowCount, addRow, removeRow } = useEdit();
  if (!editing) return null;
  const count = getRowCount(id, defaultCount);
  return (
    <div
      data-edit-control="true"
      className="mt-2 flex items-center justify-end gap-2 print:hidden"
    >
      <span className="text-[11px] font-bold text-slate-400">{label} {count}개</span>
      <button
        type="button"
        onClick={() => removeRow(id, defaultCount)}
        disabled={count <= 1}
        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 transition hover:border-red-200 hover:text-red-500 disabled:opacity-50"
      >
        <Minus className="h-3 w-3" /> {label} 삭제
      </button>
      <button
        type="button"
        onClick={() => addRow(id, defaultCount)}
        className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-600 transition hover:bg-blue-100"
      >
        <Plus className="h-3 w-3" /> {label} 추가
      </button>
    </div>
  );
};

/* ============================================================
 * 섹션 번호 계산 훅 (제외된 섹션은 번호 건너뜀)
 * ============================================================ */

function useSectionNumerator(orderedIds: string[]) {
  const { isExcluded } = useEdit();
  return (id: string) => {
    let n = 0;
    for (const sid of orderedIds) {
      if (!isExcluded(sid)) n += 1;
      if (sid === id) return n;
    }
    return n;
  };
}

/* ============================================================
 * 산업안전보건위원회
 * ============================================================ */

const OSHC_SECTIONS = ['basic', 'attendees', 'agenda', 'report', 'suggestions', 'actions'];

function OshcTemplate() {
  const num = useSectionNumerator(OSHC_SECTIONS);
  const OSHC_AGENDA_LABELS = [
    '산업재해 예방계획의 수립',
    '안전보건관리규정의 작성 및 변경',
    '근로자의 안전보건교육 계획',
    '작업환경측정 등 작업환경 점검 및 개선',
    '근로자 건강진단 등 건강관리',
    '산업재해 통계 기록·유지에 관한 사항',
    '중대재해의 원인 조사 및 재발 방지대책 수립',
    '유해·위험 기계·기구 및 설비의 안전·보건 조치',
  ];
  const OSHC_ATTENDEE_ROLES = [
    { side: '사용자', role: '대표이사 / 안전보건총괄책임자' },
    { side: '사용자', role: '안전관리자' },
    { side: '사용자', role: '보건관리자' },
    { side: '사용자', role: '산업보건의' },
    { side: '근로자', role: '근로자대표' },
    { side: '근로자', role: '명예산업안전감독관' },
    { side: '근로자', role: '근로자대표 지명 근로자' },
    { side: '근로자', role: '근로자대표 지명 근로자' },
  ];

  return (
    <article className="mx-auto max-w-[780px] bg-white p-6 text-slate-900 print:max-w-none print:p-0">
      <header className="text-center">
        <p className="text-[11px] font-bold text-slate-400 print:text-slate-600">
          산업안전보건법 제24조 / 시행령 제34~38조 · 분기당 1회 이상
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">산업안전보건위원회 회의록</h2>
        <div className="mx-auto mt-3 h-[2px] w-24 bg-blue-600" />
      </header>

      <EditableSection id="basic" num={num('basic')} title="기본 정보">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <th className={headCls}>회의명</th>
              <td className={cellCls} colSpan={3}>
                <Txt name="basic.meetingName" placeholder="예: 2026년 1분기 산업안전보건위원회 정기회의" />
              </td>
            </tr>
            <tr>
              <th className={headCls}>일시</th>
              <td className={cellCls}>
                <Txt name="basic.datetime" type="datetime-local" />
              </td>
              <th className={headCls}>장소</th>
              <td className={cellCls}>
                <Txt name="basic.location" placeholder="예: 본사 3층 대회의실" />
              </td>
            </tr>
            <tr>
              <th className={headCls}>회차</th>
              <td className={cellCls}>
                <Txt name="basic.session" placeholder="예: 제 1 회 / 2026년 제1분기" />
              </td>
              <th className={headCls}>작성자</th>
              <td className={cellCls}>
                <Txt name="basic.writer" placeholder="안전보건총괄책임자" />
              </td>
            </tr>
          </tbody>
        </table>
      </EditableSection>

      <EditableSection id="attendees" num={num('attendees')} title="참석자 (노·사 동수)">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={headCls} style={{ width: '10%' }}>구분</th>
              <th className={headCls} style={{ width: '18%' }}>직위</th>
              <th className={headCls} style={{ width: '18%' }}>성명</th>
              <th className={headCls} style={{ width: '22%' }}>소속</th>
              <th className={headCls} style={{ width: '22%' }}>위원 구분</th>
              <th className={headCls} style={{ width: '10%' }}>연락처</th>
            </tr>
          </thead>
          <tbody>
            <DynamicRows
              id="oshc-attendees"
              defaultCount={OSHC_ATTENDEE_ROLES.length}
              renderRow={(i) => {
                const preset = OSHC_ATTENDEE_ROLES[i];
                return (
                  <tr>
                    <td className={cellCls + ' text-center font-bold'}>{preset?.side ?? ''}</td>
                    <td className={cellCls}>
                      <Txt name={`attendees.${i}.position`} placeholder={preset?.role} />
                    </td>
                    <td className={cellCls}>
                      <Txt name={`attendees.${i}.name`} />
                    </td>
                    <td className={cellCls}>
                      <Txt name={`attendees.${i}.affiliation`} />
                    </td>
                    <td className={cellCls}>
                      <Txt name={`attendees.${i}.role`} placeholder="위원장/간사/위원" />
                    </td>
                    <td className={cellCls}>
                      <Txt name={`attendees.${i}.contact`} />
                    </td>
                  </tr>
                );
              }}
            />
          </tbody>
        </table>
        <RowControls id="oshc-attendees" defaultCount={OSHC_ATTENDEE_ROLES.length} label="참석자" />
      </EditableSection>

      <EditableSection
        id="agenda"
        num={num('agenda')}
        title="심의·의결 안건 (법 제24조 제1항)"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={headCls} style={{ width: '8%' }}>No.</th>
              <th className={headCls}>법정 심의·의결 사항</th>
              <th className={headCls} style={{ width: '30%' }}>논의 내용</th>
              <th className={headCls} style={{ width: '18%' }}>의결 결과</th>
            </tr>
          </thead>
          <tbody>
            <DynamicRows
              id="oshc-agenda"
              defaultCount={OSHC_AGENDA_LABELS.length}
              renderRow={(i) => (
                <tr>
                  <td className={cellCls + ' text-center'}>{i + 1}</td>
                  <td className={cellCls}>
                    {OSHC_AGENDA_LABELS[i] ? (
                      <span className="text-sm">{OSHC_AGENDA_LABELS[i]}</span>
                    ) : (
                      <Txt name={`agenda.${i}.title`} placeholder="추가 안건을 입력하세요" />
                    )}
                  </td>
                  <td className={cellCls}>
                    <Area name={`agenda.${i}.discussion`} rows={2} />
                  </td>
                  <td className={cellCls}>
                    <Sel
                      name={`agenda.${i}.resolution`}
                      options={['가결', '부결', '조건부 가결', '다음 회의 재논의', '해당 없음']}
                    />
                  </td>
                </tr>
              )}
            />
          </tbody>
        </table>
        <RowControls id="oshc-agenda" defaultCount={OSHC_AGENDA_LABELS.length} label="안건" />
      </EditableSection>

      <EditableSection id="report" num={num('report')} title="보고 사항">
        <Area
          name="report"
          rows={4}
          placeholder="직전 분기 산업재해 현황, 위험성평가 결과, 안전점검 실시 결과 등"
        />
      </EditableSection>

      <EditableSection id="suggestions" num={num('suggestions')} title="근로자 건의 및 토의사항">
        <Area name="suggestions" rows={4} placeholder="근로자 측 건의 사항, 토의 요지" />
      </EditableSection>

      <EditableSection id="actions" num={num('actions')} title="후속 조치계획">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={headCls}>조치 항목</th>
              <th className={headCls} style={{ width: '20%' }}>담당자</th>
              <th className={headCls} style={{ width: '18%' }}>완료 예정일</th>
            </tr>
          </thead>
          <tbody>
            <DynamicRows
              id="oshc-actions"
              defaultCount={4}
              renderRow={(i) => (
                <tr>
                  <td className={cellCls}>
                    <Txt name={`actions.${i}.item`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`actions.${i}.owner`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`actions.${i}.due`} type="date" />
                  </td>
                </tr>
              )}
            />
          </tbody>
        </table>
        <RowControls id="oshc-actions" defaultCount={4} label="조치 항목" />
      </EditableSection>

      <p className="mt-8 text-[11px] font-bold text-slate-400 print:text-slate-600">
        ※ 본 회의록은 3년 이상 보존해야 하며, 회의 결과는 사내 게시 또는 서면 등으로 근로자에게 알려야 합니다. (산업안전보건법 제24조)
      </p>
    </article>
  );
}

/* ============================================================
 * 협력업체 협의체회의
 * ============================================================ */

const PARTNER_SECTIONS = [
  'basic',
  'attendees',
  'agenda',
  'weekly-work',
  'inspection',
  'requests',
];

function PartnerCouncilTemplate() {
  const num = useSectionNumerator(PARTNER_SECTIONS);
  const PARTNER_AGENDA_LABELS = [
    '작업의 시작 시간',
    '작업 또는 작업장 간의 연락 방법',
    '재해 발생 위험이 있는 경우 대피 방법',
    '작업장에서의 위험성평가 실시에 관한 사항',
    '사업주와 수급인 또는 수급인 상호 간의 연락 방법 및 작업공정 조정',
  ];

  return (
    <article className="mx-auto max-w-[780px] bg-white p-6 text-slate-900 print:max-w-none print:p-0">
      <header className="text-center">
        <p className="text-[11px] font-bold text-slate-400 print:text-slate-600">
          산업안전보건법 제64조 / 시행규칙 제79조 · 매월 1회 이상
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">협력업체 안전보건 협의체 회의록</h2>
        <div className="mx-auto mt-3 h-[2px] w-24 bg-purple-600" />
      </header>

      <EditableSection id="basic" num={num('basic')} title="기본 정보">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <th className={headCls}>회의명</th>
              <td className={cellCls} colSpan={3}>
                <Txt name="basic.meetingName" placeholder="예: 2026년 0월 정기 협력업체 협의체회의" />
              </td>
            </tr>
            <tr>
              <th className={headCls}>일시</th>
              <td className={cellCls}>
                <Txt name="basic.datetime" type="datetime-local" />
              </td>
              <th className={headCls}>장소</th>
              <td className={cellCls}>
                <Txt name="basic.location" placeholder="예: 현장 사무실 회의실" />
              </td>
            </tr>
            <tr>
              <th className={headCls}>현장명</th>
              <td className={cellCls}>
                <Txt name="basic.site" />
              </td>
              <th className={headCls}>도급인</th>
              <td className={cellCls}>
                <Txt name="basic.contractor" placeholder="원도급 업체명" />
              </td>
            </tr>
          </tbody>
        </table>
      </EditableSection>

      <EditableSection id="attendees" num={num('attendees')} title="참석자">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={headCls} style={{ width: '8%' }}>No.</th>
              <th className={headCls} style={{ width: '28%' }}>회사(공종)</th>
              <th className={headCls} style={{ width: '20%' }}>직위</th>
              <th className={headCls} style={{ width: '20%' }}>성명</th>
              <th className={headCls}>연락처</th>
            </tr>
          </thead>
          <tbody>
            <DynamicRows
              id="partner-attendees"
              defaultCount={8}
              renderRow={(i) => (
                <tr>
                  <td className={cellCls + ' text-center'}>{i + 1}</td>
                  <td className={cellCls}>
                    <Txt name={`attendees.${i}.company`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`attendees.${i}.position`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`attendees.${i}.name`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`attendees.${i}.contact`} />
                  </td>
                </tr>
              )}
            />
          </tbody>
        </table>
        <RowControls id="partner-attendees" defaultCount={8} label="참석자" />
      </EditableSection>

      <EditableSection
        id="agenda"
        num={num('agenda')}
        title="법정 협의 사항 (시행규칙 제79조)"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={headCls} style={{ width: '8%' }}>No.</th>
              <th className={headCls}>협의 항목</th>
              <th className={headCls} style={{ width: '40%' }}>협의 내용 및 결정 사항</th>
            </tr>
          </thead>
          <tbody>
            <DynamicRows
              id="partner-agenda"
              defaultCount={PARTNER_AGENDA_LABELS.length}
              renderRow={(i) => (
                <tr>
                  <td className={cellCls + ' text-center'}>{i + 1}</td>
                  <td className={cellCls}>
                    {PARTNER_AGENDA_LABELS[i] ? (
                      <span className="text-sm">{PARTNER_AGENDA_LABELS[i]}</span>
                    ) : (
                      <Txt name={`agenda.${i}.title`} placeholder="추가 협의 항목을 입력하세요" />
                    )}
                  </td>
                  <td className={cellCls}>
                    <Area name={`agenda.${i}.content`} rows={2} />
                  </td>
                </tr>
              )}
            />
          </tbody>
        </table>
        <RowControls id="partner-agenda" defaultCount={PARTNER_AGENDA_LABELS.length} label="협의 항목" />
      </EditableSection>

      <EditableSection
        id="weekly-work"
        num={num('weekly-work')}
        title="금주 / 금월 작업 공정 및 위험요인"
      >
        <Area
          name="weekly-work"
          rows={4}
          placeholder="공종별 작업 계획, 위험요인 및 예방 대책"
        />
      </EditableSection>

      <EditableSection
        id="inspection"
        num={num('inspection')}
        title="안전보건 지도·점검 결과 공유"
      >
        <Area
          name="inspection"
          rows={3}
          placeholder="원청 안전점검 결과, 시정 요구 사항 등"
        />
      </EditableSection>

      <EditableSection
        id="requests"
        num={num('requests')}
        title="업체별 건의 사항 및 조치계획"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={headCls} style={{ width: '22%' }}>업체명</th>
              <th className={headCls}>건의 사항</th>
              <th className={headCls} style={{ width: '22%' }}>조치 계획 / 담당</th>
              <th className={headCls} style={{ width: '16%' }}>완료 예정일</th>
            </tr>
          </thead>
          <tbody>
            <DynamicRows
              id="partner-requests"
              defaultCount={4}
              renderRow={(i) => (
                <tr>
                  <td className={cellCls}>
                    <Txt name={`requests.${i}.company`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`requests.${i}.request`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`requests.${i}.plan`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`requests.${i}.due`} type="date" />
                  </td>
                </tr>
              )}
            />
          </tbody>
        </table>
        <RowControls id="partner-requests" defaultCount={4} label="건의 사항" />
      </EditableSection>

      <p className="mt-8 text-[11px] font-bold text-slate-400 print:text-slate-600">
        ※ 도급인은 협력업체(수급인)와 함께 매월 1회 이상 협의체를 구성·운영해야 합니다. (산업안전보건법 제64조)
      </p>
    </article>
  );
}

/* ============================================================
 * 기타 회의
 * ============================================================ */

const OTHER_SECTIONS = ['basic', 'attendees', 'agenda', 'discussion', 'decisions', 'notes'];

function OtherMeetingTemplate() {
  const num = useSectionNumerator(OTHER_SECTIONS);

  return (
    <article className="mx-auto max-w-[780px] bg-white p-6 text-slate-900 print:max-w-none print:p-0">
      <header className="text-center">
        <p className="text-[11px] font-bold text-slate-400 print:text-slate-600">사내 일반 안전·운영 회의</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">회의록</h2>
        <div className="mx-auto mt-3 h-[2px] w-24 bg-emerald-600" />
      </header>

      <EditableSection id="basic" num={num('basic')} title="기본 정보">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <th className={headCls}>회의명</th>
              <td className={cellCls} colSpan={3}>
                <Txt name="basic.meetingName" placeholder="예: TBM 연장 회의 / 현장 소장 회의 등" />
              </td>
            </tr>
            <tr>
              <th className={headCls}>일시</th>
              <td className={cellCls}>
                <Txt name="basic.datetime" type="datetime-local" />
              </td>
              <th className={headCls}>장소</th>
              <td className={cellCls}>
                <Txt name="basic.location" />
              </td>
            </tr>
            <tr>
              <th className={headCls}>주관</th>
              <td className={cellCls}>
                <Txt name="basic.host" />
              </td>
              <th className={headCls}>작성자</th>
              <td className={cellCls}>
                <Txt name="basic.writer" />
              </td>
            </tr>
          </tbody>
        </table>
      </EditableSection>

      <EditableSection id="attendees" num={num('attendees')} title="참석자">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={headCls} style={{ width: '8%' }}>No.</th>
              <th className={headCls} style={{ width: '28%' }}>소속</th>
              <th className={headCls} style={{ width: '22%' }}>직위</th>
              <th className={headCls} style={{ width: '22%' }}>성명</th>
              <th className={headCls}>연락처</th>
            </tr>
          </thead>
          <tbody>
            <DynamicRows
              id="other-attendees"
              defaultCount={6}
              renderRow={(i) => (
                <tr>
                  <td className={cellCls + ' text-center'}>{i + 1}</td>
                  <td className={cellCls}>
                    <Txt name={`attendees.${i}.affiliation`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`attendees.${i}.position`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`attendees.${i}.name`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`attendees.${i}.contact`} />
                  </td>
                </tr>
              )}
            />
          </tbody>
        </table>
        <RowControls id="other-attendees" defaultCount={6} label="참석자" />
      </EditableSection>

      <EditableSection id="agenda" num={num('agenda')} title="회의 안건">
        <Area name="agenda" rows={3} placeholder={'· 안건 1\n· 안건 2'} />
      </EditableSection>

      <EditableSection id="discussion" num={num('discussion')} title="주요 논의 내용">
        <Area name="discussion" rows={6} placeholder="논의 내용을 자유롭게 기록해주세요." />
      </EditableSection>

      <EditableSection id="decisions" num={num('decisions')} title="결정 사항 및 실행 과제">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={headCls}>결정 / 실행 과제</th>
              <th className={headCls} style={{ width: '20%' }}>담당자</th>
              <th className={headCls} style={{ width: '18%' }}>완료 예정일</th>
            </tr>
          </thead>
          <tbody>
            <DynamicRows
              id="other-decisions"
              defaultCount={4}
              renderRow={(i) => (
                <tr>
                  <td className={cellCls}>
                    <Txt name={`decisions.${i}.task`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`decisions.${i}.owner`} />
                  </td>
                  <td className={cellCls}>
                    <Txt name={`decisions.${i}.due`} type="date" />
                  </td>
                </tr>
              )}
            />
          </tbody>
        </table>
        <RowControls id="other-decisions" defaultCount={4} label="결정/실행 과제" />
      </EditableSection>

      <EditableSection id="notes" num={num('notes')} title="비고 / 첨부">
        <Area name="notes" rows={3} placeholder="기타 공유 사항, 첨부 자료명 등" />
      </EditableSection>
    </article>
  );
}
