'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase/config';
import ReportCard from '@/app/components/reportCard';

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  const router = useRouter();

  const checkAdmin = async (currentUser) => {
    const token = await currentUser.getIdToken();
    const { data } = await axios.get('/api/admin', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data === true;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }

      try {
        const admin = await checkAdmin(currentUser);
        setIsAdmin(admin);
        setAdminChecked(true);

        if (!admin) {
          router.push('/login');
          return;
        }

        setUser(currentUser);
      } catch (err) {
        console.error('Admin check failed:', err);
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchReports = async (page = pageNum) => {
    if (!user || !isAdmin) return [];
    setLoading(true);
    setError(null);

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
      setError('Failed to load reports');
      setReports([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [pageNum, user, isAdmin]);

  const handleReportHandled = async () => {
    const data = await fetchReports(pageNum);

    if ((Array.isArray(data) && data.length === 0) && pageNum > 1) {
      const prev = pageNum - 1;
      setPageNum(prev);
      await fetchReports(prev);
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

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">Community Reports</h1>
              <p className="text-sm text-slate-500 mt-1">
                Moderate reported posts that violate site guidelines.
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white border border-slate-200 shadow-sm">
                Admin
              </span>
            </div>
          </div>
        </header>

        <main>
          <div className="space-y-4">
            {loading ? (
              <div className="py-16 flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
              </div>
            ) : error ? (
              <div className="rounded-lg bg-rose-50 border border-rose-100 p-4 text-rose-700">
                {error}
              </div>
            ) : reports.length === 0 ? (
              <div className="rounded-lg bg-white p-6 border border-slate-200 shadow-sm text-center">
                <p className="text-slate-700">No reports found for this page.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {reports.map((item) => (
                  <ReportCard
                    key={item._id ?? item.id}
                    report={item}
                    onHandled={handleReportHandled}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between bg-white p-4 border border-slate-200 rounded-lg shadow-sm">
            <div className="text-sm text-slate-600">
              Page <span className="font-medium text-slate-800"> {pageNum} </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPageNum(p => Math.max(1, p - 1))}
                disabled={pageNum <= 1}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                  pageNum <= 1 ? 'bg-slate-100 text-slate-400 border-slate-100' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Prev
              </button>

              <span className="text-sm text-slate-500">|</span>

              <button
                onClick={() => setPageNum(p => p + 1)}
                disabled={reports.length < 10}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                  reports.length < 10 ? 'bg-slate-100 text-slate-400 border-slate-100' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
