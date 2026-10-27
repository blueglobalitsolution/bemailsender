import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  ArrowLeft, CheckCircle, XCircle, Clock, Terminal, Eye, Mail, RefreshCw, 
  Edit3, Plus, Trash2, Save, X, Loader2, UserX, Users, ExternalLink, ShieldAlert
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../components/Toast";

interface Log {
  id: number;
  recipient: string;
  status: string;
  message: string;
  created_at: string;
}

interface Stats {
  sent: number;
  failed: number;
  skipped?: number;
  opens: number;
  open_rate: number;
  unique_openers?: number;
  unsubscribes?: number;
}

interface OpenedRecipient {
  recipient: string;
  opens_count: number;
  last_opened_at: string;
}

interface UnsubscribedRecipient {
  recipient: string;
  reason: string;
  feedback_reason?: string;
  feedback_text?: string;
  unsubscribed_at: string;
}

interface Contact {
  id: number;
  recipient: string;
  data: string;
}

export default function CampaignLogs() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<Stats>({ sent: 0, failed: 0, opens: 0, open_rate: 0, unique_openers: 0, unsubscribes: 0 });
  const [openedRecipients, setOpenedRecipients] = useState<OpenedRecipient[]>([]);
  const [unsubscribedRecipients, setUnsubscribedRecipients] = useState<UnsubscribedRecipient[]>([]);
  const [activeTab, setActiveTab] = useState<"logs" | "opened" | "unsubscribed">("logs");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [contacts, setContacts] = useState<Record<string, string>[]>([]);
  const [contactKeys, setContactKeys] = useState<string[]>([]);
  const [savingContacts, setSavingContacts] = useState(false);

  const fetchLogs = async () => {
    try {
      const res = await apiFetch(`/api/campaigns/${id}/logs/`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || data);
        setStats(data.stats || { sent: 0, failed: 0, opens: 0, open_rate: 0, unique_openers: 0, unsubscribes: 0 });
        if (data.opened_recipients) {
          setOpenedRecipients(data.opened_recipients);
        }
        if (data.unsubscribed_recipients) {
          setUnsubscribedRecipients(data.unsubscribed_recipients);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const handleRerun = () => {
    toast.confirm("Duplicate this campaign and re-run it?", async () => {
      setRerunning(true);
      try {
        const res = await apiFetch(`/api/campaigns/${id}/rerun/`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          toast.success("Campaign duplicated.");
          navigate(`/campaigns/${data.campaignId}/logs`);
        } else {
          toast.error("Failed to re-run campaign.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Network error.");
      } finally {
        setRerunning(false);
      }
    }, { confirmLabel: "Re-run" });
  };

  const handleRetryFailed = () => {
    toast.confirm("Create a new campaign with only the failed contacts?", async () => {
      setRetryingFailed(true);
      try {
        const res = await apiFetch(`/api/campaigns/${id}/retry_failed/`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          toast.success("Retry campaign launched.");
          navigate(`/campaigns/${data.campaignId}/logs`);
        } else {
          toast.error("Failed to retry campaign.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Network error.");
      } finally {
        setRetryingFailed(false);
      }
    }, { confirmLabel: "Retry Failed" });
  };

  const openEditor = async () => {
    try {
      const res = await apiFetch(`/api/campaigns/${id}/contacts/`);
      if (res.ok) {
        const data: Contact[] = await res.json();
        const rows = data.map((c) => {
          try { return { ...JSON.parse(c.data), recipient: c.recipient }; }
          catch { return { recipient: c.recipient }; }
        });
        const keys = rows.length > 0 ? [...new Set(rows.flatMap(Object.keys))] : ["recipient"];
        setContacts(rows);
        setContactKeys(keys);
        setShowEditor(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addContactRow = () => {
    const empty: Record<string, string> = {};
    contactKeys.forEach((k) => (empty[k] = ""));
    setContacts([...contacts, empty]);
  };

  const removeContactRow = (idx: number) => {
    setContacts(contacts.filter((_, i) => i !== idx));
  };

  const updateContactField = (idx: number, key: string, value: string) => {
    const updated = contacts.map((row, i) =>
      i === idx ? { ...row, [key]: value } : row
    );
    setContacts(updated);
  };

  const saveContacts = async () => {
    setSavingContacts(true);
    try {
      const payload = contacts.map((row) => ({ ...row, email: row.recipient }));
      const res = await apiFetch(`/api/campaigns/${id}/contacts/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowEditor(false);
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingContacts(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading logs...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Link to="/campaigns" className="inline-flex items-center text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors skeuo-text">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Campaigns
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={openEditor}
            className="bg-[#111111] hover:bg-[#1a1a1a] text-[#cccccc] hover:text-white px-5 py-2.5 rounded-none text-xs font-semibold border border-[#222222] transition-all flex items-center gap-2 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit CSV
          </button>
          <button
            onClick={handleRerun}
            disabled={rerunning}
            className="bg-[#19b3d2] hover:bg-[#20c4e6] text-black font-semibold rounded-none px-6 py-2.5 text-xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer border border-[#1499b4]"
          >
            {rerunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {rerunning ? "Re-running..." : "Re-run Campaign"}
          </button>
          <button
            onClick={handleRetryFailed}
            disabled={retryingFailed || stats.failed === 0}
            className="bg-red-950/30 hover:bg-red-900/40 text-red-400 hover:text-white border border-red-900/40 px-6 py-2.5 rounded-none text-xs font-semibold transition-all flex items-center gap-2 disabled:opacity-40 cursor-pointer"
          >
            {retryingFailed ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {retryingFailed ? "Retrying..." : "Retry Failed"} {stats.failed > 0 && `(${stats.failed})`}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="skeuo-card p-4 text-center">
          <Mail className="w-5 h-5 text-blue-500 mx-auto mb-1 drop-shadow-sm" />
          <div className="text-2xl font-bold skeuo-text">{stats.sent}</div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sent</div>
        </div>
        <div className="skeuo-card p-4 text-center">
          <XCircle className="w-5 h-5 text-red-500 mx-auto mb-1 drop-shadow-sm" />
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Failed</div>
        </div>
        <div 
          onClick={() => setActiveTab("opened")}
          className={`skeuo-card p-4 text-center cursor-pointer transition-all hover:border-sky-500/50 ${activeTab === "opened" ? "ring-2 ring-sky-500/50" : ""}`}
        >
          <Eye className="w-5 h-5 text-sky-400 mx-auto mb-1 drop-shadow-sm" />
          <div className="text-2xl font-bold text-sky-400">
            {stats.opens}
            {stats.unique_openers !== undefined && stats.unique_openers > 0 && (
              <span className="text-xs text-gray-400 font-normal ml-1.5" title="Unique contacts">
                ({stats.unique_openers} people)
              </span>
            )}
          </div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-center gap-1">
            Total Opens
          </div>
        </div>
        <div className="skeuo-card p-4 text-center">
          <div className={`text-2xl font-bold ${stats.open_rate >= 50 ? 'text-green-500' : stats.open_rate > 0 ? 'text-amber-500' : 'text-gray-400'}`}>
            {stats.open_rate}%
          </div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Open Rate</div>
        </div>
        <div 
          onClick={() => setActiveTab("unsubscribed")}
          className={`skeuo-card p-4 text-center cursor-pointer transition-all hover:border-amber-500/50 col-span-2 sm:col-span-1 ${activeTab === "unsubscribed" ? "ring-2 ring-amber-500/50" : ""}`}
        >
          <UserX className="w-5 h-5 text-amber-400 mx-auto mb-1 drop-shadow-sm" />
          <div className="text-2xl font-bold text-amber-400">{stats.unsubscribes ?? unsubscribedRecipients.length}</div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Unsubscribed</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#2C353D] pt-2">
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "logs"
              ? "border-[#19b3d2] text-[#19b3d2] bg-[#161B1F]"
              : "border-transparent text-[#8E9BA8] hover:text-white"
          }`}
        >
          <Terminal className="w-4 h-4" /> Live Stream ({logs.length})
        </button>
        <button
          onClick={() => setActiveTab("opened")}
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "opened"
              ? "border-sky-400 text-sky-400 bg-[#161B1F]"
              : "border-transparent text-[#8E9BA8] hover:text-white"
          }`}
        >
          <Eye className="w-4 h-4" /> Opened by ({openedRecipients.length})
        </button>
        <button
          onClick={() => setActiveTab("unsubscribed")}
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "unsubscribed"
              ? "border-amber-400 text-amber-400 bg-[#161B1F]"
              : "border-transparent text-[#8E9BA8] hover:text-white"
          }`}
        >
          <UserX className="w-4 h-4" /> Unsubscribed ({unsubscribedRecipients.length})
        </button>
      </div>

      {/* Tab 1: Live Stream Logs */}
      {activeTab === "logs" && (
        <div className="bg-[#222930] border border-[#2C353D] rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[#2C353D] bg-[#1C2227] flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-4 font-mono text-xs text-[#CBD5E1] font-semibold">Live Transmission Stream</span>
          </div>

          <div className="p-6 h-[500px] overflow-y-auto font-mono text-sm space-y-2 bg-[#161B1F]">
            {logs.length === 0 ? (
              <div className="text-center text-[#8E9BA8] py-12 font-medium">No logs yet...</div>
            ) : (
              logs.map((log) => {
                const isOpener = openedRecipients.some((o) => o.recipient.toLowerCase() === log.recipient.toLowerCase());
                const isUnsub = unsubscribedRecipients.some((u) => u.recipient.toLowerCase() === log.recipient.toLowerCase());

                return (
                  <div key={log.id} className={`flex items-start gap-4 p-3 rounded border ${
                    log.status === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : log.status === 'skipped'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                    <span className="text-[#8E9BA8] whitespace-nowrap">
                      [{new Date(log.created_at).toLocaleTimeString()}]
                    </span>
                    {log.status === 'success' ? (
                      <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                    ) : log.status === 'skipped' ? (
                      <Clock className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                    ) : (
                      <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                    )}
                    <div className="flex-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">{log.recipient}</span>
                      {isOpener && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-sky-950/60 text-sky-400 border border-sky-800/50 px-2 py-0.5 rounded font-sans">
                          <Eye className="w-3 h-3" /> Opened
                        </span>
                      )}
                      {isUnsub && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-950/60 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded font-sans">
                          <UserX className="w-3 h-3" /> Unsubscribed
                        </span>
                      )}
                      <span className="text-[#8E9BA8]">-</span>
                      <span className="text-[#CBD5E1]">{log.message}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Opened Recipients Breakdown */}
      {activeTab === "opened" && (
        <div className="bg-[#222930] border border-[#2C353D] rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[#2C353D] bg-[#1C2227] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" />
                Contacts Who Opened This Campaign
              </h3>
              <p className="text-xs text-[#8E9BA8] mt-0.5">
                Total {openedRecipients.length} unique contact(s) opened your emails ({stats.opens} total opens)
              </p>
            </div>
            <input
              type="text"
              placeholder="Search recipient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#161B1F] border border-[#2C353D] text-white text-xs px-3 py-1.5 rounded focus:outline-none focus:border-sky-500 w-full sm:w-64"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#161B1F] border-b border-[#2C353D] text-[#8E9BA8] uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Recipient Email</th>
                  <th className="py-3 px-4 font-semibold text-center">Open Count</th>
                  <th className="py-3 px-4 font-semibold">Last Opened At</th>
                  <th className="py-3 px-4 font-semibold text-right">Engagement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C353D]/50 font-mono">
                {openedRecipients
                  .filter((o) => !searchQuery || o.recipient.toLowerCase().includes(searchQuery.toLowerCase()))
                  .length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-[#8E9BA8] font-sans">
                      {searchQuery ? "No matching contacts found." : "No recipients have opened this campaign yet."}
                    </td>
                  </tr>
                ) : (
                  openedRecipients
                    .filter((o) => !searchQuery || o.recipient.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#161B1F]/60 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-white">{item.recipient}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.opens_count >= 3
                              ? "bg-purple-950/60 text-purple-300 border border-purple-800/50"
                              : item.opens_count >= 2
                              ? "bg-sky-950/60 text-sky-300 border border-sky-800/50"
                              : "bg-emerald-950/60 text-emerald-300 border border-emerald-800/50"
                          }`}>
                            {item.opens_count} {item.opens_count === 1 ? "time" : "times"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#CBD5E1]">
                          {item.last_opened_at ? new Date(item.last_opened_at).toLocaleString() : "Just now"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-[11px] font-sans text-sky-400 font-medium">
                            {item.opens_count >= 3 ? "🔥 High Interest" : item.opens_count >= 2 ? "⚡ Interested" : "✓ Read"}
                          </span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Unsubscribed Recipients */}
      {activeTab === "unsubscribed" && (
        <div className="bg-[#222930] border border-[#2C353D] rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[#2C353D] bg-[#1C2227] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserX className="w-4 h-4 text-amber-400" />
                Unsubscribed Contacts from This Campaign
              </h3>
              <p className="text-xs text-[#8E9BA8] mt-0.5">
                {unsubscribedRecipients.length} contact(s) requested removal. System has automatically added them to suppression.
              </p>
            </div>
            <Link
              to="/saved-csvs"
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-sans underline"
            >
              Manage Global Suppression <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#161B1F] border-b border-[#2C353D] text-[#8E9BA8] uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 font-semibold">Recipient Email</th>
                  <th className="py-3 px-4 font-semibold">Status / Reason</th>
                  <th className="py-3 px-4 font-semibold">Feedback</th>
                  <th className="py-3 px-4 font-semibold text-right">Unsubscribed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C353D]/50 font-mono">
                {unsubscribedRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-[#8E9BA8] font-sans">
                      🎉 Great news! Nobody has unsubscribed from this campaign.
                    </td>
                  </tr>
                ) : (
                  unsubscribedRecipients.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#161B1F]/60 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white">{item.recipient}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/50 uppercase">
                          {item.reason}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#CBD5E1] font-sans">
                        {item.feedback_reason ? (
                          <span>
                            <strong className="text-white">{item.feedback_reason}</strong>
                            {item.feedback_text ? `: "${item.feedback_text}"` : ""}
                          </span>
                        ) : (
                          <span className="text-[#8E9BA8] italic">No feedback provided</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-[#CBD5E1]">
                        {item.unsubscribed_at ? new Date(item.unsubscribed_at).toLocaleString() : "Recently"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit CSV Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[#222930] border border-[#2C353D] rounded-lg p-6 w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2C353D]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#161B1F] border border-[#2C353D] rounded">
                  <Edit3 className="w-5 h-5 text-[#CBD5E1]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide font-sans">Edit Campaign Contacts</h3>
                  <p className="text-[11px] text-[#8E9BA8] mt-0.5">{contacts.length} recipients scheduled for this campaign</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEditor(false)} 
                className="p-1.5 text-[#888888] hover:text-white hover:bg-[#141417] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto mb-4 border border-[#1f1f23] bg-[#050505] scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="sticky top-0 bg-[#0c0c0e] border-b border-[#1f1f23] z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-[10px] uppercase text-[#666666] border-r border-[#1a1a1e] w-12 text-center">Action</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase text-[#666666] border-r border-[#1a1a1e] w-12 text-center">#</th>
                    {contactKeys.map((key) => (
                      <th key={key} className="py-2.5 px-3 text-[11px] uppercase tracking-wider text-[#00ffff] font-bold border-r border-[#1a1a1e]">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141417]">
                  {contacts.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#0a0a0d] group transition-colors">
                      <td className="py-1.5 px-2 text-center border-r border-[#141417] bg-[#070709]">
                        <button
                          onClick={() => removeContactRow(idx)}
                          title="Delete Contact"
                          className="px-1.5 py-0.5 text-xs text-[#666666] hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 rounded transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                      <td className="py-2 px-3 text-[10px] text-[#555555] text-center border-r border-[#141417] select-none">
                        {idx + 1}
                      </td>
                      {contactKeys.map((key) => (
                        <td key={key} className="p-0 border-r border-[#141417] min-w-[140px]">
                          <input
                            type="text"
                            value={row[key] || ""}
                            onChange={(e) => updateContactField(idx, key, e.target.value)}
                            className="w-full bg-transparent px-3 py-2 text-xs text-[#cccccc] focus:text-white focus:bg-[#0c0c12] focus:outline-none focus:ring-1 focus:ring-[#00ffff]/50 border-none font-mono"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {contacts.length === 0 && (
                    <tr>
                      <td colSpan={contactKeys.length + 2} className="py-12 text-center text-xs text-[#555555]">
                        No contacts available. Click "+ Add Row" to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#1f1f23]">
              <button 
                onClick={addContactRow} 
                className="bg-[#111111] hover:bg-[#1a1a1a] text-white border border-[#262626] hover:border-[#00ffff]/50 text-xs font-mono px-4 py-2 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#00ffff]" /> + Add Row
              </button>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowEditor(false)} 
                  className="bg-[#141414] hover:bg-[#202020] text-[#888888] hover:text-white px-5 py-2 text-xs font-semibold border border-[#222222] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={saveContacts}
                  disabled={savingContacts}
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold px-7 py-2 text-xs flex items-center gap-2 transition-all rounded disabled:opacity-50 cursor-pointer"
                >
                  {savingContacts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {savingContacts ? "Saving..." : "Save Contacts"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
