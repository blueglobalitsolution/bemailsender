import React, { useState, useEffect, useRef } from "react";
import { FileText, Plus, Save, Trash2, Edit3, Mail, Shield, ShieldCheck, ShieldAlert, Loader2, AlertTriangle, CheckCircle, Info } from "lucide-react";
import EmailEditor, { EditorRef } from "react-email-editor";
import { apiFetch, getApiUrl } from "../lib/api";
import { useToast } from "../components/Toast";

interface Template {
  id: number;
  name: string;
  subject: string;
  body: string;
  type: string;
  design?: any;
}

interface Identity {
  id: number;
  name: string;
  smtp_user: string;
  host: string;
}

export default function Templates() {
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newTemplate, setNewTemplate] = useState<{ name: string, subject: string, body: string, type: string, design?: any }>({
    name: "", subject: "", body: "", type: 'email'
  });
  const [spamCheckIdentity, setSpamCheckIdentity] = useState("");
  const [spamScore, setSpamScore] = useState<{ score: number; report: string } | null>(null);
  const [spamChecking, setSpamChecking] = useState(false);

  const emailEditorRef = useRef<EditorRef>(null);

  const fetchTemplates = async () => {
    try {
      const res = await apiFetch("/api/templates/");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchIdentities = async () => {
    try {
      const res = await apiFetch("/api/identities/");
      if (res.ok) {
        const data = await res.json();
        setIdentities(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchIdentities();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newTemplate.type === 'email' && emailEditorRef.current?.editor) {
      emailEditorRef.current.editor.exportHtml(async (data) => {
        const { design, html } = data;
        await saveTemplate(html, design);
      });
    } else {
      await saveTemplate(newTemplate.body, undefined);
    }
  };

  const saveTemplate = async (body: string, design?: any) => {
    try {
      const url = editingId ? `/api/templates/${editingId}/` : "/api/templates/";
      const method = editingId ? "PUT" : "POST";

      const payload = {
        ...newTemplate,
        body,
        design
      };

      const res = await apiFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIsCreating(false);
        setEditingId(null);
        setNewTemplate({ name: "", subject: "", body: "", type: 'email', design: undefined });
        fetchTemplates();
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = typeof errData === 'string' ? errData : 
          Object.values(errData).flat().join('. ') || `Error ${res.status}`;
        alert(errMsg);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save template");
    }
  };

  const handleEdit = (template: Template) => {
    setNewTemplate({
      name: template.name,
      subject: template.subject || "",
      body: template.body,
      type: template.type || 'email',
      design: template.design
    });
    setEditingId(template.id);
    setIsCreating(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onReady = () => {
    if (newTemplate.design && emailEditorRef.current?.editor) {
      emailEditorRef.current.editor.loadDesign(newTemplate.design);
    }
  };

  const checkSpamScore = async () => {
    if (!editingId && !newTemplate.body) return;
    setSpamChecking(true);
    setSpamScore(null);
    try {
      const body = newTemplate.body;
      const templateId = editingId;
      if (!templateId) {
        toast.info("Save the template first before checking spam score");
        setSpamChecking(false);
        return;
      }
      const res = await apiFetch("/api/templates/check-spam/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          identity_id: spamCheckIdentity || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSpamScore({ score: parseFloat(data.score), report: data.report || "" });
        toast.success("Spam check completed");
      } else {
        const err = await res.json();
        toast.error(err.error || "Spam check failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Spam check failed");
    } finally {
      setSpamChecking(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      const res = await apiFetch(`/api/templates/${id}/`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchTemplates();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading templates...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-serif text-white flex items-center gap-3">
          <FileText className="w-6 h-6 text-[#00ffff]" /> Script Architect
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setNewTemplate({ name: "", subject: "", body: "", type: 'email', design: undefined });
              setEditingId(null);
              setIsCreating(true);
            }}
            className="bg-[#19b3d2] hover:bg-[#20c4e6] text-black font-semibold rounded-none px-5 py-2.5 text-xs flex items-center gap-2 transition-all cursor-pointer border border-[#1499b4]"
          >
            <Plus className="w-3.5 h-3.5" /> New Template
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="skeuo-card p-6">
          <h3 className="text-lg font-bold mb-4 skeuo-text">{editingId ? "Edit Template" : "Create New Template"}</h3>
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Template Name</label>
              <input
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                className="w-full skeuo-input py-2 px-4"
                required
              />
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Email Subject</label>
                <input
                  type="text"
                  value={newTemplate.subject}
                  onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                  className="w-full skeuo-input py-2 px-4"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Email Design</label>
                <p className="text-xs text-gray-500 mb-2 font-medium">Use {'{{variable_name}}'} for dynamic content (e.g., {'{{first_name}}'})</p>
                <div className="w-full h-[600px] border border-gray-300 rounded-lg overflow-hidden shadow-inner">
                  <EmailEditor
                    key={editingId || 'new'}
                    ref={emailEditorRef}
                    onReady={onReady}
                    minHeight={600}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Test Sender Identity</label>
                  <select
                    value={spamCheckIdentity}
                    onChange={(e) => { setSpamCheckIdentity(e.target.value); setSpamScore(null); }}
                    className="w-full skeuo-input py-2 px-4"
                  >
                    <option value="">No identity (plain email)</option>
                    {identities.map((id) => (
                      <option key={id.id} value={id.id}>
                        {id.name} ({id.smtp_user})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={checkSpamScore}
                  disabled={spamChecking || !editingId}
                  className="bg-[#111111] hover:bg-[#1a1a1a] text-[#cccccc] hover:text-white px-5 py-2.5 rounded-full text-xs font-semibold border border-[#222222] transition-all flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  {spamChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5 text-[#00ffff]" />}
                  {spamChecking ? "Checking..." : "Check Spam Score"}
                </button>
              </div>

              {spamScore !== null && (
                <div className="mt-4 skeuo-inset-box p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {spamScore.score <= 3 ? (
                        <ShieldCheck className="w-10 h-10 text-green-500" />
                      ) : spamScore.score <= 6 ? (
                        <AlertTriangle className="w-10 h-10 text-orange-500" />
                      ) : (
                        <ShieldAlert className="w-10 h-10 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold">
                          Spam Score: <span className={spamScore.score <= 3 ? "text-green-600" : spamScore.score <= 6 ? "text-orange-600" : "text-red-600"}>{spamScore.score.toFixed(1)} / 10</span>
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${spamScore.score <= 3 ? "bg-green-100 text-green-700" : spamScore.score <= 6 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                          {spamScore.score <= 3 ? "Good" : spamScore.score <= 6 ? "Fair" : "Poor"}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div
                          className={`h-2 rounded-full transition-all ${spamScore.score <= 3 ? "bg-green-500" : spamScore.score <= 6 ? "bg-orange-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(spamScore.score * 10, 100)}%` }}
                        />
                      </div>
                      {spamScore.report && (
                        <details>
                          <summary className="text-xs font-bold text-gray-500 cursor-pointer hover:text-gray-700">View detailed report</summary>
                          <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white p-3 rounded max-h-48 overflow-y-auto">{spamScore.report}</pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-[#1a1a1a]">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingId(null);
                  setSpamScore(null);
                  setNewTemplate({ name: "", subject: "", body: "", type: 'email', design: undefined });
                }}
                className="bg-[#111111] hover:bg-[#1a1a1a] text-[#888888] hover:text-white px-6 py-2.5 rounded-none text-xs font-semibold border border-[#222222] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#19b3d2] hover:bg-[#20c4e6] text-black font-semibold rounded-none px-8 py-2.5 text-xs flex items-center gap-2 transition-all cursor-pointer border border-[#1499b4]"
              >
                <Save className="w-4 h-4" /> Save Template
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates
          .map((template) => (
            <div key={template.id} className="skeuo-card p-6 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-lg line-clamp-1 skeuo-text" title={template.name}>{template.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(template)} className="p-2 skeuo-btn text-blue-600">
                    <Edit3 className="w-4 h-4 drop-shadow-sm" />
                  </button>
                  <button onClick={() => handleDelete(template.id)} className="p-2 skeuo-btn-danger">
                    <Trash2 className="w-4 h-4 drop-shadow-sm" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 skeuo-text">Subject</p>
                <p className="text-sm text-gray-700 line-clamp-1 font-medium" title={template.subject}>{template.subject}</p>
              </div>

              <div className="flex-1 skeuo-inset-box p-4 overflow-hidden relative group">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Content Preview</p>
                <iframe
                  srcDoc={template.body}
                  className="w-full h-[250px] rounded border-0 bg-white"
                  sandbox="allow-same-origin"
                  title="Email Preview"
                  style={{ pointerEvents: 'none' }}
                />
              </div>
            </div>
          ))}
        {templates.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-12 text-gray-500 skeuo-inset-box font-bold">
            No templates found. Create one to get started!
          </div>
        )}
      </div>
    </div>
  );
}
