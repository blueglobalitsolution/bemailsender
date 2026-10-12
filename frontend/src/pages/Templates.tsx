import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Plus,
  Save,
  Trash2,
  Edit3,
  Mail,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  Eye,
  X,
  Sparkles
} from "lucide-react";
import EmailEditor, { EditorRef } from "react-email-editor";
import { apiFetch } from "../lib/api";
import { useToast } from "../components/Toast";
import AIEmailWriterModal from "../components/AIEmailWriterModal";

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
}

export default function Templates() {
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);

  // Template states
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [newTemplate, setNewTemplate] = useState<{
    name: string;
    subject: string;
    body: string;
    type: string;
    design?: any;
  }>({
    name: "",
    subject: "",
    body: "",
    type: "email",
  });
  const [spamCheckIdentity, setSpamCheckIdentity] = useState("");
  const [spamScore, setSpamScore] = useState<{ score: number; report: string } | null>(null);
  const [spamChecking, setSpamChecking] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  const stripHtml = (html: string) => {
    if (!html) return "";
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
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

  useEffect(() => {
    fetchTemplates();
    fetchIdentities();

    const handleOpenAI = () => setIsAIModalOpen(true);
    const handleOpenCreate = () => {
      setNewTemplate({ name: "", subject: "", body: "", type: "email", design: undefined });
      setEditingId(null);
      setIsCreating(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    window.addEventListener("open-ai-modal", handleOpenAI);
    window.addEventListener("open-create-template-modal", handleOpenCreate);

    return () => {
      window.removeEventListener("open-ai-modal", handleOpenAI);
      window.removeEventListener("open-create-template-modal", handleOpenCreate);
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newTemplate.type === "email" && emailEditorRef.current?.editor) {
      emailEditorRef.current.editor.exportHtml(async (data) => {
        const { design, html } = data;
        await saveTemplate(html, design);
      });
    } else {
      await saveTemplate(newTemplate.body, undefined);
    }
  };

  const saveTemplate = async (bodyHtml: string, designJson?: any) => {
    try {
      const url = editingId ? `/api/templates/${editingId}/` : "/api/templates/";
      const method = editingId ? "PUT" : "POST";

      const payload = {
        name: newTemplate.name,
        subject: newTemplate.subject,
        body: bodyHtml,
        type: newTemplate.type,
        design: designJson,
      };

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fetchTemplates();
        setIsCreating(false);
        setEditingId(null);
        setSpamScore(null);
        setNewTemplate({ name: "", subject: "", body: "", type: "email", design: undefined });
        toast.success(editingId ? "Template updated successfully." : "Template created successfully.");
      } else {
        const err = await res.json();
        toast.error(Object.values(err).flat().join(" ") || "Failed to save template.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error saving template.");
    }
  };

  const handleEdit = (template: Template) => {
    setNewTemplate({
      name: template.name,
      subject: template.subject || "",
      body: template.body,
      type: template.type || "email",
      design: template.design,
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

  if (loading) return <div className="text-center py-12 text-[#8E9BA8]">Loading templates...</div>;

  return (
    <div className="space-y-8 font-sans">

      {/* CREATE / EDIT TEMPLATE CARD */}
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
                    key={editingId || "new"}
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
                  setNewTemplate({ name: "", subject: "", body: "", type: "email", design: undefined });
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

      {/* TEMPLATES GRID */}
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

      {/* Right-Side Template Live Preview Drawer with Flush Alignment & No Blur */}
      {previewTemplate && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-hidden">
          {/* Solid Dark Backdrop - NO BLUR */}
          <div
            className="fixed inset-0 bg-black/60 transition-opacity animate-in fade-in duration-200"
            onClick={() => setPreviewTemplate(null)}
          />

          {/* Drawer anchored firmly to the right side */}
          <div className="fixed inset-y-0 right-0 flex max-w-full">
            <div className="w-screen max-w-2xl lg:max-w-3xl h-full bg-[#161B1F] border-l border-[#2C353D] flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-[#2C353D] flex items-start justify-between bg-[#1A2026] shrink-0">
                <div className="pr-4 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 font-semibold">
                      Live Preview
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#8E9BA8] bg-[#222930] px-2.5 py-0.5 rounded border border-[#2C353D]">
                      Email Template
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{previewTemplate.name}</h3>
                  {previewTemplate.subject && (
                    <div className="mt-2.5 p-3 bg-[#14181C] border border-[#2C353D] rounded-xl text-xs">
                      <span className="text-[#8E9BA8] font-bold uppercase text-[10px] tracking-wider block mb-1">Subject Line</span>
                      <p className="text-[#E2E8F0] font-medium">{previewTemplate.subject}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="p-2 text-[#8E9BA8] hover:text-white bg-[#222930] hover:bg-[#2C353D] border border-[#2C353D] rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Close Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Body - Live Rendered HTML in iframe */}
              <div className="flex-1 overflow-hidden p-6 flex flex-col bg-[#14181C]">
                <div className="flex items-center justify-between mb-2.5 px-0.5 shrink-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                    Email Content Canvas
                  </span>
                  <span className="text-[11px] font-mono text-[#8E9BA8]">
                    Rendered HTML
                  </span>
                </div>
                <div className="flex-1 bg-white rounded-xl overflow-hidden border border-[#2C353D] shadow-xl relative">
                  <iframe
                    srcDoc={previewTemplate.body}
                    className="w-full h-full border-0 bg-white block"
                    title="Template Live Preview"
                    sandbox="allow-same-origin allow-popups"
                  />
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="px-6 py-4 border-t border-[#2C353D] bg-[#1A2026] flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="px-4 py-2 border border-[#2C353D] bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"
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
                  className="px-5 py-2.5 bg-white hover:bg-[#CBD5E1] text-[#161B1F] text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit This Template
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
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
                            html: formattedHtml,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          };

          setNewTemplate((prev) => ({
            ...prev,
            name: prev.name || (subject ? `AI - ${subject.slice(0, 30)}` : "AI Generated Template"),
            subject: subject,
            body: body,
            design: newDesign,
          }));
          setIsCreating(true);

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
    </div>
  );
}
