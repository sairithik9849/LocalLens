'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { auth } from '@/firebase/config';
import { getFirebaseEnv } from '@/firebase/fetchEnvFromGist';
import ReportCard from '@/app/components/reportCard';
import UserCard from '@/app/components/userCard';

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [redirecting, setRedirecting] = useState(false);

  const [reports, setReports] = useState([]);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  const router = useRouter();

  const checkAdmin = async (currentUser) => {
    try {
      const token = await currentUser.getIdToken();
      const { data } = await axios.get('/api/admin', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data === true;
    } catch (error) {
      // If there's an error checking admin status, treat as non-admin
      // This prevents showing errors to non-admin users
      console.error('Admin check failed:', error);
      return false;
    }
  };

  useEffect(() => {
    let unsubscribe = null;

    const initializeAuth = async () => {
      let currentAuth = auth;

      // If auth is not available (no .env.local), fetch from Gist and initialize
      if (!currentAuth) {
        // Check if Firebase is already initialized
        const apps = getApps();
        if (apps.length > 0) {
          currentAuth = getAuth(apps[0]);
        } else {
          // Fetch config from Gist
          const config = await getFirebaseEnv();

          // Validate config
          if (!config.apiKey || !config.authDomain || !config.projectId) {
            console.error('Firebase configuration is incomplete. Please check your Gist or .env.local file.');
            return;
          }

          // Initialize Firebase
          const app = initializeApp(config);
          currentAuth = getAuth(app);
        }
      }

      if (!currentAuth) {
        console.error('Failed to initialize Firebase auth. Please check your Gist or .env.local file.');
        return;
      }

      // Set up auth state listener
      unsubscribe = onAuthStateChanged(currentAuth, async (currentUser) => {
        if (!currentUser) {
          if (!redirecting) {
            setRedirecting(true);
            router.push('/login');
          }
          return;
        }

        try {
          const admin = await checkAdmin(currentUser);
          setIsAdmin(admin);
          setAdminChecked(true);

          if (!admin) {
            if (!redirecting) {
              setRedirecting(true);
              router.push('/login');
            }
            return;
          }

          setUser(currentUser);
        } catch (err) {
          console.error('Admin check failed:', err);
          if (!redirecting) {
            setRedirecting(true);
            router.push('/login');
          }
        }
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    };

    initializeAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [router, redirecting]);

  const fetchReports = async (page = reportsPage) => {
    if (!user || !isAdmin) return [];
    setReportsLoading(true);
    setReportsError(null);

    try {
      const token = await user.getIdToken();
      const { data } = await axios.get('/api/reports', {
        headers: { Authorization: `Bearer ${token}` },
        params: { page },
      });

      setReports(data);
      return data;
    } catch (err) {
      console.error('Error fetching reports:', err);
      setReportsError('Failed to load reports');
      setReports([]);
      return [];
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchUsers = async (page = usersPage) => {
    if (!user || !isAdmin) return [];
    setUsersLoading(true);
    setUsersError(null);

    try {
      const token = await user.getIdToken();
      const res = await axios.get('http://localhost:3000/api/adminusers', {
        headers: { Authorization: `Bearer ${token}` },
        params: { page },
      });

      setUsers(Array.isArray(res.data) ? res.data : []);
      return res.data;
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsersError('Failed to load users');
      setUsers([]);
      return [];
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    fetchUsers();
  }, [reportsPage, usersPage, user, isAdmin]);

  const handleUsersUpdated = async (page = usersPage) => {
    const data = await fetchUsers(page);
    if (Array.isArray(data) && data.length === 0 && page > 1) {
      const prev = page - 1;
      setUsersPage(prev);
      await fetchUsers(prev);
    }
  };

  const handleReportHandled = async () => {
    const data = await fetchReports(reportsPage);
    if ((Array.isArray(data) && data.length === 0) && reportsPage > 1) {
      const prev = reportsPage - 1;
      setReportsPage(prev);
      await fetchReports(prev);
    }
  };

  const handleLogout = async () => {
    try {
      // Get the current auth instance
      let currentAuth = auth;
      if (!currentAuth) {
        const apps = getApps();
        if (apps.length > 0) {
          currentAuth = getAuth(apps[0]);
        }
      }

      if (currentAuth) {
        // Get token for cache invalidation if needed
        let idToken = null;
        try {
          if (currentAuth.currentUser) {
            idToken = await currentAuth.currentUser.getIdToken();
          }
        } catch (tokenError) {
          console.warn('Could not get ID token for cache invalidation:', tokenError);
        }

        // Invalidate token cache if available
        if (idToken) {
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json',
              },
            });
          } catch (cacheError) {
            console.warn('Failed to invalidate token cache:', cacheError);
          }
        }

        // Sign out from Firebase
        await signOut(currentAuth);
        
        // Redirect to login page
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect even if logout fails
      router.push('/login');
    }
  };

  if (!adminChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mb-4">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">Verifying admin access…</p>
        </div>
      </div>
    );
  }

  const totalReports = reports?.length ?? 0;
  const totalUsers = users?.length ?? 0;
  const bannedUsers = users?.filter(u => u?.moderation?.banned)?.length ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <header className="mb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">Community Admin</h1>
              <p className="text-sm text-slate-500 mt-1">
                Moderate reports and manage users — quick actions live below.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white border border-slate-200 shadow-sm">
                Admin
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                aria-label="Logout"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="grid sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
            <div className="text-xs text-slate-500">Open reports</div>
            <div className="text-2xl font-semibold text-slate-800">{totalReports}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
            <div className="text-xs text-slate-500">Users loaded (page)</div>
            <div className="text-2xl font-semibold text-slate-800">{totalUsers}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
            <div className="text-xs text-slate-500">Banned users</div>
            <div className="text-2xl font-semibold text-slate-800">{bannedUsers}</div>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="col-span-1">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Reports</h2>

            <div className="space-y-4">
              {reportsLoading ? (
                <div className="py-8 flex items-center justify-center">
                  <svg className="animate-spin h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                </div>
              ) : reportsError ? (
                <div className="rounded-lg bg-rose-50 border border-rose-100 p-4 text-rose-700">{reportsError}</div>
              ) : reports.length === 0 ? (
                <div className="rounded-lg bg-white p-6 border border-slate-200 shadow-sm text-center">
                  <p className="text-slate-700">No reports found for this page.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map(item => (
                    <ReportCard key={item._id ?? item.id} report={item} onHandled={handleReportHandled} />
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
                <div className="text-sm text-slate-600">Page <span className="font-medium text-slate-800">{reportsPage}</span></div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReportsPage(p => Math.max(1, p - 1))}
                    disabled={reportsPage <= 1}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border ${reportsPage <= 1 ? 'bg-slate-100 text-slate-400 border-slate-100' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setReportsPage(p => p + 1)}
                    disabled={reports.length < 10}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border ${reports.length < 10 ? 'bg-slate-100 text-slate-400 border-slate-100' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Users</h2>

            <div className="space-y-4">
              {usersLoading ? (
                <div className="py-8 flex items-center justify-center">
                  <svg className="animate-spin h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                </div>
              ) : usersError ? (
                <div className="rounded-lg bg-rose-50 border border-rose-100 p-4 text-rose-700">{usersError}</div>
              ) : users.length === 0 ? (
                <div className="rounded-lg bg-white p-6 border border-slate-200 shadow-sm text-center">
                  <p className="text-slate-700">No users found for this page.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map(u => (
                    <UserCard key={u._id ?? u.id} userObj={u} onHandled={() => handleUsersUpdated(usersPage)} />
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
                <div className="text-sm text-slate-600">Page <span className="font-medium text-slate-800">{usersPage}</span></div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                    disabled={usersPage <= 1}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border ${usersPage <= 1 ? 'bg-slate-100 text-slate-400 border-slate-100' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setUsersPage(p => p + 1)}
                    disabled={users.length < 10}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border ${users.length < 10 ? 'bg-slate-100 text-slate-400 border-slate-100' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
