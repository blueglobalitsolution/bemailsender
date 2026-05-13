import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Send } from "lucide-react";
import { getApiUrl } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(getApiUrl("/api/auth/forgot-password/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message);
    } catch (err) {
      setMessage("An error occurred");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans text-gray-900">
      <div className="w-full max-w-md skeuo-panel rounded-2xl p-8">
        <Link to="/login" className="inline-flex items-center text-xs font-bold text-gray-500 hover:text-gray-900 mb-6 transition-colors skeuo-text">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to login
        </Link>
        
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight mb-2 skeuo-text">Reset Password</h1>
          <p className="text-gray-500 text-sm font-bold">We'll send you a link to reset your password</p>
        </div>
        
        {message && <div className="bg-green-50 border border-green-200 text-green-700 font-bold p-3 rounded-lg mb-6 text-sm text-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]">{message}</div>}
        
        <form onSubmit={handleReset} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 drop-shadow-sm" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full skeuo-input py-3 pl-10 pr-4"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>
          
          <button type="submit" className="w-full skeuo-btn-primary font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-all">
            Send Reset Link <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
