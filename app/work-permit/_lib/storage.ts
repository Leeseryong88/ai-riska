import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { app } from '@/app/lib/firebase';
import { getStorage } from 'firebase/storage';

const storage = getStorage(app);

/**
 * Uploads a base64 encoded image to Firebase Storage and returns its download URL.
 * @param path The full path in storage where the image will be stored (e.g., 'logs/adminId/filename.jpg')
 * @param base64String The base64 data URL (e.g., 'data:image/jpeg;base64,...')
 * @returns A promise that resolves to the download URL of the uploaded image.
 */
export async function uploadBase64(path: string, base64String: string): Promise<string> {
  // If it's already a URL (not base64), return it as is
  if (!base64String.startsWith('data:')) {
    return base64String;
  }

  try {
    const storageRef = ref(storage, path);
    
    // uploadString supports 'data_url' format directly
    const uploadResult = await uploadString(storageRef, base64String, 'data_url');
    const downloadURL = await getDownloadURL(uploadResult.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading base64 to storage:', error);
    throw error;
  }
}
