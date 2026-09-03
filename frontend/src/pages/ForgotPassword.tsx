import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Send } from "lucide-react";
import { getApiUrl } from "../lib/api";
import Beams from "../components/Beams";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/auth/forgot-password/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      const data = await res.json();
      setMessage(data.message || "If an account exists, a reset link has been sent.");
    } catch (err) {
      setMessage("An error occurred. Please try again.");
    } finally {
      setLoading(false);
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
        <h1 className="text-5xl lg:text-7xl font-serif text-white tracking-tight mb-4 leading-none">
          Recover <br />
          <span className="italic font-light text-[#19b3d2]">Access.</span>
        </h1>
      </div>

      {/* Card Form */}
      <div className="w-full max-w-md bg-[#000000]/80 backdrop-blur-xl border border-[#1a1a1a] rounded-none p-8 md:p-10 shadow-2xl relative z-20">
        <Link 
          to="/login" 
          className="inline-flex items-center text-xs font-semibold text-[#777777] hover:text-[#19b3d2] mb-6 transition-colors gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
        </Link>
        
        <div className="mb-8 text-left">
          <h2 className="text-3xl font-serif text-white tracking-tight mb-2">Reset Password</h2>
          <p className="text-[#777777] text-xs font-medium">Enter your email and we'll send you recovery instructions.</p>
        </div>
        
        {message && (
          <div className="bg-[#0c1a17] border border-emerald-500/40 text-emerald-300 p-3 rounded-none mb-6 text-xs text-center font-mono">
            {message}
          </div>
        )}
        
        <form onSubmit={handleReset} className="space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-widest text-[#777777] mb-2 font-medium">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555555] pointer-events-none" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-none py-3.5 !pl-12 pr-4 text-white placeholder-[#555555] focus:outline-none focus:border-[#19b3d2] transition-all text-sm font-sans"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#19b3d2] hover:bg-[#20c4e6] text-black font-semibold rounded-none py-3.5 flex items-center justify-center gap-2 transition-all border border-[#1499b4] text-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Reset Link"} <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
