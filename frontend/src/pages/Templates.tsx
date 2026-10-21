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
  Sparkles,
  Upload,
  Code,
  Layout,
  Smartphone,
  Monitor,
  CheckCircle2,
  FileCode
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
  const [editorMode, setEditorMode] = useState<"drag_drop" | "custom_html">("drag_drop");
  const [customHtml, setCustomHtml] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setCustomHtml("");
      setUploadedFileName("");
      setEditorMode("drag_drop");
        setCustomHtml("");
        setUploadedFileName("");
        setEditorMode("drag_drop");
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

  const ensureUnsubscribeFooter = (rawHtml: string): string => {
    if (!rawHtml || !rawHtml.trim()) return rawHtml;
    const hasUnsubscribe = /unsubscribe|opt-out|list-unsubscribe/i.test(rawHtml);
    if (hasUnsubscribe) {
      return rawHtml;
    }

    const defaultFooter = '<div style="margin-top:32px;padding:20px;border-top:1px solid #eaeaea;text-align:center;font-family:sans-serif;font-size:12px;color:#888888;line-height:1.5;">' +
      '<p style="margin:0 0 8px 0;">You received this email because you are subscribed to our updates.</p>' +
      '<p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#666666;text-decoration:underline;font-weight:500;">Unsubscribe</a> from these emails.</p>' +
      '</div>';

    if (rawHtml.includes("</body>")) {
      return rawHtml.replace("</body>", defaultFooter + "\n</body>");
    } else {
      return rawHtml + defaultFooter;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm") && file.type !== "text/html") {
      toast.error("Please upload a valid .html or .htm file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const enriched = ensureUnsubscribeFooter(content);
        setCustomHtml(enriched);
        setUploadedFileName(file.name);
        setEditorMode("custom_html");

        if (!newTemplate.name) {
          const autoName = file.name.replace(/\.(html|htm)$/i, "").replace(/[-_]/g, " ");
          setNewTemplate((prev) => ({
            ...prev,
            name: autoName.charAt(0).toUpperCase() + autoName.slice(1),
          }));
        }

        toast.success(`Loaded "${file.name}" with auto-unsubscribe verification.`);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read the HTML file");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editorMode === "custom_html") {
      if (!customHtml.trim()) {
        toast.error("Please upload an HTML file or enter HTML content.");
        return;
      }
      const finalHtml = ensureUnsubscribeFooter(customHtml);
      await saveTemplate(finalHtml, undefined);
    } else if (newTemplate.type === "email" && emailEditorRef.current?.editor) {
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
    if (!template.design && template.body) {
      setEditorMode("custom_html");
      setCustomHtml(template.body);
      setUploadedFileName("Saved HTML Template");
    } else {
      setEditorMode("drag_drop");
      setCustomHtml("");
      setUploadedFileName("");
    }
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
    setSpamChecking(true);
    setSpamScore(null);
    try {
      let currentBody = newTemplate.body || "";
      if (editorMode === "custom_html") {
        currentBody = customHtml || "";
      } else if (newTemplate.type === "email" && emailEditorRef.current?.editor) {
        currentBody = await new Promise<string>((resolve) => {
          emailEditorRef.current?.editor?.exportHtml((data) => {
            resolve(data.html || "");
          });
        });
      }

      if (!currentBody.trim() && !editingId) {
        toast.info("Please enter or upload email content before checking spam score.");
        setSpamChecking(false);
        return;
      }

      const res = await apiFetch("/api/templates/check-spam/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: editingId || undefined,
          body: currentBody,
          subject: newTemplate.subject || "No Subject",
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
    <div className="flex flex-col h-full w-full font-sans bg-[#161B1F]">
      {/* CREATE / EDIT TEMPLATE PANEL */}
      {isCreating && (
        <div className="border-b border-[#2C353D] bg-[#181E24] px-4 sm:px-6 py-5 w-full">
          <div className="w-full space-y-5">
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8E9BA8] mb-1.5 font-mono">
                    Template Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cold Outreach Sequence 1"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    className="w-full bg-[#14181C] border border-[#2C353D] focus:border-white text-white text-sm px-4 py-2 rounded-lg outline-none transition-all placeholder:text-[#55606D]"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#8E9BA8] font-mono">
                      Email Subject
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAIModalOpen(true)}
                      className="text-white hover:text-white/80 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer bg-[#222930] border border-[#2C353D] px-2 py-0.5 rounded-md"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" /> Draft with AI Writer
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Quick question regarding {{company}}'s outbound growth"
                    value={newTemplate.subject}
                    onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                    className="w-full bg-[#14181C] border border-[#2C353D] focus:border-white text-white text-sm px-4 py-2 rounded-lg outline-none transition-all placeholder:text-[#55606D]"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#8E9BA8] font-mono">
                      Email Design
                    </label>
                    <p className="text-xs text-[#8E9BA8] mt-0.5">
                      Use <span className="text-white font-mono font-medium">{'{{variable_name}}'}</span> for dynamic variables (e.g. <span className="font-mono">{'{{first_name}}'}</span>, <span className="font-mono">{'{{unsubscribe_url}}'}</span>)
                    </p>
                  </div>

                  {/* Mode Selector Tabs & Upload Button */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".html,.htm"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-1.5 bg-[#222930] hover:bg-[#2C353D] border border-[#2C353D] text-[#CBD5E1] hover:text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                      title="Upload an existing HTML template"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Upload .HTML</span>
                    </button>

                    <div className="flex items-center bg-[#14181C] p-1 rounded-lg border border-[#2C353D]">
                      <button
                        type="button"
                        onClick={() => setEditorMode("drag_drop")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          editorMode === "drag_drop"
                            ? "bg-white text-[#161B1F] shadow-sm font-bold"
                            : "text-[#8E9BA8] hover:text-white"
                        }`}
                      >
                        <Layout className="w-3.5 h-3.5" />
                        <span>Drag & Drop</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditorMode("custom_html")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          editorMode === "custom_html"
                            ? "bg-white text-[#161B1F] shadow-sm font-bold"
                            : "text-[#8E9BA8] hover:text-white"
                        }`}
                      >
                        <Code className="w-3.5 h-3.5" />
                        <span>Uploaded HTML & Preview</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Drag and Drop Mode View */}
                {editorMode === "drag_drop" && (
                  <div className="w-full h-[600px] border border-[#2C353D] rounded-xl overflow-hidden bg-white">
                    <EmailEditor
                      key={editingId || "new"}
                      ref={emailEditorRef}
                      onReady={onReady}
                      minHeight={600}
                    />
                  </div>
                )}

                {/* Uploaded HTML & Live Preview Mode View */}
                {editorMode === "custom_html" && (
                  <div className="border border-[#2C353D] bg-[#14181C] rounded-xl overflow-hidden shadow-2xl">
                    {/* Top Status Bar with Device Toggle & Unsubscribe Verification Badge */}
                    <div className="px-4 py-2.5 bg-[#1C2227] border-b border-[#2C353D] flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[#8E9BA8] font-mono text-[11px] flex items-center gap-1.5">
                          <FileCode className="w-4 h-4 text-emerald-400" />
                          {uploadedFileName || "Custom HTML Template"}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Auto-Unsubscribe Ready
                        </span>
                      </div>

                      {/* Device View Toggles */}
                      <div className="flex items-center gap-1 bg-[#14181C] p-1 rounded-lg border border-[#2C353D]">
                        <button
                          type="button"
                          onClick={() => setPreviewDevice("desktop")}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                            previewDevice === "desktop" ? "bg-white text-[#161B1F] font-bold" : "text-[#8E9BA8] hover:text-white"
                          }`}
                        >
                          <Monitor className="w-3.5 h-3.5" /> Desktop
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewDevice("mobile")}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                            previewDevice === "mobile" ? "bg-white text-[#161B1F] font-bold" : "text-[#8E9BA8] hover:text-white"
                          }`}
                        >
                          <Smartphone className="w-3.5 h-3.5" /> Mobile
                        </button>
                      </div>
                    </div>

                    {/* Side-by-side or stacked Editor & Preview Canvas */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 h-[600px] divide-y lg:divide-y-0 lg:divide-x divide-[#2C353D]">
                      {/* Left: Code Editor Textarea */}
                      <div className="flex flex-col h-full bg-[#14181C]">
                        <div className="px-3 py-1.5 bg-[#181E24] border-b border-[#2C353D] flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-[#8E9BA8] tracking-wider">HTML Source Code</span>
                          <span className="text-[10px] text-[#8E9BA8] font-mono">Live Editable</span>
                        </div>
                        <textarea
                          value={customHtml}
                          onChange={(e) => setCustomHtml(e.target.value)}
                          placeholder="Upload an HTML file above or paste your raw HTML template here..."
                          className="flex-1 w-full p-4 bg-[#14181C] text-[#E2E8F0] font-mono text-xs leading-relaxed resize-none focus:outline-none border-0"
                          spellCheck={false}
                        />
                      </div>

                      {/* Right: Live Interactive Render Preview */}
                      <div className="flex flex-col h-full bg-[#182028] overflow-hidden">
                        <div className="px-3 py-1.5 bg-[#181E24] border-b border-[#2C353D] flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase text-[#8E9BA8] tracking-wider">Rendered Live Preview</span>
                          <span className="text-[10px] text-emerald-400 font-mono">Live DOM</span>
                        </div>
                        <div className="flex-1 p-4 flex items-center justify-center overflow-auto bg-[#182028]">
                          <div
                            className={`h-full bg-white transition-all duration-300 shadow-2xl overflow-hidden rounded-md border border-gray-400 ${
                              previewDevice === "mobile" ? "w-[375px]" : "w-full"
                            }`}
                          >
                            <iframe
                              srcDoc={customHtml || '<div style="font-family: sans-serif; text-align: center; padding: 40px; color: #888;">Upload an HTML file or write code on the left to see live preview.</div>'}
                              className="w-full h-full border-0 bg-white"
                              title="Custom HTML Template Preview"
                              sandbox="allow-same-origin allow-popups"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Spam Score Checker */}
              <div className="border-t border-[#2C353D] pt-4">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#8E9BA8] mb-2 font-mono">
                      Test Sender Identity
                    </label>
                    <select
                      value={spamCheckIdentity}
                      onChange={(e) => { setSpamCheckIdentity(e.target.value); setSpamScore(null); }}
                      className="w-full bg-[#14181C] border border-[#2C353D] focus:border-white text-white text-xs px-4 py-2.5 rounded-lg outline-none cursor-pointer"
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
                    disabled={spamChecking}
                    className="bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white px-5 py-2.5 rounded-lg text-xs font-semibold border border-[#2C353D] transition-all flex items-center gap-2 disabled:opacity-40 cursor-pointer shrink-0"
                  >
                    {spamChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5 text-emerald-400" />}
                    {spamChecking ? "Checking..." : "Check Spam Score"}
                  </button>
                </div>

                {spamScore !== null && (
                  <div className="mt-4 bg-[#14181C] border border-[#2C353D] rounded-xl p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {spamScore.score <= 3 ? (
                          <ShieldCheck className="w-10 h-10 text-emerald-400" />
                        ) : spamScore.score <= 6 ? (
                          <AlertTriangle className="w-10 h-10 text-amber-400" />
                        ) : (
                          <ShieldAlert className="w-10 h-10 text-rose-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-base font-semibold text-white tracking-wide">
                            Spam Score: <span className={spamScore.score <= 3 ? "text-emerald-400 font-bold" : spamScore.score <= 6 ? "text-amber-400 font-bold" : "text-rose-400 font-bold"}>{spamScore.score.toFixed(1)} / 10</span>
                          </span>
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border rounded ${spamScore.score <= 3 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : spamScore.score <= 6 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-rose-500/10 text-rose-400 border-rose-500/30"}`}>
                            {spamScore.score <= 3 ? "Good" : spamScore.score <= 6 ? "Fair" : "Poor"}
                          </span>
                        </div>
                        <div className="w-full bg-[#222930] h-1.5 mb-3 overflow-hidden rounded-full">
                          <div
                            className={`h-full transition-all duration-500 ${spamScore.score <= 3 ? "bg-emerald-400" : spamScore.score <= 6 ? "bg-amber-400" : "bg-rose-500"}`}
                            style={{ width: `${Math.min(spamScore.score * 10, 100)}%` }}
                          />
                        </div>
                        {spamScore.report && (
                          <details className="group">
                            <summary className="text-[11px] font-mono text-[#8E9BA8] cursor-pointer hover:text-white select-none transition-colors">▾ View SpamAssassin breakdown</summary>
                            <pre className="mt-2 text-[11px] text-[#CBD5E1] whitespace-pre-wrap font-mono bg-[#0B0F13] border border-[#2C353D] p-3 max-h-56 overflow-y-auto leading-relaxed rounded-lg">{spamScore.report}</pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-[#2C353D]">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingId(null);
                    setSpamScore(null);
                    setNewTemplate({ name: "", subject: "", body: "", type: "email", design: undefined });
                  }}
                  className="bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white px-5 py-2.5 rounded-lg text-xs font-semibold border border-[#2C353D] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold rounded-lg px-6 py-2.5 text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Save className="w-4 h-4" /> Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEMPLATES GRID */}
      <div className="flex-1 overflow-auto p-6 lg:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              onClick={() => setPreviewTemplate(template)}
              className="bg-[#1C2227] border border-[#2C353D] hover:border-[#CBD5E1] rounded-xl transition-all p-5 flex flex-col justify-between group cursor-pointer shadow-md relative"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h3 className="font-sans font-bold text-base text-white line-clamp-1" title={template.name}>
                      {template.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-1.5 bg-[#222930] hover:bg-[#2C353D] text-[#8E9BA8] hover:text-white rounded-lg border border-[#2C353D] transition-colors cursor-pointer"
                      title="Edit Template"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-1.5 bg-[#222930] hover:bg-rose-950/40 text-[#8E9BA8] hover:text-rose-400 rounded-lg border border-[#2C353D] transition-colors cursor-pointer"
                      title="Delete Template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {template.subject && (
                  <div className="mb-3">
                    <p className="text-[10px] uppercase font-mono tracking-wider text-[#8E9BA8] mb-0.5">Subject</p>
                    <p className="text-xs text-[#CBD5E1] font-medium line-clamp-1" title={template.subject}>
                      {template.subject}
                    </p>
                  </div>
                )}

                <p className="text-xs text-[#8E9BA8] line-clamp-4 leading-relaxed mb-4">
                  {stripHtml(template.body) || "No plain text excerpt available."}
                </p>
              </div>

              <div className="pt-3 border-t border-[#2C353D] flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8E9BA8] group-hover:text-white transition-colors">
                  Click to view preview
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewTemplate(template);
                  }}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-md transition-all cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
              </div>
            </div>
          ))}
          {templates.length === 0 && !isCreating && (
            <div className="col-span-full text-center py-20 text-[#8E9BA8] bg-[#1C2227] border border-[#2C353D] rounded-xl font-mono text-xs">
              No templates found. Click "New Template" above to get started!
            </div>
          )}
        </div>
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
