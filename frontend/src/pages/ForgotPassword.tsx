import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Send } from "lucide-react";
import { getApiUrl } from "../lib/api";
import ReachEngineLogo from "../components/ReachEngineLogo";

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
    <div className="min-h-screen bg-[#161B1F] flex items-center justify-center md:justify-end p-4 md:p-12 lg:pr-36 font-sans text-white relative overflow-hidden">
      {/* Background branding on left side for desktop */}
      <div className="hidden md:flex flex-col justify-center absolute left-12 lg:left-24 top-1/2 -translate-y-1/2 max-w-lg pointer-events-none select-none z-10">
        <div className="mb-6">
          <ReachEngineLogo size="xl" showWordmark={true} />
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
          Recover <br />
          <span className="text-[#CBD5E1]">Access.</span>
        </h1>
      </div>

      {/* Card Form */}
      <div className="w-full max-w-md bg-[#222930] border border-[#2C353D] rounded-xl p-8 md:p-10 relative z-20">
        <Link 
          to="/login" 
          className="inline-flex items-center text-xs font-semibold text-[#8E9BA8] hover:text-[#CBD5E1] mb-6 transition-colors gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
        </Link>
        
        <div className="mb-8 text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Reset Password</h2>
          <p className="text-[#8E9BA8] text-xs font-medium">Enter your email and we'll send you recovery instructions.</p>
        </div>
        
        {message && (
          <div className="bg-[#161B1F] border border-emerald-500/40 text-emerald-300 p-3 rounded-md mb-6 text-xs text-center font-mono">
            {message}
          </div>
        )}
        
        <form onSubmit={handleReset} className="space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-widest text-[#8E9BA8] mb-2 font-medium">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E9BA8] pointer-events-none" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#161B1F] border border-[#2C353D] rounded-md py-3.5 !pl-12 pr-4 text-white placeholder-[#64748B] focus:outline-none focus:border-[#CBD5E1] transition-all text-sm font-sans"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold rounded-md py-3.5 flex items-center justify-center gap-2 transition-all text-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Reset Link"} <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
