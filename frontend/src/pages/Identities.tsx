import React, { useState, useEffect } from "react";
import { UserCircle, Plus, Save, Trash2, Server } from "lucide-react";
import { apiFetch, getApiUrl } from "../lib/api";

interface Identity {
  id: number;
  name: string;
  host: string;
  port: number;
  smtp_user: string;
  secure: boolean;
}

export default function Identities() {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newIdentity, setNewIdentity] = useState({
    name: "",
    host: "",
    port: "587",
    smtp_user: "",
    smtp_pass: "",
    secure: false,
  });

  const [provider, setProvider] = useState<"gmail" | "custom">("gmail");

  const fetchIdentities = async () => {
    try {
      const res = await apiFetch("/api/identities/");
      if (res.ok) {
        const data = await res.json();
        setIdentities(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdentities();
  }, []);

  const handleProviderChange = (type: "gmail" | "custom") => {
    setProvider(type);
    if (type === "gmail") {
      setNewIdentity({
        ...newIdentity,
        host: "smtp.gmail.com",
        port: "587",
        secure: false, // Gmail uses TLS on 587
      });
    } else {
      setNewIdentity({
        ...newIdentity,
        host: "",
        port: "587",
        secure: false,
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch("/api/identities/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIdentity),
      });
      if (res.ok) {
        setIsCreating(false);
        setNewIdentity({ name: "", host: "", port: "587", smtp_user: "", smtp_pass: "", secure: false });
        fetchIdentities();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this identity?")) return;
    try {
      const res = await apiFetch(`/api/identities/${id}/`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchIdentities();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading identities...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 skeuo-text">
          <UserCircle className="w-6 h-6 text-blue-600 drop-shadow-sm" /> Sender Identities
        </h2>
        <button
          onClick={() => {
            setIsCreating(true);
            handleProviderChange("gmail"); // Default to Gmail
          }}
          className="skeuo-btn-primary px-4 py-2 text-sm font-bold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Identity
        </button>
      </div>

      {isCreating && (
        <div className="skeuo-card p-8">
          <h3 className="text-xl font-bold mb-6 skeuo-text">Add New Identity</h3>

          <div className="flex gap-4 mb-8">
            <button
              onClick={() => handleProviderChange("gmail")}
              className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${provider === "gmail" ? "bg-blue-50 border-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_4px_rgba(0,0,0,0.1)]" : "skeuo-btn"
                }`}
            >
              <div className="text-2xl font-bold text-blue-600">G</div>
              <span className="font-bold">Google (Gmail)</span>
            </button>
            <button
              onClick={() => handleProviderChange("custom")}
              className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${provider === "custom" ? "bg-blue-50 border-blue-400 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_4px_rgba(0,0,0,0.1)]" : "skeuo-btn"
                }`}
            >
              <Server className="w-6 h-6 text-gray-600" />
              <span className="font-bold">Custom SMTP</span>
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-full">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Profile Name (Reference)</label>
                <input
                  type="text"
                  value={newIdentity.name}
                  onChange={(e) => setNewIdentity({ ...newIdentity, name: e.target.value })}
                  className="w-full skeuo-input py-3 px-4"
                  placeholder="e.g., Marketing Team, Personal Email"
                  required
                />
              </div>

              {provider === "custom" && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">SMTP Host</label>
                    <input
                      type="text"
                      value={newIdentity.host}
                      onChange={(e) => setNewIdentity({ ...newIdentity, host: e.target.value })}
                      className="w-full skeuo-input py-3 px-4"
                      placeholder="smtp.example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">SMTP Port</label>
                    <input
                      type="text"
                      value={newIdentity.port}
                      onChange={(e) => setNewIdentity({ ...newIdentity, port: e.target.value })}
                      className="w-full skeuo-input py-3 px-4"
                      placeholder="587"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">
                  {provider === "gmail" ? "Gmail Address" : "SMTP Username (Email)"}
                </label>
                <input
                  type="email"
                  value={newIdentity.smtp_user}
                  onChange={(e) => setNewIdentity({ ...newIdentity, smtp_user: e.target.value })}
                  className="w-full skeuo-input py-3 px-4"
                  placeholder="you@gmail.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">
                  {provider === "gmail" ? "Google App Password" : "SMTP Password"}
                </label>
                <input
                  type="password"
                  value={newIdentity.smtp_pass}
                  onChange={(e) => setNewIdentity({ ...newIdentity, smtp_pass: e.target.value })}
                  className="w-full skeuo-input py-3 px-4"
                  placeholder={provider === "gmail" ? "xxxx xxxx xxxx xxxx" : "Your Password"}
                  required
                />
                {provider === "gmail" && (
                  <p className="text-[10px] text-blue-600 mt-2 font-bold uppercase">Must be a 16-digit App Password, not your login password.</p>
                )}
              </div>

              {provider === "custom" && (
                <div className="col-span-full">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newIdentity.secure}
                      onChange={(e) => setNewIdentity({ ...newIdentity, secure: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-bold text-gray-700 skeuo-text">Use Secure Connection (SSL on Port 465)</span>
                  </label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="skeuo-btn px-4 py-2 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-gradient-to-b from-orange-400 to-orange-600 border border-orange-700 border-bottom-orange-800 shadow-[0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.4)] text-white text-shadow-[0_-1px_0_rgba(0,0,0,0.3)] hover:from-orange-500 hover:to-orange-700 active:from-orange-600 active:to-orange-400 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Identity
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {identities.map((identity) => (
          <div key={identity.id} className="skeuo-card p-6 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-bold text-lg line-clamp-1 skeuo-text" title={identity.name}>{identity.name}</h3>
              <button onClick={() => handleDelete(identity.id)} className="p-2 skeuo-btn-danger">
                <Trash2 className="w-4 h-4 drop-shadow-sm" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 skeuo-text">Email / Username</p>
                <p className="text-sm text-gray-700 font-medium">{identity.smtp_user}</p>
              </div>
              <div className="flex items-center gap-4 skeuo-inset-box p-3">
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 skeuo-text">Host</p>
                  <p className="text-sm text-gray-700 flex items-center gap-1 font-medium">
                    <Server className="w-3 h-3 text-gray-500 drop-shadow-sm" /> {identity.host}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 skeuo-text">Port</p>
                  <p className="text-sm text-gray-700 font-mono font-bold">{identity.port}</p>
                </div>
              </div>
              <div className="pt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.1)] border ${identity.secure ? 'bg-gradient-to-b from-green-50 to-green-100 text-green-800 border-green-200' : 'bg-gradient-to-b from-gray-50 to-gray-100 text-gray-800 border-gray-200'}`}>
                  {identity.secure ? 'Secure (SSL/TLS)' : 'Standard'}
                </span>
              </div>
            </div>
          </div>
        ))}
        {identities.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-12 text-gray-500 skeuo-inset-box font-bold">
            No identities found. Add one to start sending campaigns!
          </div>
        )}
      </div>
    </div>
  );
}
