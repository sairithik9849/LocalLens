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
    <div className="min-h-screen bg-base-200">
      {/* Navigation */}
      <nav className="navbar bg-base-100 shadow-md sticky top-0 z-50 border-b border-base-300">
        <div className="container mx-auto px-4 lg:px-8 w-full flex items-center justify-between">
          <div className="flex-1 flex items-center">
            <Link href="/" className="btn btn-ghost text-xl font-bold">
              🏘️ LocalLens
            </Link>
          </div>
          <div className="flex-none flex items-center gap-3 ml-auto">
            {loading ? (
              <span className="loading loading-spinner loading-sm text-primary"></span>
            ) : user ? (
              <>
                <div className="flex items-center gap-3">
                  {profileData?.photoURL ? (
                    <img
                      src={profileData.photoURL}
                      alt="Profile"
                      className="w-10 h-10 rounded-full border-2 border-primary/50 object-cover"
                    />
                  ) : (
                    <div className="bg-primary text-primary-content rounded-full w-10 h-10 border-2 border-primary/50 flex items-center justify-center">
                      <span className="text-sm font-bold">
                        {profileData?.firstName?.[0]?.toUpperCase() || profileData?.lastName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                      </span>
                    </div>
                  )}
                  <Link href="/feed" className="btn btn-ghost btn-sm">
                    Feed
                  </Link>
                  <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">
                  Sign In
                </Link>
                <Link href="/signup" className="btn btn-primary btn-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero min-h-[90vh] bg-gradient-to-br from-base-200 via-primary/5 to-base-200 relative overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>
        <div className="hero-content text-center py-20 relative z-10">
          <div className="max-w-4xl">
            <div className="animate-float mb-8 flex justify-center">
              <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center shadow-2xl ring-4 ring-primary/20">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 text-primary-content"
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
            <h1 className="text-6xl md:text-7xl font-bold mb-6 text-base-content animate-fade-in-up leading-tight">
              Discover Your Neighborhood
            </h1>
            <p className="text-xl text-base-content/70 max-w-2xl mx-auto mb-8 animate-fade-in-up">
              LocalLens transforms raw neighborhood data into clear, interactive insights.
              Make informed decisions about where to live, work, and invest.
            </p>
            <div className="flex gap-4 justify-center animate-fade-in-up">
              <Link href={user ? "/feed" : "/login"} className="btn btn-primary btn-lg">
                {user ? "Go to Feed" : "Explore Now"}
              </Link>
              <Link href="#features" className="btn btn-outline btn-lg" aria-label="Learn more about LocalLens features">
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
        className={`py-20 bg-base-100 ${revealedSections.has("features") ? "reveal-bottom revealed" : "reveal-bottom"}`}
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-base-content">Powerful Features</h2>
            <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
              Everything you need to understand your neighborhood at a glance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow animate-fade-in-up">
              <div className="card-body">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <h3 className="card-title text-base-content">Interactive Maps & Heatmaps</h3>
                <p className="text-base-content/70">
                  Explore neighborhoods with dynamic heatmaps showing rent trends, crime density,
                  and business activity. Visualize data in an intuitive, interactive way.
                </p>
                <div className="card-actions mt-4">
                  <div className="badge badge-outline badge-primary">Interactive</div>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow animate-fade-in-up">
              <div className="card-body">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="card-title text-base-content">Historical Data Analysis</h3>
                <p className="text-base-content/70">
                  Track neighborhood trends over time with interactive charts. See how rent prices,
                  crime rates, and business activity have changed.
                </p>
                <div className="card-actions mt-4">
                  <div className="badge badge-outline badge-primary">Analytics</div>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow animate-fade-in-up">
              <div className="card-body">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <h3 className="card-title text-base-content">Hyper-Local Content</h3>
                <p className="text-base-content/70">
                  Connect with your neighborhood through local events, yard sales, and community
                  crime reports. All content is neighborhood-specific.
                </p>
                <div className="card-actions mt-4">
                  <div className="badge badge-outline badge-primary">Local</div>
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow animate-fade-in-up">
              <div className="card-body">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="card-title text-base-content">Secure & Moderated</h3>
                <p className="text-base-content/70">
                  Built with Firebase Authentication and role-based access control. Content
                  moderation ensures a safe community experience.
                </p>
                <div className="card-actions mt-4">
                  <div className="badge badge-outline badge-primary">Secure</div>
                </div>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow animate-fade-in-up">
              <div className="card-body">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="card-title text-base-content">Real-Time Communication</h3>
                <p className="text-base-content/70">
                  Join neighborhood chatrooms and receive instant notifications for new events,
                  crimes, or messages. Stay connected with your community.
                </p>
                <div className="card-actions mt-4">
                  <div className="badge badge-outline badge-primary">Real-Time</div>
                </div>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow animate-fade-in-up">
              <div className="card-body">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="card-title text-base-content">Data Aggregation</h3>
                <p className="text-base-content/70">
                  Comprehensive data from multiple sources including public crime data, real estate
                  prices, and Google Places. All standardized and stored for easy access.
                </p>
                <div className="card-actions mt-4">
                  <div className="badge badge-outline badge-primary">Comprehensive</div>
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
        className={`py-20 bg-base-200 ${revealedSections.has("how-it-works") ? "reveal-bottom revealed" : "reveal-bottom"}`}
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-base-content">How It Works</h2>
            <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
              Get started in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center animate-slide-in-left">
              <div className="avatar placeholder mb-4">
                <div className="bg-primary text-primary-content rounded-full w-20 h-20 shadow-lg hover:scale-110 transition-transform flex items-center justify-center border-2 border-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-base-content">Sign Up</h3>
              <p className="text-base-content/70">
                Create your account and register your neighborhood. Choose from email/password
                or social login options.
              </p>
            </div>

            <div className="text-center animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <div className="avatar placeholder mb-4">
                <div className="bg-primary text-primary-content rounded-full w-20 h-20 shadow-lg hover:scale-110 transition-transform flex items-center justify-center border-2 border-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-base-content">Explore</h3>
              <p className="text-base-content/70">
                Browse interactive maps, view heatmaps, and analyze historical trends for your
                neighborhood and surrounding areas.
              </p>
            </div>

            <div className="text-center animate-slide-in-right">
              <div className="avatar placeholder mb-4">
                <div className="bg-primary text-primary-content rounded-full w-20 h-20 shadow-lg hover:scale-110 transition-transform flex items-center justify-center border-2 border-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-base-content">Engage</h3>
              <p className="text-base-content/70">
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
        className={`py-20 bg-base-100 ${revealedSections.has("use-cases") ? "reveal-bottom revealed" : "reveal-bottom"}`}
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-base-content">Perfect For</h2>
            <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
              Whether you're looking for a home, starting a business, or investing
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow animate-fade-in-up">
              <div className="card-body items-center text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="card-title text-base-content">Families</h3>
                <p className="text-base-content/70">
                  Find safe communities with great schools, low crime rates, and family-friendly
                  amenities. Make informed decisions about where to raise your family.
                </p>
              </div>
            </div>

            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow animate-fade-in-up">
              <div className="card-body items-center text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <h3 className="card-title text-base-content">Renters</h3>
                <p className="text-base-content/70">
                  Compare housing costs across neighborhoods. Track rent fluctuations and find
                  the best value for your budget.
                </p>
              </div>
            </div>

            <div className="card shadow-lg bg-base-100 border border-base-300 hover:shadow-xl transition-shadow animate-fade-in-up">
              <div className="card-body items-center text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="card-title text-base-content">Entrepreneurs</h3>
                <p className="text-base-content/70">
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
        className={`py-20 bg-primary text-primary-content ${revealedSections.has("cta") ? "reveal-bottom revealed" : "reveal-bottom"}`}
      >
        <div className="container mx-auto px-4 text-center animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Ready to Explore Your Neighborhood?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join LocalLens today and start making data-driven decisions about your community.
          </p>
          <Link href={user ? "/feed" : "/signup"} className="btn btn-lg btn-secondary shadow-2xl hover:scale-105 transition-transform font-semibold">
            {user ? "Go to Feed" : "Get Started Free"}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-base-300 bg-base-100">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-base-content">🏘️ LocalLens</span>
              <span className="text-xs text-base-content/70">© {new Date().getFullYear()}</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm link link-hover text-base-content/70 hover:text-primary" aria-label="Learn more about LocalLens">About</a>
              <a href="#" className="text-sm link link-hover text-base-content/70 hover:text-primary" aria-label="Contact LocalLens">Contact</a>
              <a href="#" className="text-sm link link-hover text-base-content/70 hover:text-primary" aria-label="View LocalLens privacy policy">Privacy</a>
              <a href="#" className="text-sm link link-hover text-base-content/70 hover:text-primary" aria-label="View LocalLens terms of service">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

