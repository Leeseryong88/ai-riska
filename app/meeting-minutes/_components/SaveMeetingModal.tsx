'use client';

import React, { useState } from 'react';
import { X, Upload, FileText, Loader2 } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { uploadMeetingFile } from '../_lib/storage';
import { MEETING_TYPE_LABEL, type MeetingType } from '../_lib/types';
import { currentYear } from '../_lib/utils';

interface SaveMeetingModalProps {
  type: MeetingType;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SaveMeetingModal: React.FC<SaveMeetingModalProps> = ({ type, open, onClose, onSaved }) => {
  const { user } = useAuth();
  const nowYear = currentYear();
  const [year, setYear] = useState<number>(nowYear);
  const [quarter, setQuarter] = useState<number>(Math.floor(new Date().getMonth() / 3) + 1);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSave = async () => {
    if (!user) {
      setError('로그인이 필요합니다.');
      return;
    }
    if (!title.trim()) {
      setError('회의 제목을 입력해주세요.');
      return;
    }
    if (!date) {
      setError('회의 날짜를 선택해주세요.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      let fileMeta: { url: string; fileName: string; fileType: string } | null = null;
      if (file) {
        const res = await uploadMeetingFile(user.uid, file);
        fileMeta = { url: res.url, fileName: res.fileName, fileType: res.fileType };
      }

      const payload: Record<string, any> = {
        managerId: user.uid,
        type,
        title: title.trim(),
        date,
        createdAt: serverTimestamp(),
      };
      if (type === 'oshc') {
        payload.year = year;
        payload.quarter = quarter;
      } else if (type === 'partner_council') {
        payload.year = year;
        payload.month = month;
      }
      if (fileMeta) {
        payload.fileUrl = fileMeta.url;
        payload.fileName = fileMeta.fileName;
        payload.fileType = fileMeta.fileType;
      }

      await addDoc(collection(db, 'meeting_minutes'), payload);
      onSaved();
      onClose();
      setTitle('');
      setFile(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const years = Array.from({ length: 6 }, (_, i) => nowYear - 3 + i);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">회의록 저장</p>
            <h3 className="mt-1 text-lg font-black text-slate-900">{MEETING_TYPE_LABEL[type]}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {type === 'oshc' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-black text-slate-500">년도</label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-black text-slate-500">분기</label>
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                >
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>
                      {q}분기
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {type === 'partner_council' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-black text-slate-500">년도</label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-black text-slate-500">월</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}월
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-black text-slate-500">회의 날짜</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black text-slate-500">회의 제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2026년 1분기 정기 산업안전보건위원회"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black text-slate-500">
              회의록 파일 <span className="font-normal text-slate-400">(PDF, 이미지, 워드 등 · 선택)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 transition hover:border-blue-300 hover:bg-blue-50/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400">
                {file ? <FileText className="h-5 w-5 text-blue-600" /> : <Upload className="h-5 w-5" />}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-bold text-slate-700">
                  {file ? file.name : '파일을 선택하거나 드래그하세요'}
                </p>
                <p className="text-[11px] font-bold text-slate-400">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : '최대 20MB'}
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.hwp,.hwpx,.xls,.xlsx,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{error}</p>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? '저장 중...' : '회의록 저장'}
          </button>
        </div>
      </div>
    </div>
  );
};
