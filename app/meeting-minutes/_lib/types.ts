import type { Timestamp } from 'firebase/firestore';

export type MeetingType = 'oshc' | 'partner_council' | 'other';

export interface MeetingMinute {
  id: string;
  managerId: string;
  type: MeetingType;
  title: string;
  date: string; // YYYY-MM-DD
  year?: number;
  quarter?: number; // 1~4 (oshc)
  month?: number;   // 1~12 (partner_council)
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  createdAt?: Timestamp;
}

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  oshc: '산업안전보건위원회',
  partner_council: '협력업체 협의체회의',
  other: '기타 회의',
};

export const MEETING_TYPE_CYCLE: Record<MeetingType, string> = {
  oshc: '법령상 분기당 1회',
  partner_council: '법령상 월 1회',
  other: '주기 없음',
};
