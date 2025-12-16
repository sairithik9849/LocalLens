import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';

/**
 * Hook that checks if user is banned and redirects to /banned page
 * Continuously monitors and prevents navigation away from /banned
 * Returns { isBanned, checkingBanned } - ban status and loading state
 */
export function useCheckBanned() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isBanned, setIsBanned] = useState(false);
  const [checkingBanned, setCheckingBanned] = useState(true);
  const banCheckIntervalRef = useRef(null);
  const checkingRef = useRef(false); // Prevent concurrent checks

  // Main effect: Check ban status when user/auth changes
  useEffect(() => {
    // Clean up interval on unmount or dependency change
    if (banCheckIntervalRef.current) {
      clearInterval(banCheckIntervalRef.current);
      banCheckIntervalRef.current = null;
    }

    // If auth is still loading, keep checking state as true
    if (authLoading) {
      setCheckingBanned(true);
      return;
    }

    // If no user, set checking to false immediately
    if (!user) {
      setCheckingBanned(false);
      setIsBanned(false);
      return;
    }

    const checkBanStatus = async () => {
      // Prevent concurrent checks
      if (checkingRef.current) {
        return;
      }

      checkingRef.current = true;
      setCheckingBanned(true);

      // Get current pathname from window to avoid dependency issues
      const currentPathname = typeof window !== 'undefined' ? window.location.pathname : pathname;
      const isOnBannedPage = currentPathname === '/banned';

      try {
        // Get Firebase ID token for authentication
        const { auth } = await import('@/firebase/config');
        const { getAuth } = await import('firebase/auth');
        const currentAuth = auth || getAuth();
        const idToken = currentAuth?.currentUser ? await currentAuth.currentUser.getIdToken() : null;

        const headers = {};
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }

        const response = await fetch(`/api/users/profile?uid=${encodeURIComponent(user.uid)}`, {
          headers: headers
        });

        if (response.status === 403) {
          // User is banned (API returns 403 for banned users)
          setIsBanned(true);
          setCheckingBanned(false);
          // Only redirect if not already on banned page
          if (!isOnBannedPage) {
            router.replace('/banned');
          }
          checkingRef.current = false;
          return;
        }

        if (response.ok) {
          const data = await response.json();
          if (data.user?.moderation?.banned === true) {
            setIsBanned(true);
            setCheckingBanned(false);
            // Only redirect if not already on banned page
            if (!isOnBannedPage) {
              router.replace('/banned');
            }
            checkingRef.current = false;
            return;
          }
        }

        setIsBanned(false);
        setCheckingBanned(false);
      } catch (error) {
        // If there's an error checking ban status, assume not banned
        console.error('Ban check failed:', error);
        setIsBanned(false);
        setCheckingBanned(false);
      } finally {
        checkingRef.current = false;
      }
    };

    // Initial check
    checkBanStatus();

    return () => {
      checkingRef.current = false;
    };
  }, [user, authLoading]); // Only depend on user and authLoading - pathname handled separately

  // Set up interval for banned users to prevent navigation away
  useEffect(() => {
    if (banCheckIntervalRef.current) {
      clearInterval(banCheckIntervalRef.current);
      banCheckIntervalRef.current = null;
    }

    if (user && !authLoading && isBanned) {
      banCheckIntervalRef.current = setInterval(() => {
        // Check current pathname on each interval
        const currentPath = window.location.pathname;
        if (currentPath !== '/banned') {
          router.replace('/banned');
        }
      }, 5000);
    }

    return () => {
      if (banCheckIntervalRef.current) {
        clearInterval(banCheckIntervalRef.current);
        banCheckIntervalRef.current = null;
      }
    };
  }, [isBanned, user, authLoading]); // Set up interval when ban status changes

  // Check on pathname change only if user is banned (to redirect them back)
  useEffect(() => {
    if (!authLoading && user && isBanned && pathname !== '/banned') {
      router.replace('/banned');
    }
  }, [pathname, user, authLoading, isBanned]);

  return { isBanned, checkingBanned };
}

