import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/AuthContext';
import axios from 'axios';

/**
 * Hook that redirects admin users to /admin page
 * Returns { isAdmin, checkingAdmin } - admin status and loading state
 */
export function useRequireNonAdmin() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    // If auth is still loading, keep checking state as true
    if (authLoading) {
      setCheckingAdmin(true);
      return;
    }

    // If no user, set checking to false immediately
    if (!user) {
      setCheckingAdmin(false);
      setIsAdmin(false);
      return;
    }

    const checkAdminStatus = async () => {
      setCheckingAdmin(true);
      
      try {
        const token = await user.getIdToken();
        const { data } = await axios.get('/api/admin', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const adminStatus = data === true;
        setIsAdmin(adminStatus);
        setCheckingAdmin(false);

        // If user is admin, redirect to admin dashboard
        if (adminStatus) {
          router.replace('/admin');
        }
      } catch (error) {
        // If there's an error, assume non-admin
        console.error('Admin check failed:', error);
        setIsAdmin(false);
        setCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user, authLoading]); // Removed router from deps (it's stable)

  return { isAdmin, checkingAdmin };
}

