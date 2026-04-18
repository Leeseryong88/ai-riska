import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
// 빌드 타임에 환경 변수가 없더라도 에러로 빌드가 중단되지 않도록 방어 코드 추가
const app = getApps().length > 0 
  ? getApp() 
  : (firebaseConfig.projectId ? initializeApp(firebaseConfig) : null);

const db = app ? getFirestore(app) : null as any;
const auth = app ? getAuth(app) : null as any;
const storage = app ? getStorage(app) : null as any;

// Analytics is only supported in browser environment
export const initAnalytics = async () => {
  if (app && typeof window !== "undefined" && await isSupported()) {
    return getAnalytics(app);
  }
  return null;
};

export { app, db, auth, storage };
