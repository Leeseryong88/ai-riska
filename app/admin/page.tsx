'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
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

type PaginationInfo = {
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
  emailFilter: string;
};

const PAGE_SIZE = 20;

/** pageFetchCursor[i] = 페이지 i 로드 시 API에 줄 cursor (첫 페이지 i=0 은 없음=null) */
function initCursorChain(): (string | null)[] {
  return [null];
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailQuery, setEmailQuery] = useState('');
  const [pageIdx, setPageIdx] = useState(0);
  /** API 커서 체인 — 이 값만 변경해도 목록을 다시 불러오게 하지 않기 위해 ref로 보관 */
  const pageFetchCursorRef = useRef<(string | null)[]>(initCursorChain());
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

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

  const applyEmailSearch = useCallback(() => {
    const next = emailDraft.trim();
    setEmailQuery(next);
    setPageIdx(0);
    pageFetchCursorRef.current = initCursorChain();
  }, [emailDraft]);

  const loadUsers = useCallback(async () => {
    if (!user || !isAdminUid(user.uid)) return;
    const chain = pageFetchCursorRef.current;
    const cursor =
      pageIdx === 0
        ? ''
        : (() => {
            const c = chain[pageIdx];
            return typeof c === 'string' && c.length ? c : '';
          })();

    if (pageIdx > 0 && !cursor) {
      setLoadError('페이지 정보가 없습니다. 처음으로 돌아가 주세요.');
      setLoadingList(false);
      return;
    }

    setLoadingList(true);
    setLoadError('');
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({
        pageSize: String(PAGE_SIZE),
        ...(emailQuery ? { email: emailQuery } : {}),
        ...(cursor ? { cursor } : {}),
      });
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || '목록을 불러오지 못했습니다.');
      }
      setUsers(data.users || []);
      const p = data.pagination as PaginationInfo | undefined;
      setPagination(p ?? null);

      if (p?.hasMore && typeof p?.nextCursor === 'string') {
        const n = [...pageFetchCursorRef.current];
        while (n.length <= pageIdx + 1) n.push(null);
        n[pageIdx + 1] = p.nextCursor;
        pageFetchCursorRef.current = n;
      }
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoadingList(false);
    }
  }, [user, pageIdx, emailQuery]);

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

  const canGoPrev = pageIdx > 0;
  const canGoNext = pagination?.hasMore ?? false;

  const goPrev = () => {
    if (!canGoPrev) return;
    setPageIdx((p) => Math.max(0, p - 1));
  };

  const goNext = () => {
    if (!canGoNext) return;
    setPageIdx((p) => p + 1);
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

        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:px-6">
          <div className="min-w-[200px] max-w-md flex-1">
            <label htmlFor="admin-email-filter" className="mb-1 block text-xs font-bold text-slate-600">
              이메일로 찾기 (앞부분 일치)
            </label>
            <div className="flex gap-2">
              <input
                id="admin-email-filter"
                type="search"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyEmailSearch();
                  }
                }}
                placeholder="예: gmail.com 또는 이름@ 도메인"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-blue-300 transition focus:border-blue-400 focus:ring-2"
              />
              <button
                type="button"
                onClick={applyEmailSearch}
                className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-900"
              >
                검색
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{emailQuery ? `필터: “${emailQuery}”` : '전체 목록 · 이메일 오름차순'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
          <p className="text-sm font-bold text-slate-700">
            페이지 <span className="text-blue-700">{pageIdx + 1}</span>
            <span className="font-medium text-slate-500">
              {' '}
              (페이지당 {pagination?.pageSize ?? PAGE_SIZE}명)
            </span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPageIdx(0);
                pageFetchCursorRef.current = initCursorChain();
                setEmailDraft('');
                setEmailQuery('');
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              처음으로
            </button>
            <button
              type="button"
              disabled={!canGoPrev || loadingList}
              onClick={goPrev}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전
            </button>
            <button
              type="button"
              disabled={!canGoNext || loadingList}
              onClick={goNext}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
            </button>
          </div>
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
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm font-medium text-slate-400">
                      조건에 맞는 사용자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  users.map((row) => (
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
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
