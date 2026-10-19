import React, { useState, useEffect } from "react";
import { 
  Server, 
  Trash2, 
  Save, 
  Edit2, 
  ChevronDown, 
  ChevronRight, 
  Key, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Zap, 
  ExternalLink, 
  RefreshCw,
  Send,
  ShieldCheck
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../components/Toast";

interface Identity {
  id: number;
  name: string;
  host: string;
  port: number;
  smtp_user: string;
  smtp_pass?: string;
  smtp_from_name?: string;
  smtp_from_email?: string;
  use_tls?: boolean;
  use_ssl?: boolean;
  secure?: boolean;
  daily_limit: number;
  daily_sent: number;
  daily_date: string | null;
  last_verified_at?: string | null;
}

interface IdentityGroup {
  id: number;
  name: string;
  identities: Identity[];
  created_at: string;
}

type ProviderType = "brevo" | "gmail" | "custom";
type BrevoSubMode = "api" | "smtp";

export default function Identities() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'identities' | 'groups'>('identities');

  // Identity state
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingIdentityId, setEditingIdentityId] = useState<number | null>(null);

  const [provider, setProvider] = useState<ProviderType>("brevo");
  const [brevoMode, setBrevoMode] = useState<BrevoSubMode>("api");
  const [showPassword, setShowPassword] = useState(false);

  // Send Test Email Popup State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testTargetIdentity, setTestTargetIdentity] = useState<Identity | null>(null);
  const [testRecipientName, setTestRecipientName] = useState("");
  const [testRecipientEmail, setTestRecipientEmail] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testModalError, setTestModalError] = useState<string | null>(null);
  const [testModalSuccess, setTestModalSuccess] = useState<string | null>(null);

  const [newIdentity, setNewIdentity] = useState({
    name: "",
    host: "api.brevo.com",
    port: "443",
    smtp_user: "",
    smtp_pass: "",
    smtp_from_name: "",
    smtp_from_email: "",
    daily_limit: "300",
    secure: false,
  });

  // Group state
  const [groups, setGroups] = useState<IdentityGroup[]>([]);
  const [allIdentities, setAllIdentities] = useState<Identity[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const fetchIdentities = async () => {
    try {
      const res = await apiFetch("/api/identities/");
      if (res.ok) {
        const data = await res.json();
        setIdentities(data);
        setAllIdentities(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await apiFetch("/api/identity-groups/");
      if (res.ok) setGroups(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchIdentities();
    fetchGroups();

    const handleOpenCreateIdentity = () => {
      if (activeTab === 'identities') {
        setIsCreating(true);
        handleProviderSelect("brevo", "api");
      } else {
        resetGroupForm();
        setIsCreatingGroup(true);
      }
    };

    window.addEventListener("open-create-identity-modal", handleOpenCreateIdentity);

    return () => {
      window.removeEventListener("open-create-identity-modal", handleOpenCreateIdentity);
    };
  }, [activeTab]);

  const handleProviderSelect = (type: ProviderType, mode: BrevoSubMode = "api") => {
    setProvider(type);
    setBrevoMode(mode);

    if (type === "brevo") {
      if (mode === "api") {
        setNewIdentity((prev) => ({
          ...prev,
          host: "api.brevo.com",
          port: "443",
          daily_limit: prev.daily_limit || "300",
          secure: false,
        }));
      } else {
        setNewIdentity((prev) => ({
          ...prev,
          host: "smtp-relay.brevo.com",
          port: "587",
          daily_limit: prev.daily_limit || "300",
          secure: false,
        }));
      }
    } else if (type === "gmail") {
      setNewIdentity((prev) => ({
        ...prev,
        host: "smtp.gmail.com",
        port: "587",
        daily_limit: prev.daily_limit || "500",
        secure: false,
      }));
    } else {
      setNewIdentity((prev) => ({
        ...prev,
        host: prev.host === "api.brevo.com" || prev.host === "smtp-relay.brevo.com" || prev.host === "smtp.gmail.com" ? "" : prev.host,
        port: prev.port || "587",
        daily_limit: prev.daily_limit || "295",
      }));
    }
  };

  const resetIdentityForm = () => {
    setIsCreating(false);
    setEditingIdentityId(null);
    setNewIdentity({
      name: "",
      host: "api.brevo.com",
      port: "443",
      smtp_user: "",
      smtp_pass: "",
      smtp_from_name: "",
      smtp_from_email: "",
      daily_limit: "300",
      secure: false,
    });
    setProvider("brevo");
    setBrevoMode("api");
    setShowPassword(false);
  };

  const handleIdentityEdit = (identity: Identity) => {
    setEditingIdentityId(identity.id);
    setIsCreating(true);

    const h = (identity.host || "").toLowerCase();
    if (h === "api.brevo.com" || h === "brevo" || h.includes("brevo")) {
      setProvider("brevo");
      if (h.includes("relay") || identity.port === 587) {
        setBrevoMode("smtp");
      } else {
        setBrevoMode("api");
      }
    } else if (h.includes("gmail")) {
      setProvider("gmail");
    } else {
      setProvider("custom");
    }

    setNewIdentity({
      name: identity.name,
      host: identity.host,
      port: String(identity.port),
      smtp_user: identity.smtp_user,
      smtp_pass: "",
      smtp_from_name: identity.smtp_from_name || "",
      smtp_from_email: identity.smtp_from_email || identity.smtp_user,
      daily_limit: String(identity.daily_limit || 300),
      secure: identity.secure || false,
    });
  };

  // Open test popup from the form
  const openTestModalFromForm = () => {
    if (!newIdentity.smtp_user.trim()) {
      toast.error("Please enter sender email address first");
      return;
    }
    if (!editingIdentityId && !newIdentity.smtp_pass.trim()) {
      toast.error(provider === "brevo" && brevoMode === "api" ? "Please enter your Brevo API key first" : "Please enter your password first");
      return;
    }
    setTestTargetIdentity(null);
    setTestModalError(null);
    setTestModalSuccess(null);
    setTestModalOpen(true);
  };

  // Open test popup from an identity card in the list
  const openTestModalFromCard = (identity: Identity) => {
    setTestTargetIdentity(identity);
    setTestModalError(null);
    setTestModalSuccess(null);
    setTestModalOpen(true);
  };

  // Handle actual sending of the test email
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipientEmail.trim()) {
      setTestModalError("Please enter recipient email");
      return;
    }

    setSendingTestEmail(true);
    setTestModalError(null);
    setTestModalSuccess(null);

    try {
      let endpoint = "";
      let payload: any = {
        recipient_email: testRecipientEmail.trim(),
        recipient_name: testRecipientName.trim(),
      };

      if (testTargetIdentity) {
        endpoint = `/api/identities/${testTargetIdentity.id}/test/`;
      } else if (editingIdentityId) {
        endpoint = `/api/identities/${editingIdentityId}/test/`;
        payload = {
          ...payload,
          host: newIdentity.host,
          port: parseInt(newIdentity.port) || 587,
          smtp_user: newIdentity.smtp_user,
          smtp_pass: newIdentity.smtp_pass,
          smtp_from_name: newIdentity.smtp_from_name,
          smtp_from_email: newIdentity.smtp_from_email,
          use_tls: provider === "custom" ? !newIdentity.secure : true,
          use_ssl: provider === "custom" ? newIdentity.secure : false,
        };
      } else {
        endpoint = "/api/identities/test-new/";
        payload = {
          ...payload,
          host: newIdentity.host,
          port: parseInt(newIdentity.port) || 587,
          smtp_user: newIdentity.smtp_user,
          smtp_pass: newIdentity.smtp_pass,
          smtp_from_name: newIdentity.smtp_from_name,
          smtp_from_email: newIdentity.smtp_from_email,
          use_tls: provider === "custom" ? !newIdentity.secure : true,
          use_ssl: provider === "custom" ? newIdentity.secure : false,
        };
      }

      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const msg = data.message || `Test email successfully sent to ${testRecipientEmail}!`;
        setTestModalSuccess(msg);
        toast.success(msg);
        fetchIdentities();
        setTimeout(() => {
          setTestModalOpen(false);
          setTestModalSuccess(null);
        }, 1600);
      } else {
        const errMsg = data.message || "Failed to send test email. Please check your credentials.";
        setTestModalError(errMsg);
        toast.error(errMsg);
      }
    } catch (err: any) {
      const errMsg = err.message || "Network error while sending test email.";
      setTestModalError(errMsg);
      toast.error(errMsg);
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleIdentitySave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdentity.name.trim()) {
      toast.error("Please enter a profile name");
      return;
    }
    if (!newIdentity.smtp_user.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    if (!editingIdentityId && !newIdentity.smtp_pass.trim()) {
      toast.error(provider === "brevo" && brevoMode === "api" ? "Brevo API Key is required" : "Password is required");
      return;
    }

    try {
      const payload: any = {
        name: newIdentity.name.trim(),
        host: newIdentity.host.trim() || (provider === "brevo" ? (brevoMode === "api" ? "api.brevo.com" : "smtp-relay.brevo.com") : "smtp.gmail.com"),
        port: parseInt(newIdentity.port) || (provider === "brevo" && brevoMode === "api" ? 443 : 587),
        smtp_user: newIdentity.smtp_user.trim(),
        smtp_from_name: newIdentity.smtp_from_name.trim() || undefined,
        smtp_from_email: newIdentity.smtp_from_email.trim() || newIdentity.smtp_user.trim(),
        daily_limit: parseInt(newIdentity.daily_limit) || (provider === "gmail" ? 500 : 300),
        use_tls: provider === "custom" ? !newIdentity.secure : true,
        use_ssl: provider === "custom" ? newIdentity.secure : false,
      };

      if (newIdentity.smtp_pass.trim()) {
        payload.smtp_pass = newIdentity.smtp_pass.trim();
      }

      const endpoint = editingIdentityId ? `/api/identities/${editingIdentityId}/` : "/api/identities/";
      const method = editingIdentityId ? "PUT" : "POST";

      const res = await apiFetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingIdentityId ? "Identity updated successfully." : "New identity created.");
        resetIdentityForm();
        fetchIdentities();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.name ? `Error: ${err.name[0]}` : "Failed to save identity. Please verify fields.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error while saving identity.");
    }
  };

  const handleIdentityDelete = (id: number) => {
    toast.confirm("Are you sure you want to delete this identity?", async () => {
      try {
        const res = await apiFetch(`/api/identities/${id}/`, { method: "DELETE" });
        if (res.ok) {
          fetchIdentities();
          toast.success("Identity deleted successfully.");
        } else {
          toast.error("Failed to delete identity.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Network error deleting identity.");
      }
    });
  };

  // Group handlers
  const resetGroupForm = () => {
    setNewGroupName("");
    setSelectedGroupIds([]);
    setIsCreatingGroup(false);
    setEditingGroupId(null);
  };

  const handleGroupSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const body = { name: newGroupName.trim(), identity_ids: selectedGroupIds };
    try {
      if (editingGroupId !== null) {
        const res = await apiFetch(`/api/identity-groups/${editingGroupId}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) toast.success("Identity group updated.");
      } else {
        const res = await apiFetch("/api/identity-groups/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) toast.success("Identity group created.");
      }
      resetGroupForm();
      fetchGroups();
    } catch (err) {
      console.error(err);
      toast.error("Error saving identity group.");
    }
  };

  const handleGroupDelete = (id: number) => {
    toast.confirm("Are you sure you want to delete this identity group?", async () => {
      try {
        const res = await apiFetch(`/api/identity-groups/${id}/`, { method: "DELETE" });
        if (res.ok) {
          fetchGroups();
          toast.success("Identity group deleted.");
        } else {
          toast.error("Failed to delete group.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Network error deleting group.");
      }
    });
  };

  const handleGroupEdit = (group: IdentityGroup) => {
    setEditingGroupId(group.id);
    setNewGroupName(group.name);
    setSelectedGroupIds(group.identities.map((i) => i.id));
  };

  const toggleGroupIdentity = (id: number) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getProviderInfo = (identity: Identity) => {
    const h = (identity.host || "").toLowerCase();
    if (h === "api.brevo.com" || h === "brevo" || (h.includes("brevo") && !h.includes("relay"))) {
      return {
        type: "brevo-api",
        badge: "Brevo API",
        badgeColor: "bg-teal-500/10 text-teal-400 border-teal-500/30",
        icon: <Zap className="w-3.5 h-3.5 text-teal-400" />,
        desc: "REST API v3 (Direct)"
      };
    }
    if (h.includes("brevo") && h.includes("relay")) {
      return {
        type: "brevo-smtp",
        badge: "Brevo SMTP",
        badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
        icon: <Send className="w-3.5 h-3.5 text-blue-400" />,
        desc: "Brevo SMTP Relay (Port 587)"
      };
    }
    if (h.includes("gmail")) {
      return {
        type: "gmail",
        badge: "Google Gmail",
        badgeColor: "bg-red-500/10 text-red-400 border-red-500/30",
        icon: <span className="font-bold text-red-400 text-xs">G</span>,
        desc: "Gmail SMTP"
      };
    }
    return {
      type: "custom",
      badge: "Custom SMTP",
      badgeColor: "bg-gray-500/10 text-gray-400 border-gray-500/30",
      icon: <Server className="w-3.5 h-3.5 text-gray-400" />,
      desc: `${identity.host}:${identity.port}`
    };
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading connected providers...</div>;

  return (
    <div className="space-y-8">
      {/* Top tab switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 bg-[#222930] border border-[#2C353D] rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('identities')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'identities' 
                ? 'bg-white text-[#161B1F] shadow-sm' 
                : 'text-[#8E9BA8] hover:text-white'
            }`}
          >
            Connected Providers ({identities.length})
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'groups' 
                ? 'bg-white text-[#161B1F] shadow-sm' 
                : 'text-[#8E9BA8] hover:text-white'
            }`}
          >
            Provider Groups ({groups.length})
          </button>
        </div>
      </div>

      {/* Identities Tab */}
      {activeTab === 'identities' && (
        <>
          {isCreating && (
            <div className="skeuo-card p-6 md:p-8 border border-[#00ffff]/30 shadow-[0_0_24px_rgba(0,255,255,0.08)] transition-all">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold skeuo-text flex items-center gap-2">
                    {editingIdentityId ? "Edit Connected Provider" : "Connect Email Provider"}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Configure Brevo (Sendinblue), Google, or any custom SMTP server to send campaigns.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetIdentityForm}
                  className="text-xs text-[#888888] hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-[#111] border border-[#222] cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              {/* Provider Selection Tabs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Brevo */}
                <button
                  type="button"
                  onClick={() => handleProviderSelect("brevo", "api")}
                  className={`p-4 rounded-xl border transition-all flex flex-col items-start text-left gap-2 cursor-pointer relative ${
                    provider === "brevo" 
                      ? "bg-[#00ffff]/10 border-[#00ffff] text-white shadow-[0_0_20px_rgba(0,255,255,0.18)]" 
                      : "bg-[#0a0a0a] border-[#1e1e1e] text-[#888888] hover:border-[#333333] hover:text-white"
                  }`}
                >
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    Recommended
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center font-black text-teal-300 text-base">
                      B
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Brevo</div>
                      <div className="text-[11px] text-gray-400">Sendinblue (API & SMTP)</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                    Direct API Key connection. Bypasses port 587 blockages and high delivery rate.
                  </p>
                </button>

                {/* Google Gmail */}
                <button
                  type="button"
                  onClick={() => handleProviderSelect("gmail")}
                  className={`p-4 rounded-xl border transition-all flex flex-col items-start text-left gap-2 cursor-pointer ${
                    provider === "gmail" 
                      ? "bg-[#00ffff]/10 border-[#00ffff] text-white shadow-[0_0_20px_rgba(0,255,255,0.18)]" 
                      : "bg-[#0a0a0a] border-[#1e1e1e] text-[#888888] hover:border-[#333333] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center font-bold text-red-400 text-base">
                      G
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Google (Gmail)</div>
                      <div className="text-[11px] text-gray-400">Workspace / Personal</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                    Use with Google 16-character App Passwords on standard Gmail SMTP.
                  </p>
                </button>

                {/* Custom SMTP */}
                <button
                  type="button"
                  onClick={() => handleProviderSelect("custom")}
                  className={`p-4 rounded-xl border transition-all flex flex-col items-start text-left gap-2 cursor-pointer ${
                    provider === "custom" 
                      ? "bg-[#00ffff]/10 border-[#00ffff] text-white shadow-[0_0_20px_rgba(0,255,255,0.18)]" 
                      : "bg-[#0a0a0a] border-[#1e1e1e] text-[#888888] hover:border-[#333333] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gray-500/20 border border-gray-500/40 flex items-center justify-center font-bold text-gray-300">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Custom SMTP</div>
                      <div className="text-[11px] text-gray-400">Any SMTP Provider</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                    Connect any custom mail server, Amazon SES, SendGrid, Mailgun, or Office 365.
                  </p>
                </button>
              </div>

              {/* Sub-mode switcher for Brevo */}
              {provider === "brevo" && (
                <div className="mb-6 p-4 rounded-xl bg-[#0f1418] border border-[#232b32] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" /> Brevo Connection Mode
                    </span>
                    <a 
                      href="https://app.brevo.com/settings/keys/api" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-teal-400 hover:text-teal-300 underline flex items-center gap-1"
                    >
                      Get Brevo API Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleProviderSelect("brevo", "api")}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        brevoMode === "api"
                          ? "bg-teal-500 text-black shadow-[0_0_12px_rgba(20,184,166,0.4)]"
                          : "bg-[#182026] text-gray-400 hover:text-white border border-[#2b353f]"
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" /> Brevo API Key (Fast & Recommended)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProviderSelect("brevo", "smtp")}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        brevoMode === "smtp"
                          ? "bg-teal-500 text-black shadow-[0_0_12px_rgba(20,184,166,0.4)]"
                          : "bg-[#182026] text-gray-400 hover:text-white border border-[#2b353f]"
                      }`}
                    >
                      <Server className="w-3.5 h-3.5" /> Brevo SMTP Relay
                    </button>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleIdentitySave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Profile Name */}
                  <div className="col-span-full">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Profile Name (Reference) <span className="text-red-400">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={newIdentity.name} 
                      onChange={(e) => setNewIdentity({ ...newIdentity, name: e.target.value })} 
                      className="w-full skeuo-input py-3 px-4 text-white" 
                      placeholder={provider === "brevo" ? "e.g., Marketing Team - Brevo API" : "e.g., Support Team Gmail"} 
                      required 
                    />
                  </div>

                  {/* Custom SMTP host/port */}
                  {provider === "custom" && (
                    <>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                          SMTP Host <span className="text-red-400">*</span>
                        </label>
                        <input 
                          type="text" 
                          value={newIdentity.host} 
                          onChange={(e) => setNewIdentity({ ...newIdentity, host: e.target.value })} 
                          className="w-full skeuo-input py-3 px-4 text-white" 
                          placeholder="smtp.example.com" 
                          required 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                          SMTP Port <span className="text-red-400">*</span>
                        </label>
                        <input 
                          type="text" 
                          value={newIdentity.port} 
                          onChange={(e) => setNewIdentity({ ...newIdentity, port: e.target.value })} 
                          className="w-full skeuo-input py-3 px-4 text-white" 
                          placeholder="587" 
                          required 
                        />
                      </div>
                    </>
                  )}

                  {/* Brevo SMTP host/port info */}
                  {provider === "brevo" && brevoMode === "smtp" && (
                    <>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                          SMTP Host
                        </label>
                        <input 
                          type="text" 
                          value={newIdentity.host} 
                          onChange={(e) => setNewIdentity({ ...newIdentity, host: e.target.value })} 
                          className="w-full skeuo-input py-3 px-4 text-white font-mono text-sm" 
                          placeholder="smtp-relay.brevo.com" 
                          required 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                          SMTP Port
                        </label>
                        <input 
                          type="text" 
                          value={newIdentity.port} 
                          onChange={(e) => setNewIdentity({ ...newIdentity, port: e.target.value })} 
                          className="w-full skeuo-input py-3 px-4 text-white font-mono text-sm" 
                          placeholder="587" 
                          required 
                        />
                      </div>
                    </>
                  )}

                  {/* Sender Display Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Sender Name (Display Name)
                    </label>
                    <input 
                      type="text" 
                      value={newIdentity.smtp_from_name} 
                      onChange={(e) => setNewIdentity({ ...newIdentity, smtp_from_name: e.target.value })} 
                      className="w-full skeuo-input py-3 px-4 text-white" 
                      placeholder="e.g., Your Name or Sales Team" 
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Name seen by the recipient in their inbox header.</p>
                  </div>

                  {/* Sender Email / Username */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      {provider === "brevo" 
                        ? (brevoMode === "api" ? "Sender Email (Verified in Brevo)" : "Brevo Account Email") 
                        : (provider === "gmail" ? "Gmail Address" : "SMTP Username / Email")} <span className="text-red-400">*</span>
                    </label>
                    <input 
                      type="email" 
                      value={newIdentity.smtp_user} 
                      onChange={(e) => setNewIdentity({ 
                        ...newIdentity, 
                        smtp_user: e.target.value,
                        smtp_from_email: newIdentity.smtp_from_email || e.target.value 
                      })} 
                      className="w-full skeuo-input py-3 px-4 text-white" 
                      placeholder="you@yourdomain.com" 
                      required 
                    />
                    {provider === "brevo" && (
                      <p className="text-[10px] text-teal-400 mt-1">
                        Must be a verified sender in your Brevo account (Settings → Senders & IP).
                      </p>
                    )}
                  </div>

                  {/* Password / API Key */}
                  <div className="col-span-full">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
                        {provider === "brevo" 
                          ? (brevoMode === "api" ? "Brevo API Key" : "Brevo Master SMTP Key") 
                          : (provider === "gmail" ? "Google 16-Digit App Password" : "SMTP Password")} <span className="text-red-400">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-xs text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>

                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={newIdentity.smtp_pass} 
                        onChange={(e) => setNewIdentity({ ...newIdentity, smtp_pass: e.target.value })} 
                        className="w-full skeuo-input py-3 px-4 text-white font-mono text-sm pr-10" 
                        placeholder={
                          editingIdentityId 
                            ? "•••••••• (Leave blank to keep existing key/password)" 
                            : (provider === "brevo" 
                                ? (brevoMode === "api" ? "xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" : "xsmtpsib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") 
                                : (provider === "gmail" ? "xxxx xxxx xxxx xxxx" : "Your SMTP Password"))
                        } 
                        required={!editingIdentityId} 
                      />
                      <div className="absolute right-3 top-3.5 text-gray-500">
                        <Key className="w-4 h-4" />
                      </div>
                    </div>

                    {provider === "brevo" && brevoMode === "api" && (
                      <p className="text-[11px] text-gray-400 mt-2">
                        💡 Where to get it: Log into <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noopener noreferrer" className="text-teal-400 underline">Brevo Dashboard → Settings → SMTP & API → API Keys</a> and copy your key (starts with <span className="font-mono text-teal-300">xkeysib-</span>).
                      </p>
                    )}
                    {provider === "gmail" && (
                      <p className="text-[11px] text-blue-400 mt-2 font-medium">
                        Must be a Google App Password from <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline font-bold">Google Security</a>, not your standard Google login password.
                      </p>
                    )}
                  </div>

                  {/* Daily Limit */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Daily Send Limit
                    </label>
                    <input 
                      type="number" 
                      value={newIdentity.daily_limit} 
                      onChange={(e) => setNewIdentity({ ...newIdentity, daily_limit: e.target.value })} 
                      className="w-full skeuo-input py-3 px-4 text-white" 
                      placeholder="300" 
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Brevo Free tier sends up to 300 emails/day. Gmail allows up to 500/day.
                    </p>
                  </div>

                  {/* Custom SMTP SSL checkbox */}
                  {provider === "custom" && (
                    <div className="flex items-center pt-6">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={newIdentity.secure} 
                          onChange={(e) => setNewIdentity({ ...newIdentity, secure: e.target.checked })} 
                          className="w-5 h-5 rounded border-gray-600 bg-black/40 text-teal-500 focus:ring-teal-500" 
                        />
                        <span className="text-sm font-semibold text-gray-300">
                          Use Secure SSL Connection (Port 465)
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#1e242a]">
                  <button
                    type="button"
                    onClick={openTestModalFromForm}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold border border-teal-500/40 text-teal-300 hover:bg-teal-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-teal-400" /> Test Connection (Send Test Email)
                  </button>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button 
                      type="button" 
                      onClick={resetIdentityForm} 
                      className="bg-[#111111] hover:bg-[#1a1a1a] text-[#888888] hover:text-white px-5 py-2.5 rounded-full text-xs font-semibold border border-[#222222] transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="bg-[#00ffff] hover:bg-[#33ffff] text-black font-semibold rounded-full px-7 py-2.5 text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,255,255,0.25)] hover:shadow-[0_0_28px_rgba(0,255,255,0.4)] cursor-pointer"
                    >
                      <Save className="w-4 h-4" /> {editingIdentityId ? "Update Identity" : "Save Identity"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {identities.map((identity) => {
              const pInfo = getProviderInfo(identity);
              const percentUsed = Math.min(100, Math.round(((identity.daily_sent || 0) / (identity.daily_limit || 300)) * 100));

              return (
                <div 
                  key={identity.id} 
                  className="skeuo-card p-6 flex flex-col justify-between group hover:border-[#333333] transition-all relative overflow-hidden"
                >
                  <div>
                    {/* Header: Provider badge and actions */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${pInfo.badgeColor}`}>
                        {pInfo.icon}
                        {pInfo.badge}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => openTestModalFromCard(identity)} 
                          title="Send Test Email"
                          className="px-2.5 py-1 bg-[#111] hover:bg-teal-500/10 text-teal-400 hover:text-teal-300 border border-teal-500/30 rounded-md transition-all cursor-pointer text-xs font-semibold flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> Test
                        </button>
                        <button 
                          onClick={() => handleIdentityEdit(identity)} 
                          title="Edit Identity"
                          className="p-1.5 bg-[#111111] hover:bg-[#1a1a1a] text-[#888888] hover:text-[#00ffff] border border-[#222222] hover:border-[#00ffff]/40 rounded-md transition-all cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleIdentityDelete(identity.id)} 
                          title="Delete Identity"
                          className="p-1.5 skeuo-btn-danger rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Identity Name */}
                    <h3 className="font-bold text-lg text-white line-clamp-1 mb-1" title={identity.name}>
                      {identity.name}
                    </h3>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mb-4 truncate">
                      <Mail className="w-3 h-3 text-gray-500 shrink-0" />
                      {identity.smtp_from_name ? `${identity.smtp_from_name} <${identity.smtp_user}>` : identity.smtp_user}
                    </p>

                    {/* Technical details box */}
                    <div className="space-y-2 skeuo-inset-box p-3 rounded-lg text-xs">
                      <div className="flex items-center justify-between text-gray-400">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Endpoint</span>
                        <span className="font-mono text-gray-300 truncate max-w-[170px]" title={identity.host}>
                          {identity.host}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-gray-400">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Port / Protocol</span>
                        <span className="font-mono font-bold text-gray-300">
                          {pInfo.type === "brevo-api" ? "HTTPS (443)" : `${identity.port} (${identity.secure ? "SSL" : "TLS"})`}
                        </span>
                      </div>
                      {identity.last_verified_at && (
                        <div className="flex items-center justify-between text-teal-400 pt-1 border-t border-[#1e242a]">
                          <span className="flex items-center gap-1 text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(identity.last_verified_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Daily limit gauge */}
                  <div className="pt-4 mt-3 border-t border-[#1e242a]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-gray-400 font-medium">Daily Quota</span>
                      <span className="font-mono font-bold text-gray-200">
                        {identity.daily_sent || 0} / {identity.daily_limit || 300}
                      </span>
                    </div>
                    <div className="w-full bg-[#111] h-1.5 rounded-full overflow-hidden border border-[#222]">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          percentUsed > 90 ? "bg-red-500" : percentUsed > 70 ? "bg-amber-400" : "bg-teal-400"
                        }`}
                        style={{ width: `${percentUsed}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {identities.length === 0 && !isCreating && (
              <div className="col-span-full text-center py-16 px-4 skeuo-inset-box rounded-2xl border border-dashed border-[#2b353f] space-y-4">
                <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mx-auto text-teal-400">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">No Connected Providers Yet</h4>
                  <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
                    Connect Brevo using your API Key or connect Google/Custom SMTP to start sending automated email campaigns.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(true);
                    handleProviderSelect("brevo", "api");
                  }}
                  className="bg-[#00ffff] hover:bg-[#33ffff] text-black font-bold px-6 py-2.5 rounded-full text-xs shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-all cursor-pointer"
                >
                  + Connect Brevo or SMTP Provider
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <>
          {(isCreatingGroup || editingGroupId !== null) && (
            <div className="skeuo-card p-8 border border-[#00ffff]/30">
              <h3 className="text-xl font-bold mb-6 skeuo-text">{editingGroupId ? "Edit Group" : "Create Group"}</h3>
              <form onSubmit={handleGroupSave} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Group Name</label>
                  <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full skeuo-input py-3 px-4 text-white" placeholder="e.g., High Deliverability Pool" required />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Select Identities ({selectedGroupIds.length} selected)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                    {allIdentities.map((idn) => (
                      <label key={idn.id} className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all border ${selectedGroupIds.includes(idn.id) ? "bg-[#00ffff]/10 border-[#00ffff] text-white shadow-[0_0_16px_rgba(0,255,255,0.2)]" : "bg-[#0a0a0a] border-[#1e1e1e] text-[#888888] hover:border-[#333333]"}`}>
                        <input type="checkbox" checked={selectedGroupIds.includes(idn.id)} onChange={() => toggleGroupIdentity(idn.id)} className="mt-1 w-4 h-4 rounded border-gray-600 bg-black/40 text-teal-500 focus:ring-teal-500" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-white">{idn.name}</p>
                          <p className="text-xs text-gray-400 font-medium truncate">{idn.smtp_user}</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">Limit: {idn.daily_limit}/day — Sent: {idn.daily_sent}</p>
                        </div>
                      </label>
                    ))}
                    {allIdentities.length === 0 && (
                      <p className="col-span-full text-center py-8 text-gray-500 font-bold">No identities available. Add one first.</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-4">
                  <button type="button" onClick={resetGroupForm} className="bg-[#111111] hover:bg-[#1a1a1a] text-[#888888] hover:text-white px-5 py-2.5 rounded-full text-xs font-semibold border border-[#222222] transition-all cursor-pointer">Cancel</button>
                  <button type="submit" className="bg-[#00ffff] hover:bg-[#33ffff] text-black font-semibold rounded-full px-7 py-2.5 text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(0,255,255,0.25)] hover:shadow-[0_0_28px_rgba(0,255,255,0.4)] cursor-pointer">
                    <Save className="w-4 h-4" /> {editingGroupId ? "Save Changes" : "Create Group"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="skeuo-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => toggleExpand(group.id)} className="flex items-center gap-3 flex-1 text-left cursor-pointer">
                    {expanded[group.id] ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                    <h3 className="font-bold text-lg text-white">{group.name}</h3>
                    <span className="text-xs font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 rounded-full">{group.identities.length} identities</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleGroupEdit(group)} className="skeuo-btn px-3 py-1.5 text-xs font-bold cursor-pointer">Edit</button>
                    <button onClick={() => handleGroupDelete(group.id)} className="p-2 skeuo-btn-danger cursor-pointer"><Trash2 className="w-4 h-4 drop-shadow-sm" /></button>
                  </div>
                </div>
                {expanded[group.id] && (
                  <div className="space-y-2">
                    {group.identities.map((idn) => (
                      <div key={idn.id} className="skeuo-inset-box p-3 flex items-center justify-between rounded-lg">
                        <div>
                          <p className="font-bold text-sm text-white">{idn.name}</p>
                          <p className="text-xs text-gray-400 font-medium">{idn.smtp_user}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono font-bold text-gray-300">{idn.daily_sent}/{idn.daily_limit}</p>
                          <p className="text-[10px] text-gray-500">sent today</p>
                        </div>
                      </div>
                    ))}
                    {group.identities.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No identities in this group.</p>}
                  </div>
                )}
              </div>
            ))}
            {groups.length === 0 && !isCreatingGroup && editingGroupId === null && (
              <div className="text-center py-12 text-gray-500 skeuo-inset-box font-bold">No identity groups yet. Create one to distribute email sending across multiple identities!</div>
            )}
          </div>
        </>
      )}

      {/* Send Test Email Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay without blur */}
          <div 
            onClick={() => setTestModalOpen(false)}
            className="fixed inset-0 bg-black/40 transition-opacity cursor-pointer"
            aria-hidden="true"
          />

          <div className="skeuo-card max-w-md w-full p-6 md:p-8 border border-[#00ffff]/40 shadow-[0_0_40px_rgba(0,255,255,0.15)] relative z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Send Test Email</h3>
                  <p className="text-xs text-gray-400">
                    Verify real inbox delivery and connection
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-lg bg-[#0f1418] border border-[#232b32] text-xs text-gray-300 mb-5 flex items-center justify-between">
              <span className="text-gray-400">Sending via:</span>
              <span className="font-semibold text-teal-300 font-mono truncate max-w-[220px]">
                {testTargetIdentity ? testTargetIdentity.name : (newIdentity.name || (provider === "brevo" ? "Brevo API" : "Custom SMTP"))}
              </span>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Recipient Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={testRecipientEmail}
                  onChange={(e) => setTestRecipientEmail(e.target.value)}
                  placeholder="e.g., you@domain.com"
                  required
                  className="w-full skeuo-input py-2.5 px-3.5 text-white text-sm"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  We will send a formatted test message to this inbox.
                </p>
              </div>

              {testModalError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 break-all">{testModalError}</div>
                </div>
              )}

              {testModalSuccess && (
                <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">{testModalSuccess}</div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e242a]">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  disabled={sendingTestEmail}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-[#111] hover:bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#222] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingTestEmail}
                  className="bg-[#00ffff] hover:bg-[#33ffff] text-black font-bold px-6 py-2 rounded-full text-xs shadow-[0_0_20px_rgba(0,255,255,0.25)] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {sendingTestEmail ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending Email...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Send Test Email
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}