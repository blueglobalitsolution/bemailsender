import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Wand2, User, Users, FileText, Settings, ArrowRight, ArrowLeft, Upload, CheckCircle, Loader2, X, Clock, AlertCircle, Shield, ShieldCheck, ShieldAlert, Globe, Calendar, Shuffle, Target, Sparkles, Eye } from "lucide-react";
import { apiFetch, getApiUrl } from "../lib/api";
import { useToast } from "../components/Toast";
import TemplateValidationPanel, { ValidationResult } from "../components/TemplateValidationPanel";

export default function Wizard() {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [identities, setIdentities] = useState<any[]>([]);
  const [identityGroups, setIdentityGroups] = useState<any[]>([]);
  const [savedCsvs, setSavedCsvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);

  const stripHtml = (html: string) => {
    if (!html) return "";
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Form State
  const [campaignName, setCampaignName] = useState("");
  const campaignType = 'email';
  const [identityId, setIdentityId] = useState("");
  const [identityGroupId, setIdentityGroupId] = useState("");
  const [senderMode, setSenderMode] = useState<'single' | 'group'>('single');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [savedCsvId, setSavedCsvId] = useState("");
  const [showSavedList, setShowSavedList] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(45);
  const delayMs = (delaySeconds * 1000).toString();
  
  // Advanced Scheduling State
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [timezone, setTimezone] = useState("UTC+05:30 (Asia/Kolkata - IST)");
  const [humanJitter, setHumanJitter] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(250);
  const [enableDailyLimit, setEnableDailyLimit] = useState(false);
  const [launchDate, setLaunchDate] = useState("");

  // CSV rows state (parsed client-side)
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [removedEmails, setRemovedEmails] = useState<string[]>([]);

  // CSV scan results
  const [scanning, setScanning] = useState(false);
  const [checkGravatar, setCheckGravatar] = useState(false);
  const [scanData, setScanData] = useState<{
    results: { email: string; valid: boolean; flags: string[]; reason?: string; warning?: string; bounce_count?: number }[];
    stats: {
      total: number;
      valid: number;
      disposable: number;
      bounced: number;
      invalid: number;
      gravatar?: number;
      duplicates?: number;
      cooldown?: number;
      cooldown_days?: number;
      suppressed?: number;
      will_send?: number;
    };
    active_campaign?: { id: number; name: string; status: string } | null;
  } | null>(null);
  const [allowRepeat, setAllowRepeat] = useState(false);

  // Progress modal state
  const [showProgress, setShowProgress] = useState(false);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [progress, setProgress] = useState<any>(null);
  const [countdown, setCountdown] = useState(0);
  const [progressLogs, setProgressLogs] = useState<any[]>([]);
  const [templateValidation, setTemplateValidation] = useState<ValidationResult | null>(null);
  const progressInterval = useRef<any>(null);
  const countdownInterval = useRef<any>(null);
  const delayRef = useRef(45);

  useEffect(() => {
    apiFetch('/api/templates/?type=email')
      .then((res) => res.json())
      .then((data) => setTemplates(data));

    apiFetch("/api/identities/")
      .then((res) => res.json())
      .then((data) => setIdentities(data));
    apiFetch("/api/identity-groups/")
      .then((res) => res.json())
      .then((data) => setIdentityGroups(data));
    apiFetch("/api/saved-csvs/")
      .then((res) => res.json())
      .then((data) => setSavedCsvs(data));
  }, []);

  const handleNext = () => {
    if (step === 1) {
      if (!identityId && !identityGroupId) {
        toast.error("Please select a Sender Identity or Identity Group");
        return;
      }
    }
    if (step === 2) {
      if (!csvFile && !savedCsvId) {
        toast.error("Please upload or select an audience CSV");
        return;
      }
    }
    if (step === 3) {
      if (!templateId) {
        toast.error("Please select an Email Template to continue");
        return;
      }
    }
    setStep((s) => Math.min(s + 1, 4));
  };
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

  const pollProgress = async (id: number) => {
    try {
      const res = await apiFetch(`/api/campaigns/${id}/progress/`);
      if (!res.ok) {
        if (progressInterval.current) clearInterval(progressInterval.current);
        return;
      }
      const data = await res.json();
      setProgress(data);
      if (data.logs) {
        setProgressLogs(data.logs);
      }
      if (data.delay_ms) {
        delayRef.current = Math.floor(data.delay_ms / 1000);
      }
      // Initialize countdown when running with pending emails
      if (data.status === "running" && data.pending > 0) {
        setCountdown((prev) => (prev <= 0 ? delayRef.current : prev));
      }
      // Stop polling when done
      if (data.status === "completed" || data.status === "failed") {
        if (progressInterval.current) clearInterval(progressInterval.current);
        setCountdown(0);
      }
    } catch (err) {
      console.error(err);
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
  };

  const handleScan = async () => {
    if (!csvFile && !savedCsvId) return;
    setScanning(true);
    setScanData(null);
    setRemovedEmails([]);
    setAllowRepeat(false);
    try {
      if (savedCsvId) {
        const res = await apiFetch("/api/campaigns/scan-csv/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ savedCsvId, gravatar: checkGravatar }),
        });
        const data = await res.json();
        if (res.ok) {
          setScanData(data);
          toast.success("CSV scan completed.");
        } else {
          toast.error(data.error || "Scan failed");
        }
      } else if (csvFile) {
        const formData = new FormData();
        formData.append("csv", csvFile);
        if (checkGravatar) formData.append("gravatar", "true");
        const res = await apiFetch("/api/campaigns/scan-csv/", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          setScanData(data);
          toast.success("CSV scan completed.");
        } else {
          toast.error(data.error || "Scan failed");
        }
      }
    } catch (err) {
      toast.error("Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const removeEmail = (email: string) => {
    setRemovedEmails((prev) => [...prev, email]);
  };

  const removeAllInvalid = () => {
    if (!scanData) return;
    const toRemove = scanData.results.filter((r) => !r.valid).map((r) => r.email);
    setRemovedEmails((prev) => [...new Set([...prev, ...toRemove])]);
  };

  const removeAllBounced = () => {
    if (!scanData) return;
    const toRemove = scanData.results.filter((r) => r.flags.includes("bounced")).map((r) => r.email);
    setRemovedEmails((prev) => [...new Set([...prev, ...toRemove])]);
  };

  const getWillSendCount = () => {
    if (!scanData) return csvRows.length - removedEmails.length;
    return scanData.results.filter(
      (r) =>
        r.valid &&
        !r.flags.includes("duplicate") &&
        !r.flags.includes("suppressed") &&
        (!r.flags.includes("cooldown") || allowRepeat) &&
        !removedEmails.includes(r.email)
    ).length;
  };

  const handleSubmit = async (force = false) => {
    if ((!csvFile && !savedCsvId) || !templateId || (!identityId && !identityGroupId)) {
      toast.error("Please fill all required fields");
      return;
    }

    if (scanData && getWillSendCount() === 0) {
      toast.error("No recipients will be sent after duplicate/cooldown checks. Adjust the CSV or cooldown override.");
      return;
    }

    if (!force) {
      try {
        const vres = await apiFetch("/api/templates/validate/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template_id: templateId }),
        });
        const vdata = await vres.json();
        if (vres.ok) {
          setTemplateValidation(vdata);
          if (!vdata.ok) {
            toast.error(`Template has ${vdata.summary.errors} blocking issue(s). Fix them before launching.`);
            return;
          }
          if (vdata.summary?.warnings) {
            toast.warning(`Template has ${vdata.summary.warnings} warning(s). Review before launching.`);
          }
        }
      } catch (err) {
        console.error("Template validation failed:", err);
      }
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("name", campaignName || `Campaign ${new Date().toLocaleDateString()}`);
    formData.append("type", "email");
    formData.append("templateId", templateId);
    formData.append("identityId", identityId);
    formData.append("identityGroupId", identityGroupId);
    formData.append("delayMs", delayMs);
    formData.append("scheduleDays", isScheduled ? JSON.stringify(scheduleDays) : "[]");
    formData.append("startTime", isScheduled ? startTime : "");
    formData.append("endTime", isScheduled ? endTime : "");
    formData.append("force", force ? "true" : "false");
    formData.append("allowRepeat", allowRepeat ? "true" : "false");
    if (isScheduled) {
      formData.append("timezone", timezone);
      formData.append("humanJitter", humanJitter ? "true" : "false");
      if (enableDailyLimit) formData.append("dailyLimit", dailyLimit.toString());
      if (launchDate) formData.append("launchDate", launchDate);
    }
    if (csvRows.length > 0 && removedEmails.length > 0) {
      const remainingRows = csvRows.filter((row) => !removedEmails.includes(row["email"] || row["recipient"] || ""));
      if (remainingRows.length > 0 && remainingRows.length < csvRows.length) {
        const headerLine = csvHeaders.join(",") + "\n";
        const csvString = headerLine + remainingRows.map((row) => csvHeaders.map((h) => row[h] || "").join(",")).join("\n");
        formData.append("csv", new Blob([csvString], { type: "text/csv" }), csvFile?.name || "campaign.csv");
      } else {
        formData.append("csv", csvFile || new Blob());
      }
    } else if (csvFile) {
      formData.append("csv", csvFile);
    }
    if (savedCsvId) {
      formData.append("savedCsvId", savedCsvId);
    }
    // Applies removals from the scan UI even when using a saved CSV, where the
    // client does not have the raw rows available.
    formData.append("removedEmails", JSON.stringify(removedEmails));

    try {
      const res = await apiFetch("/api/campaigns/send/", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        if (data.queued) {
          toast.info(
            `Campaign queued behind campaign #${data.queuedBehindCampaignId ?? data.runningCampaignId} (${data.queuedBehindStatus || "active"}). It will start after that campaign finishes.`
          );
        }
        if (data.summary) {
          const summary = data.summary;
          toast.info(
            `${summary.pending} will be sent · ${summary.cooldown_skipped} cooldown skips · ${summary.suppressed_skipped} suppressed · ${summary.duplicate_rows_skipped} duplicate rows removed`
          );
        }
        setCampaignId(data.campaignId);
        setShowProgress(true);
        setProgressLogs([]);
        // Start polling
        if (progressInterval.current) clearInterval(progressInterval.current);
        progressInterval.current = setInterval(() => pollProgress(data.campaignId), 2000);
      } else {
        if (data.validation) setTemplateValidation(data.validation);
        toast.error(data.error || "Failed to start campaign");
      }
    } catch (err) {
      toast.error("An error occurred while launching campaign");
    } finally {
      setLoading(false);
    }
  };

  // Countdown timer: ticks down every second, resets via delayRef
  useEffect(() => {
    if (!showProgress) return;
    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return delayRef.current;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [showProgress]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, []);

  const steps = [
    { id: 1, title: "Identity", icon: User },
    { id: 2, title: "Audience", icon: Users },
    { id: 3, title: "Creative", icon: FileText },
    { id: 4, title: "Governance", icon: Settings },
  ];

  return (
    <div className="w-full space-y-8">

      {/* Stepper Progress Bar */}
      <div className="bg-[#222930] border border-[#2C353D] rounded-xl p-6">
        <div className="flex justify-between items-center relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-[#1C2227] -z-10"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-white -z-10 transition-all duration-300"
            style={{ width: `${((step - 1) / 3) * 100}%` }}></div>

          {steps.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-2 px-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                step >= s.id 
                  ? 'bg-white text-[#161B1F] font-bold shadow-sm' 
                  : 'bg-[#1C2227] text-[#8E9BA8] border border-[#2C353D]'
              }`}>
                <s.icon className="w-4 h-4" />
              </div>
              <span className={`text-[11px] font-sans font-semibold uppercase tracking-wider ${
                step >= s.id ? 'text-white' : 'text-[#8E9BA8]'
              }`}>{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-[#222930] border border-[#2C353D] rounded-xl p-6 md:p-8 min-h-[400px]">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Configure Email Identity</h3>
              <p className="text-[#8E9BA8] text-xs mb-6">Choose your sender identity or rotation pool.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#8E9BA8] mb-2 font-semibold">Campaign Name (Optional)</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full bg-[#1C2227] border border-[#2C353D] rounded-lg py-2.5 px-4 text-white text-xs placeholder-[#8E9BA8] focus:outline-none focus:border-[#CBD5E1]"
                  placeholder="e.g., Q3 Outreach"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#8E9BA8] mb-2 font-semibold">Select Sender Mode</label>
                <div className="flex gap-1.5 bg-[#1C2227] border border-[#2C353D] rounded-lg p-1 w-full max-w-sm mb-4">
                  <button
                    type="button"
                    onClick={() => { setSenderMode('single'); setIdentityGroupId(""); }}
                    className={`px-4 py-2 text-xs font-semibold rounded-md transition-all flex-1 cursor-pointer ${
                      senderMode === 'single'
                        ? 'bg-white text-[#161B1F] shadow-sm'
                        : 'text-[#8E9BA8] hover:text-white'
                    }`}
                  >
                    Single Identity
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSenderMode('group'); setIdentityId(""); }}
                    className={`px-4 py-2 text-xs font-semibold rounded-md transition-all flex-1 cursor-pointer ${
                      senderMode === 'group'
                        ? 'bg-white text-[#161B1F] shadow-sm'
                        : 'text-[#8E9BA8] hover:text-white'
                    }`}
                  >
                    Identity Group
                  </button>
                </div>

                {senderMode !== 'group' ? (
                  <>
                    <p className="text-xs text-[#8E9BA8] mb-3">Choose a single sender identity.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {identities.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-[#8E9BA8] bg-[#1C2227] border border-[#2C353D] rounded-lg text-xs">
                          No identities found. <a href="/identities" className="text-sky-400 hover:underline">Add one here</a>.
                        </div>
                      ) : (
                        identities.map((identity) => (
                          <div
                            key={identity.id}
                            onClick={() => { setSenderMode('single'); setIdentityId(identity.id.toString()); setIdentityGroupId(""); }}
                            className={`p-4 rounded-lg cursor-pointer transition-all border ${
                              identityId === identity.id.toString()
                                ? 'bg-[#29323A] border-white/60 shadow-sm ring-1 ring-white/20'
                                : 'bg-[#1C2227] border-[#2C353D] hover:border-[#4A5866]'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold text-sm text-white">{identity.name}</h4>
                              {identityId === identity.id.toString() && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                            </div>
                            <p className="text-xs text-[#CBD5E1] truncate">{identity.smtp_user}</p>
                            <p className="text-[11px] font-mono text-[#8E9BA8] mt-1">{identity.host}:{identity.port}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-[#8E9BA8] mb-3">Choose an identity group for automatic rotation across multiple senders.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {identityGroups.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-[#8E9BA8] bg-[#1C2227] border border-[#2C353D] rounded-lg text-xs">
                          No identity groups found. <a href="/identities" className="text-sky-400 hover:underline font-semibold">Create one here</a>.
                        </div>
                      ) : (
                        identityGroups.map((group) => (
                          <div
                            key={group.id}
                            onClick={() => { setSenderMode('group'); setIdentityGroupId(group.id.toString()); setIdentityId(""); }}
                            className={`p-4 rounded-lg cursor-pointer transition-all border ${
                              identityGroupId === group.id.toString()
                                ? 'bg-[#29323A] border-white/60 shadow-sm ring-1 ring-white/20'
                                : 'bg-[#1C2227] border-[#2C353D] hover:border-[#4A5866]'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold text-sm text-white">{group.name}</h4>
                              {identityGroupId === group.id.toString() && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                            </div>
                            <p className="text-xs text-[#CBD5E1]">{group.identities?.length || 0} identities</p>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Import Audience</h3>
              <p className="text-[#8E9BA8] text-xs mb-6">Upload a CSV file or select a previously saved one.</p>
            </div>

            <div className="flex gap-1.5 bg-[#1C2227] border border-[#2C353D] rounded-lg p-1 w-full max-w-sm mb-4">
              <button
                type="button"
                onClick={() => { setSavedCsvId(""); setShowSavedList(false); setCsvFile(null); setScanData(null); setCsvRows([]); }}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-all flex-1 cursor-pointer ${
                  !showSavedList 
                    ? 'bg-white text-[#161B1F] shadow-sm' 
                    : 'text-[#8E9BA8] hover:text-white'
                }`}
              >
                Upload CSV
              </button>
              <button
                type="button"
                onClick={() => { setShowSavedList(true); setCsvFile(null); setScanData(null); setCsvRows([]); }}
                className={`px-4 py-2 text-xs font-semibold rounded-md transition-all flex-1 cursor-pointer ${
                  showSavedList 
                    ? 'bg-white text-[#161B1F] shadow-sm' 
                    : 'text-[#8E9BA8] hover:text-white'
                }`}
              >
                Saved CSV
              </button>
            </div>

            {!showSavedList ? (
              <div className="bg-[#1C2227] border-2 border-dashed border-[#2C353D] hover:border-[#CBD5E1] rounded-xl p-10 text-center transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setCsvFile(file);
                    setScanData(null);
                    setRemovedEmails([]);
                    setCsvRows([]);
                    setCsvHeaders([]);
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const text = ev.target?.result as string;
                        const lines = text.split("\n").filter((l) => l.trim());
                        if (lines.length > 0) {
                          const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
                          setCsvHeaders(headers);
                          const rows = lines.slice(1).map((line) => {
                            const vals = line.split(",").map((v) => v.trim());
                            const row: Record<string, string> = {};
                            headers.forEach((h, i) => { row[h] = vals[i] || ""; });
                            return row;
                          }).filter((r) => r["email"] || r["recipient"] || Object.values(r).some((v) => v.includes("@")));
                          setCsvRows(rows);
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-10 h-10 text-[#8E9BA8] mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-white mb-1">Click to upload or drag and drop</h4>
                <p className="text-xs text-[#8E9BA8] font-mono">CSV files only</p>

                {csvFile && (
                  <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3.5 py-1.5 text-xs font-mono rounded-md border border-emerald-500/20">
                    <CheckCircle className="w-3.5 h-3.5" /> {csvFile.name} ({csvRows.length} contacts)
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-xs uppercase tracking-wider text-[#8E9BA8] mb-2 font-semibold">Select Saved CSV</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedCsvs.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-[#8E9BA8] bg-[#1C2227] border border-[#2C353D] rounded-lg text-xs">
                      No leads found. <a href="/saved-csvs" className="text-sky-400 hover:underline font-semibold">Upload one here</a>.
                    </div>
                  ) : (
                    savedCsvs.map((scsv) => (
                      <div
                        key={scsv.id}
                        onClick={() => {
                          setSavedCsvId(scsv.id.toString());
                          setScanData(null);
                          setRemovedEmails([]);
                          setCsvHeaders(scsv.columns || []);
                          setCsvRows([]);
                        }}
                        className={`p-4 rounded-lg cursor-pointer transition-all border ${
                          savedCsvId === scsv.id.toString()
                            ? 'bg-[#29323A] border-white/60 shadow-sm ring-1 ring-white/20'
                            : 'bg-[#1C2227] border-[#2C353D] hover:border-[#4A5866]'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-sm text-white">{scsv.name}</h4>
                          {savedCsvId === scsv.id.toString() && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <p className="text-xs text-[#CBD5E1]">{scsv.row_count} contacts</p>
                        <p className="text-[11px] text-[#8E9BA8] mt-1 font-mono">Uploaded {new Date(scsv.created_at).toLocaleDateString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {(csvFile || (showSavedList && savedCsvId)) && (
              <div className="space-y-4">
                <div className="bg-[#1C2227] border border-[#2C353D] rounded-lg p-4 flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checkGravatar}
                      onChange={(e) => setCheckGravatar(e.target.checked)}
                      className="w-4 h-4 bg-[#14181C] border-[#2C353D] rounded text-white focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">Check Gravatar profile</span>
                      <span className="text-[11px] text-[#8E9BA8]">Verify profile existence and avatar presence during scan</span>
                    </div>
                  </label>
                </div>

                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold rounded-lg px-5 py-2.5 text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                  {scanning ? "Scanning..." : "Scan CSV"}
                </button>

                {scanData && (
                  <div className="space-y-4">
                    {/* Stats summary */}
                    <div className="flex flex-wrap gap-2 text-xs font-mono">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 rounded-md">
                        <CheckCircle className="w-3.5 h-3.5" /> {scanData.stats.valid} Safe
                      </span>
                      {scanData.stats.gravatar > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/40 border border-purple-500/30 text-purple-400 rounded-md">
                          <CheckCircle className="w-3.5 h-3.5" /> {scanData.stats.gravatar} Gravatar
                        </span>
                      )}
                      {scanData.stats.disposable > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/40 border border-amber-500/30 text-amber-400 rounded-md">
                          <AlertCircle className="w-3.5 h-3.5" /> {scanData.stats.disposable} Disposable
                        </span>
                      )}
                      {scanData.stats.bounced > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-950/40 border border-sky-500/30 text-sky-400 rounded-md">
                          <X className="w-3.5 h-3.5" /> {scanData.stats.bounced} Bounced
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 border border-rose-500/30 text-rose-400 rounded-md">
                        <X className="w-3.5 h-3.5" /> {scanData.stats.invalid} Invalid
                      </span>
                      {(scanData.stats.cooldown || 0) > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/40 border border-amber-500/30 text-amber-400 rounded-md">
                          <Clock className="w-3.5 h-3.5" /> {scanData.stats.cooldown} Cooldown
                        </span>
                      )}
                      {(scanData.stats.suppressed || 0) > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 border border-rose-500/30 text-rose-400 rounded-md">
                          <ShieldAlert className="w-3.5 h-3.5" /> {scanData.stats.suppressed} Suppressed
                        </span>
                      )}
                      {(scanData.stats.duplicates || 0) > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 border border-slate-500/30 text-slate-300 rounded-md">
                          <X className="w-3.5 h-3.5" /> {scanData.stats.duplicates} Duplicates
                        </span>
                      )}
                      {removedEmails.length > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1C2227] border border-[#2C353D] text-[#8E9BA8] rounded-md">
                          🗑️ {removedEmails.length} Removed
                        </span>
                      )}
                    </div>

                    {/* Remaining count */}
                    <div className="bg-[#1C2227] border border-[#2C353D] rounded-lg p-3 text-center">
                      <span className="text-xs font-mono text-[#CBD5E1]">
                        <strong className="text-white">{getWillSendCount()}</strong> of {scanData.stats.total} contacts will be sent
                        {(scanData.stats.duplicates || 0) > 0 && (
                          <span className="text-[#8E9BA8]"> · {scanData.stats.duplicates} duplicate row(s) ignored</span>
                        )}
                      </span>
                    </div>

                    {/* Account-level queue warning */}
                    {scanData.active_campaign && (
                      <div className="bg-sky-950/30 border border-sky-500/30 rounded-lg p-3 text-[11px] font-mono text-sky-300">
                        <strong>Queued:</strong> campaign #{scanData.active_campaign.id} “{scanData.active_campaign.name}” is already {scanData.active_campaign.status === "running" ? "running" : "scheduled"} for this account.
                        This campaign will start after it completes.
                      </div>
                    )}

                    {/* Cooldown warning + override */}
                    {(scanData.stats.cooldown || 0) > 0 && (
                      <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 space-y-2">
                        <p className="text-[11px] font-mono text-amber-300">
                          <strong>{scanData.stats.cooldown}</strong> recipient(s) were already emailed by this account within the last {scanData.stats.cooldown_days ?? 30} day(s).
                          Server will skip them unless you override below.
                        </p>
                        <label className="flex items-start gap-2 text-[11px] font-mono text-amber-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowRepeat}
                            onChange={(e) => setAllowRepeat(e.target.checked)}
                            className="mt-0.5 accent-amber-500"
                          />
                          <span>Send to already-contacted recipients anyway (override cooldown)</span>
                        </label>
                      </div>
                    )}

                    {/* Duplicate rows */}
                    {(scanData.stats.duplicates || 0) > 0 && (
                      <div className="bg-[#1C2227] border border-slate-700/50 rounded-lg p-4">
                        <h4 className="font-mono text-xs font-bold text-slate-300 mb-2">
                          Duplicate rows ({scanData.stats.duplicates})
                        </h4>
                        <p className="text-[10px] font-mono text-[#8E9BA8] mb-2">
                          Only the first occurrence of each email will be sent. These rows are automatically ignored.
                        </p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {scanData.results.filter((r) => r.flags.includes("duplicate")).map((r, i) => (
                            <div key={i} className="text-[11px] font-mono text-slate-400 truncate">
                              {r.email}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suppressed list */}
                    {(scanData.stats.suppressed || 0) > 0 && (
                      <div className="bg-[#1C2227] border border-rose-950/50 rounded-lg p-4">
                        <h4 className="font-mono text-xs font-bold text-rose-400 mb-2 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" /> Suppressed recipients ({scanData.stats.suppressed})
                        </h4>
                        <p className="text-[10px] font-mono text-[#8E9BA8] mb-2">
                          These are on your unsubscribe/bounce suppression list. The server will always skip them.
                        </p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {scanData.results.filter((r) => r.flags.includes("suppressed")).map((r, i) => (
                            <div key={i} className="text-[11px] font-mono text-rose-300 truncate">
                              {r.email}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cooldown list */}
                    {(scanData.stats.cooldown || 0) > 0 && (
                      <div className="bg-[#1C2227] border border-amber-950/50 rounded-lg p-4">
                        <h4 className="font-mono text-xs font-bold text-amber-400 mb-2">
                          Already contacted ({scanData.stats.cooldown})
                        </h4>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {scanData.results.filter((r) => r.flags.includes("cooldown")).map((r, i) => (
                            <div key={i} className="text-[11px] font-mono text-amber-300 truncate">
                              {r.email} <span className="text-amber-500">— {r.warning}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Invalid emails - with delete */}
                    {scanData.results.filter((r) => !r.valid).length > 0 && (
                      <div className="bg-[#1C2227] border border-rose-950/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-mono text-xs font-bold text-rose-400">Invalid ({scanData.stats.invalid})</h4>
                          <button
                            onClick={removeAllInvalid}
                            className="text-[11px] font-mono text-rose-400 hover:text-white bg-rose-950/40 border border-rose-900/50 hover:bg-rose-900/60 px-2.5 py-1 rounded transition-all cursor-pointer"
                          >
                            🗑️ Remove All
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5">
                          {scanData.results.filter((r) => !r.valid).map((r, i) => (
                            <div key={i} className="text-xs font-mono flex items-center gap-2 p-2 bg-[#14181C] border border-[#2C353D] rounded text-rose-300">
                              <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span className="truncate flex-1">{r.email} <span className="text-rose-500">— {r.reason}</span></span>
                              {!removedEmails.includes(r.email) && (
                                <button onClick={() => removeEmail(r.email)} className="text-rose-400 hover:text-rose-200 px-1.5 py-0.5 cursor-pointer">🗑️</button>
                              )}
                              {removedEmails.includes(r.email) && <span className="text-emerald-400 text-[10px]">✓ Removed</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bounced emails - with delete */}
                    {scanData.results.filter((r) => r.flags.includes("bounced") && r.valid).length > 0 && (
                      <div className="bg-[#1C2227] border border-sky-950/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-mono text-xs font-bold text-sky-400">Previously Bounced ({scanData.stats.bounced})</h4>
                          <button
                            onClick={removeAllBounced}
                            className="text-[11px] font-mono text-sky-400 hover:text-white bg-sky-950/40 border border-sky-900/50 hover:bg-sky-900/60 px-2.5 py-1 rounded transition-all cursor-pointer"
                          >
                            🗑️ Remove All
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5">
                          {scanData.results.filter((r) => r.flags.includes("bounced") && r.valid).map((r, i) => (
                            <div key={i} className="text-xs font-mono flex items-center gap-2 p-2 bg-[#14181C] border border-[#2C353D] rounded text-sky-300">
                              <X className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span className="truncate flex-1">{r.email} <span className="text-sky-500">(bounced {r.bounce_count}x)</span></span>
                              {!removedEmails.includes(r.email) && (
                                <button onClick={() => removeEmail(r.email)} className="text-sky-400 hover:text-sky-200 px-1.5 py-0.5 cursor-pointer">🗑️</button>
                              )}
                              {removedEmails.includes(r.email) && <span className="text-emerald-400 text-[10px]">✓ Removed</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Disposable warning */}
                    {scanData.results.filter((r) => r.flags.includes("disposable")).length > 0 && (
                      <div className="bg-[#1C2227] border border-amber-950/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-mono text-xs font-bold text-amber-400">Disposable ({scanData.stats.disposable})</h4>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1.5">
                          {scanData.results.filter((r) => r.flags.includes("disposable")).map((r, i) => (
                            <div key={i} className="text-xs font-mono flex items-center gap-2 p-2 bg-[#14181C] border border-[#2C353D] rounded text-amber-300">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="truncate flex-1">{r.email} <span className="text-amber-500">— {r.warning}</span></span>
                              {!removedEmails.includes(r.email) && (
                                <button onClick={() => removeEmail(r.email)} className="text-amber-400 hover:text-amber-200 px-1.5 py-0.5 cursor-pointer">🗑️</button>
                              )}
                              {removedEmails.includes(r.email) && <span className="text-emerald-400 text-[10px]">✓ Removed</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Select Creative</h3>
              <p className="text-[#8E9BA8] text-xs mb-6">Choose an email template from your Script Architect library.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates.length === 0 ? (
                <div className="col-span-full text-center py-12 text-[#8E9BA8] bg-[#1C2227] border border-[#2C353D] rounded-lg text-xs">
                  No email templates found. Please create one in Script Architect first.
                </div>
              ) : (
                templates.map((t) => {
                  const isSelected = templateId === t.id.toString();
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setTemplateId(t.id.toString());
                        toast.success(`Selected template: ${t.name}`);
                      }}
                      className={`p-5 cursor-pointer transition-all border relative flex flex-col justify-between group rounded-lg ${
                        isSelected
                          ? 'bg-[#29323A] border-white/60 shadow-sm ring-1 ring-white/20'
                          : 'bg-[#1C2227] border-[#2C353D] hover:border-[#4A5866]'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <h4 className="font-bold text-sm text-white line-clamp-1" title={t.name}>
                            {t.name}
                          </h4>
                          {isSelected && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </div>
                        {t.subject && (
                          <p className="text-xs text-[#CBD5E1] font-medium mb-3 line-clamp-1" title={t.subject}>
                            <span className="text-[#8E9BA8]">Subject:</span> {t.subject}
                          </p>
                        )}
                        <p className="text-xs text-[#8E9BA8] line-clamp-3 leading-relaxed mb-4">
                          {stripHtml(t.body) || "No plain text excerpt available."}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[#2C353D] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTemplateId(t.id.toString());
                            toast.success(`Selected template: ${t.name}`);
                          }}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-white text-[#161B1F] font-bold shadow-sm'
                              : 'bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white border border-[#2C353D]'
                          }`}
                        >
                          <CheckCircle className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-600' : 'text-[#8E9BA8]'}`} />
                          {isSelected ? 'Selected' : 'Select'}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTemplate(t);
                          }}
                          className="text-xs font-medium text-[#CBD5E1] hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-[#222930] hover:bg-[#2C353D] border border-[#2C353D] rounded-md transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Governance & Control</h3>
              <p className="text-[#8E9BA8] text-xs mb-6">Set delivery pacing, sending schedules, and throttling limits.</p>
            </div>
            
            <div className="bg-[#1C2227] border border-[#2C353D] rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-bold text-sm text-white">Traffic Control</h4>
                  <p className="text-xs text-[#8E9BA8]">Set custom delay between consecutive emails to control delivery speed & protect sender reputation.</p>
                </div>
                <div className="flex items-center gap-1.5 bg-[#222930] border border-[#2C353D] px-3 py-1.5 rounded-md">
                  <span className="font-mono text-sm font-bold text-white">{delaySeconds}</span>
                  <span className="text-[11px] font-mono text-[#8E9BA8]">sec</span>
                </div>
              </div>

              {/* Slider & Quick Presets */}
              <div className="space-y-4 pt-2">
                <input
                  type="range"
                  min="5"
                  max="180"
                  step="5"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="w-full accent-white cursor-pointer h-1.5 bg-[#2C353D] rounded-lg"
                />

                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] uppercase tracking-wider text-[#8E9BA8] font-semibold">Presets:</span>
                    {[
                      { label: "15s (Fast)", val: 15 },
                      { label: "30s (Balanced)", val: 30 },
                      { label: "45s (Recommended)", val: 45 },
                      { label: "60s (Safe)", val: 60 },
                      { label: "90s (High Safety)", val: 90 },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setDelaySeconds(preset.val)}
                        className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-all cursor-pointer border ${
                          delaySeconds === preset.val
                            ? "bg-white text-[#161B1F] border-white font-bold"
                            : "bg-[#222930] border-[#2C353D] text-[#8E9BA8] hover:text-white"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="text-[11px] font-mono text-[#8E9BA8]">
                    {delaySeconds < 25 ? (
                      <span className="text-amber-400">⚡ Faster pacing</span>
                    ) : (
                      <span className="text-emerald-400">🛡️ Optimal inbox deliverability</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#1C2227] border border-[#2C353D] rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-400" /> Campaign Schedule
                  </h4>
                  <p className="text-xs text-[#8E9BA8] mt-1">Automate delivery windows, timezones, and daily throttling limits.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-[#222930] border border-[#2C353D] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {isScheduled && (
                <div className="space-y-6 pt-5 border-t border-[#2C353D] animate-in fade-in duration-300">
                  {/* Timezone & Launch Date */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-[#8E9BA8] mb-2 font-semibold flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-sky-400" /> Target Timezone
                      </label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full bg-[#222930] border border-[#2C353D] rounded-md py-2 px-3 text-xs text-white focus:outline-none focus:border-[#CBD5E1] font-mono cursor-pointer"
                      >
                        <option value="UTC+05:30 (Asia/Kolkata - IST)">UTC+05:30 (Asia/Kolkata - IST)</option>
                        <option value="UTC-05:00 (America/New_York - EST)">UTC-05:00 (America/New_York - EST)</option>
                        <option value="UTC-08:00 (America/Los_Angeles - PST)">UTC-08:00 (America/Los_Angeles - PST)</option>
                        <option value="UTC-06:00 (America/Chicago - CST)">UTC-06:00 (America/Chicago - CST)</option>
                        <option value="UTC+00:00 (Europe/London - GMT)">UTC+00:00 (Europe/London - GMT)</option>
                        <option value="UTC+01:00 (Europe/Paris - CET)">UTC+01:00 (Europe/Paris - CET)</option>
                        <option value="UTC+04:00 (Asia/Dubai - GST)">UTC+04:00 (Asia/Dubai - GST)</option>
                        <option value="UTC+08:00 (Asia/Singapore - SGT)">UTC+08:00 (Asia/Singapore - SGT)</option>
                        <option value="UTC+10:00 (Australia/Sydney - AEST)">UTC+10:00 (Australia/Sydney - AEST)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-[#8E9BA8] mb-2 font-semibold flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-sky-400" /> Launch Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={launchDate}
                        onChange={(e) => setLaunchDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full bg-[#222930] border border-[#2C353D] rounded-md py-2 px-3 text-xs text-white focus:outline-none focus:border-[#CBD5E1] font-mono"
                      />
                    </div>
                  </div>

                  {/* Schedule Presets */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#8E9BA8] mb-2 font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" /> Schedule Presets
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleDays([1, 2, 3, 4, 5]);
                          setStartTime("09:00");
                          setEndTime("17:00");
                        }}
                        className="px-3 py-1.5 text-xs font-mono rounded-md border border-[#2C353D] bg-[#222930] hover:bg-[#29323A] text-[#CBD5E1] hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        💼 Standard Business (Mon-Fri 9AM-5PM)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleDays([1, 2, 3, 4]);
                          setStartTime("08:00");
                          setEndTime("11:30");
                        }}
                        className="px-3 py-1.5 text-xs font-mono rounded-md border border-[#2C353D] bg-[#222930] hover:bg-[#29323A] text-[#CBD5E1] hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        ⚡ Morning Outreach Peak (Mon-Thu 8AM-11:30AM)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleDays([0, 1, 2, 3, 4, 5, 6]);
                          setStartTime("00:00");
                          setEndTime("23:59");
                        }}
                        className="px-3 py-1.5 text-xs font-mono rounded-md border border-[#2C353D] bg-[#222930] hover:bg-[#29323A] text-[#CBD5E1] hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        🌐 24/7 Continuous
                      </button>
                    </div>
                  </div>

                  {/* Active Days */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#8E9BA8] mb-2 font-semibold">Active Days</label>
                    <div className="flex flex-wrap gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (scheduleDays.includes(index)) {
                              setScheduleDays(scheduleDays.filter(d => d !== index));
                            } else {
                              setScheduleDays([...scheduleDays, index]);
                            }
                          }}
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer border ${
                            scheduleDays.includes(index)
                              ? 'bg-white text-[#161B1F] border-white font-bold'
                              : 'bg-[#222930] text-[#8E9BA8] hover:text-white border-[#2C353D]'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Start and End Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-[#8E9BA8] mb-2 font-semibold">Start Time</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-[#222930] border border-[#2C353D] rounded-md py-2 px-3 text-white text-xs font-mono focus:outline-none focus:border-[#CBD5E1]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-[#8E9BA8] mb-2 font-semibold">End Time</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-[#222930] border border-[#2C353D] rounded-md py-2 px-3 text-white text-xs font-mono focus:outline-none focus:border-[#CBD5E1]"
                      />
                    </div>
                  </div>

                  {/* Jitter and Daily Limit */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="bg-[#222930] border border-[#2C353D] p-4 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Shuffle className="w-3.5 h-3.5 text-sky-400" />
                          <span className="text-xs font-semibold text-white">Humanized Variance</span>
                        </div>
                        <p className="text-[11px] text-[#8E9BA8] mt-0.5">Adds ±5 to 15s natural variance between sends.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={humanJitter}
                          onChange={(e) => setHumanJitter(e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-[#1C2227] border border-[#2C353D] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    <div className="bg-[#222930] border border-[#2C353D] p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-sky-400" />
                          <span className="text-xs font-semibold text-white">Daily Cap</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={enableDailyLimit}
                            onChange={(e) => setEnableDailyLimit(e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-[#1C2227] border border-[#2C353D] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                      {enableDailyLimit ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            min="10"
                            max="5000"
                            step="10"
                            value={dailyLimit}
                            onChange={(e) => setDailyLimit(Number(e.target.value))}
                            className="w-28 bg-[#1C2227] border border-[#2C353D] px-2.5 py-1 text-xs text-white font-mono rounded-md focus:outline-none focus:border-[#CBD5E1]"
                          />
                          <span className="text-[11px] text-[#8E9BA8]">max emails per day</span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#8E9BA8]">Automatically pauses once limit is reached and resumes next day.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrev}
          disabled={step === 1}
          className={`px-5 py-2.5 font-semibold rounded-lg flex items-center gap-2 transition-all text-xs cursor-pointer ${
            step === 1 
              ? 'text-[#8E9BA8]/40 border border-[#2C353D]/40 cursor-not-allowed opacity-40' 
              : 'bg-[#222930] hover:bg-[#29323A] text-[#CBD5E1] hover:text-white border border-[#2C353D]'
          }`}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {step < 4 ? (
          <button
            onClick={handleNext}
            className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold rounded-lg px-6 py-2.5 text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => handleSubmit()}
            disabled={loading}
            className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold rounded-lg px-7 py-2.5 text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Launching..." : "Launch Campaign"} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Pre-send validation modal */}
      {templateValidation && !templateValidation.ok && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#181E24] border border-[#2C353D] rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Template needs attention
              </h3>
              <button
                type="button"
                onClick={() => setTemplateValidation(null)}
                className="p-1.5 text-[#8E9BA8] hover:text-white rounded-lg hover:bg-[#222930] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <TemplateValidationPanel result={templateValidation} />

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTemplateValidation(null)}
                className="px-4 py-2 bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white rounded-lg text-xs font-semibold border border-[#2C353D] transition-all cursor-pointer"
              >
                Fix template first
              </button>
              <button
                type="button"
                onClick={() => {
                  setTemplateValidation(null);
                  void handleSubmit(true);
                }}
                className="px-5 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-lg text-xs font-bold border border-rose-500/30 transition-all cursor-pointer"
              >
                Launch anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgress && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#222930] border border-[#2C353D] rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
                {campaignName || "Campaign Execution"}
              </h3>
              <div className="flex items-center gap-2">
                {progress?.status === "running" && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 rounded-md animate-pulse">Running</span>
                )}
                {progress?.status === "completed" && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 rounded-md">Completed</span>
                )}
                {progress?.status === "scheduled" && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-sky-950/60 border border-sky-500/40 text-sky-400 rounded-md">Scheduled</span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {progress && (
              <div className="mb-4">
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-[#8E9BA8]">
                    {progress.sent + (progress.failed || 0) + (progress.skipped || 0)} of {progress.total} processed
                  </span>
                  <span className="font-bold text-white">
                    {progress.total > 0 ? Math.round((progress.sent + (progress.failed || 0) + (progress.skipped || 0)) / progress.total * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-[#1C2227] border border-[#2C353D] h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress.total > 0 ? Math.min((progress.sent + (progress.failed || 0) + (progress.skipped || 0)) / progress.total * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Countdown timer */}
            {(progress?.status === "running" || progress?.status === "scheduled") && progress?.pending > 0 && (
              <div className="bg-[#1C2227] border border-[#2C353D] rounded-lg p-4 mb-4 text-center">
                <div className="text-3xl font-bold text-white font-mono">
                  {countdown}s
                </div>
                <div className="text-[10px] font-mono text-[#8E9BA8] mt-1 uppercase tracking-wider">Next email in</div>
              </div>
            )}

            {/* Errors */}
            {progress?.failed > 0 && (
              <div className="bg-rose-950/30 border border-rose-900/50 text-rose-400 p-3 mb-4 text-xs font-mono rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {progress.failed} email{progress.failed > 1 ? 's' : ''} failed
              </div>
            )}

            {progress?.skipped > 0 && (
              <div className="bg-amber-950/30 border border-amber-900/50 text-amber-400 p-3 mb-4 text-xs font-mono rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {progress.skipped} email{progress.skipped > 1 ? 's' : ''} skipped (duplicate/cooldown/suppressed)
              </div>
            )}

            {/* Live log */}
            <div className="bg-[#1C2227] border border-[#2C353D] rounded-lg overflow-hidden mb-4">
              <div className="p-2.5 border-b border-[#2C353D] flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#8E9BA8] uppercase tracking-wider">Live Feed</span>
              </div>
              <div className="p-3 h-48 overflow-y-auto font-mono text-xs space-y-1.5">
                {progressLogs.length === 0 ? (
                  <div className="text-[#8E9BA8] text-center py-4">Waiting for first email to send...</div>
                ) : (
                  [...progressLogs].reverse().map((log: any) => (
                    <div key={log.id} className={`flex items-start gap-2 p-1.5 border border-[#2C353D] rounded ${log.status === 'success' ? 'text-emerald-400 bg-emerald-950/10' : log.status === 'skipped' ? 'text-amber-400 bg-amber-950/10' : 'text-rose-400 bg-rose-950/10'}`}>
                      <span className="text-[#8E9BA8] shrink-0 text-[10px]">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                      {log.status === 'success' ? (
                        <CheckCircle className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" />
                      ) : log.status === 'skipped' ? (
                        <Clock className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />
                      ) : (
                        <X className="w-3 h-3 mt-0.5 shrink-0 text-rose-400" />
                      )}
                      <span className="text-[#CBD5E1] truncate">{log.recipient}</span>
                      <span className="text-[#8E9BA8]">-</span>
                      <span className="truncate text-[#8E9BA8]">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3">
              {progress?.status === "completed" && campaignId && (
                <button
                  onClick={() => navigate(`/campaigns/${campaignId}/logs`)}
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold px-4 py-2 text-xs rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  View Full Logs
                </button>
              )}
              <button
                onClick={() => {
                  setShowProgress(false);
                  if (progressInterval.current) clearInterval(progressInterval.current);
                  if (countdownInterval.current) clearInterval(countdownInterval.current);
                  if (progress?.status === "completed") {
                    navigate("/campaigns");
                  }
                }}
                className="bg-[#1C2227] hover:bg-[#29323A] text-[#CBD5E1] hover:text-white border border-[#2C353D] px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-all"
              >
                {progress?.status === "completed" ? "Done" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right-Side Template Live Preview Drawer with Flush Alignment & No Blur */}
      {previewTemplate && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-hidden">
          {/* Solid Dark Backdrop - NO BLUR */}
          <div
            className="fixed inset-0 bg-black/60 transition-opacity animate-in fade-in duration-200"
            onClick={() => setPreviewTemplate(null)}
          />

          {/* Drawer anchored firmly to the right side */}
          <div className="fixed inset-y-0 right-0 flex max-w-full">
            <div className="w-screen max-w-2xl lg:max-w-3xl h-full bg-[#161B1F] border-l border-[#2C353D] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-[#2C353D] flex items-start justify-between bg-[#1A2026] shrink-0">
                <div className="pr-4 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 font-semibold">
                      Live Preview
                    </span>
                    {templateId === previewTemplate.id.toString() && (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1 font-semibold">
                        <CheckCircle className="w-3 h-3" /> Selected
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{previewTemplate.name}</h3>
                  {previewTemplate.subject && (
                    <div className="mt-2.5 p-3 bg-[#14181C] border border-[#2C353D] rounded-xl text-xs">
                      <span className="text-[#8E9BA8] font-bold uppercase text-[10px] tracking-wider block mb-1">Subject Line</span>
                      <p className="text-[#E2E8F0] font-medium">{previewTemplate.subject}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="p-2 text-[#8E9BA8] hover:text-white bg-[#222930] hover:bg-[#2C353D] border border-[#2C353D] rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Close Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Body - Live HTML Rendered in iframe */}
              <div className="flex-1 overflow-hidden p-6 flex flex-col bg-[#14181C]">
                <div className="flex items-center justify-between mb-2.5 px-0.5 shrink-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                    Email Content Canvas
                  </span>
                  <span className="text-[11px] font-mono text-[#8E9BA8]">
                    Rendered HTML
                  </span>
                </div>
                <div className="flex-1 bg-white rounded-xl overflow-hidden border border-[#2C353D] shadow-xl relative">
                  <iframe
                    srcDoc={previewTemplate.body}
                    className="w-full h-full border-0 bg-white block"
                    title="Creative Email Preview"
                    sandbox="allow-same-origin allow-popups"
                  />
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="px-6 py-4 border-t border-[#2C353D] bg-[#1A2026] flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="px-4 py-2 border border-[#2C353D] bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplateId(previewTemplate.id.toString());
                    setPreviewTemplate(null);
                    setStep(4);
                  }}
                  className="px-5 py-2.5 bg-white hover:bg-[#CBD5E1] text-[#161B1F] text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Select & Continue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

