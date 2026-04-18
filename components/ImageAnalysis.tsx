'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ImageAnalysisProps {
  analysis: string;
  itemId: number;
  imageUrl?: string | null;
  onSelectionChange: (itemId: number, selectedRows: string[]) => void;
}

const ImageAnalysis = ({ analysis, itemId, imageUrl, onSelectionChange }: ImageAnalysisProps) => {
  const [tableData, setTableData] = useState<Array<{
    riskFactor: string;
    severity: string;
    probability: string;
    riskLevel: string;
    countermeasure: string;
    isSelected: boolean;
  }>>([]);
  
  const [showImageModal, setShowImageModal] = useState(false);
  // 전체 선택 상태 추가
  const [selectAll, setSelectAll] = useState(false);
  // 이전 선택 상태를 저장하기 위한 ref
  const prevSelectedRowsRef = useRef<string[]>([]);
  
  // 분석 결과가 변경될 때마다 테이블 데이터 추출
  useEffect(() => {
    if (!analysis) return;
    
    try {
      // HTML 파싱을 위한 임시 요소 생성
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = analysis;
      
      // 테이블 찾기
      const table = tempDiv.querySelector('table');
      if (!table) return;
      
      // tbody 내의 모든 행에서 데이터 추출
      const tbody = table.querySelector('tbody');
      if (!tbody) return;
      
      const rows = tbody.querySelectorAll('tr');
      const extractedData = Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        
        // 각 셀에서 텍스트 추출
        return {
          riskFactor: cells[0]?.textContent?.trim() || '',
          severity: cells[1]?.textContent?.trim() || '',
          probability: cells[2]?.textContent?.trim() || '',
          riskLevel: cells[3]?.textContent?.trim() || '',
          countermeasure: cells[4]?.textContent?.trim() || '',
          isSelected: false
        };
      });
      
      setTableData(extractedData);
      setSelectAll(false); // 새 데이터가 로드될 때 전체 선택 상태 초기화
      // 새 데이터가 로드될 때 이전 선택 내역도 초기화
      prevSelectedRowsRef.current = [];
    } catch (error) {
      console.error('테이블 데이터 추출 오류:', error);
    }
  }, [analysis]);
  
  // 체크박스 변경 처리
  const handleCheckboxChange = (index: number) => {
    setTableData(prevData => {
      const newData = [...prevData];
      newData[index] = {
        ...newData[index],
        isSelected: !newData[index].isSelected
      };
      
      // 모든 항목이 선택되었는지 확인하여 전체 선택 상태 업데이트
      const allSelected = newData.every(item => item.isSelected);
      setSelectAll(allSelected);
      
      return newData;
    });
  };
  
  // 전체 선택/해제 처리
  const handleSelectAllChange = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    
    // 모든 행의 선택 상태 업데이트
    setTableData(prevData => 
      prevData.map(row => ({
        ...row,
        isSelected: newSelectAll
      }))
    );
  };
  
  // 선택된 항목 문자열로 변환하는 함수 (메모이제이션)
  const getSelectedRowsString = useCallback((data: typeof tableData) => {
    return data
      .filter(row => row.isSelected)
      .map(row => `${row.riskFactor}|${row.severity}|${row.probability}|${row.riskLevel}|${row.countermeasure}`);
  }, []);
  
  // 선택된 행이 변경될 때마다 부모 컴포넌트에 알림 (최적화)
  useEffect(() => {
    const selectedRows = getSelectedRowsString(tableData);
    
    // 이전 선택과 현재 선택이 다를 경우에만 업데이트
    if (JSON.stringify(prevSelectedRowsRef.current) !== JSON.stringify(selectedRows)) {
      prevSelectedRowsRef.current = selectedRows;
      onSelectionChange(itemId, selectedRows);
    }
  }, [tableData, itemId, onSelectionChange, getSelectedRowsString]);

  return (
    <div className="p-3 md:p-6 bg-white rounded-lg shadow-md h-full relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* 모바일 이미지 아이콘 */}
          {imageUrl && (
            <div 
              className="md:hidden w-10 h-10 rounded-lg overflow-hidden border border-blue-200 shadow-sm cursor-pointer active:scale-95 transition-transform"
              onClick={() => setShowImageModal(true)}
            >
              <img src={imageUrl} alt="분석 이미지" className="w-full h-full object-cover" />
            </div>
          )}
          <h2 className="text-lg md:text-xl font-semibold text-gray-800">위험성평가표</h2>
        </div>
      </div>
      
      {/* 이미지 확대 모달 */}
      {showImageModal && imageUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-full max-h-full animate-scaleIn">
            <img 
              src={imageUrl} 
              alt="분석 이미지 확대" 
              className="rounded-xl shadow-2xl max-h-[85vh] object-contain"
            />
            <button 
              className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-800 hover:bg-gray-100 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowImageModal(false);
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {tableData.length > 0 ? (
        <div className="w-full">
          {/* 데스크톱/태블릿 테이블 뷰 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAllChange}
                      className="w-5 h-5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="min-w-[150px]">위험 요소</th>
                  <th className="w-20 text-center">중대성</th>
                  <th className="w-20 text-center">가능성</th>
                  <th className="w-24 text-center">위험도</th>
                  <th className="min-w-[200px]">대책</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="text-center p-3 border border-gray-200">
                      <input
                        type="checkbox"
                        checked={row.isSelected}
                        onChange={() => handleCheckboxChange(index)}
                        className="w-5 h-5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-3 border border-gray-200 text-gray-800">{row.riskFactor}</td>
                    <td className="p-3 border border-gray-200 text-center font-medium">{row.severity}</td>
                    <td className="p-3 border border-gray-200 text-center font-medium">{row.probability}</td>
                    <td className="p-3 border border-gray-200 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                        row.riskLevel.includes('상') ? 'bg-red-100 text-red-700' :
                        row.riskLevel.includes('중') ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {row.riskLevel}
                      </span>
                    </td>
                    <td className="p-3 border border-gray-200 text-gray-700 leading-relaxed">{row.countermeasure}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 뷰 */}
          <div className="md:hidden space-y-4">
            <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2">
              <span className="text-sm font-bold text-blue-800">전체 선택</span>
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAllChange}
                className="w-6 h-6 cursor-pointer rounded border-blue-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
            
            {tableData.map((row, index) => (
              <div 
                key={index} 
                className={`border-2 rounded-xl p-4 shadow-sm transition-all ${
                  row.isSelected 
                    ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400' 
                    : 'border-gray-200 bg-white'
                }`}
                onClick={() => handleCheckboxChange(index)}
              >
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="flex-1">
                    <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">
                      위험 요소
                    </span>
                    <p className="font-bold text-gray-900 leading-snug">
                      {row.riskFactor}
                    </p>
                  </div>
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={row.isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleCheckboxChange(index);
                      }}
                      className="w-7 h-7 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                    <span className="text-[10px] text-gray-400 font-bold block mb-0.5">중대성</span>
                    <span className="font-extrabold text-gray-700">{row.severity}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                    <span className="text-[10px] text-gray-400 font-bold block mb-0.5">가능성</span>
                    <span className="font-extrabold text-gray-700">{row.probability}</span>
                  </div>
                  <div className={`p-2 rounded-lg text-center border ${
                    row.riskLevel.includes('상') ? 'bg-red-50 border-red-100 text-red-700' :
                    row.riskLevel.includes('중') ? 'bg-yellow-50 border-yellow-100 text-yellow-700' :
                    'bg-green-50 border-green-100 text-green-700'
                  }`}>
                    <span className="text-[10px] font-bold block mb-0.5 opacity-70">위험도</span>
                    <span className="font-extrabold">{row.riskLevel}</span>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="inline-block px-2 py-0.5 rounded bg-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">
                    대책
                  </span>
                  <p className="text-sm text-gray-700 leading-relaxed font-medium">
                    {row.countermeasure}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div 
          className="text-gray-700 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: analysis }}
        />
      )}
      
      <div className="mt-6 flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${tableData.filter(row => row.isSelected).length > 0 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
          <span className="text-sm font-semibold text-gray-600">
            {tableData.filter(row => row.isSelected).length > 0 
              ? `${tableData.filter(row => row.isSelected).length}개 위험 요소 선택됨` 
              : "위험 요소를 선택해주세요"}
          </span>
        </div>
        {tableData.length > 0 && (
          <p className="text-[11px] text-gray-400 italic md:hidden">카드를 클릭하여 선택 가능</p>
        )}
      </div>
      
      <style jsx global>{`
        .md\\:hidden table {
          display: none;
        }
        
        /* 모바일에서 raw HTML 테이블이 렌더링될 때의 대응 */
        @media (max-width: 767px) {
          .text-gray-700 table {
            display: block;
            width: 100%;
            overflow-x: auto;
            white-space: nowrap;
          }
          
          .text-gray-700 td, .text-gray-700 th {
            min-width: 120px;
            white-space: normal;
            word-break: keep-all;
          }
        }

        table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 1rem;
          border: 1px solid #e2e8f0;
          font-size: 0.95rem;
        }
        
        th, td {
          padding: 0.75rem;
          border: 1px solid #e2e8f0;
          vertical-align: top;
        }
        
        th {
          background-color: #f8fafc;
          font-weight: 700;
          text-align: left;
          color: #475569;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }
        
        tr:nth-child(even) {
          background-color: #fcfcfc;
        }
      `}</style>
    </div>
  );
};

export default ImageAnalysis; 