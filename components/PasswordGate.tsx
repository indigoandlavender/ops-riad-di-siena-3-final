"use client";

import { useState, useEffect } from "react";

interface PasswordGateProps {
  children: React.ReactNode;
}

// Password is checked against environment variable or fallback
const CORRECT_PASSWORD = process.env.NEXT_PUBLIC_OPS_PASSWORD || "c0usc0us*2344";

export default function PasswordGate({ children }: PasswordGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    const auth = sessionStorage.getItem("ops_authenticated");
    setIsAuthenticated(auth === "true");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem("ops_authenticated", "true");
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPassword("");
    }
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
      </div>
    );
  }

  // Authenticated - show content
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Password gate
  return (
    <div className="min-h-screen relative flex items-center justify-center">
      {/* Blurred background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://res.cloudinary.com/drstfu5yr/image/upload/v1735000000/riad-di-siena/courtyard.jpg')`,
          filter: "blur(20px)",
          transform: "scale(1.1)",
        }}
      />
      
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Password form */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-[22px] font-light text-black/80 tracking-wide">
              Riad di Siena
            </h1>
            <p className="text-[13px] text-black/40 mt-1">Operations Dashboard</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                  placeholder="Enter password"
                  autoFocus
                  className={`w-full px-4 py-3 pr-12 text-[14px] border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    error 
                      ? "border-red-300 focus:ring-red-200" 
                      : "border-black/10 focus:ring-black/10 focus:border-black/30"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-black/40 hover:text-black/60 transition-colors"
                >
                  {showPassword ? (
                    /* Eye open - password visible */
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    /* Eye closed - password hidden */
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
              {error && (
                <p className="text-[12px] text-red-500 mt-2">Incorrect password</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-black/80 transition-colors"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
