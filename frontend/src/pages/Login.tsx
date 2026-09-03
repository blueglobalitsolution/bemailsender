import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { getApiUrl } from "../lib/api";
import Beams from "../components/Beams";

export default function Login({ setAuth }: { setAuth: (auth: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(getApiUrl("/api/auth/login/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("access_token", data.access);
        setAuth(true);
        navigate("/campaigns");
      } else {
        // Extract error message from Django REST response
        if (data.error) {
          setError(data.error);
        } else if (typeof data === "object") {
          const fieldErrors = Object.entries(data)
            .map(([key, value]) => {
              const msg = Array.isArray(value) ? value.join(" ") : value;
              return `${key}: ${msg}`;
            })
            .join(" | ");
          setError(fieldErrors || "Login failed");
        } else {
          setError("Invalid credentials");
        }
      }
    } catch (err) {
      setError("Network error. Please try again later.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center md:justify-end p-4 md:p-12 lg:pr-36 font-sans text-white relative overflow-hidden">
      {/* 3D Dynamic Beams Background */}
      <Beams 
        lightColor="#19b3d2"
        beamNumber={30} 
        beamWidth={4.7} 
        beamHeight={30} 
        speed={5.7} 
        noiseIntensity={1.4}
        scale={0.15}
        rotation={-31}
        className="opacity-80"
      />

      {/* Subtle background branding on left side for desktop */}
      <div className="hidden md:flex flex-col justify-center absolute left-12 lg:left-24 top-1/2 -translate-y-1/2 max-w-lg pointer-events-none select-none z-10">
        <h2 className="text-5xl lg:text-6xl font-serif text-white tracking-tight leading-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
          Automate.<br />Scale.<br /><span className="text-[#00ffff] drop-shadow-[0_0_24px_rgba(0,255,255,0.4)]">Deliver.</span>
        </h2>
      </div>

      <div className="w-full max-w-md bg-[#000000]/90 backdrop-blur-xl border border-[#1a1a1a] rounded-none p-10 shadow-[0_16px_48px_rgba(0,0,0,0.9)] z-10">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-serif text-white tracking-tight mb-2">BEmailSender</h1>
          <p className="text-[#888888] text-sm">Sign in to your dashboard</p>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-900/60 text-red-400 font-medium p-3 rounded-none mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-widest text-[#777777] mb-2 font-medium">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555] pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-none py-3.5 !pl-12 pr-4 text-white placeholder-[#555555] focus:outline-none focus:border-[#00ffff] transition-all text-sm"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs uppercase tracking-widest text-[#777777] font-medium">Password</label>
              <Link to="/forgot-password" className="text-xs text-[#00ffff] hover:underline font-medium">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555] pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-none py-3.5 !pl-12 pr-4 text-white placeholder-[#555555] focus:outline-none focus:border-[#00ffff] transition-all text-sm"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#19b3d2] hover:bg-[#20c4e6] text-black font-semibold rounded-none py-3.5 flex items-center justify-center gap-2 transition-all border border-[#1499b4] text-sm cursor-pointer"
          >
            Sign In <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-[#777777]">
          Don't have an account? <Link to="/register" className="text-[#00ffff] hover:underline ml-1 font-medium">Create one</Link>
        </p>
      </div>
    </div>
  );
}
