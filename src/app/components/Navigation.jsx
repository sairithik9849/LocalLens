// src/app/components/Navigation.jsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/firebase/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

function Navigation() {
  const { user, userProfile, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Helper function to check if a path is active
  const isActive = (path) => {
    if (path === '/') {
      return pathname === '/';
    }
    // Special handling for /friends to only match /friends/search, not /friends/chat
    if (path === '/friends') {
      return pathname === '/friends/search' || pathname.startsWith('/friends/search/');
    }
    // For other paths, check if pathname starts with the path
    return pathname.startsWith(path);
  };

  // Helper function to get link style based on active state
  const getLinkStyle = (path) => {
    const active = isActive(path);
    return {
      ...styles.link,
      backgroundColor: active ? '#e48a04' : 'transparent',
      color: active ? 'white' : '#2c3e50',
      fontWeight: active ? '600' : '500',
    };
  };

  // Get user initials for profile circle
  const getUserInitials = () => {
    if (userProfile?.firstName && userProfile?.lastName) {
      return `${userProfile.firstName[0]}${userProfile.lastName[0]}`.toUpperCase();
    }
    if (userProfile?.firstName) {
      return userProfile.firstName[0].toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <nav style={styles.nav}>
      {/* Logo/Title - LEFT */}
      <h1 style={styles.title}>🏘️ LocalLens</h1>

      {/* Navigation Links - RIGHT EDGE */}
      <ul style={styles.list}>
        <li style={styles.listItem}>
          <Link 
            href="/" 
            style={getLinkStyle('/')}
            onMouseEnter={(e) => {
              if (!isActive('/')) {
                e.target.style.backgroundColor = '#e48a04';
                e.target.style.color = 'white';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive('/')) {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#2c3e50';
              }
            }}
          >
            Home
          </Link>
        </li>

        {user ? (
          <>
            <li style={styles.listItem}>
              <Link 
                href="/map" 
                style={getLinkStyle('/map')}
                onMouseEnter={(e) => {
                  if (!isActive('/map')) {
                    e.target.style.backgroundColor = '#e48a04';
                    e.target.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive('/map')) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#2c3e50';
                  }
                }}
              >
                Map
              </Link>
            </li>
            <li style={styles.listItem}>
              <Link 
                href="/incidents" 
                style={getLinkStyle('/incidents')}
                onMouseEnter={(e) => {
                  if (!isActive('/incidents')) {
                    e.target.style.backgroundColor = '#e48a04';
                    e.target.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive('/incidents')) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#2c3e50';
                  }
                }}
              >
                Incidents
              </Link>
            </li>
            <li style={styles.listItem}>
              <Link 
                href="/feed" 
                style={getLinkStyle('/feed')}
                onMouseEnter={(e) => {
                  if (!isActive('/feed')) {
                    e.target.style.backgroundColor = '#e48a04';
                    e.target.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive('/feed')) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#2c3e50';
                  }
                }}
              >
                Feed
              </Link>
            </li>
            <li style={styles.listItem}>
              <Link 
                href="/friends/search" 
                style={getLinkStyle('/friends')}
                onMouseEnter={(e) => {
                  if (!isActive('/friends')) {
                    e.target.style.backgroundColor = '#e48a04';
                    e.target.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive('/friends')) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#2c3e50';
                  }
                }}
              >
                Friends
              </Link>
            </li>
            <li style={styles.listItem}>
              <Link 
                href="/friends/chat" 
                style={getLinkStyle('/friends/chat')}
                onMouseEnter={(e) => {
                  if (!isActive('/friends/chat')) {
                    e.target.style.backgroundColor = '#e48a04';
                    e.target.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive('/friends/chat')) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#2c3e50';
                  }
                }}
              >
                Messages
              </Link>
            </li>
            <li style={styles.listItem}>
              <Link 
                href="/events" 
                style={getLinkStyle('/events')}
                onMouseEnter={(e) => {
                  if (!isActive('/events')) {
                    e.target.style.backgroundColor = '#e48a04';
                    e.target.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive('/events')) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#2c3e50';
                  }
                }}
              >
                Events
              </Link>
            </li>
            {/* User Profile Circle */}
            <li style={styles.listItem}>
              <Link 
                href="/profile" 
                style={styles.profileLink}
                title="Profile"
                onMouseEnter={(e) => {
                  const circle = e.currentTarget.querySelector('div, img');
                  if (circle) {
                    circle.style.transform = 'scale(1.1)';
                    circle.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  const circle = e.currentTarget.querySelector('div, img');
                  if (circle) {
                    circle.style.transform = 'scale(1)';
                    circle.style.boxShadow = 'none';
                  }
                }}
              >
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt="Profile"
                    style={{
                      ...styles.profileCircle,
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div style={styles.profileCircle}>
                    <span style={styles.profileInitials}>{getUserInitials()}</span>
                  </div>
                )}
              </Link>
            </li>
            <li style={styles.listItem}>
              <button
                onClick={handleLogout}
                style={styles.link}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#e48a04';
                  e.target.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#2c3e50';
                }}
              >
                Logout
              </button>
            </li>
          </>
        ) : (
          <>
            <li style={styles.listItem}>
              <Link 
                href="/login" 
                style={getLinkStyle('/login')}
                onMouseEnter={(e) => {
                  if (!isActive('/login')) {
                    e.target.style.backgroundColor = '#e48a04';
                    e.target.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive('/login')) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#2c3e50';
                  }
                }}
              >
                Login
              </Link>
            </li>
            <li style={styles.listItem}>
              <Link 
                href="/signup" 
                style={getLinkStyle('/signup')}
                onMouseEnter={(e) => {
                  if (!isActive('/signup')) {
                    e.target.style.backgroundColor = '#e48a04';
                    e.target.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive('/signup')) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = '#2c3e50';
                  }
                }}
              >
                Sign Up
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}

const styles = {
  nav: {
    backgroundColor: '#ffffff',
    color: '#2c3e50',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  list: {
    listStyle: 'none',
    display: 'flex',
    gap: '2rem',
    padding: 0,
    margin: 0,
  },
  listItem: {
    display: 'inline',
  },
  link: {
    color: '#2c3e50',
    textDecoration: 'none',
    fontSize: '1.1rem',
    fontWeight: '500',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    transition: 'all 0.3s ease',
    display: 'inline-block',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  profileLink: {
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    borderRadius: '50%',
    transition: 'all 0.3s ease',
  },
  profileCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#e48a04',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #e48a04',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    overflow: 'hidden',
  },
  profileInitials: {
    color: 'white',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  }
};

export default Navigation;