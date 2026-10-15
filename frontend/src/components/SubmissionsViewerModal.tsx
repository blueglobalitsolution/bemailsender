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
  ChevronRight,
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
    if (filterMode !== "all" && s.qualification_status !== filterMode) {
      return false;
    }
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Qualified ({sub.qualification_score})
          </span>
        );
      case "review":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertCircle className="w-3 h-3" /> Review ({sub.qualification_score})
          </span>
        );
      case "disqualified":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" /> Disqualified ({sub.qualification_score})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#222930] text-gray-400 border border-white/10">
            <Clock className="w-3 h-3" /> Unprocessed
          </span>
        );
    }
  };

  const qualifiedCount = submissions.filter((s) => s.qualification_status === "qualified").length;
  const reviewCount = submissions.filter((s) => s.qualification_status === "review").length;
  const disqualifiedCount = submissions.filter((s) => s.qualification_status === "disqualified").length;
  const qualifiedPercentage = submissions.length > 0 ? Math.round((qualifiedCount / submissions.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop overlay without blur */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/40 transition-opacity animate-in fade-in duration-200 cursor-pointer"
        aria-hidden="true"
      />

      {/* Slide-over panel - compact & right-aligned */}
      <div className="fixed inset-y-0 right-0 max-w-full flex z-50 pointer-events-none">
        <div className="w-screen max-w-2xl lg:max-w-3xl xl:max-w-4xl bg-[#12161A] border-l border-[#2C353D] shadow-[-16px_0_40px_rgba(0,0,0,0.85)] flex flex-col h-full animate-in slide-in-from-right duration-250 ease-out pointer-events-auto">
          
          {/* Compact Header */}
          <div className="px-4 py-2.5 border-b border-[#2C353D] bg-[#161B1F] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400">
                <Table className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-white tracking-tight truncate max-w-xs">
                    Pipeline: {effectivePageTitle}
                  </h2>
                  <span className="bg-purple-500/15 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded text-[9px] font-bold flex items-center gap-1 shrink-0">
                    <Sparkles className="w-2.5 h-2.5 text-purple-400" /> Laya AI
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <span>Slug:</span>
                  <a 
                    href={`/p/${effectivePageSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-teal-400 hover:text-teal-300 hover:underline flex items-center gap-0.5"
                  >
                    /p/{effectivePageSlug} <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Compact Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleEvaluateLeads}
                disabled={evaluating || submissions.length === 0}
                className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-semibold px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                title="Run Laya qualification scoring"
              >
                {evaluating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Scoring...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-purple-400" /> AI Qualify
                  </>
                )}
              </button>

              <button
                onClick={() => handleDownloadCsv(true)}
                disabled={qualifiedCount === 0}
                className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold px-2 py-1 rounded-md text-[11px] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                title="Download qualified CSV"
              >
                <Download className="w-3 h-3" /> Qualified ({qualifiedCount})
              </button>

              <button
                onClick={() => handleDownloadCsv(false)}
                disabled={submissions.length === 0}
                className="bg-white hover:bg-gray-200 text-[#161B1F] font-bold px-2 py-1 rounded-md text-[11px] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
              >
                <Download className="w-3 h-3" /> All CSV
              </button>

              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer ml-0.5"
                title="Close Drawer (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Compact Inline KPI Bar */}
          <div className="px-4 py-1.5 bg-[#14181C] border-b border-[#2C353D] flex items-center justify-between text-[11px] gap-2 overflow-x-auto">
            <div className="flex items-center gap-4 text-gray-400">
              <span className="flex items-center gap-1">
                Total: <strong className="text-white font-mono">{submissions.length}</strong>
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" /> Qualified: <strong className="font-mono">{qualifiedCount} ({qualifiedPercentage}%)</strong>
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <Clock className="w-3 h-3" /> Review: <strong className="font-mono">{reviewCount}</strong>
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <XCircle className="w-3 h-3" /> Disqualified: <strong className="font-mono">{disqualifiedCount}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={fetchSubmissions}
                disabled={loading}
                title="Refresh leads"
                className="p-1 text-gray-400 hover:text-white hover:bg-white/5 rounded cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin text-purple-400" : ""}`} />
              </button>
            </div>
          </div>

          {/* Compact Filter and Search Toolbar */}
          <div className="px-4 py-2 bg-[#161B1F] border-b border-[#2C353D] flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  filterMode === "all"
                    ? "bg-white text-[#161B1F] font-bold"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                All ({submissions.length})
              </button>
              <button
                onClick={() => setFilterMode("qualified")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  filterMode === "qualified"
                    ? "bg-emerald-500 text-black font-bold"
                    : "text-emerald-400/90 hover:text-emerald-300"
                }`}
              >
                Qualified ({qualifiedCount})
              </button>
              <button
                onClick={() => setFilterMode("review")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  filterMode === "review"
                    ? "bg-amber-500 text-black font-bold"
                    : "text-amber-400/90 hover:text-amber-300"
                }`}
              >
                Review ({reviewCount})
              </button>
              <button
                onClick={() => setFilterMode("disqualified")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  filterMode === "disqualified"
                    ? "bg-rose-500 text-white font-bold"
                    : "text-rose-400/90 hover:text-rose-300"
                }`}
              >
                Disqualified ({disqualifiedCount})
              </button>
            </div>

            {/* Compact Search */}
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads..."
                className="bg-[#0f1418] border border-[#2b353f] rounded-md pl-7 pr-5 py-1 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60 w-36 sm:w-48"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1.5 text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Drawer Body Area */}
          <div className="flex-1 overflow-auto p-3.5 relative">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center text-center space-y-2">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                <p className="text-xs text-gray-400 font-medium">Loading leads pipeline...</p>
              </div>
            ) : submissions.length === 0 ? (
              <div className="py-10 px-4 flex flex-col items-center justify-center text-center border border-dashed border-[#2C353D] rounded-xl bg-[#161B1F]/40 space-y-2.5">
                <div className="w-9 h-9 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Table className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-white">No Submissions Yet</h3>
                <p className="text-[11px] text-gray-400 max-w-sm mx-auto leading-relaxed">
                  Incoming leads from your landing page form will be automatically analyzed and displayed here.
                </p>
                <a
                  href={`/p/${effectivePageSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white hover:bg-gray-200 text-[#161B1F] font-bold px-3.5 py-1.5 rounded-full text-[11px] shadow-sm transition-all flex items-center gap-1 mt-1"
                >
                  Open Live Page <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center border border-[#2C353D] rounded-xl bg-[#161B1F]/30 space-y-1.5">
                <p className="text-xs font-semibold text-white">No matching leads found</p>
                <button
                  onClick={() => {
                    setFilterMode("all");
                    setSearchQuery("");
                  }}
                  className="text-[11px] text-purple-400 hover:underline cursor-pointer"
                >
                  Clear search and filters
                </button>
              </div>
            ) : (
              <div className="border border-[#2C353D] rounded-lg overflow-hidden shadow-sm bg-[#161B1F]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#CBD5E1]">
                    <thead className="bg-[#1E252D] text-white border-b border-[#2C353D] font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-3 py-2 w-8">#</th>
                        <th className="px-3 py-2">Qualification</th>
                        <th className="px-3 py-2 min-w-[160px]">AI Reason</th>
                        <th className="px-3 py-2 whitespace-nowrap">Submitted</th>
                        <th className="px-3 py-2 whitespace-nowrap">Form</th>
                        {dataKeys.map((key) => (
                          <th key={key} className="px-3 py-2 capitalize whitespace-nowrap">
                            {key.replace(/_/g, " ")}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2C353D]">
                      {filteredSubmissions.map((sub, idx) => (
                        <tr 
                          key={sub.id} 
                          onClick={() => setSelectedLead(sub)}
                          className={`hover:bg-[#1E252D]/80 transition-colors cursor-pointer text-xs ${
                            selectedLead?.id === sub.id ? "bg-purple-500/10" : ""
                          }`}
                        >
                          <td className="px-3 py-2 font-mono text-gray-500 font-semibold">{idx + 1}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {getStatusBadge(sub)}
                          </td>
                          <td className="px-3 py-2 max-w-[200px]">
                            {sub.qualification_reason ? (
                              <div className="flex items-center gap-1 text-gray-300">
                                <Info className="w-3 h-3 text-purple-400 shrink-0" />
                                <span className="truncate text-[11px]" title={sub.qualification_reason}>
                                  {sub.qualification_reason}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-500 italic text-[10px]">Unprocessed</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-400 font-mono text-[10px]">
                            {new Date(sub.submitted_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 font-medium text-white whitespace-nowrap text-[11px]">{sub.form_name || "Form"}</td>
                          {dataKeys.map((key) => (
                            <td key={key} className="px-3 py-2 text-white max-w-[140px] truncate text-[11px]">
                              {sub.data?.[key] !== undefined && sub.data?.[key] !== null
                                ? String(sub.data[key])
                                : "-"}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLead(sub);
                              }}
                              className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-0.5 ml-auto cursor-pointer"
                            >
                              Inspect <ChevronRight className="w-2.5 h-2.5" />
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

          {/* Compact Lead Details Drawer Sub-panel (When lead is selected) */}
          {selectedLead && (
            <div className="border-t border-[#2C353D] bg-[#161B1F] p-4 max-h-56 overflow-y-auto animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-[10px]">
                    #{selectedLead.id}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      Lead Details
                      {getStatusBadge(selectedLead)}
                    </h4>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-gray-400 hover:text-white p-0.5 rounded text-[11px] font-semibold cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              {selectedLead.qualification_reason && (
                <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-200 mb-2.5">
                  <div className="flex items-center gap-1 font-bold text-purple-300 mb-0.5">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    Laya AI Evaluation (Score: {selectedLead.qualification_score}/100)
                  </div>
                  <p className="leading-relaxed">{selectedLead.qualification_reason}</p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {selectedLead.data && Object.entries(selectedLead.data).map(([field, val]) => (
                  <div key={field} className="p-2 rounded bg-[#0f1418] border border-[#2b353f]">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 truncate capitalize">
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

          {/* Compact Drawer Footer */}
          <div className="px-4 py-2 border-t border-[#2C353D] bg-[#14181C] flex items-center justify-between text-[11px] text-gray-400">
            <span>
              Showing <strong className="text-white">{filteredSubmissions.length}</strong> of <strong className="text-white">{submissions.length}</strong> leads
            </span>
            <span className="text-[10px] text-gray-500">
              Press <kbd className="px-1 py-0.2 rounded bg-black/40 border border-white/10 text-gray-400 font-mono text-[9px]">Esc</kbd> to close.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
