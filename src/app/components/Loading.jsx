"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function Loading({ children }) {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center fixed inset-0 z-50" style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-linear-to-br from-cyan-500 via-blue-500 to-purple-600 flex items-center justify-center shadow-2xl mx-auto mb-4 animate-pulse" style={{ boxShadow: '0 0 40px rgba(34, 211, 238, 0.5), 0 0 60px rgba(147, 51, 234, 0.3)' }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-white"
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
          <span className="loading loading-spinner loading-lg text-cyan-400"></span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

