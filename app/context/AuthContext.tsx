'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth, db } from '@/app/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export interface UserProfile {
  uid?: string;
  email: string;
  name: string;
  organization: string;
  phone: string;
  subscriptionActive?: boolean;
  subscriptionPlanAmount?: number;
  subscriptionUpdatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      // 기존 프로필 구독 해제
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        // Firestore에서 프로필 정보 실시간 구독
        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (doc) => {
          if (doc.exists()) {
            setUserProfile(doc.data() as UserProfile);
            setLoading(false);
          } else {
            // 구글 인증은 되었으나 Firestore에 정보가 없는 경우 (가입 도중 이탈 등)
            setUserProfile(null);
            
            // 로그인 페이지가 아닌 곳에서 발견되면 강제 로그아웃
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              signOut(auth);
            }
            setLoading(false);
          }
        }, (error) => {
          console.error("Profile subscription error:", error);
          setUserProfile(null);
          setLoading(false);
        });
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
