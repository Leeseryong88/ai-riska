'use client';

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  deleteDoc, 
  doc,
  updateDoc,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { Trash2, ExternalLink, Calendar, Info, FileSpreadsheet, Printer, Edit2, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pagination } from '@/components/ui/Pagination';
import {
  computeRiskLevelLabel,
  inferAssessmentMethod,
  riskLevelBadgeStyle,
} from '@/app/lib/risk-level';

interface AssessmentRecord {
  id: string;
  title: string;
  createdAt: any;
  tableData: any[];
  tableHTML: string;
  userId: string;
  approvalCount?: number;
  approvalLabels?: string[];
  showWorkerSignatures?: boolean;
}

export function RiskAssessmentTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<AssessmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listPage, setListPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<AssessmentRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editTableData, setEditTableData] = useState<any[]>([]);
  const [editApprovalCount, setEditApprovalCount] = useState(0);
  const [editApprovalLabels, setEditApprovalLabels] = useState<string[]>([]);
  const [editShowWorkerSignatures, setEditShowWorkerSignatures] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const assessmentTableRef = useRef<HTMLDivElement>(null);

  const FETCH_BATCH = 100;
  const LIST_PAGE_SIZE = 10;

  const fetchItems = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const aggregated: AssessmentRecord[] = [];
      let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
      while (true) {
        let q = query(
          collection(db, 'assessments'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(FETCH_BATCH)
        );
        if (cursor) q = query(q, startAfter(cursor));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) break;
        aggregated.push(
          ...querySnapshot.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as AssessmentRecord
          )
        );
        if (querySnapshot.docs.length < FETCH_BATCH) break;
        cursor = querySnapshot.docs[querySnapshot.docs.length - 1];
      }
      setItems(aggregated);
      setListPage(1);
    } catch (error) {
      console.error('Error fetching assessments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [user]);

  const totalPages = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE));

  useEffect(() => {
    if (listPage > totalPages) setListPage(totalPages);
  }, [listPage, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (listPage - 1) * LIST_PAGE_SIZE;
    return items.slice(start, start + LIST_PAGE_SIZE);
  }, [items, listPage]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('정말로 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'assessments', id));
      setItems(prev => prev.filter(item => item.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}. ${month}. ${day}.`;
  };

  const handleEditStart = () => {
    if (!selectedItem) return;
    setEditTitle(selectedItem.title || '');
    setEditTableData(JSON.parse(JSON.stringify(selectedItem.tableData || [])));
    
    // 결재칸 및 근로자 서명란 상태 설정
    let appCount = selectedItem.approvalCount;
    let appLabels = selectedItem.approvalLabels;
    let workerSigs = selectedItem.showWorkerSignatures;

    // 만약 필드가 없는 기존 데이터라면 HTML에서 추출 시도
    if (appCount === undefined || appLabels === undefined || workerSigs === undefined) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = selectedItem.tableHTML || '';
      
      if (appCount === undefined) {
        const approvalCells = tempDiv.querySelectorAll('.approval-section-wrapper th').length;
        // 결재칸 th 개수에서 1(결재 텍스트 칸)을 뺀 것이 실제 결재 칸 수
        appCount = Math.max(0, approvalCells - 1);
      }
      
      if (appLabels === undefined) {
        const approvalThs = tempDiv.querySelectorAll('.approval-section-wrapper th:not([rowspan])');
        appLabels = Array.from(approvalThs).map(th => th.textContent?.trim() || '');
      }
      
      if (workerSigs === undefined) {
        workerSigs = tempDiv.querySelector('.worker-signature-section') !== null;
      }
    }

    setEditApprovalCount(appCount || 0);
    setEditApprovalLabels(appLabels || Array(appCount || 0).fill(''));
    setEditShowWorkerSignatures(!!workerSigs);
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
  };

  const generateTableHTML = (data: any[], appCount: number = 0, appLabels: string[] = [], workerSigs: boolean = false) => {
    let approvalHTML = '';
    if (appCount > 0) {
      approvalHTML = `
        <div class="approval-section-wrapper" style="display: flex; justify-content: flex-end; margin-bottom: 25px; width: 100%;">
          <div style="width: fit-content; margin-left: auto;">
            <table border="1" style="border-collapse: collapse; text-align: center; border: 1px solid #94A3B8;">
              <tr>
                <th rowspan="2" style="padding: 5px; background-color: #F8FAFC; font-size: 11px; width: 30px; border: 1px solid #94A3B8; color: #475569; line-height: 1.2; text-align: center;">
                  <div class="approval-cell">
                    <div style="width: 100%;">결</div>
                    <div style="width: 100%;">재</div>
                  </div>
                </th>
                ${Array(appCount).fill(0).map((_, i) => `<th style="padding: 5px; background-color: #F8FAFC; font-size: 11px; width: 70px; height: 25px; border: 1px solid #94A3B8; color: #475569; text-align: center;">${appLabels[i] || ''}</th>`).join('')}
              </tr>
              <tr>
                ${Array(appCount).fill(0).map(() => `<td style="height: 70px; width: 70px; border: 1px solid #94A3B8;"></td>`).join('')}
              </tr>
            </table>
          </div>
        </div>
      `;
    }

    let workerSignatureHTML = '';
    if (workerSigs) {
      workerSignatureHTML = `
        <div class="worker-signature-section" style="margin-top: 40px; page-break-before: auto;">
          <h3 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #1E293B; border-left: 4px solid #3B82F6; padding-left: 10px;">근로자 명단 및 서명</h3>
          <table border="1" style="border-collapse: collapse; width: 100%; text-align: center; border: 1px solid #94A3B8;">
            <thead>
              <tr style="background-color: #F8FAFC;">
                <th style="padding: 10px; font-size: 13px; border: 1px solid #94A3B8; width: 16%; color: #475569;">성명</th>
                <th style="padding: 10px; font-size: 13px; border: 1px solid #94A3B8; width: 17%; color: #475569;">서명</th>
                <th style="padding: 10px; font-size: 13px; border: 1px solid #94A3B8; width: 16%; color: #475569;">성명</th>
                <th style="padding: 10px; font-size: 13px; border: 1px solid #94A3B8; width: 17%; color: #475569;">서명</th>
                <th style="padding: 10px; font-size: 13px; border: 1px solid #94A3B8; width: 16%; color: #475569;">성명</th>
                <th style="padding: 10px; font-size: 13px; border: 1px solid #94A3B8; width: 18%; color: #475569;">서명</th>
              </tr>
            </thead>
            <tbody>
              ${Array(4).fill(0).map(() => `
                <tr>
                  <td style="height: 45px; border: 1px solid #94A3B8;"></td>
                  <td style="height: 45px; border: 1px solid #94A3B8;"></td>
                  <td style="height: 45px; border: 1px solid #94A3B8;"></td>
                  <td style="height: 45px; border: 1px solid #94A3B8;"></td>
                  <td style="height: 45px; border: 1px solid #94A3B8;"></td>
                  <td style="height: 45px; border: 1px solid #94A3B8;"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const spMethod = inferAssessmentMethod(data);
    return `
      <div style="width: 100%; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;">
        ${approvalHTML}
        <table class="main-assessment-table" border="1" style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #94A3B8; table-layout: fixed;">
          <thead>
            <tr style="background-color: #F8FAFC;">
              <th style="padding: 12px 8px; border: 1px solid #94A3B8; width: 15%; color: #475569;">공정/장비</th>
              <th style="padding: 12px 8px; border: 1px solid #94A3B8; width: 25%; color: #475569;">위험 요소</th>
              <th style="padding: 12px 8px; border: 1px solid #94A3B8; width: 8%; color: #475569;">중대성</th>
              <th style="padding: 12px 8px; border: 1px solid #94A3B8; width: 8%; color: #475569;">가능성</th>
              <th style="padding: 12px 8px; border: 1px solid #94A3B8; width: 10%; color: #475569;">위험도</th>
              <th style="padding: 12px 8px; border: 1px solid #94A3B8; width: 34%; color: #475569;">대책</th>
            </tr>
          </thead>
          <tbody>
            ${data
              .map((row) => {
                const risk = computeRiskLevelLabel(
                  String(row.severity ?? ''),
                  String(row.probability ?? ''),
                  spMethod
                );
                return `
              <tr>
                <td style="padding: 10px 8px; border: 1px solid #94A3B8; color: #1E293B;">${row.processName || ''}</td>
                <td style="padding: 10px 8px; border: 1px solid #94A3B8; color: #1E293B;">${row.riskFactor || ''}</td>
                <td style="padding: 10px 8px; border: 1px solid #94A3B8; color: #1E293B; text-align: center;">${row.severity || ''}</td>
                <td style="padding: 10px 8px; border: 1px solid #94A3B8; color: #1E293B; text-align: center;">${row.probability || ''}</td>
                <td style="padding: 10px 8px; border: 1px solid #94A3B8; color: #1E293B; text-align: center;">
                  <span style="padding: 2px 8px; border-radius: 9999px; font-weight: bold; font-size: 11px; ${riskLevelBadgeStyle(
                    risk
                  )}">${risk}</span>
                </td>
                <td style="padding: 10px 8px; border: 1px solid #94A3B8; color: #1E293B;">${row.countermeasure || ''}</td>
              </tr>
            `;
              })
              .join('')}
          </tbody>
        </table>
        ${workerSignatureHTML}
      </div>
    `;
  };

  const extractTableDataFromContainer = (container: HTMLElement | null) => {
    if (!container) return null;
    const mainTable =
      container.querySelector<HTMLTableElement>('table.main-assessment-table') ||
      Array.from(container.querySelectorAll<HTMLTableElement>('table')).find((t) => {
        const tr = t.querySelector('tbody tr');
        return tr != null && tr.querySelectorAll('td').length >= 6;
      }) ||
      null;
    if (!mainTable) return null;
    const tbody = mainTable.querySelector('tbody');
    if (!tbody) return null;
    const rows = tbody.querySelectorAll('tr');
    const data: {
      processName: string;
      riskFactor: string;
      severity: string;
      probability: string;
      riskLevel: string;
      countermeasure: string;
    }[] = [];
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 6) return;
      data.push({
        processName: cells[0]?.textContent?.trim() || '',
        riskFactor: cells[1]?.textContent?.trim() || '',
        severity: cells[2]?.textContent?.trim() || '',
        probability: cells[3]?.textContent?.trim() || '',
        riskLevel: '',
        countermeasure: cells[5]?.textContent?.trim() || '',
      });
    });
    if (data.length === 0) return null;
    const method = inferAssessmentMethod(data);
    return data.map((r) => ({
      ...r,
      riskLevel: computeRiskLevelLabel(r.severity, r.probability, method),
    }));
  };

  const editFormPreviewHtml = useMemo(
    () =>
      generateTableHTML(
        editTableData,
        editApprovalCount,
        editApprovalLabels,
        editShowWorkerSignatures
      ),
    [editTableData, editApprovalCount, editApprovalLabels, editShowWorkerSignatures]
  );

  const applyRiskToRow = (tr: HTMLTableRowElement, table: HTMLTableElement) => {
    const tds = tr.querySelectorAll<HTMLElement>('td');
    if (tds.length < 6) return;
    const rows: { severity: string; probability: string }[] = [];
    table.querySelectorAll('tbody tr').forEach((r) => {
      const c = r.querySelectorAll('td');
      if (c.length >= 4) {
        rows.push({
          severity: c[2].textContent?.trim() || '',
          probability: c[3].textContent?.trim() || '',
        });
      }
    });
    const m = inferAssessmentMethod(rows);
    const label = computeRiskLevelLabel(
      tds[2].textContent?.trim() || '',
      tds[3].textContent?.trim() || '',
      m
    );
    tds[4].innerHTML = '';
    tds[4].textContent = label;
  };

  const flushEditFromDom = () => {
    const d = extractTableDataFromContainer(assessmentTableRef.current);
    if (d && d.length > 0) {
      setEditTableData(d);
    }
  };

  useLayoutEffect(() => {
    if (!isEditing || !assessmentTableRef.current) return;
    const root = assessmentTableRef.current;
    const table =
      root.querySelector<HTMLTableElement>('table.main-assessment-table') ||
      Array.from(root.querySelectorAll<HTMLTableElement>('table')).find((t) => {
        const tr = t.querySelector('tbody tr');
        return tr != null && tr.querySelectorAll('td').length >= 6;
      });
    if (!table) return;
    const bodyRows = table.querySelectorAll<HTMLTableRowElement>('tbody tr');
    bodyRows.forEach((tr) => {
      const tds = tr.querySelectorAll<HTMLElement>('td');
      if (tds.length < 6) return;
      tds.forEach((el, col) => {
        if (col === 4) {
          el.contentEditable = 'false';
          el.removeAttribute('contenteditable');
          el.style.cursor = 'not-allowed';
          el.style.outline = '1px solid rgba(148, 163, 184, 0.55)';
          el.style.outlineOffset = '-1px';
          el.style.background = 'rgba(248, 250, 252, 0.98)';
        } else {
          el.contentEditable = 'true';
          el.style.cursor = 'text';
          el.style.outline = '1px dashed rgba(59, 130, 246, 0.45)';
          el.style.outlineOffset = '-1px';
        }
      });
      applyRiskToRow(tr, table);
    });
    const onInput = (e: Event) => {
      const t = e.target as HTMLElement;
      if (!t.closest('tbody')) return;
      const tr = t.closest('tr') as HTMLTableRowElement | null;
      if (!tr || !tr.closest('table')?.isSameNode(table)) return;
      const targetTd = t.closest('td');
      if (!targetTd) return;
      const tds = tr.querySelectorAll('td');
      const col = Array.prototype.indexOf.call(tds, targetTd);
      if (col !== 2 && col !== 3) return;
      applyRiskToRow(tr, table);
    };
    root.addEventListener('input', onInput, true);
    return () => {
      root.removeEventListener('input', onInput, true);
      bodyRows.forEach((r) => {
        r.querySelectorAll<HTMLElement>('td').forEach((el) => {
          el.contentEditable = 'false';
          el.removeAttribute('contenteditable');
          el.style.removeProperty('cursor');
          el.style.removeProperty('outline');
          el.style.removeProperty('outline-offset');
          el.style.removeProperty('background');
        });
      });
    };
  }, [isEditing, editFormPreviewHtml]);

  const handleSave = async () => {
    if (!selectedItem) return;
    setIsSaving(true);
    try {
      const fromDom = extractTableDataFromContainer(assessmentTableRef.current);
      const tableData = fromDom && fromDom.length > 0 ? fromDom : editTableData;
      setEditTableData(tableData);
      const newTableHTML = generateTableHTML(
        tableData, 
        editApprovalCount, 
        editApprovalLabels,
        editShowWorkerSignatures
      );
      
      const docRef = doc(db, 'assessments', selectedItem.id);
      await updateDoc(docRef, {
        title: editTitle,
        tableData: tableData,
        tableHTML: newTableHTML,
        approvalCount: editApprovalCount,
        approvalLabels: editApprovalLabels,
        showWorkerSignatures: editShowWorkerSignatures
      });

      // Update local state
      setItems(prev => prev.map(item => 
        item.id === selectedItem.id 
          ? { 
              ...item, 
              title: editTitle, 
              tableData: tableData, 
              tableHTML: newTableHTML,
              approvalCount: editApprovalCount,
              approvalLabels: editApprovalLabels,
              showWorkerSignatures: editShowWorkerSignatures
            }
          : item
      ));
      setSelectedItem(prev => prev ? { 
        ...prev, 
        title: editTitle, 
        tableData: tableData, 
        tableHTML: newTableHTML,
        approvalCount: editApprovalCount,
        approvalLabels: editApprovalLabels,
        showWorkerSignatures: editShowWorkerSignatures
      } : null);
      setIsEditing(false);
      alert('수정되었습니다.');
    } catch (error) {
      console.error('Error updating assessment:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    if (!selectedItem) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('팝업 차단을 해제해주세요.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${selectedItem.title}</title>
          <style>
            @page { size: landscape; margin: 10mm; }
            body { 
              font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; 
              padding: 20px;
              color: #333;
            }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { font-size: 24pt; margin: 0; }
            .info { text-align: right; margin-bottom: 10px; font-size: 10pt; color: #666; }
            .approval-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>위험성평가표</h1>
          </div>
          <div class="info">
            제목: ${selectedItem.title}<br/>
            생성일: ${formatDate(selectedItem.createdAt)}
          </div>
          <div class="content">
            ${selectedItem.tableHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {items.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Info className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-bold">저장된 위험성평가 결과가 없습니다.</p>
        </div>
      ) : (
        <>
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 text-xs font-black text-gray-500 uppercase tracking-wider">
            <div className="col-span-1 text-center">번호</div>
            <div className="col-span-5">제목</div>
            <div className="col-span-3 text-center">생성일</div>
            <div className="col-span-2 text-center">항목수</div>
            <div className="col-span-1 text-center">작업</div>
          </div>
          <div className="divide-y divide-gray-100">
            {pagedItems.map((item, index) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setSelectedItem(item)}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-amber-50/30 transition-all cursor-pointer items-center"
              >
                <div className="hidden md:flex md:col-span-1 items-center justify-center">
                  <span className="text-sm font-black text-blue-600">{(listPage - 1) * LIST_PAGE_SIZE + index + 1}</span>
                </div>
                <div className="col-span-1 md:col-span-5 flex items-center gap-3">
                  <div className="md:hidden w-8 h-8 shrink-0 rounded-lg bg-blue-100 flex items-center justify-center">
                    <span className="text-xs font-black text-blue-600">{(listPage - 1) * LIST_PAGE_SIZE + index + 1}</span>
                  </div>
                  <div className="hidden md:flex w-10 h-10 rounded-lg bg-blue-100 items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900 line-clamp-1">{item.title || '제목 없음'}</h3>
                    <div className="md:hidden mt-1 flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                      {formatDate(item.createdAt)}
                    </div>
                  </div>
                </div>
                
                <div className="hidden md:flex md:col-span-3 items-center justify-center text-xs font-bold text-gray-500">
                  {formatDate(item.createdAt)}
                </div>
                
                <div className="col-span-1 md:col-span-2 flex md:justify-center items-center gap-2">
                  <span className="md:hidden text-[10px] text-gray-400 font-bold">항목수:</span>
                  <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full font-bold">
                    {item.tableData?.length || 0}건
                  </span>
                </div>

                <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center gap-2">
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="p-2 text-amber-600">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <Pagination
          page={listPage}
          totalPages={totalPages}
          onChange={setListPage}
          accentClass="bg-amber-600 text-white border-amber-600"
        />
        </>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedItem(null); setIsEditing(false); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-6xl bg-white rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 sm:p-8 border-b border-gray-100 flex justify-between items-center shrink-0">
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-2xl font-black text-gray-900 border-b-2 border-blue-500 outline-none flex-1 mr-4"
                    autoFocus
                  />
                ) : (
                  <h2 className="text-2xl font-black text-gray-900">{selectedItem.title}</h2>
                )}
                
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <>
                      <button
                        onClick={handlePrint}
                        className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-bold"
                        title="인쇄"
                      >
                        <Printer className="w-5 h-5" />
                        <span className="hidden sm:inline">인쇄</span>
                      </button>
                      <button
                        onClick={handleEditStart}
                        className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-2 text-sm font-bold"
                        title="수정"
                      >
                        <Edit2 className="w-5 h-5" />
                        <span className="hidden sm:inline">수정</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-bold disabled:opacity-50"
                      >
                        {isSaving ? (
                          <div className="w-5 h-5 border-t-2 border-white border-solid rounded-full animate-spin" />
                        ) : (
                          <Check className="w-5 h-5" />
                        )}
                        <span>저장</span>
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-bold"
                      >
                        <X className="w-5 h-5" />
                        <span>취소</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => { setSelectedItem(null); setIsEditing(false); }}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors ml-2"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                {isEditing ? (
                  <div className="space-y-6">
                    {/* 설정 옵션 */}
                    <div className="flex flex-wrap gap-4 items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-700">결재칸:</span>
                        <div className="flex gap-1">
                          {[0, 1, 2, 3, 4].map(count => (
                            <button
                              key={count}
                              onClick={() => {
                                flushEditFromDom();
                                setEditApprovalCount(count);
                                if (count > editApprovalLabels.length) {
                                  const newLabels = [...editApprovalLabels];
                                  for (let i = editApprovalLabels.length; i < count; i++) {
                                    newLabels.push('');
                                  }
                                  setEditApprovalLabels(newLabels);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                editApprovalCount === count 
                                  ? 'bg-blue-600 text-white shadow-sm' 
                                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {count === 0 ? '없음' : `${count}칸`}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {editApprovalCount > 0 && (
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-blue-100">
                          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">직인명:</span>
                          <div className="flex gap-1">
                            {Array(editApprovalCount).fill(0).map((_, i) => (
                              <input
                                key={i}
                                type="text"
                                value={editApprovalLabels[i] || ''}
                                onChange={(e) => {
                                  flushEditFromDom();
                                  const newLabels = [...editApprovalLabels];
                                  newLabels[i] = e.target.value;
                                  setEditApprovalLabels(newLabels);
                                }}
                                placeholder={`칸 ${i+1}`}
                                className="w-16 px-2 py-1 text-[11px] border border-gray-100 rounded focus:ring-1 focus:ring-blue-400 outline-none font-bold text-center"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="h-4 w-px bg-gray-200 mx-2 hidden sm:block" />
                      
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-700">근로자 명단/서명:</span>
                        <button
                          onClick={() => {
                            flushEditFromDom();
                            setEditShowWorkerSignatures(!editShowWorkerSignatures);
                          }}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            editShowWorkerSignatures 
                              ? 'bg-emerald-600 text-white shadow-sm' 
                              : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {editShowWorkerSignatures ? '표시 중' : '미표시'}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500">
                      아래 표는 저장된 위험성평가와 동일한 양식입니다. 셀을 클릭해 직접 수정하세요. 결재칸·근로자 서명 표시를 바꾸면 표가 다시 그려집니다.
                    </p>
                    <div
                      ref={assessmentTableRef}
                      className="mt-3 bg-white p-2 border border-gray-100 rounded-2xl overflow-auto ring-2 ring-blue-400/50 ring-inset"
                    >
                      <div
                        className="assessment-table-container"
                        dangerouslySetInnerHTML={{ __html: editFormPreviewHtml }}
                      />
                    </div>
                  </div>
                ) : (
                  <div 
                    className="bg-white p-4 border border-gray-100 rounded-2xl overflow-auto assessment-table-container"
                    dangerouslySetInnerHTML={{ __html: selectedItem.tableHTML }} 
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .assessment-table-container table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .assessment-table-container th, 
        .assessment-table-container td {
          border: 1px solid #e5e7eb;
          padding: 0.75rem;
          text-align: left;
        }
        .assessment-table-container th {
          background-color: #f9fafb;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
