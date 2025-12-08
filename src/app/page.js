"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/firebase/AuthContext";

export default function Home() {
  const [scrollY, setScrollY] = useState(0);
  const [revealedSections, setRevealedSections] = useState(new Set());
  const [profileData, setProfileData] = useState(null);
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch user profile when user is logged in
  useEffect(() => {
    if (user && !loading) {
      const fetchProfile = async () => {
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
          if (response.ok) {
            try {
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                setProfileData(data.user);
              }
            } catch (parseError) {
              console.error('Error parsing profile response:', parseError);
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      };
      fetchProfile();
    } else {
      setProfileData(null);
    }
  }, [user, loading]);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -100px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const revealId = entry.target.getAttribute("data-reveal");
          if (revealId) {
            setRevealedSections((prev) => new Set([...prev, revealId]));
          }
        }
      });
    }, observerOptions);

    const sections = document.querySelectorAll("[data-reveal]");
    sections.forEach((section) => observer.observe(section));

    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  return (
    <div className="min-h-screen relative" style={{ background: 'transparent' }}>
      {/* Parallax Background */}
      <div 
        className="fixed inset-0 w-full h-full"
        style={{
          backgroundImage: `url('https://plus.unsplash.com/premium_photo-1714051660720-888e8454a021?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8bmV3JTIweW9ya3xlbnwwfHwwfHx8MA%3D%3D')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          transform: `translate3d(0, ${scrollY * 0.3}px, 0)`,
          zIndex: -2,
        }}
      />
      <div 
        className="fixed inset-0 w-full h-full"
        style={{
          background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.3) 30%, rgba(0, 0, 0, 0.25) 60%, rgba(0, 0, 0, 0.2) 100%)',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-blue-500/8 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>
      {/* Navigation */}
      <nav className="navbar backdrop-blur-lg shadow-xl sticky top-0 z-50 border-b" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', borderColor: 'rgba(34, 211, 238, 0.3)' }}>
        <div className="container mx-auto px-4 lg:px-8 w-full flex items-center justify-between">
          <div className="flex-1 flex items-center">
            <Link href="/" className="btn btn-ghost text-xl font-bold hover:scale-105 transition-all duration-300 group">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-7 w-7 mr-2 text-cyan-400 group-hover:text-cyan-300 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </div>
              <span className="bg-linear-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                LocalLens
              </span>
            </Link>
          </div>
          <div className="flex-none flex items-center gap-3 ml-auto">
            {loading ? (
              <span className="loading loading-spinner loading-sm text-cyan-400"></span>
            ) : user ? (
              <>
                <div className="flex items-center gap-3">
                  {profileData?.photoURL ? (
                    <img
                      src={profileData.photoURL}
                      alt="Profile"
                      className="w-10 h-10 rounded-full border-2 border-cyan-400/50 object-cover"
                    />
                  ) : (
                    <div className="bg-linear-to-br from-cyan-500 via-blue-500 to-purple-600 text-white rounded-full w-10 h-10 border-2 border-cyan-400/50 flex items-center justify-center">
                      <span className="text-sm font-bold">
                        {profileData?.firstName?.[0]?.toUpperCase() || profileData?.lastName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                      </span>
                    </div>
                  )}
                  <Link 
                    href="/dashboard" 
                    className="btn btn-sm md:btn-md transition-all duration-300 font-medium border-2 border-cyan-400 hover:border-cyan-300 hover:bg-cyan-400/20 hover:scale-105 hover:shadow-lg hover:shadow-cyan-400/20 bg-transparent text-white"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="btn btn-sm md:btn-md transition-all duration-300 font-medium border-2 border-cyan-400 hover:border-cyan-300 hover:bg-cyan-400/20 hover:scale-105 hover:shadow-lg hover:shadow-cyan-400/20 bg-transparent text-white"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="btn btn-sm md:btn-md transition-all duration-300 font-medium border-2 border-cyan-400 hover:border-cyan-300 hover:bg-cyan-400/20 hover:scale-105 hover:shadow-lg hover:shadow-cyan-400/20 bg-transparent text-white"
                >
                  Sign In
                </Link>
                <Link 
                  href="/signup" 
                  className="btn btn-sm md:btn-md shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold relative overflow-hidden group text-white border-none"
                  style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)' }}
                >
                  <span className="relative z-10">Get Started</span>
                  <span className="absolute inset-0 bg-linear-to-r from-cyan-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero min-h-[90vh] relative overflow-hidden z-10 bg-transparent">
        {/* Additional Background Pattern */}
        <div className="absolute inset-0 opacity-5 z-0">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        <div className="hero-content text-center py-20 relative z-10 animate-fade-in bg-transparent">
          <div className="max-w-4xl">
            <div className="animate-float mb-8 flex justify-center">
              <div className="w-24 h-24 rounded-full bg-linear-to-br from-cyan-500 via-blue-500 to-purple-600 flex items-center justify-center shadow-2xl" style={{ boxShadow: '0 0 40px rgba(34, 211, 238, 0.5), 0 0 60px rgba(147, 51, 234, 0.3)' }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-linear-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent animate-fade-in-up leading-tight pb-2 drop-shadow-lg" style={{ textShadow: '0 2px 25px rgba(0, 0, 0, 0.6), 0 0 40px rgba(34, 211, 238, 0.4), 0 0 60px rgba(147, 51, 234, 0.3)' }}>
              Discover Your Neighborhood
            </h1>
            <div className="relative inline-block mb-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <div className="absolute inset-0 backdrop-blur-sm rounded-xl -z-10 px-6 py-3" style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}></div>
              <p className="text-xl text-white max-w-2xl mx-auto drop-shadow-md relative z-10" style={{ textShadow: '0 1px 5px rgba(0, 0, 0, 0.5)' }}>
                LocalLens transforms raw neighborhood data into clear, interactive insights.
                Make informed decisions about where to live, work, and invest.
              </p>
            </div>
            <div className="flex gap-4 justify-center animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
              <Link href={user ? "/dashboard" : "/login"} className="btn btn-lg hover:scale-105 transition-transform shadow-lg backdrop-blur-sm text-white font-semibold" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)', border: 'none' }}>
                {user ? "Go to Dashboard" : "Explore Now"}
              </Link>
              <Link 
                href="#features" 
                className="btn btn-outline btn-lg hover:scale-105 transition-transform border-2 backdrop-blur-sm text-white border-cyan-400 hover:bg-cyan-400/30 hover:border-cyan-300 font-semibold"
                aria-label="Learn more about LocalLens features"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section 
        id="features" 
        data-reveal="features"
        className={`py-20 relative z-10 ${revealedSections.has("features") ? "reveal-bottom revealed" : "reveal-bottom"}`}
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(10px)' }}
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">Powerful Features</h2>
            <p className="text-lg text-white max-w-2xl mx-auto">
              Everything you need to understand your neighborhood at a glance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card shadow-xl hover-lift animate-fade-in-up border-2 rounded-lg" style={{ animationDelay: "0.1s", backgroundColor: 'rgba(51, 65, 85, 0.4)', borderColor: 'rgba(34, 211, 238, 0.5)' }}>
              <div className="card-body">
                <div className="w-16 h-16 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <h3 className="card-title text-white">Interactive Maps & Heatmaps</h3>
                <p className="text-white">
                  Explore neighborhoods with dynamic heatmaps showing rent trends, crime density,
                  and business activity. Visualize data in an intuitive, interactive way.
                </p>
                <div className="card-actions mt-4">
                  <div className="badge badge-outline border-cyan-400 text-cyan-400">Interactive</div>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="card shadow-xl hover-lift animate-fade-in-up border-2 rounded-lg" style={{ animationDelay: "0.2s", backgroundColor: 'rgba(51, 65, 85, 0.4)', borderColor: 'rgba(34, 211, 238, 0.5)' }}>
              <div className="card-body">
                <div className="w-16 h-16 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="card-title text-white">Historical Data Analysis</h3>
                <p className="text-white">
                  Track neighborhood trends over time with interactive charts. See how rent prices,
                  crime rates, and business activity have changed.
                </p>
                <div className="card-actions mt-4">
                  <div className="badge badge-outline border-blue-400 text-blue-400">Analytics</div>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="card shadow-xl hover-lift animate-fade-in-up border-2 rounded-lg" style={{ animationDelay: "0.3s", backgroundColor: 'rgba(51, 65, 85, 0.4)', borderColor: 'rgba(34, 211, 238, 0.5)' }}>
              <div className="card-body">
                <div className="w-16 h-16 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <h3 className="card-title text-white">Hyper-Local Content</h3>
                <p className="text-white">
                  Connect with your neighborhood through local events, yard sales, and community
                  crime reports. All content is neighborhood-specific.
                </p>
                <div className="card-actions mt-4">
                  <div className="badge badge-outline border-purple-400 text-purple-400">Local</div>
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="card shadow-xl hover-lift animate-fade-in-up border-2 rounded-lg" style={{ animationDelay: "0.4s", backgroundColor: 'rgba(51, 65, 85, 0.4)', borderColor: 'rgba(34, 211, 238, 0.5)' }}>
              <div className="card-body">
                <div className="w-16 h-16 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="card-title text-white">Secure & Moderated</h3>
                <p className="text-white">
                  Built with Firebase Authentication and role-based access control. Content
                  moderation ensures a safe community experience.
                </p>
                <div className="card-actions mt-4">
                  <div className="badge badge-outline border-cyan-400 text-cyan-400">Secure</div>
                </div>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="card shadow-xl hover-lift animate-fade-in-up border-2 rounded-lg" style={{ animationDelay: "0.5s", backgroundColor: 'rgba(51, 65, 85, 0.4)', borderColor: 'rgba(34, 211, 238, 0.5)' }}>
              <div className="card-body">
                <div className="w-16 h-16 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="card-title text-white">Real-Time Communication</h3>
                <p className="text-white">
                  Join neighborhood chatrooms and receive instant notifications for new events,
                  crimes, or messages. Stay connected with your community.
                </p>
                <div className="card-actions mt-4">
                  <div className="badge badge-outline border-blue-400 text-blue-400">Real-Time</div>
                </div>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="card shadow-xl hover-lift animate-fade-in-up border-2 rounded-lg" style={{ animationDelay: "0.6s", backgroundColor: 'rgba(51, 65, 85, 0.4)', borderColor: 'rgba(34, 211, 238, 0.5)' }}>
              <div className="card-body">
                <div className="w-16 h-16 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="card-title text-white">Data Aggregation</h3>
                <p className="text-white">
                  Comprehensive data from multiple sources including public crime data, real estate
                  prices, and Google Places. All standardized and stored for easy access.
                </p>
                <div className="card-actions mt-4">
                  <div className="badge badge-outline border-purple-400 text-purple-400">Comprehensive</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section 
        id="how-it-works"
        data-reveal="how-it-works"
        className={`py-20 relative z-10 ${revealedSections.has("how-it-works") ? "reveal-bottom revealed" : "reveal-bottom"}`}
        style={{ backgroundColor: 'rgba(30, 41, 59, 0.65)', backdropFilter: 'blur(10px)' }}
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">How It Works</h2>
            <p className="text-lg text-white max-w-2xl mx-auto">
              Get started in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center animate-slide-in-left">
              <div className="avatar placeholder mb-4">
                <div className="bg-linear-to-br from-cyan-500 to-blue-500 text-white rounded-full w-20 h-20 shadow-lg hover:scale-110 transition-transform flex items-center justify-center border-2" style={{ borderColor: 'rgba(34, 211, 238, 0.6)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-white">Sign Up</h3>
              <p className="text-white">
                Create your account and register your neighborhood. Choose from email/password
                or social login options.
              </p>
            </div>

            <div className="text-center animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <div className="avatar placeholder mb-4">
                <div className="bg-linear-to-br from-blue-500 to-purple-500 text-white rounded-full w-20 h-20 shadow-lg hover:scale-110 transition-transform flex items-center justify-center border-2" style={{ borderColor: 'rgba(59, 130, 246, 0.6)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-white">Explore</h3>
              <p className="text-white">
                Browse interactive maps, view heatmaps, and analyze historical trends for your
                neighborhood and surrounding areas.
              </p>
            </div>

            <div className="text-center animate-slide-in-right">
              <div className="avatar placeholder mb-4">
                <div className="bg-linear-to-br from-purple-500 to-pink-500 text-white rounded-full w-20 h-20 shadow-lg hover:scale-110 transition-transform flex items-center justify-center border-2" style={{ borderColor: 'rgba(147, 51, 234, 0.6)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-white">Engage</h3>
              <p className="text-white">
                Join neighborhood discussions, post events, share yard sales, and report local
                incidents. Connect with your community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section 
        id="use-cases"
        data-reveal="use-cases"
        className={`py-20 relative z-10 ${revealedSections.has("use-cases") ? "reveal-bottom revealed" : "reveal-bottom"}`}
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(10px)' }}
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">Perfect For</h2>
            <p className="text-lg text-white max-w-2xl mx-auto">
              Whether you're looking for a home, starting a business, or investing
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="card shadow-lg hover-lift animate-fade-in-up border-2 rounded-lg" style={{ animationDelay: "0.1s", backgroundColor: 'rgba(51, 65, 85, 0.4)', borderColor: 'rgba(34, 211, 238, 0.5)' }}>
              <div className="card-body items-center text-center">
                <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="card-title text-white">Families</h3>
                <p className="text-white">
                  Find safe communities with great schools, low crime rates, and family-friendly
                  amenities. Make informed decisions about where to raise your family.
                </p>
              </div>
            </div>

            <div className="card shadow-lg hover-lift animate-fade-in-up border-2 rounded-lg" style={{ animationDelay: "0.2s", backgroundColor: 'rgba(51, 65, 85, 0.4)', borderColor: 'rgba(34, 211, 238, 0.5)' }}>
              <div className="card-body items-center text-center">
                <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <h3 className="card-title text-white">Renters</h3>
                <p className="text-white">
                  Compare housing costs across neighborhoods. Track rent fluctuations and find
                  the best value for your budget.
                </p>
              </div>
            </div>

            <div className="card shadow-lg hover-lift animate-fade-in-up border-2 rounded-lg" style={{ animationDelay: "0.3s", backgroundColor: 'rgba(51, 65, 85, 0.4)', borderColor: 'rgba(34, 211, 238, 0.5)' }}>
              <div className="card-body items-center text-center">
                <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="card-title text-white">Entrepreneurs</h3>
                <p className="text-white">
                  Scout locations for your business. Analyze foot traffic, competition, and
                  local demographics to find the perfect spot.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section 
        id="cta"
        data-reveal="cta"
        className={`py-20 relative overflow-hidden z-10 ${revealedSections.has("cta") ? "reveal-bottom revealed" : "reveal-bottom"}`}
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)' }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "50px 50px" }}></div>
        </div>
        <div className="container mx-auto px-4 text-center relative z-10 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">Ready to Explore Your Neighborhood?</h2>
          <p className="text-xl mb-8 text-white">
            Join LocalLens today and start making data-driven decisions about your community.
          </p>
          <Link href={user ? "/dashboard" : "/signup"} className="btn btn-lg text-white shadow-2xl hover:scale-105 transition-transform animate-pulse-glow border-none font-semibold" style={{ background: 'linear-gradient(135deg, #22d3ee 0%, #a855f7 100%)' }}>
            {user ? "Go to Dashboard" : "Get Started Free"}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)', borderColor: 'rgba(34, 211, 238, 0.5)' }}>
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-cyan-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span className="text-sm font-semibold text-white">LocalLens</span>
              <span className="text-xs text-white/90">© {new Date().getFullYear()}</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm link link-hover hover:text-cyan-400 transition-colors text-white" aria-label="Learn more about LocalLens">About</a>
              <a href="#" className="text-sm link link-hover hover:text-cyan-400 transition-colors text-white" aria-label="Contact LocalLens">Contact</a>
              <a href="#" className="text-sm link link-hover hover:text-cyan-400 transition-colors text-white" aria-label="View LocalLens privacy policy">Privacy</a>
              <a href="#" className="text-sm link link-hover hover:text-cyan-400 transition-colors text-white" aria-label="View LocalLens terms of service">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

