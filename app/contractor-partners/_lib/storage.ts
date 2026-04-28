import { MAX_UPLOAD_FILE_BYTES } from '@/app/lib/upload-limits';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject, type StorageReference } from 'firebase/storage';
import { storage } from '@/app/lib/firebase';

function sanitizeSegment(name: string) {
  return name.replace(/[^\w.\-가-힣]/g, '_').slice(0, 180) || 'file';
}

export async function uploadPartnerFile(
  userId: string,
  partnerId: string,
  kind: string,
  file: File
): Promise<{ url: string; fileName: string }> {
  if (!storage) throw new Error('스토리지를 사용할 수 없습니다.');
  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    throw new Error('파일은 최대 20MB까지 업로드할 수 있습니다.');
  }
  const safe = sanitizeSegment(file.name);
  const path = `contractor-partners/${userId}/${partnerId}/${Date.now()}_${kind}_${safe}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, fileName: file.name };
}

async function deleteStorageFolderRecursive(folderRef: StorageReference): Promise<void> {
  const { items, prefixes } = await listAll(folderRef);
  await Promise.all(items.map((item) => deleteObject(item).catch((err) => console.warn('Storage file delete:', item.fullPath, err))));
  await Promise.all(prefixes.map((prefix) => deleteStorageFolderRecursive(prefix)));
}

/**
 * 협력업체에 업로드된 모든 Storage 객체를 삭제합니다. (경로: contractor-partners/{userId}/{partnerId}/)
 * 폴더가 없거나 비어 있어도 오류로 처리하지 않습니다.
 */
export async function deletePartnerStorageFiles(userId: string, partnerId: string): Promise<void> {
  if (!storage) return;
  const folderRef = ref(storage, `contractor-partners/${userId}/${partnerId}`);
  try {
    await deleteStorageFolderRecursive(folderRef);
  } catch (e) {
    console.warn('deletePartnerStorageFiles:', e);
  }
}
