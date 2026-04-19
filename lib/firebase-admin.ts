import * as admin from 'firebase-admin';

/**
 * 서버 전용. `.env.local`에 `FIREBASE_SERVICE_ACCOUNT_JSON` (서비스 계정 JSON 전체 한 줄) 필요.
 */
export function getFirebaseAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON 환경 변수가 설정되지 않았습니다. Firebase Console에서 서비스 계정 키 JSON을 한 줄로 넣어 주세요.'
    );
  }
  const cred = JSON.parse(json) as admin.ServiceAccount;
  return admin.initializeApp({
    credential: admin.credential.cert(cred),
  });
}

export function getAdminAuth(): admin.auth.Auth {
  return getFirebaseAdminApp().auth();
}

export function getAdminFirestore(): admin.firestore.Firestore {
  return getFirebaseAdminApp().firestore();
}
