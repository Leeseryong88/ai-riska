'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import WorkspaceShell from '@/components/navigation/WorkspaceShell';
import { useAuth } from '@/app/context/AuthContext';
import { isAdminUid } from '@/lib/admin-client';

type AdminUserRow = {
  uid: string;
  email: string;
  name: string;
  organization: string;
  subscriptionActive: boolean;
  subscriptionPlanAmount?: number;
  subscriptionUpdatedAt: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  const allowed = user && isAdminUid(user.uid);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!isAdminUid(user.uid)) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const loadUsers = useCallback(async () => {
    if (!user || !isAdminUid(user.uid)) return;
    setLoadingList(true);
    setLoadError('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || '목록을 불러오지 못했습니다.');
      }
      setUsers(data.users || []);
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    if (allowed) {
      loadUsers();
    }
  }, [allowed, loadUsers]);

  const toggleSubscription = async (row: AdminUserRow) => {
    if (!user) return;
    const next = !row.subscriptionActive;
    if (!window.confirm(`${row.email} 구독 상태를 ${next ? '활성' : '비활성'}으로 변경할까요?`)) return;
    setUpdatingUid(row.uid);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${row.uid}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionActive: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || '변경에 실패했습니다.');
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === row.uid
            ? {
                ...u,
                subscriptionActive: next,
                subscriptionUpdatedAt: new Date().toISOString(),
              }
            : u
        )
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setUpdatingUid(null);
    }
  };

  if (loading || !user || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <WorkspaceShell
      title="관리자"
      description="이용자 구독 상태를 변경할 수 있습니다."
      contentClassName="max-w-5xl"
    >
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
          <p className="text-sm text-slate-600">
            API는 <code className="rounded bg-slate-100 px-1">ADMIN_UIDS</code>에 등록된 UID만 허용합니다.
          </p>
        </div>

        {loadError && (
          <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 sm:px-6">
            {loadError}
          </div>
        )}

        <div className="overflow-x-auto">
          {loadingList ? (
            <div className="flex justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 sm:px-6">이메일</th>
                  <th className="px-4 py-3">이름</th>
                  <th className="px-4 py-3">소속</th>
                  <th className="px-4 py-3">구독</th>
                  <th className="px-4 py-3 sm:px-6">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((row) => (
                  <tr key={row.uid} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900 sm:px-6">{row.email}</td>
                    <td className="px-4 py-3 text-slate-700">{row.name}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">{row.organization}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          row.subscriptionActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.subscriptionActive ? '구독 중' : '미구독'}
                      </span>
                    </td>
                    <td className="px-4 py-3 sm:px-6">
                      <button
                        type="button"
                        disabled={updatingUid === row.uid}
                        onClick={() => toggleSubscription(row)}
                        className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
                      >
                        {updatingUid === row.uid
                          ? '처리 중…'
                          : row.subscriptionActive
                            ? '구독 끄기'
                            : '구독 켜기'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
