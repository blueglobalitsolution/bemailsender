import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Wand2, User, Users, FileText, Settings, ArrowRight, ArrowLeft, Upload, CheckCircle, Loader2, X, Clock, AlertCircle, Shield, ShieldCheck, ShieldAlert, Globe, Calendar, Shuffle, Target, Sparkles, Eye } from "lucide-react";
import { apiFetch, getApiUrl } from "../lib/api";
import { useToast } from "../components/Toast";

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
    stats: { total: number; valid: number; disposable: number; bounced: number; invalid: number };
  } | null>(null);

  // Progress modal state
  const [showProgress, setShowProgress] = useState(false);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [progress, setProgress] = useState<any>(null);
  const [countdown, setCountdown] = useState(0);
  const [progressLogs, setProgressLogs] = useState<any[]>([]);
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

  const handleSubmit = async () => {
    if ((!csvFile && !savedCsvId) || !templateId || (!identityId && !identityGroupId)) {
      toast.error("Please fill all required fields");
      return;
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

    try {
      const res = await apiFetch("/api/campaigns/send/", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setCampaignId(data.campaignId);
        setShowProgress(true);
        setProgressLogs([]);
        // Start polling
        if (progressInterval.current) clearInterval(progressInterval.current);
        progressInterval.current = setInterval(() => pollProgress(data.campaignId), 2000);
      } else {
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

      {/* Progress Bar */}
      <div className="bg-[#000000] border border-[#1a1a1a] rounded-none p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between items-center relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-[#141414] -z-10"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#00ffff] -z-10 shadow-[0_0_12px_rgba(0,255,255,0.4)] transition-all duration-300"
            style={{ width: `${((step - 1) / 3) * 100}%` }}></div>

          {steps.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-2 px-2">
              <div className={`w-10 h-10 rounded-none flex items-center justify-center transition-all duration-300 ${
                step >= s.id 
                  ? 'bg-[#00ffff] text-black shadow-[0_0_16px_rgba(0,255,255,0.4)]' 
                  : 'bg-[#111111] text-[#555555] border border-[#222222]'
              }`}>
                <s.icon className="w-4 h-4" />
              </div>
              <span className={`text-[11px] font-mono uppercase tracking-wider ${
                step >= s.id ? 'text-[#00ffff]' : 'text-[#555555]'
              }`}>{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-[#000000] border border-[#1a1a1a] rounded-none p-8 min-h-[400px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-2xl font-serif text-white mb-1">Configure Email Identity</h3>
              <p className="text-[#777777] text-sm mb-6">Choose your sender identity or rotation pool.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-xs uppercase tracking-widest text-[#777777] mb-2 font-medium">Campaign Name (Optional)</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-none py-3 px-4 text-white placeholder-[#555555]"
                  placeholder="e.g., Q3 Outreach"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-[#777777] mb-2 font-medium">Select Sender</label>
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => { setSenderMode('single'); setIdentityGroupId(""); }}
                    className={`px-5 py-2.5 text-xs font-semibold rounded-none transition-all flex-1 cursor-pointer ${
                      senderMode === 'single'
                        ? 'bg-[#00ffff] text-black shadow-[0_0_16px_rgba(0,255,255,0.3)]'
                        : 'bg-[#111111] text-[#888888] hover:text-white border border-[#222222]'
                    }`}
                  >
                    Single Identity
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSenderMode('group'); setIdentityId(""); }}
                    className={`px-5 py-2.5 text-xs font-semibold rounded-none transition-all flex-1 cursor-pointer ${
                      senderMode === 'group'
                        ? 'bg-[#00ffff] text-black shadow-[0_0_16px_rgba(0,255,255,0.3)]'
                        : 'bg-[#111111] text-[#888888] hover:text-white border border-[#222222]'
                    }`}
                  >
                    Identity Group
                  </button>
                </div>

                {senderMode !== 'group' ? (
                  <>
                    <p className="text-xs text-[#777777] mb-3">Choose a single sender identity.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {identities.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-[#666666] bg-[#0a0a0a] border border-[#1a1a1a] rounded-none">
                          No identities found. <a href="/identities" className="text-[#00ffff] hover:underline">Add one here</a>.
                        </div>
                      ) : (
                        identities.map((identity) => (
                          <div
                            key={identity.id}
                            onClick={() => { setSenderMode('single'); setIdentityId(identity.id.toString()); setIdentityGroupId(""); }}
                            className={`p-4 rounded-none cursor-pointer transition-all border ${
                              identityId === identity.id.toString()
                                ? 'bg-[#00ffff]/10 border-[#00ffff] shadow-[0_0_16px_rgba(0,255,255,0.2)]'
                                : 'bg-[#0a0a0a] border-[#1e1e1e] hover:border-[#333333]'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-serif text-lg text-white">{identity.name}</h4>
                              {identityId === identity.id.toString() && <CheckCircle className="w-4 h-4 text-[#00ffff]" />}
                            </div>
                            <p className="text-xs text-[#888888]">{identity.smtp_user}</p>
                            <p className="text-[10px] font-mono text-[#555555] mt-1">{identity.host}:{identity.port}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-[#777777] mb-3 font-medium">Choose an identity group for automatic rotation across multiple senders.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {identityGroups.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-[#555555] bg-[#0a0a0a] border border-[#1e1e1e]">
                          No identity groups found. <a href="/identities" className="text-[#00ffff] hover:underline font-bold">Create one here</a>.
                        </div>
                      ) : (
                        identityGroups.map((group) => (
                          <div
                            key={group.id}
                            onClick={() => { setSenderMode('group'); setIdentityGroupId(group.id.toString()); setIdentityId(""); }}
                            className={`p-4 cursor-pointer transition-all border ${identityGroupId === group.id.toString()
                              ? 'bg-[#00ffff]/10 border-[#00ffff] shadow-[0_0_16px_rgba(0,255,255,0.2)]'
                              : 'bg-[#0a0a0a] border-[#1e1e1e] hover:border-[#333333]'
                              }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-serif text-lg text-white font-medium">{group.name}</h4>
                              {identityGroupId === group.id.toString() && <CheckCircle className="w-4 h-4 text-[#00ffff]" />}
                            </div>
                            <p className="text-xs text-[#888888]">{group.identities?.length || 0} identities</p>
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
              <h3 className="text-2xl font-serif text-white mb-1">Import Audience</h3>
              <p className="text-[#777777] text-sm mb-6">Upload a CSV file or select a previously saved one.</p>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => { setSavedCsvId(""); setShowSavedList(false); setCsvFile(null); setScanData(null); setCsvRows([]); }}
                className={`px-5 py-2.5 text-xs font-semibold rounded-none transition-all flex-1 cursor-pointer ${
                  !showSavedList 
                    ? 'bg-[#00ffff] text-black shadow-[0_0_16px_rgba(0,255,255,0.3)]' 
                    : 'bg-[#111111] text-[#888888] hover:text-white border border-[#222222]'
                }`}
              >
                Upload CSV
              </button>
              <button
                type="button"
                onClick={() => { setShowSavedList(true); setCsvFile(null); setScanData(null); setCsvRows([]); }}
                className={`px-5 py-2.5 text-xs font-semibold rounded-none transition-all flex-1 cursor-pointer ${
                  showSavedList 
                    ? 'bg-[#00ffff] text-black shadow-[0_0_16px_rgba(0,255,255,0.3)]' 
                    : 'bg-[#111111] text-[#888888] hover:text-white border border-[#222222]'
                }`}
              >
                Saved CSV
              </button>
            </div>

            {!showSavedList ? (
              <div className="bg-[#0a0a0a] border-2 border-dashed border-[#222222] hover:border-[#00ffff] rounded-none p-12 text-center transition-colors cursor-pointer relative">
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
                <Upload className="w-10 h-10 text-[#555555] mx-auto mb-3 drop-shadow-sm" />
                <h4 className="text-base font-medium text-white mb-1">Click to upload or drag and drop</h4>
                <p className="text-xs text-[#666666] font-mono">CSV files only</p>

                {csvFile && (
                  <div className="mt-4 inline-flex items-center gap-2 bg-[#00ffff]/10 text-[#00ffff] px-4 py-2 text-xs font-mono border border-[#00ffff]/30 shadow-[0_0_12px_rgba(0,255,255,0.15)]">
                    <CheckCircle className="w-3.5 h-3.5" /> {csvFile.name} ({csvRows.length} contacts)
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-xs uppercase tracking-widest text-[#777777] mb-2 font-medium">Select Saved CSV</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedCsvs.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-[#555555] bg-[#0a0a0a] border border-[#1e1e1e]">
                      No saved CSVs found. <a href="/saved-csvs" className="text-[#00ffff] hover:underline font-bold">Upload one here</a>.
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
                        className={`p-5 cursor-pointer transition-all border ${savedCsvId === scsv.id.toString()
                          ? 'bg-[#00ffff]/10 border-[#00ffff] shadow-[0_0_16px_rgba(0,255,255,0.2)]'
                          : 'bg-[#0a0a0a] border-[#1e1e1e] hover:border-[#333333]'
                          }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-serif text-lg text-white font-medium">{scsv.name}</h4>
                          {savedCsvId === scsv.id.toString() && <CheckCircle className="w-4 h-4 text-[#00ffff]" />}
                        </div>
                        <p className="text-xs text-[#888888] font-medium">{scsv.row_count} contacts</p>
                        <p className="text-[10px] text-[#555555] mt-1 font-mono">Uploaded {new Date(scsv.created_at).toLocaleDateString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {(csvFile || (showSavedList && savedCsvId)) && campaignType === 'email' && (
              <div className="space-y-4">
                <div className="bg-[#0a0a0a] border border-[#1e1e1e] p-4 flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checkGravatar}
                      onChange={(e) => setCheckGravatar(e.target.checked)}
                      className="w-4 h-4 bg-[#111111] border-[#333333] rounded-none accent-[#00ffff] cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">Check Gravatar profile</span>
                      <span className="text-[11px] text-[#666666]">Verify profile existence and avatar presence during scan</span>
                    </div>
                  </label>
                </div>

                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="bg-[#19b3d2] hover:bg-[#20c4e6] text-black font-semibold rounded-none px-6 py-2.5 text-xs flex items-center gap-2 transition-all cursor-pointer border border-[#1499b4] disabled:opacity-50"
                >
                  {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                  {scanning ? "Scanning..." : "Scan CSV"}
                </button>

                {scanData && (
                  <div className="space-y-4">
                    {/* Stats summary */}
                    <div className="flex flex-wrap gap-2 text-xs font-mono">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" /> {scanData.stats.valid} Safe
                      </span>
                      {scanData.stats.gravatar > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/40 border border-purple-500/30 text-purple-400">
                          <CheckCircle className="w-3.5 h-3.5" /> {scanData.stats.gravatar} Gravatar
                        </span>
                      )}
                      {scanData.stats.disposable > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/40 border border-amber-500/30 text-amber-400">
                          <AlertCircle className="w-3.5 h-3.5" /> {scanData.stats.disposable} Disposable
                        </span>
                      )}
                      {scanData.stats.bounced > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-950/40 border border-sky-500/30 text-sky-400">
                          <X className="w-3.5 h-3.5" /> {scanData.stats.bounced} Bounced
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 border border-rose-500/30 text-rose-400">
                        <X className="w-3.5 h-3.5" /> {scanData.stats.invalid} Invalid
                      </span>
                      {removedEmails.length > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 border border-gray-700 text-gray-400">
                          🗑️ {removedEmails.length} Removed
                        </span>
                      )}
                    </div>

                    {/* Remaining count */}
                    <div className="bg-[#0a0a0a] border border-[#1e1e1e] p-3 text-center">
                      <span className="text-sm font-mono text-[#00ffff]">
                        {csvRows.length - removedEmails.length} of {csvRows.length} contacts will be sent
                      </span>
                    </div>

                    {/* Invalid emails - with delete */}
                    {scanData.results.filter((r) => !r.valid).length > 0 && (
                      <div className="bg-[#0a0a0a] border border-rose-950/50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-mono text-xs font-bold text-rose-400">Invalid ({scanData.stats.invalid})</h4>
                          <button
                            onClick={removeAllInvalid}
                            className="text-[11px] font-mono text-rose-400 hover:text-white bg-rose-950/40 border border-rose-900/50 hover:bg-rose-900/60 px-2.5 py-1 transition-all cursor-pointer"
                          >
                            🗑️ Remove All
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5">
                          {scanData.results.filter((r) => !r.valid).map((r, i) => (
                            <div key={i} className="text-xs font-mono flex items-center gap-2 p-2 bg-[#050505] border border-[#1a1a1a] text-rose-300">
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
                      <div className="bg-[#0a0a0a] border border-sky-950/50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-mono text-xs font-bold text-sky-400">Previously Bounced ({scanData.stats.bounced})</h4>
                          <button
                            onClick={removeAllBounced}
                            className="text-[11px] font-mono text-sky-400 hover:text-white bg-sky-950/40 border border-sky-900/50 hover:bg-sky-900/60 px-2.5 py-1 transition-all cursor-pointer"
                          >
                            🗑️ Remove All
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5">
                          {scanData.results.filter((r) => r.flags.includes("bounced") && r.valid).map((r, i) => (
                            <div key={i} className="text-xs font-mono flex items-center gap-2 p-2 bg-[#050505] border border-[#1a1a1a] text-sky-300">
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
                      <div className="bg-[#0a0a0a] border border-amber-950/50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-mono text-xs font-bold text-amber-400">Disposable ({scanData.stats.disposable})</h4>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1.5">
                          {scanData.results.filter((r) => r.flags.includes("disposable")).map((r, i) => (
                            <div key={i} className="text-xs font-mono flex items-center gap-2 p-2 bg-[#050505] border border-[#1a1a1a] text-amber-300">
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
              <h3 className="text-2xl font-serif text-white mb-1">Select Creative</h3>
              <p className="text-[#777777] text-sm mb-6">Choose an email template from your Script Architect library.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {templates.length === 0 ? (
                <div className="col-span-full text-center py-12 text-[#555555] bg-[#0a0a0a] border border-[#1e1e1e]">
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
                      className={`p-5 cursor-pointer transition-all border relative flex flex-col justify-between group rounded-none ${
                        isSelected
                          ? 'bg-[#00ffff]/10 border-[#00ffff] shadow-[0_0_20px_rgba(0,255,255,0.25)]'
                          : 'bg-[#0a0a0a] border-[#1e1e1e] hover:border-[#3a3a3a]'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <h4 className="font-serif text-lg text-white font-medium line-clamp-1" title={t.name}>
                            {t.name}
                          </h4>
                          {isSelected && <CheckCircle className="w-4 h-4 text-[#00ffff] shrink-0" />}
                        </div>
                        {t.subject && (
                          <p className="text-xs text-[#888888] font-medium mb-3 line-clamp-1" title={t.subject}>
                            <span className="text-[#555555]">Subject:</span> {t.subject}
                          </p>
                        )}
                        <p className="text-xs text-[#777777] line-clamp-3 leading-relaxed mb-4">
                          {stripHtml(t.body) || "No plain text excerpt available."}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-[#141414] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTemplateId(t.id.toString());
                            toast.success(`Selected template: ${t.name}`);
                          }}
                          className={`text-xs font-semibold px-3 py-1.5 transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#00ffff] text-black font-bold'
                              : 'bg-[#161B1F] text-[#CBD5E1] hover:text-white border border-[#2C353D] hover:bg-[#222930]'
                          }`}
                        >
                          <CheckCircle className={`w-3.5 h-3.5 ${isSelected ? 'text-black' : 'text-[#8E9BA8]'}`} />
                          {isSelected ? 'Selected' : 'Select'}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTemplate(t);
                          }}
                          className="text-xs font-medium text-[#00ffff] hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-[#00ffff]/10 hover:bg-[#00ffff]/20 border border-[#00ffff]/30 transition-all cursor-pointer"
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
              <h3 className="text-2xl font-serif text-white mb-1">Governance & Control</h3>
              <p className="text-gray-500 text-sm mb-6">Set delivery rules and scheduling.</p>
            </div>
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-none p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-serif text-lg text-white">Traffic Control</h4>
                  <p className="text-xs text-[#777777]">Set custom delay between consecutive emails to control delivery speed & prevent spam flagging.</p>
                </div>
                <div className="flex items-center gap-2 bg-[#111111] border border-[#222222] px-3 py-1.5 rounded-none">
                  <span className="font-mono text-base font-bold text-[#19b3d2]">{delaySeconds}</span>
                  <span className="text-[11px] font-mono text-[#777777]">seconds</span>
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
                  className="w-full accent-[#19b3d2] cursor-pointer h-1.5 bg-[#1a1a1a] rounded-none"
                />

                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-[#666666]">Quick Presets:</span>
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
                        className={`px-2.5 py-1 text-[11px] font-mono rounded-none transition-all cursor-pointer border ${
                          delaySeconds === preset.val
                            ? "bg-[#19b3d2]/15 border-[#19b3d2] text-[#19b3d2]"
                            : "bg-[#111111] border-[#222222] text-[#888888] hover:text-white"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="text-[11px] font-mono text-[#666666]">
                    {delaySeconds < 25 ? (
                      <span className="text-amber-400">⚡ Faster speed (high-volume accounts)</span>
                    ) : (
                      <span className="text-emerald-400">🛡️ Optimal inbox deliverability</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-none p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-serif text-lg text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#19b3d2]" /> Campaign Schedule
                  </h4>
                  <p className="text-xs text-[#777777] mt-1">Automate delivery windows, timezones, and daily throttling limits.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                  />
                  <div className="w-12 h-6 bg-[#1a1a1a] border border-[#2a2a2a] peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-none after:h-5 after:w-5 after:transition-all peer-checked:bg-[#19b3d2] peer-checked:after:bg-black"></div>
                </label>
              </div>

              {isScheduled && (
                <div className="space-y-6 pt-5 border-t border-[#1a1a1a] animate-in fade-in duration-300">
                  {/* 1. Timezone Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-[#777777] mb-2 font-medium flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-[#19b3d2]" /> Target Timezone
                      </label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full bg-[#111111] border border-[#222222] rounded-none py-2.5 px-3 text-xs text-white focus:outline-none focus:border-[#19b3d2] font-mono cursor-pointer"
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

                    {/* 5. Launch Date Picker ("Schedule for Later") */}
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-[#777777] mb-2 font-medium flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#19b3d2]" /> Launch Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={launchDate}
                        onChange={(e) => setLaunchDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full bg-[#111111] border border-[#222222] rounded-none py-2 px-3 text-xs text-white focus:outline-none focus:border-[#19b3d2] font-mono"
                      />
                    </div>
                  </div>

                  {/* 2. Pre-Configured Business Hour Presets */}
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[#777777] mb-2 font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#19b3d2]" /> Schedule Presets
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleDays([1, 2, 3, 4, 5]);
                          setStartTime("09:00");
                          setEndTime("17:00");
                        }}
                        className="px-3 py-1.5 text-xs font-mono rounded-none border border-[#222222] bg-[#111111] hover:bg-[#1a1a1a] text-[#cccccc] hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
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
                        className="px-3 py-1.5 text-xs font-mono rounded-none border border-[#222222] bg-[#111111] hover:bg-[#1a1a1a] text-[#cccccc] hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
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
                        className="px-3 py-1.5 text-xs font-mono rounded-none border border-[#222222] bg-[#111111] hover:bg-[#1a1a1a] text-[#cccccc] hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        🌐 24/7 Continuous
                      </button>
                    </div>
                  </div>

                  {/* Active Days Selection */}
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-[#777777] mb-2 font-medium">Active Days</label>
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
                          className={`px-4 py-2 text-xs font-semibold rounded-none transition-all cursor-pointer border ${
                            scheduleDays.includes(index)
                              ? 'bg-[#19b3d2] text-black border-[#1499b4]'
                              : 'bg-[#111111] text-[#888888] hover:text-white border-[#222222]'
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
                      <label className="block text-xs uppercase tracking-widest text-[#777777] mb-2 font-medium">Start Time</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-[#111111] border border-[#222222] rounded-none py-2 px-4 text-white text-xs font-mono focus:outline-none focus:border-[#19b3d2]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-[#777777] mb-2 font-medium">End Time</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-[#111111] border border-[#222222] rounded-none py-2 px-4 text-white text-xs font-mono focus:outline-none focus:border-[#19b3d2]"
                      />
                    </div>
                  </div>

                  {/* 4. Random Humanized Jitter + 3. Daily Sending Limit */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* Humanized Jitter */}
                    <div className="bg-[#111111] border border-[#222222] p-4 rounded-none flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Shuffle className="w-3.5 h-3.5 text-[#19b3d2]" />
                          <span className="text-xs font-semibold text-white">Humanized Jitter</span>
                        </div>
                        <p className="text-[11px] text-[#777777] mt-0.5">Adds ±5 to 15s natural variance between emails to simulate human typing.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={humanJitter}
                          onChange={(e) => setHumanJitter(e.target.checked)}
                        />
                        <div className="w-10 h-5 bg-[#1a1a1a] border border-[#2a2a2a] peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#19b3d2] peer-checked:after:bg-black"></div>
                      </label>
                    </div>

                    {/* Daily Sending Limit */}
                    <div className="bg-[#111111] border border-[#222222] p-4 rounded-none">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-[#19b3d2]" />
                          <span className="text-xs font-semibold text-white">Daily Sending Cap</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={enableDailyLimit}
                            onChange={(e) => setEnableDailyLimit(e.target.checked)}
                          />
                          <div className="w-10 h-5 bg-[#1a1a1a] border border-[#2a2a2a] peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-[#19b3d2] peer-checked:after:bg-black"></div>
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
                            className="w-28 bg-[#0a0a0a] border border-[#222222] px-2.5 py-1 text-xs text-white font-mono rounded-none focus:outline-none focus:border-[#19b3d2]"
                          />
                          <span className="text-[11px] text-[#777777]">max emails per day</span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#777777]">Automatically pauses once limit is reached and resumes next day.</p>
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
          className={`px-6 py-3 font-semibold rounded-none flex items-center gap-2 transition-all text-xs cursor-pointer ${step === 1 ? 'text-[#444444] border border-[#1c1c1c] cursor-not-allowed opacity-40' : 'bg-[#111111] text-[#cccccc] hover:text-white border border-[#222222]'
            }`}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {step < 4 ? (
          <button
            onClick={handleNext}
            className="bg-[#19b3d2] hover:bg-[#20c4e6] text-black font-semibold rounded-none px-7 py-3 text-xs flex items-center gap-2 transition-all cursor-pointer border border-[#1499b4]"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#19b3d2] hover:bg-[#20c4e6] text-black font-semibold rounded-none px-8 py-3.5 text-xs flex items-center gap-2 transition-all cursor-pointer border border-[#1499b4] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Launching..." : "Launch Campaign"} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress Modal */}
      {showProgress && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0a0a] border border-[#1e1e1e] p-6 w-full max-w-lg shadow-[0_16px_48px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif text-white flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-[#00ffff] animate-spin" />
                {campaignName || "Campaign"}
              </h3>
              <div className="flex items-center gap-2">
                {progress?.status === "running" && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 animate-pulse">Running</span>
                )}
                {progress?.status === "completed" && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">Completed</span>
                )}
                {progress?.status === "scheduled" && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-sky-950/60 border border-sky-500/40 text-sky-400">Scheduled</span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {progress && (
              <div className="mb-4">
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-[#888888]">{progress.sent} of {progress.total} sent</span>
                  <span className="font-bold text-[#00ffff]">
                    {progress.total > 0 ? Math.round(progress.sent / progress.total * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-[#141414] border border-[#222222] h-2 overflow-hidden">
                  <div
                    className="h-full bg-[#00ffff] shadow-[0_0_12px_rgba(0,255,255,0.6)] transition-all duration-700 ease-out"
                    style={{ width: `${progress.total > 0 ? Math.min(progress.sent / progress.total * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Countdown timer */}
            {(progress?.status === "running" || progress?.status === "scheduled") && progress?.pending > 0 && (
              <div className="bg-[#050505] border border-[#1a1a1a] p-4 mb-4 text-center">
                <div className="text-3xl font-bold text-[#00ffff] font-mono">
                  {countdown}s
                </div>
                <div className="text-[10px] font-mono text-[#777777] mt-1 uppercase tracking-widest">Next email in</div>
              </div>
            )}

            {/* Errors */}
            {progress?.failed > 0 && (
              <div className="bg-rose-950/30 border border-rose-900/50 text-rose-400 p-3 mb-4 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {progress.failed} email{progress.failed > 1 ? 's' : ''} failed
              </div>
            )}

            {/* Live log */}
            <div className="bg-[#050505] border border-[#1a1a1a] overflow-hidden mb-4">
              <div className="p-2.5 border-b border-[#1a1a1a] flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#888888] uppercase tracking-wider">Live Feed</span>
              </div>
              <div className="p-3 h-48 overflow-y-auto font-mono text-xs space-y-1.5">
                {progressLogs.length === 0 ? (
                  <div className="text-[#555555] text-center py-4">Waiting for first email to send...</div>
                ) : (
                  [...progressLogs].reverse().map((log: any) => (
                    <div key={log.id} className={`flex items-start gap-2 p-1.5 border border-[#141414] ${log.status === 'success' ? 'text-emerald-400 bg-emerald-950/10' : 'text-rose-400 bg-rose-950/10'}`}>
                      <span className="text-[#555555] shrink-0 text-[10px]">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                      {log.status === 'success' ? (
                        <CheckCircle className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" />
                      ) : (
                        <X className="w-3 h-3 mt-0.5 shrink-0 text-rose-400" />
                      )}
                      <span className="text-[#cccccc] truncate">{log.recipient}</span>
                      <span className="text-[#555555]">-</span>
                      <span className="truncate text-[#888888]">{log.message}</span>
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
                  className="bg-[#19b3d2] hover:bg-[#20c4e6] text-black font-semibold px-5 py-2 text-xs border border-[#1499b4] transition-all cursor-pointer"
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
                className="bg-[#111111] hover:bg-[#1a1a1a] text-[#cccccc] hover:text-white border border-[#222222] px-5 py-2 text-xs font-semibold cursor-pointer transition-all"
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

