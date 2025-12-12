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
    <nav style={styles.nav}>
      {/* Logo/Title - LEFT */}
      <h1 style={styles.title}>🏘️ LocalLens</h1>

      {/* Navigation Links - RIGHT EDGE */}
      <ul style={styles.list}>
        <li style={styles.listItem}>
          <Link 
            href="/" 
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
            Home
          </Link>
        </li>

        {user ? (
          <>
            <li style={styles.listItem}>
              <Link 
                href="/map" 
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
                Map
              </Link>
            </li>
            <li style={styles.listItem}>
              <Link 
                href="/feed" 
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
                Feed
              </Link>
            </li>
            <li style={styles.listItem}>
              <Link 
                href="/friends/search" 
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
                Friends
              </Link>
            </li>
            <li style={styles.listItem}>
              <Link 
                href="/friends/chat" 
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
                Messages
              </Link>
            </li>
            <li style={styles.listItem}>
              <Link 
                href="/events" 
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
                Events
              </Link>
            </li>
            <li style={styles.listItem}>
              <Link 
                href="/profile" 
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
                Profile
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
                Login
              </Link>
            </li>
            <li style={styles.listItem}>
              <Link 
                href="/signup" 
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
    justifyContent: 'space-between',  // Push title left, links right
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
  }
};

export default Navigation;