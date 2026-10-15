import React, { useState, useEffect } from "react";
import { 
  Download, 
  X, 
  Loader2, 
  Table, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Clock, 
  Info, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  Users,
  ChevronRight,
  User,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  Filter
} from "lucide-react";
import { apiFetch, getApiUrl } from "../lib/api";
import { useToast } from "./Toast";

interface Submission {
  id: number;
  landing_page: number;
  page_title: string;
  form: number;
  form_name: string;
  data: Record<string, any>;
  ip_address: string;
  user_agent: string;
  submitted_at: string;
  is_qualified: boolean;
  qualification_score: number;
  qualification_status: "qualified" | "review" | "disqualified" | "unprocessed";
  qualification_reason: string;
}

export interface SubmissionsViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageId?: number;
  pageTitle?: string;
  pageSlug?: string;
  landingPageId?: number;
  landingPageTitle?: string;
  landingPageSlug?: string;
}

export default function SubmissionsViewerModal({
  isOpen,
  onClose,
  pageId,
  pageTitle,
  pageSlug,
  landingPageId,
  landingPageTitle,
  landingPageSlug,
}: SubmissionsViewerModalProps) {
  const toast = useToast();
  const effectivePageId = pageId ?? landingPageId ?? 0;
  const effectivePageTitle = pageTitle ?? landingPageTitle ?? "Landing Page";
  const effectivePageSlug = pageSlug ?? landingPageSlug ?? "";

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "qualified" | "review" | "disqualified">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<Submission | null>(null);

  const fetchSubmissions = async () => {
    if (!effectivePageId) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/api/landing-pages/${effectivePageId}/submissions/`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      } else {
        toast.error("Failed to load submissions");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !effectivePageId) return;
    fetchSubmissions();
    setSelectedLead(null);
    setSearchQuery("");
    setFilterMode("all");
  }, [isOpen, effectivePageId]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (selectedLead) {
          setSelectedLead(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedLead, onClose]);

  if (!isOpen) return null;

  const handleEvaluateLeads = async () => {
    if (!effectivePageId) return;
    try {
      setEvaluating(true);
      const res = await apiFetch(`/api/landing-pages/${effectivePageId}/evaluate_leads/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
        toast.success(`Evaluated ${data.evaluated_count || 0} leads with Laya AI!`);
      } else {
        toast.error("Failed to evaluate leads");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error running AI lead evaluation");
    } finally {
      setEvaluating(false);
    }
  };

  const handleDownloadCsv = (qualifiedOnly: boolean = false) => {
    if (!effectivePageId) return;
    const token = localStorage.getItem("access_token");
    const query = qualifiedOnly ? "?qualified_only=true" : "";
    const downloadUrl = getApiUrl(`/api/landing-pages/${effectivePageId}/export_csv/${query}`);

    fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Export failed");
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const prefix = qualifiedOnly ? "qualified_leads" : "leads";
        a.download = `${prefix}_${effectivePageSlug || "export"}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(qualifiedOnly ? "Qualified CSV exported successfully!" : "CSV exported successfully!");
      })
      .catch((err) => {
        console.error(err);
        toast.error("Could not download CSV export");
      });
  };

  // Filter and Search logic
  const filteredSubmissions = submissions.filter((s) => {
    // Status filter
    if (filterMode !== "all" && s.qualification_status !== filterMode) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchReason = (s.qualification_reason || "").toLowerCase().includes(q);
      const matchForm = (s.form_name || "").toLowerCase().includes(q);
      const matchIp = (s.ip_address || "").toLowerCase().includes(q);
      const matchData = s.data && Object.values(s.data).some((val) => 
        String(val).toLowerCase().includes(q)
      );
      return matchReason || matchForm || matchIp || matchData;
    }
    return true;
  });

  // Extract all distinct keys across submitted data
  const dataKeys = Array.from(
    new Set<string>(submissions.flatMap((s) => (s.data ? Object.keys(s.data) : [])))
  );

  const getStatusBadge = (sub: Submission) => {
    switch (sub.qualification_status) {
      case "qualified":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <CheckCircle2 className="w-3.5 h-3.5" /> Qualified ({sub.qualification_score})
          </span>
        );
      case "review":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertCircle className="w-3.5 h-3.5" /> Review ({sub.qualification_score})
          </span>
        );
      case "disqualified":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" /> Disqualified ({sub.qualification_score})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#222930] text-gray-400 border border-white/10">
            <Clock className="w-3.5 h-3.5" /> Unprocessed
          </span>
        );
    }
  };

  const qualifiedCount = submissions.filter((s) => s.qualification_status === "qualified").length;
  const reviewCount = submissions.filter((s) => s.qualification_status === "review").length;
  const disqualifiedCount = submissions.filter((s) => s.qualification_status === "disqualified").length;
  const qualifiedPercentage = submissions.length > 0 ? Math.round((qualifiedCount / submissions.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 md:pl-16 z-50">
        <div className="w-screen max-w-5xl xl:max-w-6xl bg-[#12161A] border-l border-[#2C353D] shadow-[-20px_0_60px_rgba(0,0,0,0.85)] flex flex-col h-full animate-in slide-in-from-right duration-300 ease-out">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#2C353D] bg-[#161B1F] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.2)]">
                <Table className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-white tracking-tight truncate max-w-md">
                    Leads Pipeline: {effectivePageTitle}
                  </h2>
                  <span className="bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0">
                    <Sparkles className="w-3 h-3 text-purple-400" /> Laya + Llama AI
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                  <span>Page Slug:</span>
                  <a 
                    href={`/p/${effectivePageSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-teal-400 hover:text-teal-300 hover:underline flex items-center gap-1"
                  >
                    /p/{effectivePageSlug} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleEvaluateLeads}
                disabled={evaluating || submissions.length === 0}
                className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-40"
                title="Run Laya & Llama qualification scoring on all leads"
              >
                {evaluating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Evaluating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Run AI Qualify
                  </>
                )}
              </button>

              <button
                onClick={() => handleDownloadCsv(true)}
                disabled={qualifiedCount === 0}
                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-40"
                title="Download only leads validated by AI as Qualified"
              >
                <Download className="w-3.5 h-3.5" /> Qualified CSV ({qualifiedCount})
              </button>

              <button
                onClick={() => handleDownloadCsv(false)}
                disabled={submissions.length === 0}
                className="bg-white hover:bg-gray-200 text-[#161B1F] font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" /> All CSV
              </button>

              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer ml-1"
                title="Close Drawer (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* KPI Analytics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3.5 bg-[#14181C] border-b border-[#2C353D]">
            <div className="p-3 rounded-xl bg-[#1A2026] border border-[#2C353D] flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Submissions</p>
                <p className="text-xl font-bold text-white mt-0.5">{submissions.length}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center text-gray-400">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Qualified Leads</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <p className="text-xl font-bold text-emerald-400">{qualifiedCount}</p>
                  <span className="text-xs text-emerald-400/80 font-semibold font-mono">({qualifiedPercentage}%)</span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Needs Review</p>
                <p className="text-xl font-bold text-amber-400 mt-0.5">{reviewCount}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Disqualified</p>
                <p className="text-xl font-bold text-rose-400 mt-0.5">{disqualifiedCount}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="px-6 py-3 bg-[#161B1F] border-b border-[#2C353D] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-gray-400 font-semibold mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter:
              </span>
              <button
                onClick={() => setFilterMode("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterMode === "all"
                    ? "bg-white text-[#161B1F] shadow-sm font-bold"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                All ({submissions.length})
              </button>
              <button
                onClick={() => setFilterMode("qualified")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filterMode === "qualified"
                    ? "bg-emerald-500 text-black font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                    : "text-emerald-400/90 hover:text-emerald-300 hover:bg-emerald-500/10"
                }`}
              >
                <CheckCircle2 className="w-3 h-3" /> Qualified ({qualifiedCount})
              </button>
              <button
                onClick={() => setFilterMode("review")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filterMode === "review"
                    ? "bg-amber-500 text-black font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                    : "text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/10"
                }`}
              >
                <Clock className="w-3 h-3" /> Review ({reviewCount})
              </button>
              <button
                onClick={() => setFilterMode("disqualified")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filterMode === "disqualified"
                    ? "bg-rose-500 text-white font-bold shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                    : "text-rose-400/90 hover:text-rose-300 hover:bg-rose-500/10"
                }`}
              >
                <XCircle className="w-3 h-3" /> Disqualified ({disqualifiedCount})
              </button>
            </div>

            {/* Search Input & Refresh */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search leads..."
                  className="bg-[#0f1418] border border-[#2b353f] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60 w-52 md:w-64"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2 text-gray-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                onClick={fetchSubmissions}
                disabled={loading}
                title="Refresh leads list"
                className="p-1.5 bg-[#1A2026] hover:bg-[#222930] text-gray-400 hover:text-white border border-[#2C353D] rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-400" : ""}`} />
              </button>
            </div>
          </div>

          {/* Drawer Body Area */}
          <div className="flex-1 overflow-auto p-6 relative">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-xs text-gray-400 font-medium">Loading leads pipeline from landing page...</p>
              </div>
            ) : submissions.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center border border-dashed border-[#2C353D] rounded-2xl bg-[#161B1F]/40 p-8 space-y-3">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Table className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">No Submissions Yet</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                  Share this landing page link with prospects. Incoming form submissions will be automatically analyzed, qualified, and organized in this drawer.
                </p>
                <a
                  href={`/p/${effectivePageSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white hover:bg-gray-200 text-[#161B1F] font-bold px-5 py-2 rounded-full text-xs shadow-md transition-all flex items-center gap-1.5 mt-2"
                >
                  View Live Landing Page <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center border border-[#2C353D] rounded-xl bg-[#161B1F]/30 space-y-2">
                <p className="text-sm font-semibold text-white">No leads match your filter or search criteria</p>
                <button
                  onClick={() => {
                    setFilterMode("all");
                    setSearchQuery("");
                  }}
                  className="text-xs text-purple-400 hover:underline cursor-pointer"
                >
                  Reset filters and show all leads
                </button>
              </div>
            ) : (
              <div className="border border-[#2C353D] rounded-xl overflow-hidden shadow-sm bg-[#161B1F]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#CBD5E1]">
                    <thead className="bg-[#1E252D] text-white border-b border-[#2C353D] font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 w-12">#</th>
                        <th className="px-4 py-3">AI Qualification</th>
                        <th className="px-4 py-3 min-w-[220px]">AI Reasoning</th>
                        <th className="px-4 py-3 whitespace-nowrap">Submitted At</th>
                        <th className="px-4 py-3 whitespace-nowrap">Form Name</th>
                        {dataKeys.map((key) => (
                          <th key={key} className="px-4 py-3 capitalize whitespace-nowrap">
                            {key.replace(/_/g, " ")}
                          </th>
                        ))}
                        <th className="px-4 py-3">IP Address</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2C353D]">
                      {filteredSubmissions.map((sub, idx) => (
                        <tr 
                          key={sub.id} 
                          onClick={() => setSelectedLead(sub)}
                          className={`hover:bg-[#1E252D]/80 transition-colors cursor-pointer ${
                            selectedLead?.id === sub.id ? "bg-purple-500/10" : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-mono text-gray-500 font-semibold">{idx + 1}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {getStatusBadge(sub)}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            {sub.qualification_reason ? (
                              <div className="flex items-center gap-1.5 text-gray-300">
                                <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span className="truncate max-w-[200px]" title={sub.qualification_reason}>
                                  {sub.qualification_reason}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-500 italic text-[11px]">Unprocessed</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-400 font-mono text-[11px]">
                            {new Date(sub.submitted_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{sub.form_name || "Form"}</td>
                          {dataKeys.map((key) => (
                            <td key={key} className="px-4 py-3 text-white max-w-xs truncate">
                              {sub.data?.[key] !== undefined && sub.data?.[key] !== null
                                ? String(sub.data[key])
                                : "-"}
                            </td>
                          ))}
                          <td className="px-4 py-3 font-mono text-gray-500 text-[11px] whitespace-nowrap">
                            {sub.ip_address || "-"}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLead(sub);
                              }}
                              className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 ml-auto cursor-pointer"
                            >
                              Inspect <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Lead Details Flyout (If a lead row is clicked) */}
          {selectedLead && (
            <div className="border-t border-[#2C353D] bg-[#161B1F] p-6 max-h-72 overflow-y-auto animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xs">
                    #{selectedLead.id}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Lead Details & AI Evaluation
                      {getStatusBadge(selectedLead)}
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Submitted on {new Date(selectedLead.submitted_at).toLocaleString()} via form: <span className="text-white">{selectedLead.form_name}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/5 text-xs font-semibold cursor-pointer"
                >
                  ✕ Close Details
                </button>
              </div>

              {/* AI Evaluation Reason Card */}
              {selectedLead.qualification_reason && (
                <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 mb-4">
                  <div className="flex items-center gap-1.5 font-bold text-purple-300 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Laya AI Reasoning (Score: {selectedLead.qualification_score}/100)
                  </div>
                  <p className="leading-relaxed">{selectedLead.qualification_reason}</p>
                </div>
              )}

              {/* Form Data Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {selectedLead.data && Object.entries(selectedLead.data).map(([field, val]) => (
                  <div key={field} className="p-2.5 rounded-lg bg-[#0f1418] border border-[#2b353f]">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 truncate capitalize">
                      {field.replace(/_/g, " ")}
                    </span>
                    <span className="block text-xs font-semibold text-white mt-0.5 break-all">
                      {String(val) || "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drawer Footer */}
          <div className="px-6 py-3 border-t border-[#2C353D] bg-[#14181C] flex items-center justify-between text-xs text-gray-400">
            <span>
              Showing <strong className="text-white">{filteredSubmissions.length}</strong> of <strong className="text-white">{submissions.length}</strong> leads
            </span>
            <span className="text-[11px] text-gray-500">
              💡 Press <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-gray-400 font-mono text-[10px]">Esc</kbd> anytime to close this drawer.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
