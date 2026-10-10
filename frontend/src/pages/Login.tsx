import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { getApiUrl } from "../lib/api";
import Beams from "../components/Beams";
import { ReachEngineLogoMark } from "../components/ReachEngineLogo";

export default function Login({ setAuth }: { setAuth: (auth: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-[#161B1F] flex items-center justify-center md:justify-end p-4 md:p-12 lg:pr-36 font-sans text-white relative overflow-hidden">
      {/* 3D Dynamic Beams Background */}
      <Beams 
        lightColor="#CBD5E1"
        beamNumber={28} 
        beamWidth={4.5} 
        beamHeight={30} 
        speed={4.5} 
        noiseIntensity={1.3}
        scale={0.16}
        rotation={-31}
        className="opacity-70"
      />

      {/* Subtle background branding on left side for desktop */}
      <div className="hidden md:flex flex-col justify-center absolute left-12 lg:left-24 top-1/2 -translate-y-1/2 max-w-lg pointer-events-none select-none z-10">
        <h2 className="text-5xl lg:text-6xl font-bold text-white tracking-tight leading-none">
          Automate.<br />Scale.<br /><span className="text-[#CBD5E1]">Deliver.</span>
        </h2>
      </div>

      <div className="w-full max-w-md bg-[#222930]/90 backdrop-blur-xl border border-[#2C353D] rounded-xl p-10 z-10">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[#161B1F] border border-[#2C353D] flex items-center justify-center mb-3">
            <ReachEngineLogoMark size={40} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Reach<span className="font-semibold text-[#CBD5E1]">Engine</span></h1>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-900/60 text-red-400 font-medium p-3 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-widest text-[#8E9BA8] mb-2 font-medium">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E9BA8] pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#161B1F] border border-[#2C353D] rounded-md py-3.5 !pl-12 pr-4 text-white placeholder-[#64748B] focus:outline-none focus:border-[#CBD5E1] transition-all text-sm"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs uppercase tracking-widest text-[#8E9BA8] font-medium">Password</label>
              <Link to="/forgot-password" className="text-xs text-[#CBD5E1] hover:underline font-medium">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E9BA8] pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#161B1F] border border-[#2C353D] rounded-md py-3.5 !pl-12 !pr-12 text-white placeholder-[#64748B] focus:outline-none focus:border-[#CBD5E1] transition-all text-sm"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E9BA8] hover:text-white p-1 transition-colors cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold rounded-md py-3.5 flex items-center justify-center gap-2 transition-all text-sm cursor-pointer"
          >
            Sign In <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
