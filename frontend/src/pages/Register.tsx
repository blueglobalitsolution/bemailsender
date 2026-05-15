import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, ArrowRight, UserPlus } from "lucide-react";
import { getApiUrl } from "../lib/api";

export default function Register({ setAuth }: { setAuth: (auth: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(getApiUrl("/api/auth/register/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, password_confirm: password }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        // Auto-login since backend now returns tokens
        if (data.access) {
          localStorage.setItem("access_token", data.access);
          setAuth(true);
          navigate("/campaigns");
        } else {
          navigate("/login");
        }
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
          setError(fieldErrors || "Registration failed");
        } else {
          setError("Registration failed");
        }
      }
    } catch (err) {
      setError("Network error. Please try again later.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans text-gray-900">
      <div className="w-full max-w-md skeuo-panel rounded-2xl p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-2 skeuo-text">BEmailSender</h1>
          <p className="text-gray-500 text-sm font-bold">Create your account</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 font-bold p-3 rounded-lg mb-6 text-sm shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-6">
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

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 drop-shadow-sm" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full skeuo-input py-3 pl-10 pr-4"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-gradient-to-b from-orange-400 to-orange-600 border border-orange-700 border-bottom-orange-800 shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.4)] text-white text-shadow-[0_-1px_0_rgba(0,0,0,0.3)] hover:from-orange-500 hover:to-orange-700 active:from-orange-600 active:to-orange-400 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-all">
            Create Account <UserPlus className="w-4 h-4" />
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500 font-bold">
          Already have an account? <Link to="/login" className="text-gray-900 hover:underline skeuo-text">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
