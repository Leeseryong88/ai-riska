'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';
import {
  getDefaultTemplateContent,
  normalizeTemplateContent,
  templateContentToHtml,
  type WorkerFeedbackTemplateContent,
} from '../_lib/templateContent';

export const DEFAULT_WF_QR_TITLE = '근로자 의견·제보 QR';
export const DEFAULT_WF_QR_TEXT =
  '산업안전보건법에 따라 근로자 의견을 청취하고 있습니다.\n아래 QR을 스캔하여 의견·제보를 남겨 주세요.';

export function useWorkerFeedbackTemplate() {
  const { user } = useAuth();
  const [content, setContent] = useState<WorkerFeedbackTemplateContent>(getDefaultTemplateContent);
  const [draft, setDraft] = useState<WorkerFeedbackTemplateContent>(getDefaultTemplateContent);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [qrTitle, setQrTitle] = useState(DEFAULT_WF_QR_TITLE);
  const [qrText, setQrText] = useState(DEFAULT_WF_QR_TEXT);
  const [qrDecorEditing, setQrDecorEditing] = useState(false);
  const [tempQrTitle, setTempQrTitle] = useState(DEFAULT_WF_QR_TITLE);
  const [tempQrText, setTempQrText] = useState(DEFAULT_WF_QR_TEXT);
  const [savingQr, setSavingQr] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const ref = doc(db, 'worker_feedback_settings', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (data?.templateContent) {
            setContent(normalizeTemplateContent(data.templateContent));
          } else {
            setContent(getDefaultTemplateContent());
          }
          if (typeof data?.qrTitle === 'string') setQrTitle(data.qrTitle);
          if (typeof data?.qrText === 'string') setQrText(data.qrText);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const openEdit = useCallback(() => {
    setDraft(normalizeTemplateContent(content));
    setEditing(true);
  }, [content]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const save = useCallback(async () => {
    if (!user) return;
    const normalized = normalizeTemplateContent(draft);
    setSaving(true);
    try {
      const html = templateContentToHtml(normalized);
      await setDoc(
        doc(db, 'worker_feedback_settings', user.uid),
        {
          managerId: user.uid,
          templateContent: normalized,
          templateHtml: html,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setContent(normalized);
      setDraft(normalized);
      setEditing(false);
      alert('저장되었습니다.');
    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }, [user, draft]);

  const setDraftTitle = (title: string) => setDraft((c) => ({ ...c, title }));
  const setDraftLead = (lead: string) => setDraft((c) => ({ ...c, lead }));
  const setDraftBullet = (index: number, value: string) =>
    setDraft((c) => {
      const bullets = [...c.bullets];
      bullets[index] = value;
      return { ...c, bullets };
    });
  const addDraftBullet = () => setDraft((c) => ({ ...c, bullets: [...c.bullets, ''] }));
  const removeDraftBullet = (index: number) =>
    setDraft((c) => ({
      ...c,
      bullets: c.bullets.filter((_, i) => i !== index),
    }));

  const openQrDecorEdit = useCallback(() => {
    setTempQrTitle(qrTitle);
    setTempQrText(qrText);
    setQrDecorEditing(true);
  }, [qrTitle, qrText]);

  const cancelQrDecorEdit = useCallback(() => {
    setQrDecorEditing(false);
    setTempQrTitle(qrTitle);
    setTempQrText(qrText);
  }, [qrTitle, qrText]);

  const saveQrDecor = useCallback(async () => {
    if (!user) return;
    setSavingQr(true);
    try {
      await setDoc(
        doc(db, 'worker_feedback_settings', user.uid),
        {
          managerId: user.uid,
          qrTitle: tempQrTitle,
          qrText: tempQrText,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setQrTitle(tempQrTitle);
      setQrText(tempQrText);
      setQrDecorEditing(false);
    } catch (e) {
      console.error(e);
      alert('QR 안내 저장에 실패했습니다.');
    } finally {
      setSavingQr(false);
    }
  }, [user, tempQrTitle, tempQrText]);

  return {
    content,
    draft,
    editing,
    loading,
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
  };
}
