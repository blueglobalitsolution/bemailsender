import React, { useState, useEffect } from "react";
import { Download, X, Loader2, Table, Calendar, Globe, User, Mail, FileText, CheckCircle2 } from "lucide-react";
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

  useEffect(() => {
    if (!isOpen || !pageId) return;
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
    fetchSubmissions();
  }, [isOpen, pageId]);

  if (!isOpen) return null;

  // Extract all distinct keys across submitted data
  const dataKeys = Array.from(
    new Set(submissions.flatMap((s) => (s.data ? Object.keys(s.data) : [])))
  );

  const handleDownloadCsv = () => {
    const token = localStorage.getItem("access_token");
    const downloadUrl = `${getApiUrl()}/api/landing-pages/${pageId}/export_csv/`;
    
    // Trigger download with auth token
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
        a.download = `leads_${pageSlug}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("CSV downloaded successfully!");
      })
      .catch((err) => {
        console.error(err);
        toast.error("Could not download CSV export");
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#161B1F] border border-[#2C353D] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2C353D] bg-[#1A2026]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Table className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Leads Captured: {pageTitle}
              </h3>
              <p className="text-xs text-[#8E9BA8]">
                Slug: <code className="text-white">/p/{pageSlug}</code> &bull; Total Submissions: {submissions.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownloadCsv}
              disabled={submissions.length === 0}
              className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> Download CSV
            </button>
            <button
              onClick={onClose}
              className="text-[#8E9BA8] hover:text-white p-1.5 rounded-lg hover:bg-[#222930] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-white animate-spin mb-3" />
              <p className="text-xs text-[#8E9BA8]">Loading captured leads...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center border border-dashed border-[#2C353D] rounded-xl bg-[#1A2026]/40">
              <Table className="w-10 h-10 text-[#8E9BA8] mb-3 opacity-50" />
              <p className="text-sm font-semibold text-white mb-1">No Submissions Yet</p>
              <p className="text-xs text-[#8E9BA8] max-w-sm">
                Share this landing page link in your email campaigns. As soon as a contact submits the form, entries will display here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#2C353D] rounded-xl">
              <table className="w-full text-left text-xs text-[#CBD5E1]">
                <thead className="bg-[#1E252D] text-white border-b border-[#2C353D] font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">#</th>
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
                  {submissions.map((sub, idx) => (
                    <tr key={sub.id} className="hover:bg-[#1E252D]/60 transition-colors">
                      <td className="px-4 py-3 font-mono text-[#8E9BA8]">{idx + 1}</td>
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
