import React, { useState, useEffect, useRef } from "react";
import { FileText, Plus, Save, Trash2, Edit3, Mail, Shield, ShieldCheck, ShieldAlert, Loader2, AlertTriangle, CheckCircle, Info, Eye, X, Sparkles, Globe, FormInput, Copy, ExternalLink, Download, Layers } from "lucide-react";
import EmailEditor, { EditorRef } from "react-email-editor";
import { apiFetch, getApiUrl } from "../lib/api";
import { useToast } from "../components/Toast";
import AIEmailWriterModal from "../components/AIEmailWriterModal";
import FormBuilderModal, { CustomForm } from "../components/FormBuilderModal";
import SubmissionsViewerModal from "../components/SubmissionsViewerModal";

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

interface LandingPageItem {
  id: number;
  title: string;
  slug: string;
  html_content: string;
  views_count: number;
  public_url: string;
  submissions_count: number;
  created_at: string;
}

export default function Templates() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"templates" | "landing-pages" | "forms">("templates");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPageItem[]>([]);
  const [customForms, setCustomForms] = useState<CustomForm[]>([]);
  const [loading, setLoading] = useState(true);

  // Template states
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [newTemplate, setNewTemplate] = useState<{ name: string, subject: string, body: string, type: string, design?: any }>({
    name: "", subject: "", body: "", type: 'email'
  });
  const [spamCheckIdentity, setSpamCheckIdentity] = useState("");
  const [spamScore, setSpamScore] = useState<{ score: number; report: string } | null>(null);
  const [spamChecking, setSpamChecking] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Landing Page creation/edit states
  const [isCreatingLanding, setIsCreatingLanding] = useState(false);
  const [editingLandingId, setEditingLandingId] = useState<number | null>(null);
  const [landingTitle, setLandingTitle] = useState("");
  const [landingHtml, setLandingHtml] = useState("");
  const [savingLanding, setSavingLanding] = useState(false);

  // Form builder modal state
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const [editingFormItem, setEditingFormItem] = useState<CustomForm | null>(null);

  // Submissions viewer modal state
  const [viewingSubmissionsPage, setViewingSubmissionsPage] = useState<{ id: number; title: string; slug: string } | null>(null);

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

  const fetchLandingPages = async () => {
    try {
      const res = await apiFetch("/api/landing-pages/");
      if (res.ok) {
        setLandingPages(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCustomForms = async () => {
    try {
      const res = await apiFetch("/api/forms/");
      if (res.ok) {
        setCustomForms(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchIdentities();
    fetchLandingPages();
    fetchCustomForms();

    const handleOpenAI = () => setIsAIModalOpen(true);
    const handleOpenCreate = () => {
      setActiveTab("templates");
      setNewTemplate({ name: "", subject: "", body: "", type: 'email', design: undefined });
      setEditingId(null);
      setIsCreating(true);
    };

    const handleOpenFormBuilder = () => {
      setActiveTab("forms");
      setEditingFormItem(null);
      setIsFormBuilderOpen(true);
    };

    const handleOpenCreateLanding = () => {
      setActiveTab("landing-pages");
      setEditingLandingId(null);
      setLandingTitle("");
      setLandingHtml(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Special Offer</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; text-align: center; }
    .container { max-width: 600px; margin: 0 auto; background: #1e293b; padding: 40px; border-radius: 16px; border: 1px solid #334155; }
    h1 { font-size: 28px; margin-bottom: 12px; color: #ffffff; }
    p { font-size: 15px; color: #94a3b8; line-height: 1.6; margin-bottom: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Exclusive Access & Free Consultation</h1>
    <p>Fill out the form below to receive your custom strategy guide directly to your inbox.</p>
    
    <!-- Paste your form shortcode below, e.g. {{form_xxx}} -->
    
  </div>
</body>
</html>`);
      setIsCreatingLanding(true);
    };

    window.addEventListener("open-ai-modal", handleOpenAI);
    window.addEventListener("open-create-template-modal", handleOpenCreate);
    window.addEventListener("open-form-builder-modal", handleOpenFormBuilder);
    window.addEventListener("open-create-landing-modal", handleOpenCreateLanding);

    return () => {
      window.removeEventListener("open-ai-modal", handleOpenAI);
      window.removeEventListener("open-create-template-modal", handleOpenCreate);
      window.removeEventListener("open-form-builder-modal", handleOpenFormBuilder);
      window.removeEventListener("open-create-landing-modal", handleOpenCreateLanding);
    };
  }, []);

  const handleSaveLanding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!landingTitle.trim() || !landingHtml.trim()) {
      toast.error("Please provide Title and HTML content");
      return;
    }

    try {
      setSavingLanding(true);
      const url = editingLandingId ? `/api/landing-pages/${editingLandingId}/` : "/api/landing-pages/";
      const method = editingLandingId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: landingTitle.trim(),
          html_content: landingHtml,
        }),
      });

      if (res.ok) {
        toast.success(editingLandingId ? "Landing page updated!" : "Landing page published successfully!");
        setIsCreatingLanding(false);
        setEditingLandingId(null);
        fetchLandingPages();
      } else {
        const err = await res.json();
        toast.error(Object.values(err).flat().join(" ") || "Failed to save landing page");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error saving landing page");
    } finally {
      setSavingLanding(false);
    }
  };

  const handleDeleteLanding = (id: number) => {
    toast.confirm("Are you sure you want to delete this landing page?", async () => {
      try {
        const res = await apiFetch(`/api/landing-pages/${id}/`, { method: "DELETE" });
        if (res.ok) {
          toast.success("Landing page deleted");
          fetchLandingPages();
        } else {
          toast.error("Failed to delete landing page");
        }
      } catch (err) {
        console.error(err);
        toast.error("Network error deleting landing page");
      }
    });
  };

  const handleDeleteForm = (id: number) => {
    toast.confirm("Are you sure you want to delete this form?", async () => {
      try {
        const res = await apiFetch(`/api/forms/${id}/`, { method: "DELETE" });
        if (res.ok) {
          toast.success("Form deleted");
          fetchCustomForms();
        } else {
          toast.error("Failed to delete form");
        }
      } catch (err) {
        console.error(err);
        toast.error("Network error deleting form");
      }
    });
  };

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

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
        toast.success(editingId ? "Template updated successfully." : "Template created successfully.");
        setIsCreating(false);
        setEditingId(null);
        setNewTemplate({ name: "", subject: "", body: "", type: 'email', design: undefined });
        fetchTemplates();
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = typeof errData === 'string' ? errData : 
          Object.values(errData).flat().join('. ') || `Error ${res.status}`;
        toast.error(errMsg);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template");
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
    const designToLoad = newTemplate.design;
    if (designToLoad && emailEditorRef.current?.editor) {
      emailEditorRef.current.editor.loadDesign(designToLoad);
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

  const handleDelete = (id: number) => {
    toast.confirm("Are you sure you want to delete this template?", async () => {
      try {
        const res = await apiFetch(`/api/templates/${id}/`, {
          method: "DELETE",
        });
        if (res.ok) {
          fetchTemplates();
          toast.success("Template deleted successfully.");
        } else {
          toast.error("Failed to delete template.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Network error deleting template.");
      }
    });
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading templates...</div>;

  return (
    <div className="space-y-8">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-[#2C353D] pb-4">
        <div className="flex gap-1.5 bg-[#222930] border border-[#2C353D] rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab("templates")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "templates"
                ? "bg-white text-[#161B1F] shadow-sm font-bold"
                : "text-[#8E9BA8] hover:text-white"
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Email Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab("landing-pages")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "landing-pages"
                ? "bg-white text-[#161B1F] shadow-sm font-bold"
                : "text-[#8E9BA8] hover:text-white"
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Landing Pages ({landingPages.length})
          </button>
          <button
            onClick={() => setActiveTab("forms")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "forms"
                ? "bg-white text-[#161B1F] shadow-sm font-bold"
                : "text-[#8E9BA8] hover:text-white"
            }`}
          >
            <FormInput className="w-3.5 h-3.5" /> Lead Forms ({customForms.length})
          </button>
        </div>
      </div>

      {/* TAB 1: EMAIL TEMPLATES */}
      {activeTab === "templates" && (
        <>
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
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 skeuo-text">Email Subject</label>
                  <button
                    type="button"
                    onClick={() => setIsAIModalOpen(true)}
                    className="text-[#00ffff] hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Draft with AI Writer
                  </button>
                </div>
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
                        <ShieldAlert className="w-10 h-10 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-base font-semibold text-white tracking-wide">
                          Spam Score: <span className={spamScore.score <= 3 ? "text-emerald-400 font-bold" : spamScore.score <= 6 ? "text-amber-400 font-bold" : "text-rose-400 font-bold"}>{spamScore.score.toFixed(1)} / 10</span>
                        </span>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border ${spamScore.score <= 3 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : spamScore.score <= 6 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-rose-500/10 text-rose-400 border-rose-500/30"}`}>
                          {spamScore.score <= 3 ? "Good" : spamScore.score <= 6 ? "Fair" : "Poor"}
                        </span>
                      </div>
                      <div className="w-full bg-[#1e1e1e] h-1.5 mb-3 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${spamScore.score <= 3 ? "bg-emerald-400" : spamScore.score <= 6 ? "bg-amber-400" : "bg-rose-500"}`}
                          style={{ width: `${Math.min(spamScore.score * 10, 100)}%` }}
                        />
                      </div>
                      {spamScore.report && (
                        <details className="group">
                          <summary className="text-[11px] font-mono text-[#888888] cursor-pointer hover:text-[#cccccc] select-none transition-colors">▾ View SpamAssassin breakdown</summary>
                          <pre className="mt-2 text-[11px] text-[#aaaaaa] whitespace-pre-wrap font-mono bg-[#09090b] border border-[#1f1f23] p-3 max-h-56 overflow-y-auto leading-relaxed scrollbar-thin">{spamScore.report}</pre>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {templates.map((template) => (
          <div
            key={template.id}
            onClick={() => setPreviewTemplate(template)}
            className="bg-[#000000] border border-[#1a1a1a] hover:border-[#333333] transition-all p-5 flex flex-col justify-between group cursor-pointer shadow-lg relative"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-4 h-4 text-[#00ffff] shrink-0" />
                  <h3 className="font-serif font-medium text-lg text-white line-clamp-1" title={template.name}>
                    {template.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-1.5 bg-[#111111] hover:bg-[#1f1f1f] text-[#888888] hover:text-[#00ffff] border border-[#222222] transition-colors cursor-pointer"
                    title="Edit Template"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-1.5 bg-[#111111] hover:bg-rose-950/40 text-[#888888] hover:text-rose-400 border border-[#222222] transition-colors cursor-pointer"
                    title="Delete Template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {template.subject && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase font-mono tracking-wider text-[#666666] mb-0.5">Subject</p>
                  <p className="text-xs text-[#cccccc] font-medium line-clamp-1" title={template.subject}>
                    {template.subject}
                  </p>
                </div>
              )}

              <p className="text-xs text-[#777777] line-clamp-4 leading-relaxed mb-4">
                {stripHtml(template.body) || "No plain text excerpt available."}
              </p>
            </div>

            <div className="pt-3 border-t border-[#141414] flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#555555] group-hover:text-[#888888] transition-colors">
                Click to view preview
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewTemplate(template);
                }}
                className="text-xs font-medium text-[#00ffff] hover:text-white flex items-center gap-1.5 px-2.5 py-1 bg-[#00ffff]/10 hover:bg-[#00ffff]/20 border border-[#00ffff]/30 transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
            </div>
          </div>
        ))}
        {templates.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-16 text-[#666666] bg-[#000000] border border-[#1a1a1a]">
            No templates found. Create one to get started!
          </div>
        )}
          </div>
        </>
      )}

      {/* TAB 2: CUSTOM LANDING PAGES */}
      {activeTab === "landing-pages" && (
        <div className="space-y-6">
          {isCreatingLanding && (
            <div className="bg-[#1E252D] border border-[#2C353D] rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-5 border-b border-[#2C353D] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {editingLandingId ? "Edit Custom Landing Page" : "Create New Custom Landing Page"}
                    </h3>
                    <p className="text-xs text-[#8E9BA8]">
                      Paste custom HTML and insert any form shortcode like <code className="text-white bg-[#161B1F] px-1 py-0.5 rounded">{"{{form_xxx}}"}</code>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreatingLanding(false)}
                  className="text-[#8E9BA8] hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveLanding} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                    Landing Page Title *
                  </label>
                  <input
                    type="text"
                    value={landingTitle}
                    onChange={(e) => setLandingTitle(e.target.value)}
                    placeholder="e.g. Free Strategy Consultation & Webinar"
                    className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-white transition-all"
                    required
                  />
                </div>

                {/* Side-by-Side: Left HTML Editor, Right Live Real-Time Preview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                  {/* Left Column: HTML Code Input */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                        Raw HTML Content (with Shortcodes) *
                      </label>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[11px] text-[#8E9BA8]">Insert Shortcode:</span>
                      {customForms.length === 0 ? (
                        <span className="text-[11px] text-amber-400 font-medium">No forms yet</span>
                      ) : (
                        customForms.slice(0, 3).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              const sc = `{{${f.shortcode}}}`;
                              setLandingHtml((prev) => prev + `\n${sc}\n`);
                              toast.info(`Inserted ${sc}`);
                            }}
                            className="text-[11px] bg-[#161B1F] hover:bg-[#26303A] border border-[#2C353D] px-2 py-0.5 rounded text-white font-mono cursor-pointer"
                            title="Click to append to HTML"
                          >
                            + {`{{${f.shortcode}}}`}
                          </button>
                        ))
                      )}
                    </div>

                    <textarea
                      value={landingHtml}
                      onChange={(e) => setLandingHtml(e.target.value)}
                      rows={18}
                      placeholder="<!DOCTYPE html><html>... paste full HTML here ...</html>"
                      className="w-full font-mono text-xs bg-[#161B1F] border border-[#2C353D] rounded-xl p-4 text-emerald-300 focus:outline-none focus:border-white transition-all flex-1 min-h-[420px]"
                      required
                    />
                  </div>

                  {/* Right Column: Live Instant Side Preview */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] flex items-center gap-2">
                        <Eye className="w-3.5 h-3.5 text-emerald-400" /> Live Real-Time Preview
                      </label>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Interactive
                      </span>
                    </div>

                    <div className="border border-[#2C353D] rounded-xl overflow-hidden bg-black flex-1 min-h-[420px] shadow-inner relative">
                      {landingHtml.trim() ? (
                        <iframe
                          srcDoc={landingHtml}
                          title="Live Preview"
                          className="w-full h-full border-0 block"
                          style={{ minHeight: "440px", height: "100%", width: "100%" }}
                          sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 text-[#8E9BA8]">
                          <Eye className="w-8 h-8 mb-2 opacity-40" />
                          <p className="text-xs">Paste your HTML on the left to see live preview here</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2C353D]">
                  <button
                    type="button"
                    onClick={() => setIsCreatingLanding(false)}
                    className="px-4 py-2 text-xs font-semibold text-[#8E9BA8] hover:text-white rounded-lg hover:bg-[#222930] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingLanding}
                    className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold px-5 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {savingLanding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {editingLandingId ? "Update Landing Page" : "Publish Landing Page"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Landing Pages List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {landingPages.map((page) => (
              <div
                key={page.id}
                className="bg-[#1E252D] border border-[#2C353D] hover:border-[#3E4A56] rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                        <Globe className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base line-clamp-1" title={page.title}>
                          {page.title}
                        </h4>
                        <span className="text-[11px] text-[#8E9BA8] font-mono">
                          /p/{page.slug}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingLandingId(page.id);
                          setLandingTitle(page.title);
                          setLandingHtml(page.html_content);
                          setIsCreatingLanding(true);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="p-1.5 text-[#8E9BA8] hover:text-white hover:bg-[#26303A] rounded-md transition-colors"
                        title="Edit Page HTML"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLanding(page.id)}
                        className="p-1.5 text-[#8E9BA8] hover:text-red-400 hover:bg-[#26303A] rounded-md transition-colors"
                        title="Delete Landing Page"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Public Link Box */}
                  <div className="p-2.5 bg-[#161B1F] border border-[#2C353D] rounded-lg mb-4 flex items-center justify-between gap-2">
                    <div className="truncate text-[11px] text-[#CBD5E1] font-mono select-all">
                      {window.location.origin}/p/{page.slug}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(`${window.location.origin}/p/${page.slug}`, "Public link copied!")
                        }
                        className="p-1 text-[#8E9BA8] hover:text-white hover:bg-[#222930] rounded cursor-pointer"
                        title="Copy Public Link to share in email"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={`/p/${page.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-[#8E9BA8] hover:text-white hover:bg-[#222930] rounded cursor-pointer"
                        title="Open Live Public Page"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Stats Counter: Page Clicks & Form Submissions */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-[#161B1F] border border-[#2C353D] p-3 rounded-xl text-center">
                      <p className="text-[11px] text-[#8E9BA8] font-semibold uppercase tracking-wider mb-0.5">
                        Page Views / Clicks
                      </p>
                      <p className="text-xl font-bold text-white">{page.views_count}</p>
                    </div>
                    <div className="bg-[#161B1F] border border-[#2C353D] p-3 rounded-xl text-center">
                      <p className="text-[11px] text-[#8E9BA8] font-semibold uppercase tracking-wider mb-0.5">
                        Leads Captured
                      </p>
                      <p className="text-xl font-bold text-emerald-400">{page.submissions_count}</p>
                    </div>
                  </div>
                </div>

                {/* Footer Action: View & Download Leads */}
                <div className="pt-3 border-t border-[#2C353D] flex items-center justify-between">
                  <button
                    onClick={() =>
                      setViewingSubmissionsPage({ id: page.id, title: page.title, slug: page.slug })
                    }
                    className="w-full bg-[#222930] hover:bg-[#29323A] border border-[#2C353D] text-white font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-white" /> View Submissions ({page.submissions_count})
                  </button>
                </div>
              </div>
            ))}

            {landingPages.length === 0 && !isCreatingLanding && (
              <div className="col-span-full py-16 text-center border border-dashed border-[#2C353D] rounded-2xl bg-[#1E252D]/40">
                <Globe className="w-10 h-10 text-[#8E9BA8] mx-auto mb-3 opacity-60" />
                <h4 className="text-base font-bold text-white mb-1">No Custom Landing Pages Yet</h4>
                <p className="text-xs text-[#8E9BA8] max-w-sm mx-auto mb-4">
                  Paste your own HTML code, embed dynamic lead capture forms via shortcodes, and track clicks and submissions live.
                </p>
                <button
                  onClick={() => {
                    setEditingLandingId(null);
                    setLandingTitle("");
                    setLandingHtml(`<!DOCTYPE html>
<html>
<head>
  <style>body { font-family: sans-serif; background: #0f172a; color: white; padding: 40px; text-align: center; }</style>
</head>
<body>
  <h1>Welcome to our Offer</h1>
  <p>Fill out the form below:</p>
  {{form_xxx}}
</body>
</html>`);
                    setIsCreatingLanding(true);
                  }}
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold px-4 py-2 rounded-lg text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Create First Landing Page
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LEAD FORMS / FORM BUILDER */}
      {activeTab === "forms" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-[#1E252D] border border-[#2C353D] rounded-2xl">
            <div>
              <h4 className="text-sm font-bold text-white">Drag & Drop Form Builder Library</h4>
              <p className="text-xs text-[#8E9BA8]">
                Create customizable lead forms and copy their shortcodes to paste inside any Landing Page HTML.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingFormItem(null);
                setIsFormBuilderOpen(true);
              }}
              className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New Lead Form
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customForms.map((form) => (
              <div
                key={form.id}
                className="bg-[#1E252D] border border-[#2C353D] hover:border-[#3E4A56] rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                        <FormInput className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base line-clamp-1">{form.name}</h4>
                        <span className="text-[11px] text-[#8E9BA8]">
                          {form.fields_schema?.length || 0} fields configured
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingFormItem(form);
                          setIsFormBuilderOpen(true);
                        }}
                        className="p-1.5 text-[#8E9BA8] hover:text-white hover:bg-[#26303A] rounded-md transition-colors"
                        title="Edit Form"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteForm(form.id)}
                        className="p-1.5 text-[#8E9BA8] hover:text-red-400 hover:bg-[#26303A] rounded-md transition-colors"
                        title="Delete Form"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Form Shortcode Banner */}
                  <div className="p-3 bg-[#161B1F] border border-[#2C353D] rounded-xl mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8E9BA8]">
                        Embed Shortcode
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`{{${form.shortcode}}}`, "Shortcode copied to clipboard!")}
                        className="text-[11px] text-white hover:underline flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <code className="text-xs font-mono text-white bg-[#1A2026] px-2 py-1 rounded block border border-[#2C353D]">
                      {`{{${form.shortcode}}}`}
                    </code>
                  </div>

                  {/* Fields list */}
                  <div className="space-y-1.5 mb-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E9BA8]">Fields:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(form.fields_schema || []).map((f) => (
                        <span
                          key={f.id}
                          className="text-[11px] px-2 py-0.5 rounded bg-[#161B1F] border border-[#2C353D] text-[#CBD5E1]"
                        >
                          {f.label} {f.required && "*"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#2C353D] flex items-center justify-between text-xs text-[#8E9BA8]">
                  <span>Total Submissions:</span>
                  <span className="font-bold text-white">{form.submissions_count || 0}</span>
                </div>
              </div>
            ))}

            {customForms.length === 0 && (
              <div className="col-span-full py-16 text-center border border-dashed border-[#2C353D] rounded-2xl bg-[#1E252D]/40">
                <FormInput className="w-10 h-10 text-[#8E9BA8] mx-auto mb-3 opacity-60" />
                <h4 className="text-base font-bold text-white mb-1">No Lead Capture Forms Built Yet</h4>
                <p className="text-xs text-[#8E9BA8] max-w-sm mx-auto mb-4">
                  Build custom forms using drag and drop fields, and generate shortcodes for your landing pages.
                </p>
                <button
                  onClick={() => {
                    setEditingFormItem(null);
                    setIsFormBuilderOpen(true);
                  }}
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold px-4 py-2 rounded-lg text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Launch Form Builder
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right-Side Template Live Preview Drawer with Slide Animation */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop with Fade Animation */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setPreviewTemplate(null)}
          ></div>

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-8 sm:pl-16">
            <div className="w-screen max-w-2xl lg:max-w-3xl bg-[#0c0c0c] border-l border-[#1f1f1f] flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.9)] animate-in slide-in-from-right duration-300">
              {/* Drawer Header */}
              <div className="p-6 border-b border-[#1c1c1c] flex items-start justify-between bg-[#000000]/70 backdrop-blur-md">
                <div className="pr-4 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#00ffff] bg-[#00ffff]/10 px-2 py-0.5 border border-[#00ffff]/30">
                      Live Preview
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#777777] bg-[#111111] px-2 py-0.5 border border-[#222222]">
                      Email Template
                    </span>
                  </div>
                  <h3 className="text-2xl font-serif text-white tracking-tight leading-snug">{previewTemplate.name}</h3>
                  {previewTemplate.subject && (
                    <div className="mt-2 p-2.5 bg-[#050505] border border-[#1a1a1a] text-xs">
                      <span className="text-[#666666] font-mono uppercase text-[10px] block mb-0.5">Subject Line:</span>
                      <p className="text-[#ededed] font-medium">{previewTemplate.subject}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="p-2 text-[#777777] hover:text-white bg-[#111111] hover:bg-[#1a1a1a] border border-[#222222] transition-colors cursor-pointer shrink-0 ml-2"
                  title="Close Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body - Live Rendered HTML in iframe */}
              <div className="flex-1 overflow-hidden p-6 flex flex-col bg-[#050505]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#666666]">
                    Email Content Canvas
                  </span>
                  <span className="text-[11px] font-mono text-[#555555]">
                    Rendered HTML
                  </span>
                </div>
                <div className="flex-1 bg-white rounded-none overflow-hidden border border-[#222222] shadow-2xl relative">
                  <iframe
                    srcDoc={previewTemplate.body}
                    className="w-full h-full border-0 bg-white"
                    title="Template Live Preview"
                    sandbox="allow-same-origin allow-popups"
                  />
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-5 border-t border-[#1a1a1a] bg-[#000000] flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="px-6 py-3 border border-[#222222] text-[#888888] hover:text-white hover:bg-[#111111] text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const t = previewTemplate;
                    setPreviewTemplate(null);
                    handleEdit(t);
                  }}
                  className="px-8 py-3 bg-[#19b3d2] hover:bg-[#20c4e6] text-black text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(25,179,210,0.3)] cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" /> Edit This Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Email Writer Modal */}
      <AIEmailWriterModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onApply={(subject, body) => {
          const formattedHtml = `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333333; padding: 20px;">${body.replace(/\n\n/g, "<br/><br/>").replace(/\n/g, "<br/>")}</div>`;
          
          const newDesign = {
            body: {
              rows: [
                {
                  cells: [1],
                  columns: [
                    {
                      contents: [
                        {
                          type: "html",
                          values: {
                            html: formattedHtml
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          };

          setNewTemplate((prev) => ({
            ...prev,
            name: prev.name || (subject ? `AI - ${subject.slice(0, 30)}` : "AI Generated Template"),
            subject: subject,
            body: body,
            design: newDesign,
          }));
          setIsCreating(true);

          // If the visual EmailEditor is already mounted, load design directly
          setTimeout(() => {
            if (emailEditorRef.current?.editor) {
              try {
                emailEditorRef.current.editor.loadDesign(newDesign);
              } catch (err) {
                console.log("Could not auto-populate react-email-editor canvas:", err);
              }
            }
          }, 150);

          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {/* Form Builder Modal */}
      <FormBuilderModal
        isOpen={isFormBuilderOpen}
        onClose={() => {
          setIsFormBuilderOpen(false);
          setEditingFormItem(null);
        }}
        editingForm={editingFormItem}
        onSaved={() => {
          fetchCustomForms();
        }}
      />

      {/* Leads / Submissions Viewer Modal */}
      {viewingSubmissionsPage && (
        <SubmissionsViewerModal
          isOpen={!!viewingSubmissionsPage}
          onClose={() => setViewingSubmissionsPage(null)}
          pageId={viewingSubmissionsPage.id}
          pageTitle={viewingSubmissionsPage.title}
          pageSlug={viewingSubmissionsPage.slug}
        />
      )}
    </div>
  );
}
