import React, { useState, useEffect } from "react";
import {
  User,
  Shield,
  Clock,
  Sliders,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Building,
  Mail,
  Key,
  LogOut,
  Calendar,
  MapPin,
  Eye,
  RefreshCw,
  Lock,
  Sparkles,
  Info,
  Save,
  Check,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../components/Toast";
import { cn } from "../lib/utils";

const DAYS_OF_WEEK = [
  { id: 1, label: "Mon", full: "Monday" },
  { id: 2, label: "Tue", full: "Tuesday" },
  { id: 3, label: "Wed", full: "Wednesday" },
  { id: 4, label: "Thu", full: "Thursday" },
  { id: 5, label: "Fri", full: "Friday" },
  { id: 6, label: "Sat", full: "Saturday" },
  { id: 0, label: "Sun", full: "Sunday" },
];

export default function Settings() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<
    "profile" | "safeguards" | "compliance" | "alerts"
  >("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Password State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Safeguards State
  const [cooldownDays, setCooldownDays] = useState<number>(30);
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scheduleStartTime, setScheduleStartTime] = useState("09:00");
  const [scheduleEndTime, setScheduleEndTime] = useState("18:00");
  const [enableWindow, setEnableWindow] = useState(true);

  // Compliance State
  const [unsubText, setUnsubText] = useState(
    "If you'd rather not hear from us, click here to unsubscribe."
  );
  const [companyAddress, setCompanyAddress] = useState("");
  const [enforceOneClick, setEnforceOneClick] = useState(true);

  // Alerts State
  const [bounceThreshold, setBounceThreshold] = useState<number>(5.0);
  const [bounceAutoPause, setBounceAutoPause] = useState(true);

  // Load User Data
  const loadUserData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/auth/me/");
      if (res.ok) {
        const data = await res.json();
        setName(data.full_name || data.name || "");
        setEmail(data.email || "");
        setCompanyName(data.company_name || "");
        setCooldownDays(
          data.recipient_cooldown_days !== undefined
            ? data.recipient_cooldown_days
            : 30
        );

        if (Array.isArray(data.schedule_days) && data.schedule_days.length > 0) {
          setScheduleDays(data.schedule_days);
        } else {
          setScheduleDays([1, 2, 3, 4, 5]);
        }

        if (data.schedule_start_time) {
          setScheduleStartTime(data.schedule_start_time.slice(0, 5));
        }
        if (data.schedule_end_time) {
          setScheduleEndTime(data.schedule_end_time.slice(0, 5));
        }
        if (!data.schedule_start_time && !data.schedule_end_time) {
          setEnableWindow(false);
        } else {
          setEnableWindow(true);
        }

        if (data.global_unsubscribe_text) {
          setUnsubText(data.global_unsubscribe_text);
        }
        if (data.company_address) {
          setCompanyAddress(data.company_address);
        }
        if (data.enforce_one_click_unsub !== undefined) {
          setEnforceOneClick(data.enforce_one_click_unsub);
        }

        if (data.bounce_alert_threshold !== undefined) {
          setBounceThreshold(Number(data.bounce_alert_threshold));
        }
        if (data.bounce_auto_pause !== undefined) {
          setBounceAutoPause(data.bounce_auto_pause);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load user settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    const handleGlobalSave = () => {
      handleSaveSettings("Settings");
    };
    window.addEventListener("save-settings", handleGlobalSave);
    return () => window.removeEventListener("save-settings", handleGlobalSave);
  });

  // Save Settings
  const handleSaveSettings = async (sectionName: string) => {
    try {
      setSaving(true);
      const payload: Record<string, any> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        company_name: companyName.trim(),
        recipient_cooldown_days: Number(cooldownDays) || 0,
        schedule_days: scheduleDays,
        schedule_start_time: enableWindow && scheduleStartTime ? `${scheduleStartTime}:00` : null,
        schedule_end_time: enableWindow && scheduleEndTime ? `${scheduleEndTime}:00` : null,
        global_unsubscribe_text: unsubText.trim(),
        company_address: companyAddress.trim(),
        enforce_one_click_unsub: Boolean(enforceOneClick),
        bounce_alert_threshold: Number(bounceThreshold) || 5.0,
        bounce_auto_pause: Boolean(bounceAutoPause),
      };

      const res = await apiFetch("/api/auth/me/", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(`${sectionName} saved successfully.`);
      } else {
        const errorData = await res.json();
        const firstError = Object.values(errorData)[0];
        const errorMsg = Array.isArray(firstError)
          ? firstError[0]
          : typeof firstError === "string"
          ? firstError
          : "Failed to update settings.";
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error while saving settings.");
    } finally {
      setSaving(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await apiFetch("/api/auth/change-password/", {
        method: "POST",
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
          new_password_confirm: confirmPassword,
        }),
      });

      if (res.ok) {
        toast.success("Password changed successfully.");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const err = await res.json();
        const msg =
          err.old_password?.[0] ||
          err.new_password?.[0] ||
          err.new_password_confirm?.[0] ||
          "Failed to change password.";
        toast.error(msg);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error changing password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  // Logout All Devices
  const handleLogoutAll = () => {
    toast.confirm(
      "Are you sure you want to log out from all devices? You will need to log in again on this device as well.",
      async () => {
        try {
          const res = await apiFetch("/api/auth/logout-all/", {
            method: "POST",
          });
          if (res.ok) {
            localStorage.removeItem("access_token");
            toast.success("All sessions terminated. Redirecting to login...");
            setTimeout(() => {
              window.location.href = "/login";
            }, 1000);
          } else {
            toast.error("Failed to terminate sessions.");
          }
        } catch (err) {
          console.error(err);
          toast.error("Network error logging out across devices.");
        }
      }
    );
  };

  // Day toggle
  const toggleDay = (dayId: number) => {
    setScheduleDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  const setWeekdayPreset = () => {
    setScheduleDays([1, 2, 3, 4, 5]);
  };

  const setAllDaysPreset = () => {
    setScheduleDays([0, 1, 2, 3, 4, 5, 6]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-[#8E9BA8]">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading settings & deliverability rules...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-16">
      {/* Tabs Bar */}
      <div className="flex border-b border-[#2C353D] gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("profile")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer whitespace-nowrap",
            activeTab === "profile"
              ? "border-emerald-400 text-white bg-[#1C2227]"
              : "border-transparent text-[#8E9BA8] hover:text-white hover:bg-[#1C2227]/50"
          )}
        >
          <User className="w-4 h-4" />
          Profile & Security
        </button>

        <button
          onClick={() => setActiveTab("safeguards")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer whitespace-nowrap",
            activeTab === "safeguards"
              ? "border-emerald-400 text-white bg-[#1C2227]"
              : "border-transparent text-[#8E9BA8] hover:text-white hover:bg-[#1C2227]/50"
          )}
        >
          <Sliders className="w-4 h-4" />
          Sending Windows & Cooldown
        </button>

        <button
          onClick={() => setActiveTab("compliance")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer whitespace-nowrap",
            activeTab === "compliance"
              ? "border-emerald-400 text-white bg-[#1C2227]"
              : "border-transparent text-[#8E9BA8] hover:text-white hover:bg-[#1C2227]/50"
          )}
        >
          <FileCheck className="w-4 h-4" />
          Compliance & Unsubscribe
        </button>

        <button
          onClick={() => setActiveTab("alerts")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer whitespace-nowrap",
            activeTab === "alerts"
              ? "border-emerald-400 text-white bg-[#1C2227]"
              : "border-transparent text-[#8E9BA8] hover:text-white hover:bg-[#1C2227]/50"
          )}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Bounce Alerts & Auto-Pause
        </button>
      </div>

      {/* TAB 1: Profile & Security */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Profile Card */}
          <div className="bg-[#1C2227] border border-[#2C353D] rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-[#2C353D] pb-4">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">General Profile</h3>
                <p className="text-xs text-[#8E9BA8]">
                  Update your personal name, login email, and company identity.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E9BA8] mb-1.5">
                  Full Name / Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Johnson"
                    className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg pl-9.5 pr-4 py-2.5 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E9BA8] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@company.com"
                    className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg pl-9.5 pr-4 py-2.5 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-white transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E9BA8] mb-1.5">
                  Company / Brand Name
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. BlueGlobal Tech Inc."
                    className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg pl-9.5 pr-4 py-2.5 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-white transition-all"
                  />
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Used as default company name in footer compliance disclosures.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveSettings("Profile")}
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-400 text-[#161B1F] font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Profile
                </button>
              </div>
            </div>
          </div>

          {/* Password & Security Card */}
          <div className="space-y-6">
            <div className="bg-[#1C2227] border border-[#2C353D] rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-3 border-b border-[#2C353D] pb-4">
                <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Password & Security</h3>
                  <p className="text-xs text-[#8E9BA8]">
                    Change your current password to a new secure one.
                  </p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E9BA8] mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg pl-9.5 pr-4 py-2.5 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E9BA8] mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg pl-9.5 pr-4 py-2.5 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-white transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E9BA8] mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg pl-9.5 pr-4 py-2.5 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-60"
                >
                  {passwordLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Key className="w-3.5 h-3.5" />
                  )}
                  Update Password
                </button>
              </form>
            </div>

            {/* Logout All Devices */}
            <div className="bg-[#1C2227] border border-rose-900/30 rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Session Logout Across All Devices
                    </h3>
                    <p className="text-xs text-[#8E9BA8] mt-0.5">
                      Instantly revoke access tokens and force logout across all other computers, browsers, and mobile devices.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleLogoutAll}
                  className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out Everywhere
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Sending Windows & Cooldown Safeguards */}
      {activeTab === "safeguards" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          {/* Recipient Cooldown Period Card */}
          <div className="bg-[#1C2227] border border-[#2C353D] rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#2C353D] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Recipient Cooldown Guardrail
                  </h3>
                  <p className="text-xs text-[#8E9BA8]">
                    Global safeguard: Automatically skip leads that were already contacted within a set timeframe.
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-2xl font-mono font-bold text-emerald-400">
                  {cooldownDays === 0 ? "Disabled" : `${cooldownDays} Days`}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="1"
                  value={cooldownDays}
                  onChange={(e) => setCooldownDays(Number(e.target.value))}
                  className="flex-1 accent-emerald-400 cursor-pointer h-2 bg-[#161B1F] rounded-lg"
                />
                <div className="w-24">
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={cooldownDays}
                    onChange={(e) => setCooldownDays(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg px-3 py-1.5 text-center font-mono font-bold text-sm text-white focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-[#8E9BA8] mr-1">Presets:</span>
                {[
                  { label: "14 Days", val: 14 },
                  { label: "30 Days (Recommended)", val: 30 },
                  { label: "45 Days", val: 45 },
                  { label: "60 Days", val: 60 },
                  { label: "Disabled (0)", val: 0 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setCooldownDays(preset.val)}
                    className={cn(
                      "text-xs px-3 py-1 rounded-md border transition-all cursor-pointer",
                      cooldownDays === preset.val
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold"
                        : "bg-[#161B1F] border-[#2C353D] text-[#8E9BA8] hover:text-white"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="p-3.5 bg-[#161B1F] border border-[#2C353D] rounded-lg flex items-start gap-3 text-xs text-[#8E9BA8]">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>How it works:</strong> If set to <strong>{cooldownDays} days</strong>, ReachEngine checks your historical sending ledger before sending. If a recipient was emailed in any campaign less than {cooldownDays} days ago, they are automatically safely skipped to protect you from spam complaints. (0 disables cooldown).
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleSaveSettings("Cooldown Period")}
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-400 text-[#161B1F] font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Cooldown
                </button>
              </div>
            </div>
          </div>

          {/* Sending Windows / Business Hours Card */}
          <div className="bg-[#1C2227] border border-[#2C353D] rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#2C353D] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Sending Windows & Business Hours
                  </h3>
                  <p className="text-xs text-[#8E9BA8]">
                    Control which days and hours campaigns are permitted to broadcast emails.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-[#8E9BA8]">Enable Window</span>
                <input
                  type="checkbox"
                  checked={enableWindow}
                  onChange={(e) => setEnableWindow(e.target.checked)}
                  className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
                />
              </label>
            </div>

            {enableWindow ? (
              <div className="space-y-6">
                {/* Day Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#8E9BA8]">
                      Active Sending Days
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={setWeekdayPreset}
                        className="text-[11px] text-[#8E9BA8] hover:text-white underline cursor-pointer"
                      >
                        Weekdays (Mon-Fri)
                      </button>
                      <span className="text-[#64748B]">•</span>
                      <button
                        type="button"
                        onClick={setAllDaysPreset}
                        className="text-[11px] text-[#8E9BA8] hover:text-white underline cursor-pointer"
                      >
                        All 7 Days
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = scheduleDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleDay(day.id)}
                          className={cn(
                            "py-2.5 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1",
                            isSelected
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                              : "bg-[#161B1F] border-[#2C353D] text-[#64748B] hover:text-[#8E9BA8]"
                          )}
                        >
                          <span>{day.label}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hours Selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E9BA8] mb-2">
                    Permitted Sending Hours (UTC / Server Time)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#161B1F] border border-[#2C353D] rounded-lg p-3.5 space-y-1.5">
                      <span className="text-xs text-[#8E9BA8] font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-sky-400" /> Start Time
                      </span>
                      <input
                        type="time"
                        value={scheduleStartTime}
                        onChange={(e) => setScheduleStartTime(e.target.value)}
                        className="w-full bg-[#1C2227] border border-[#2C353D] rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white"
                      />
                    </div>

                    <div className="bg-[#161B1F] border border-[#2C353D] rounded-lg p-3.5 space-y-1.5">
                      <span className="text-xs text-[#8E9BA8] font-medium flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" /> End Time
                      </span>
                      <input
                        type="time"
                        value={scheduleEndTime}
                        onChange={(e) => setScheduleEndTime(e.target.value)}
                        className="w-full bg-[#1C2227] border border-[#2C353D] rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#161B1F] border border-[#2C353D] rounded-lg text-xs text-[#8E9BA8]">
                  Emails queued outside of these hours will automatically pause in <code>scheduled</code> status and resume when your next business window opens.
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#161B1F] border border-[#2C353D] rounded-lg text-xs text-[#8E9BA8]">
                Window restrictions are disabled. Campaigns will dispatch emails 24 hours a day, 7 days a week as soon as they are launched.
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleSaveSettings("Safeguards")}
                disabled={saving}
                className="bg-emerald-500 hover:bg-emerald-400 text-[#161B1F] font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                Save Safeguards
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Compliance & Default Unsubscribe Footer */}
      {activeTab === "compliance" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[#1C2227] border border-[#2C353D] rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-3 border-b border-[#2C353D] pb-4">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Compliance & Legal Footers</h3>
                  <p className="text-xs text-[#8E9BA8]">
                    Configure CAN-SPAM Act mandatory physical address and unsubscribe link text.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Global Unsubscribe Text */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E9BA8] mb-1.5">
                    Global Unsubscribe Link Text
                  </label>
                  <input
                    type="text"
                    value={unsubText}
                    onChange={(e) => setUnsubText(e.target.value)}
                    placeholder="If you'd rather not hear from us, click here to unsubscribe."
                    className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-white transition-all"
                  />
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Clear unsubscribe links drastically lower spam-flagging rates by recipients.
                  </p>
                </div>

                {/* Company Physical Address */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#8E9BA8] mb-1.5">
                    Company Physical Legal Address (CAN-SPAM Mandatory)
                  </label>
                  <textarea
                    rows={3}
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="100 Innovation Way, Suite 400&#10;San Francisco, CA 94105, United States"
                    className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg p-3 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-white transition-all font-mono"
                  />
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Required by CAN-SPAM and GDPR laws to prevent sender domain blacklisting. Auto-attached to email footers.
                  </p>
                </div>

                {/* RFC 8058 One-Click Unsubscribe Toggle */}
                <div className="p-4 bg-[#161B1F] border border-[#2C353D] rounded-lg flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        One-Click Unsubscribe Enforcement (RFC 8058)
                      </span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                        Yahoo & Gmail Req
                      </span>
                    </div>
                    <p className="text-xs text-[#8E9BA8]">
                      Includes <code>List-Unsubscribe</code> and <code>List-Unsubscribe-Post: List-Unsubscribe=One-Click</code> headers on all outgoing emails.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={enforceOneClick}
                    onChange={(e) => setEnforceOneClick(e.target.checked)}
                    className="w-5 h-5 accent-emerald-400 rounded cursor-pointer mt-1"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleSaveSettings("Compliance settings")}
                    disabled={saving}
                    className="bg-emerald-500 hover:bg-emerald-400 text-[#161B1F] font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Compliance Rules
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Live Email Footer Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#1C2227] border border-[#2C353D] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8E9BA8]">
                <Eye className="w-4 h-4 text-emerald-400" />
                Live Email Footer Preview
              </div>

              {/* Email Mock Container */}
              <div className="bg-[#FFFFFF] text-[#1E293B] rounded-lg p-5 shadow-inner border border-gray-200">
                <div className="border-b border-gray-100 pb-3 mb-3 text-xs text-gray-400 italic">
                  [... Your Campaign Email Body Content Here ...]
                </div>

                {/* Simulated Footer */}
                <div className="text-center pt-4 border-t border-gray-200 space-y-2">
                  <p className="text-xs text-gray-500 underline cursor-pointer hover:text-gray-700">
                    {unsubText || "If you'd rather not hear from us, click here to unsubscribe."}
                  </p>

                  {(companyName || companyAddress) && (
                    <div className="text-[11px] text-gray-400 leading-tight">
                      {companyName && (
                        <div className="font-semibold text-gray-600 mb-0.5">
                          {companyName}
                        </div>
                      )}
                      {companyAddress ? (
                        <div className="whitespace-pre-line text-gray-500">
                          {companyAddress}
                        </div>
                      ) : (
                        <span className="text-gray-300 italic">No physical address set yet</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-[#8E9BA8] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  One-Click Header: <strong>{enforceOneClick ? "Enabled (RFC 8058 compliant)" : "Disabled"}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Notifications & Bounce Alerts */}
      {activeTab === "alerts" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[#1C2227] border border-[#2C353D] rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#2C353D] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Automated Bounce Rate Guardrail & Alerts
                    </h3>
                    <p className="text-xs text-[#8E9BA8]">
                      Detect invalid emails and automatically pause campaigns to protect your domain reputation.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-mono font-bold text-amber-400">
                    {bounceThreshold}%
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                {/* Threshold Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#8E9BA8]">
                    <span>Bounce Rate Threshold</span>
                    <span className="font-mono font-bold text-white">Trigger at &gt; {bounceThreshold}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1.0"
                      max="15.0"
                      step="0.5"
                      value={bounceThreshold}
                      onChange={(e) => setBounceThreshold(Number(e.target.value))}
                      className="flex-1 accent-amber-400 cursor-pointer h-2 bg-[#161B1F] rounded-lg"
                    />
                    <div className="w-20">
                      <input
                        type="number"
                        min="0.5"
                        max="50.0"
                        step="0.5"
                        value={bounceThreshold}
                        onChange={(e) => setBounceThreshold(Number(e.target.value))}
                        className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg px-2 py-1.5 text-center font-mono font-bold text-sm text-white focus:outline-none focus:border-white"
                      />
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-[#8E9BA8]">Presets:</span>
                    {[
                      { label: "3.0% (Strict)", val: 3.0 },
                      { label: "5.0% (Recommended)", val: 5.0 },
                      { label: "8.0%", val: 8.0 },
                      { label: "10.0%", val: 10.0 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setBounceThreshold(p.val)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-md border transition-all cursor-pointer",
                          bounceThreshold === p.val
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold"
                            : "bg-[#161B1F] border-[#2C353D] text-[#8E9BA8] hover:text-white"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto Pause Toggle */}
                <div className="p-4 bg-[#161B1F] border border-[#2C353D] rounded-lg flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-white">
                      Auto-Pause Active Campaigns
                    </div>
                    <p className="text-xs text-[#8E9BA8]">
                      When enabled, if a campaign's bounce rate surpasses <strong>{bounceThreshold}%</strong> (after 10+ attempts), ReachEngine instantly sets the campaign status to <code>paused</code> and issues a critical deliverability alert.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={bounceAutoPause}
                    onChange={(e) => setBounceAutoPause(e.target.checked)}
                    className="w-5 h-5 accent-amber-400 rounded cursor-pointer mt-1"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleSaveSettings("Bounce Alerts")}
                    disabled={saving}
                    className="bg-amber-400 hover:bg-amber-300 text-[#161B1F] font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Alert Settings
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Best Practices & Deliverability Telemetry */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#1C2227] border border-[#2C353D] rounded-xl p-6 space-y-4">
              <div className="font-bold flex items-center gap-2 text-amber-300 text-sm">
                <Shield className="w-4 h-4" />
                Industry Standard: Keep Bounce Rate Under 5%
              </div>
              <p className="text-xs text-[#8E9BA8] leading-relaxed">
                Major inbox providers (Google Workspace, Microsoft 365, Yahoo) start flagging sending domains and warmup pools when bounce rates cross 3% – 5%. Auto-pausing high-bounce campaigns protects your identities from being permanently blacklisted.
              </p>

              <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-lg space-y-2.5 text-xs">
                <div className="font-semibold text-amber-300">Auto-Protection Benefits:</div>
                <ul className="list-disc pl-4 space-y-1 text-amber-200/80">
                  <li>Halts high-bounce batches before SMTP blacklisting occurs.</li>
                  <li>Auto-marks invalid recipients directly into suppression lists.</li>
                  <li>Protects other warmup identities in rotating groups.</li>
                </ul>
              </div>

              <div className="p-3 bg-[#161B1F] border border-[#2C353D] rounded-lg text-[11px] text-[#8E9BA8] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Auto-Pause Guardrail: <strong>{bounceAutoPause ? "Active" : "Disabled"}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
