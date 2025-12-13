// src/app/components/Navigation.jsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/firebase/AuthContext';
import { useRouter } from 'next/navigation';

function Navigation() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="navbar bg-base-100 shadow-md">
      <div className="flex-1">
        <Link href="/" className="btn btn-ghost text-xl font-bold">
          🏘️ LocalLens
        </Link>
      </div>
      <div className="flex-none">
        <ul className="menu menu-horizontal px-1 gap-2">
        {user ? (
          <>
              <li>
                <Link href="/map" className="btn btn-ghost">
                Map
              </Link>
            </li>
              <li>
                <Link href="/incidents" className="btn btn-ghost">
                Incidents
              </Link>
            </li>
              <li>
                <Link href="/feed" className="btn btn-ghost">
                Feed
              </Link>
            </li>
              <li>
                <Link href="/friends/search" className="btn btn-ghost">
                Friends
              </Link>
            </li>
              <li>
                <Link href="/friends/chat" className="btn btn-ghost">
                Messages
              </Link>
            </li>
              <li>
                <Link href="/events" className="btn btn-ghost">
                Events
              </Link>
            </li>
              <li>
                <Link href="/profile" className="btn btn-ghost">
                Profile
              </Link>
            </li>
              <li>
                <button onClick={handleLogout} className="btn btn-ghost">
                Logout
              </button>
            </li>
          </>
        ) : (
          <>
              <li>
                <Link href="/login" className="btn btn-ghost">
                Login
              </Link>
            </li>
              <li>
                <Link href="/signup" className="btn btn-primary">
                Sign Up
              </Link>
            </li>
          </>
        )}
      </ul>
      </div>
    </div>
  );
}

export default Navigation;
