import React, { useState, useEffect } from "react";
import {
  Inbox as InboxIcon,
  Search,
  RefreshCw,
  Star,
  Trash2,
  Mail,
  MailOpen,
  ArrowRight,
  Settings,
  Plus,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Filter,
  Globe,
  Radio,
  Clock,
  Send,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../components/Toast";

interface InboundConfig {
  id: number;
  name: string;
  provider: "sendgrid" | "mailgun" | "ses" | "postmark" | "generic";
  domain?: string;
  webhook_token: string;
  webhook_url: string;
  is_active: boolean;
  emails_count: number;
  created_at: string;
}

interface ReceivedEmailItem {
  id: number;
  sender: string;
  recipient: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  is_read: boolean;
  is_starred: boolean;
  is_reply: boolean;
  campaign?: number | null;
  campaign_name?: string | null;
  config?: number | null;
  config_name?: string | null;
  provider?: string | null;
  received_at: string;
}

export default function Inbox() {
  const { addToast } = useToast();
  const [emails, setEmails] = useState<ReceivedEmailItem[]>([]);
  const [configs, setConfigs] = useState<InboundConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<ReceivedEmailItem | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "unread" | "starred" | "replies">("all");
  const [selectedConfigId, setSelectedConfigId] = useState<string>("all");

  // Modal State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newConfigName, setNewConfigName] = useState("");
  const [newConfigProvider, setNewConfigProvider] = useState<string>("sendgrid");
  const [newConfigDomain, setNewConfigDomain] = useState("");
  const [creatingConfig, setCreatingConfig] = useState(false);

  // Copied State
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchEmails = async () => {
    try {
      let url = "/api/inbound/emails/";
      const params = new URLSearchParams();
      if (selectedConfigId !== "all") params.append("config_id", selectedConfigId);
      if (searchQuery) params.append("search", searchQuery);
      if (filterMode === "unread") params.append("is_read", "false");
      
      const queryStr = params.toString();
      if (queryStr) url += `?${queryStr}`;

      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        let list: ReceivedEmailItem[] = Array.isArray(data) ? data : data.results || [];
        if (filterMode === "starred") {
          list = list.filter((e) => e.is_starred);
        } else if (filterMode === "replies") {
          list = list.filter((e) => e.is_reply);
        }
        setEmails(list);
        if (selectedEmail) {
          const updated = list.find((e) => e.id === selectedEmail.id);
          if (updated) setSelectedEmail(updated);
        }
      }
    } catch (err) {
      console.error("Failed to load emails", err);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await apiFetch("/api/inbound/configs/");
      if (res.ok) {
        const data = await res.json();
        setConfigs(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Failed to load configs", err);
    }
  };

  useEffect(() => {
    Promise.all([fetchEmails(), fetchConfigs()]).finally(() => setLoading(false));

    const handleOpenModal = () => setShowConfigModal(true);
    window.addEventListener("open-inbound-config-modal", handleOpenModal);
    return () => window.removeEventListener("open-inbound-config-modal", handleOpenModal);
  }, [filterMode, selectedConfigId]);

  const handleSelectEmail = async (email: ReceivedEmailItem) => {
    setSelectedEmail(email);
    if (!email.is_read) {
      try {
        await apiFetch(`/api/inbound/emails/${email.id}/mark_read/`, { method: "POST" });
        setEmails((prev) =>
          prev.map((e) => (e.id === email.id ? { ...e, is_read: true } : e))
        );
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleToggleStar = async (email: ReceivedEmailItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/api/inbound/emails/${email.id}/toggle_star/`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setEmails((prev) =>
          prev.map((item) => (item.id === email.id ? { ...item, is_starred: data.is_starred } : item))
        );
        if (selectedEmail?.id === email.id) {
          setSelectedEmail((prev) => (prev ? { ...prev, is_starred: data.is_starred } : null));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEmail = async (emailId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/api/inbound/emails/${emailId}/`, { method: "DELETE" });
      if (res.ok) {
        setEmails((prev) => prev.filter((item) => item.id !== emailId));
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(null);
        }
        addToast({ title: "Email Deleted", description: "Message removed from inbox.", type: "info" });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConfigName) return;
    setCreatingConfig(true);
    try {
      const res = await apiFetch("/api/inbound/configs/", {
        method: "POST",
        body: JSON.stringify({
          name: newConfigName,
          provider: newConfigProvider,
          domain: newConfigDomain || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setConfigs((prev) => [created, ...prev]);
        setShowConfigModal(false);
        setNewConfigName("");
        setNewConfigDomain("");
        addToast({
          title: "Inbound Webhook Configured",
          description: `Ready for ${created.provider.toUpperCase()} incoming mail.`,
          type: "success",
        });
      }
    } catch (err) {
      addToast({ title: "Error", description: "Failed to create configuration.", type: "error" });
    } finally {
      setCreatingConfig(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    addToast({ title: "Copied!", description: "Webhook URL copied to clipboard.", type: "success" });
    setTimeout(() => setCopiedToken(null), 2500);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] font-sans">
      {/* Main Mail Container */}
      <div className="flex-1 flex flex-col md:flex-row bg-[#222930] border border-[#2C353D] rounded-lg overflow-hidden min-h-0">
        {/* Left Column: Email List + Filter Controls */}
        <div className="w-full md:w-96 lg:w-[420px] border-r border-[#2C353D] flex flex-col shrink-0 bg-[#1C2227]">
          {/* Filter Tabs */}
          <div className="p-3 border-b border-[#2C353D] bg-[#161B1F] flex items-center justify-between gap-1">
            <div className="flex gap-1 overflow-x-auto">
              {(["all", "unread", "replies", "starred"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors cursor-pointer ${
                    filterMode === mode
                      ? "bg-white text-[#161B1F]"
                      : "text-[#8E9BA8] hover:text-white hover:bg-[#222930]"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {configs.length > 0 && (
              <select
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
                className="bg-[#222930] text-xs text-[#CBD5E1] border border-[#2C353D] rounded px-2 py-1 max-w-[120px] truncate"
              >
                <option value="all">All Webhooks</option>
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-[#2C353D] relative bg-[#1C2227]">
            <Search className="w-4 h-4 text-[#8E9BA8] absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search sender, subject or body..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchEmails()}
              className="w-full bg-[#161B1F] border border-[#2C353D] rounded-md py-2 pl-9 pr-3 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#CBD5E1]"
            />
          </div>

          {/* Emails Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#2C353D]">
            {loading ? (
              <div className="p-12 text-center text-xs text-[#8E9BA8]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                Checking for incoming emails...
              </div>
            ) : emails.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#8E9BA8]">
                <Mail className="w-8 h-8 mx-auto mb-3 opacity-30 text-[#CBD5E1]" />
                <p className="font-semibold text-white">No messages found</p>
                <p className="mt-1 text-[11px]">
                  Configure your inbound webhook URL in SendGrid, Mailgun, or Amazon SES to begin receiving.
                </p>
              </div>
            ) : (
              emails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;
                return (
                  <div
                    key={email.id}
                    onClick={() => handleSelectEmail(email)}
                    className={`p-4 transition-all cursor-pointer relative group ${
                      isSelected
                        ? "bg-[#29323A] border-l-4 border-l-white"
                        : email.is_read
                        ? "hover:bg-[#222930]/70"
                        : "bg-[#182026] hover:bg-[#202931] border-l-4 border-l-[#CBD5E1]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`truncate text-xs ${
                            email.is_read ? "font-medium text-[#CBD5E1]" : "font-bold text-white"
                          }`}
                        >
                          {email.sender}
                        </span>
                        {email.is_reply && (
                          <span className="shrink-0 text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                            Reply
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#8E9BA8] whitespace-nowrap shrink-0 font-mono">
                        {new Date(email.received_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <h4
                      className={`text-xs truncate ${
                        email.is_read ? "text-[#CBD5E1] font-normal" : "text-white font-semibold"
                      }`}
                    >
                      {email.subject || "(No Subject)"}
                    </h4>

                    <p className="text-[11px] text-[#8E9BA8] truncate mt-1">
                      {email.body_text || "No preview content available."}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2C353D]/50 text-[10px] text-[#8E9BA8]">
                      <span className="font-mono uppercase tracking-wider text-[9px] bg-[#161B1F] px-1.5 py-0.5 rounded border border-[#2C353D]">
                        {email.provider || "Webhook"}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleToggleStar(email, e)}
                          className="hover:text-amber-400 p-0.5 transition-colors cursor-pointer"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              email.is_starred ? "fill-amber-400 text-amber-400" : ""
                            }`}
                          />
                        </button>
                        <button
                          onClick={(e) => handleDeleteEmail(email.id, e)}
                          className="hover:text-rose-400 p-0.5 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Email Reader View */}
        <div className="flex-1 flex flex-col bg-[#222930] min-h-0 overflow-y-auto">
          {selectedEmail ? (
            <div className="p-6 md:p-8 flex flex-col h-full">
              {/* Message Header */}
              <div className="border-b border-[#2C353D] pb-6 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {selectedEmail.subject || "(No Subject)"}
                  </h2>
                  <div className="flex items-center gap-2">
                    {selectedEmail.campaign_name && (
                      <span className="text-xs bg-[#161B1F] border border-[#2C353D] text-[#CBD5E1] px-2.5 py-1 rounded font-mono">
                        Campaign: {selectedEmail.campaign_name}
                      </span>
                    )}
                    <button
                      onClick={(e) => handleToggleStar(selectedEmail, e)}
                      className="p-2 bg-[#161B1F] border border-[#2C353D] text-[#8E9BA8] hover:text-amber-400 rounded transition-all cursor-pointer"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          selectedEmail.is_starred ? "fill-amber-400 text-amber-400" : ""
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => handleDeleteEmail(selectedEmail.id, e)}
                      className="p-2 bg-[#161B1F] border border-[#2C353D] text-[#8E9BA8] hover:text-rose-400 rounded transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#161B1F] p-4 rounded-lg border border-[#2C353D]">
                  <div>
                    <span className="text-[#8E9BA8] uppercase text-[10px] tracking-wider block">From:</span>
                    <span className="text-white font-medium break-all">{selectedEmail.sender}</span>
                  </div>
                  <div>
                    <span className="text-[#8E9BA8] uppercase text-[10px] tracking-wider block">To:</span>
                    <span className="text-[#CBD5E1] font-medium break-all">{selectedEmail.recipient}</span>
                  </div>
                  <div>
                    <span className="text-[#8E9BA8] uppercase text-[10px] tracking-wider block">Received:</span>
                    <span className="text-[#CBD5E1] font-mono">
                      {new Date(selectedEmail.received_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8E9BA8] uppercase text-[10px] tracking-wider block">Provider:</span>
                    <span className="text-white font-mono uppercase">
                      {selectedEmail.provider || "Generic Webhook"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Message Body Content */}
              <div className="flex-1 bg-[#161B1F] p-6 rounded-lg border border-[#2C353D] overflow-y-auto">
                {selectedEmail.body_html ? (
                  <div
                    className="prose prose-invert max-w-none text-white text-sm"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-[#CBD5E1] leading-relaxed">
                    {selectedEmail.body_text || "No message body provided."}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-[#8E9BA8]">
              <MailOpen className="w-12 h-12 mb-3 opacity-30 text-[#CBD5E1]" />
              <h3 className="text-base font-bold text-white">Select an email to read</h3>
              <p className="text-xs max-w-md mt-1 text-[#8E9BA8]">
                Incoming messages from SendGrid, Mailgun, Amazon SES or Postmark will display here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Webhook Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-[#222930] border border-[#2C353D] rounded-xl p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#2C353D]">
              <div>
                <h3 className="text-lg font-bold text-white">Inbound Webhooks Configuration</h3>
                <p className="text-xs text-[#8E9BA8] mt-0.5">
                  Connect email providers to automatically receive incoming emails and track campaign replies.
                </p>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-[#8E9BA8] hover:text-white text-sm px-2 py-1"
              >
                ✕
              </button>
            </div>

            {/* Existing Webhooks List */}
            <div className="space-y-4 mb-8">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Active Webhook Endpoints</h4>
              {configs.length === 0 ? (
                <div className="p-4 bg-[#161B1F] rounded border border-[#2C353D] text-xs text-[#8E9BA8] text-center">
                  No active webhooks configured yet. Create one below!
                </div>
              ) : (
                configs.map((cfg) => {
                  const fullUrl = `${window.location.origin}/api/inbound/webhook/${cfg.webhook_token}/`;
                  return (
                    <div
                      key={cfg.id}
                      className="p-4 bg-[#161B1F] border border-[#2C353D] rounded-lg space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{cfg.name}</span>
                          <span className="text-[10px] bg-[#222930] border border-[#2C353D] text-[#CBD5E1] px-2 py-0.5 rounded font-mono uppercase">
                            {cfg.provider}
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-400 font-mono">
                          {cfg.emails_count} received
                        </span>
                      </div>

                      {cfg.domain && (
                        <p className="text-xs text-[#8E9BA8]">
                          Target Domain: <span className="text-white font-mono">{cfg.domain}</span>
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          readOnly
                          value={fullUrl}
                          className="flex-1 bg-[#1C2227] border border-[#2C353D] rounded py-1.5 px-3 text-xs font-mono text-[#CBD5E1] select-all focus:outline-none"
                        />
                        <button
                          onClick={() => copyToClipboard(fullUrl, cfg.webhook_token)}
                          className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          {copiedToken === cfg.webhook_token ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copy URL
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Create New Webhook Form */}
            <form onSubmit={handleCreateConfig} className="border-t border-[#2C353D] pt-6 space-y-4">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add New Inbound Provider
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-[#8E9BA8] mb-1 font-medium">
                    Configuration Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Production SendGrid Inbound"
                    value={newConfigName}
                    onChange={(e) => setNewConfigName(e.target.value)}
                    className="w-full bg-[#161B1F] border border-[#2C353D] rounded p-2.5 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#CBD5E1]"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest text-[#8E9BA8] mb-1 font-medium">
                    Email Service Provider
                  </label>
                  <select
                    value={newConfigProvider}
                    onChange={(e) => setNewConfigProvider(e.target.value)}
                    className="w-full bg-[#161B1F] border border-[#2C353D] rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#CBD5E1]"
                  >
                    <option value="sendgrid">SendGrid (Inbound Parse)</option>
                    <option value="mailgun">Mailgun (Inbound Routing)</option>
                    <option value="ses">Amazon SES (SNS Notification)</option>
                    <option value="postmark">Postmark (Inbound Webhook)</option>
                    <option value="generic">Generic Webhook (Custom HTTP POST)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs uppercase tracking-widest text-[#8E9BA8] mb-1 font-medium">
                    Inbound Domain (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. mail.yourdomain.com"
                    value={newConfigDomain}
                    onChange={(e) => setNewConfigDomain(e.target.value)}
                    className="w-full bg-[#161B1F] border border-[#2C353D] rounded p-2.5 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#CBD5E1]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-xs text-[#8E9BA8] hover:text-white"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={creatingConfig || !newConfigName}
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold text-xs px-6 py-2 rounded transition-all cursor-pointer disabled:opacity-50"
                >
                  {creatingConfig ? "Creating..." : "Generate Webhook URL"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
