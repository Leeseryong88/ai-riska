import { MAX_UPLOAD_FILE_BYTES } from '@/app/lib/upload-limits';
import { deleteObject, getDownloadURL, listAll, ref, uploadBytes, type StorageReference } from 'firebase/storage';
import { storage } from '@/app/lib/firebase';

function sanitizeSegment(name: string) {
  return name.replace(/[^\w.\-가-힣]/g, '_').slice(0, 180) || 'file';
}

export async function uploadHazardousMachineryFile(
  userId: string,
  machineryId: string,
  kind: string,
  file: File
): Promise<{ url: string; path: string; fileName: string; fileType: string; uploadedAt: string }> {
  if (!storage) throw new Error('스토리지를 사용할 수 없습니다.');
  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    throw new Error('파일은 최대 20MB까지 업로드할 수 있습니다.');
  }
  const safe = sanitizeSegment(file.name);
  const path = `hazardous-machinery/${userId}/${machineryId}/${Date.now()}_${kind}_${safe}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return {
    url,
    path,
    fileName: file.name,
    fileType: file.type || '',
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteHazardousMachineryFile(path?: string | null) {
  if (!storage || !path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    console.warn('deleteHazardousMachineryFile:', e);
  }
}

async function deleteStorageFolderRecursive(folderRef: StorageReference): Promise<void> {
  const { items, prefixes } = await listAll(folderRef);
  await Promise.all(items.map((item) => deleteObject(item).catch((err) => console.warn('Storage file delete:', item.fullPath, err))));
  await Promise.all(prefixes.map((prefix) => deleteStorageFolderRecursive(prefix)));
}

export async function deleteHazardousMachineryStorageFiles(userId: string, machineryId: string): Promise<void> {
  if (!storage) return;
  const folderRef = ref(storage, `hazardous-machinery/${userId}/${machineryId}`);
  try {
    await deleteStorageFolderRecursive(folderRef);
  } catch (e) {
    console.warn('deleteHazardousMachineryStorageFiles:', e);
  }
}
