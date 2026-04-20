import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/app/lib/firebase';

function sanitizeSegment(name: string) {
  return name.replace(/[^\w.\-가-힣]/g, '_').slice(0, 180) || 'file';
}

export async function uploadMeetingFile(
  userId: string,
  file: File
): Promise<{ url: string; path: string; fileName: string; fileType: string }> {
  if (!storage) throw new Error('스토리지를 사용할 수 없습니다.');
  const safe = sanitizeSegment(file.name);
  const path = `meeting-minutes/${userId}/${Date.now()}_${safe}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, path, fileName: file.name, fileType: file.type || '' };
}

export async function deleteMeetingFile(path?: string | null) {
  if (!storage || !path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    console.warn('deleteMeetingFile:', e);
  }
}
