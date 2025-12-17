// src/app/components/Navigation.jsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/firebase/AuthContext';
import { useRouter } from 'next/navigation';

function Navigation() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
      setMobileMenuOpen(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="w-full px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Title */}
          <Link href="/" className="text-2xl font-bold text-gray-800 transition" style={{ color: '#2c3e50' }} onMouseEnter={(e) => e.target.style.color = '#e48a04'} onMouseLeave={(e) => e.target.style.color = '#2c3e50'}>
            🏘️ LocalLens
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {user ? (
              <>
                <Link 
                  href="/map" 
                  className="px-4 py-2 rounded text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  Map
                </Link>
                <Link 
                  href="/incidents" 
                  className="px-4 py-2 rounded text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  Incidents
                </Link>
                <Link 
                  href="/feed" 
                  className="px-4 py-2 rounded text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  Feed
                </Link>
                <Link 
                  href="/friends/search" 
                  className="px-4 py-2 rounded text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  Friends
                </Link>
                <Link 
                  href="/friends/chat" 
                  className="px-4 py-2 rounded text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  Messages
                </Link>
                <Link 
                  href="/events" 
                  className="px-4 py-2 rounded text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  Events
                </Link>
                <Link 
                  href="/yardsales" 
                  className="px-4 py-2 rounded text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  Yard Sales
                </Link>
                <Link 
                  href="/profile" 
                  className="px-4 py-2 rounded text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="px-4 py-2 rounded text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  Login
                </Link>
                <Link 
                  href="/signup" 
                  className="px-4 py-2 rounded text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition"
          >
            {mobileMenuOpen ? (
              // X Icon
              <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Hamburger Icon
              <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-4 py-3 space-y-1">
            {user ? (
              <>
                <Link 
                  href="/map" 
                  onClick={closeMobileMenu}
                  className="block px-4 py-3 rounded-lg text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  🗺️ Map
                </Link>
                <Link 
                  href="/incidents" 
                  onClick={closeMobileMenu}
                  className="block px-4 py-3 rounded-lg text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  🚨 Incidents
                </Link>
                <Link 
                  href="/feed" 
                  onClick={closeMobileMenu}
                  className="block px-4 py-3 rounded-lg text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  📰 Feed
                </Link>
                <Link 
                  href="/friends/search" 
                  onClick={closeMobileMenu}
                  className="block px-4 py-3 rounded-lg text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  👥 Friends
                </Link>
                <Link 
                  href="/friends/chat" 
                  onClick={closeMobileMenu}
                  className="block px-4 py-3 rounded-lg text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  💬 Messages
                </Link>
                <Link 
                  href="/events" 
                  onClick={closeMobileMenu}
                  className="block px-4 py-3 rounded-lg text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  📅 Events
                </Link>
                <Link 
                  href="/yardsales" 
                  onClick={closeMobileMenu}
                  className="block px-4 py-3 rounded-lg text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  🏪 Yard Sales
                </Link>
                <Link 
                  href="/profile" 
                  onClick={closeMobileMenu}
                  className="block px-4 py-3 rounded-lg text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  👤 Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 rounded-lg text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  🚪 Logout
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/login" 
                  onClick={closeMobileMenu}
                  className="block px-4 py-3 rounded-lg text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  🔑 Login
                </Link>
                <Link 
                  href="/signup" 
                  onClick={closeMobileMenu}
                  className="block px-4 py-3 rounded-lg text-gray-700 transition font-medium"
                  onMouseEnter={(e) => { e.target.style.backgroundColor = '#e48a04'; e.target.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#2c3e50'; }}
                >
                  ✨ Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navigation;