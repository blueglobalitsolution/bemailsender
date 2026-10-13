import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { getApiUrl } from "../lib/api";
import Beams from "../components/Beams";
import { ReachEngineLogoMark } from "../components/ReachEngineLogo";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch(getApiUrl("/api/auth/forgot-password/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok) {
        setIsSuccess(true);
        setMessage(data.message || "A password reset link has been dispatched to your email.");
      } else {
        setError(data.error || "Unable to send reset instructions. Please verify your email.");
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#161B1F] flex items-center justify-center p-4 sm:p-6 font-sans text-white relative overflow-hidden select-none">
      {/* 3D Dynamic Beams Background */}
      <Beams 
        lightColor="#CBD5E1"
        beamNumber={24} 
        beamWidth={4.5} 
        beamHeight={30} 
        speed={4.0} 
        noiseIntensity={1.2}
        scale={0.16}
        rotation={-30}
        className="opacity-60"
      />

      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-cyan-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Main Centered Glass Card */}
      <div className="w-full max-w-md bg-[#1C2227]/90 backdrop-blur-2xl border border-[#2C353D] rounded-2xl p-8 sm:p-10 shadow-2xl relative z-10">
        
        {/* Brand Badge & Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#161B1F] border border-[#2C353D] flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ReachEngineLogoMark size={38} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Reset Password
          </h1>
          <p className="text-[#8E9BA8] text-xs sm:text-sm font-medium mt-2 max-w-xs mx-auto leading-relaxed">
            Enter your registered email and we'll send you instructions to recover your account.
          </p>
        </div>

        {/* Success View */}
        {isSuccess ? (
          <div className="space-y-6">
            <div className="bg-[#161B1F] border border-emerald-500/30 rounded-xl p-5 text-center space-y-2.5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-emerald-300">
                Recovery Link Dispatched
              </p>
              <p className="text-xs text-[#8E9BA8] leading-relaxed">
                If an account exists for <span className="text-white font-medium">{email}</span>, check your inbox (and spam folder) for reset steps.
              </p>
            </div>

            <Link
              to="/login"
              className="w-full bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all text-sm cursor-pointer shadow-md"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Sign In
            </Link>
          </div>
        ) : (
          /* Reset Request Form */
          <form onSubmit={handleReset} className="space-y-5">
            {error && (
              <div className="bg-red-950/40 border border-red-900/60 text-red-400 font-medium p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs uppercase tracking-wider text-[#8E9BA8] mb-2 font-semibold">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E9BA8] pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl py-3.5 !pl-12 pr-4 text-white placeholder-[#64748B] focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all text-sm"
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-white hover:bg-[#CBD5E1] disabled:opacity-40 text-[#161B1F] font-bold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all text-sm cursor-pointer shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#161B1F]" />
                  <span>Sending Instructions...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <Send className="w-4 h-4 text-[#161B1F]" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center text-xs font-semibold text-[#8E9BA8] hover:text-white transition-colors gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
