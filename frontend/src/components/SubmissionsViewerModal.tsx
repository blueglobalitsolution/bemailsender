import React, { useState, useEffect } from "react";
import { Download, X, Loader2, Table, Sparkles, CheckCircle2, AlertCircle, XCircle, Clock, Info } from "lucide-react";
import { apiFetch, getApiUrl } from "../lib/api";
import { useToast } from "./Toast";

interface Submission {
  id: number;
  landing_page: number;
  page_title: string;
  form: number;
  form_name: string;
  data: Record<string, string>;
  ip_address: string;
  user_agent: string;
  submitted_at: string;
  is_qualified: boolean;
  qualification_score: number;
  qualification_status: "qualified" | "review" | "disqualified" | "unprocessed";
  qualification_reason: string;
}

interface SubmissionsViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: number;
  pageTitle: string;
  pageSlug: string;
}

export default function SubmissionsViewerModal({
  isOpen,
  onClose,
  pageId,
  pageTitle,
  pageSlug,
}: SubmissionsViewerModalProps) {
  const toast = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "qualified" | "review" | "disqualified">("all");
  const [activeReasonTooltip, setActiveReasonTooltip] = useState<number | null>(null);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/landing-pages/${pageId}/submissions/`);
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
    if (!isOpen || !pageId) return;
    fetchSubmissions();
  }, [isOpen, pageId]);

  if (!isOpen) return null;

  const handleEvaluateLeads = async () => {
    try {
      setEvaluating(true);
      const res = await apiFetch(`/api/landing-pages/${pageId}/evaluate_leads/`, {
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
    const token = localStorage.getItem("access_token");
    const query = qualifiedOnly ? "?qualified_only=true" : "";
    const downloadUrl = `${getApiUrl()}/api/landing-pages/${pageId}/export_csv/${query}`;

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
        a.download = `${prefix}_${pageSlug}.csv`;
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

  const filteredSubmissions = submissions.filter((s) => {
    if (filterMode === "all") return true;
    return s.qualification_status === filterMode;
  });

  // Extract all distinct keys across submitted data
  const dataKeys = Array.from(
    new Set(submissions.flatMap((s) => (s.data ? Object.keys(s.data) : [])))
  );

  const getStatusBadge = (sub: Submission) => {
    switch (sub.qualification_status) {
      case "qualified":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Qualified ({sub.qualification_score})
          </span>
        );
      case "review":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertCircle className="w-3.5 h-3.5" /> Review ({sub.qualification_score})
          </span>
        );
      case "disqualified":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" /> Disqualified ({sub.qualification_score})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#2C353D] text-[#8E9BA8] border border-white/10">
            <Clock className="w-3.5 h-3.5" /> Unprocessed
          </span>
        );
    }
  };

  const qualifiedCount = submissions.filter((s) => s.qualification_status === "qualified").length;
  const reviewCount = submissions.filter((s) => s.qualification_status === "review").length;
  const disqualifiedCount = submissions.filter((s) => s.qualification_status === "disqualified").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#161B1F] border border-[#2C353D] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#2C353D] bg-[#1A2026]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Table className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Leads Pipeline: {pageTitle}
                </h3>
                <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Laya + Llama AI
                </span>
              </div>
              <p className="text-xs text-[#8E9BA8]">
                Slug: <code className="text-white">/p/{pageSlug}</code> &bull; Total Submissions: {submissions.length} &bull; Qualified: <span className="text-emerald-400 font-semibold">{qualifiedCount}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleEvaluateLeads}
              disabled={evaluating || submissions.length === 0}
              className="bg-[#2C353D] hover:bg-[#38434D] text-white border border-white/10 font-medium px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-40"
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
              className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> All CSV
            </button>

            <button
              onClick={onClose}
              className="text-[#8E9BA8] hover:text-white p-1.5 rounded-lg hover:bg-[#222930] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="px-6 py-2.5 bg-[#14181C] border-b border-[#2C353D] flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[#8E9BA8] font-medium mr-1">Filter Leads:</span>
            <button
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterMode === "all"
                  ? "bg-white text-[#161B1F] font-bold"
                  : "text-[#8E9BA8] hover:text-white hover:bg-[#1E252D]"
              }`}
            >
              All ({submissions.length})
            </button>
            <button
              onClick={() => setFilterMode("qualified")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterMode === "qualified"
                  ? "bg-emerald-500 text-white font-bold"
                  : "text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              Qualified ({qualifiedCount})
            </button>
            <button
              onClick={() => setFilterMode("review")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterMode === "review"
                  ? "bg-amber-500 text-black font-bold"
                  : "text-amber-400/80 hover:text-amber-400 hover:bg-amber-500/10"
              }`}
            >
              Review ({reviewCount})
            </button>
            <button
              onClick={() => setFilterMode("disqualified")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterMode === "disqualified"
                  ? "bg-rose-500 text-white font-bold"
                  : "text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10"
              }`}
            >
              Disqualified ({disqualifiedCount})
            </button>
          </div>
          <span className="text-[#8E9BA8] text-[11px]">
            Hover over the status pill or info icon to view AI reasoning.
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-white animate-spin mb-3" />
              <p className="text-xs text-[#8E9BA8]">Loading leads pipeline...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center border border-dashed border-[#2C353D] rounded-xl bg-[#1A2026]/40">
              <Table className="w-10 h-10 text-[#8E9BA8] mb-3 opacity-50" />
              <p className="text-sm font-semibold text-white mb-1">No Submissions Yet</p>
              <p className="text-xs text-[#8E9BA8] max-w-sm">
                Share this landing page in your campaigns. Incoming leads will be automatically analyzed by Laya AI and classified here.
              </p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center border border-[#2C353D] rounded-xl bg-[#1A2026]/20">
              <p className="text-sm font-semibold text-white mb-1">No leads match filter "{filterMode}"</p>
              <button
                onClick={() => setFilterMode("all")}
                className="text-xs text-purple-400 hover:underline mt-2"
              >
                Show all submissions
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#2C353D] rounded-xl">
              <table className="w-full text-left text-xs text-[#CBD5E1]">
                <thead className="bg-[#1E252D] text-white border-b border-[#2C353D] font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">AI Qualification</th>
                    <th className="px-4 py-3">AI Reason</th>
                    <th className="px-4 py-3">Submitted At</th>
                    <th className="px-4 py-3">Form Name</th>
                    {dataKeys.map((key) => (
                      <th key={key} className="px-4 py-3 capitalize">
                        {key.replace(/_/g, " ")}
                      </th>
                    ))}
                    <th className="px-4 py-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C353D] bg-[#161B1F]">
                  {filteredSubmissions.map((sub, idx) => (
                    <tr key={sub.id} className="hover:bg-[#1E252D]/60 transition-colors">
                      <td className="px-4 py-3 font-mono text-[#8E9BA8]">{idx + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getStatusBadge(sub)}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {sub.qualification_reason ? (
                          <div
                            className="relative group cursor-pointer"
                            onClick={() =>
                              setActiveReasonTooltip(activeReasonTooltip === sub.id ? null : sub.id)
                            }
                          >
                            <p className="text-white text-xs truncate max-w-[240px] flex items-center gap-1">
                              <Info className="w-3.5 h-3.5 text-[#8E9BA8] flex-shrink-0" />
                              <span className="truncate">{sub.qualification_reason}</span>
                            </p>
                            {/* Detailed popover on hover/click */}
                            <div className="hidden group-hover:block absolute left-0 bottom-full mb-1 z-50 w-72 p-3 bg-[#1F2630] border border-[#38434D] rounded-xl shadow-2xl text-xs text-[#E2E8F0] whitespace-normal pointer-events-none">
                              <div className="font-semibold text-white mb-1 flex items-center gap-1 text-[11px]">
                                <Sparkles className="w-3 h-3 text-purple-400" /> AI Evaluation Note:
                              </div>
                              <p className="text-[11px] leading-relaxed text-[#CBD5E1]">
                                {sub.qualification_reason}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#8E9BA8] italic text-[11px]">Pending AI eval</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[#8E9BA8]">
                        {new Date(sub.submitted_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{sub.form_name}</td>
                      {dataKeys.map((key) => (
                        <td key={key} className="px-4 py-3 text-white max-w-xs truncate">
                          {sub.data?.[key] !== undefined && sub.data?.[key] !== null
                            ? String(sub.data[key])
                            : "-"}
                        </td>
                      ))}
                      <td className="px-4 py-3 font-mono text-[#8E9BA8]">{sub.ip_address || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

