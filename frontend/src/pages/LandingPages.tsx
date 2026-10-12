import React, { useState, useEffect, useRef } from "react";
import {
  Globe,
  Plus,
  Save,
  Trash2,
  Edit3,
  Loader2,
  Copy,
  ExternalLink,
  Download,
  Layers,
  GripVertical,
  X,
  FormInput
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../components/Toast";
import FormBuilderModal, { CustomForm } from "../components/FormBuilderModal";
import SubmissionsViewerModal from "../components/SubmissionsViewerModal";

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

export default function LandingPages() {
  const toast = useToast();
  const [activeSubTab, setActiveSubTab] = useState<"landing-pages" | "forms">("landing-pages");
  const [landingPages, setLandingPages] = useState<LandingPageItem[]>([]);
  const [customForms, setCustomForms] = useState<CustomForm[]>([]);
  const [loading, setLoading] = useState(true);

  // Landing Page creation/edit states
  const [isCreatingLanding, setIsCreatingLanding] = useState(false);
  const [editingLandingId, setEditingLandingId] = useState<number | null>(null);
  const [landingTitle, setLandingTitle] = useState("");
  const [landingHtml, setLandingHtml] = useState("");
  const [savingLanding, setSavingLanding] = useState(false);
  const [isDraggingOverEditor, setIsDraggingOverEditor] = useState(false);
  const [isDraggingOverPreview, setIsDraggingOverPreview] = useState(false);
  const landingTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Form Builder Modal State
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const [editingFormItem, setEditingFormItem] = useState<CustomForm | null>(null);

  // Submissions Modal State
  const [viewingSubmissionsPage, setViewingSubmissionsPage] = useState<{ id: number; title: string; slug: string } | null>(null);

  useEffect(() => {
    fetchLandingPages();
    fetchCustomForms();

    const handleOpenCreateLanding = () => {
      setEditingLandingId(null);
      setLandingTitle("");
      setLandingHtml(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Special Offer</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0B0E14; color: #FFFFFF; padding: 48px 24px; text-align: center; }
    .container { max-width: 640px; margin: 0 auto; background: #161B22; padding: 40px; border-radius: 16px; border: 1px solid #30363D; }
    h1 { font-size: 28px; margin-bottom: 12px; }
    p { color: #8B949E; font-size: 15px; margin-bottom: 28px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Special Product Demo</h1>
    <p>Sign up below to claim your personalized walkthrough.</p>
    {{form_lead}}
  </div>
</body>
</html>`);
      setActiveSubTab("landing-pages");
      setIsCreatingLanding(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleOpenFormBuilder = () => {
      setEditingFormItem(null);
      setIsFormBuilderOpen(true);
    };

    window.addEventListener("open-create-landing-modal", handleOpenCreateLanding);
    window.addEventListener("open-form-builder-modal", handleOpenFormBuilder);

    return () => {
      window.removeEventListener("open-create-landing-modal", handleOpenCreateLanding);
      window.removeEventListener("open-form-builder-modal", handleOpenFormBuilder);
    };
  }, []);

  const fetchLandingPages = async () => {
    try {
      const res = await apiFetch("/api/landing-pages/");
      if (res.ok) {
        const data = await res.json();
        setLandingPages(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomForms = async () => {
    try {
      const res = await apiFetch("/api/forms/");
      if (res.ok) {
        const data = await res.json();
        setCustomForms(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveLanding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!landingTitle.trim() || !landingHtml.trim()) {
      toast.error("Please provide both a title and HTML content");
      return;
    }
    setSavingLanding(true);
    try {
      const url = editingLandingId ? `/api/landing-pages/${editingLandingId}/` : "/api/landing-pages/";
      const method = editingLandingId ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: landingTitle,
          html_content: landingHtml,
        }),
      });

      if (res.ok) {
        toast.success(editingLandingId ? "Landing page updated successfully!" : "Landing page created!");
        setIsCreatingLanding(false);
        setEditingLandingId(null);
        setLandingTitle("");
        setLandingHtml("");
        fetchLandingPages();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save landing page");
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

  const insertFormShortcode = (shortcode: string, formName?: string) => {
    const sc = `{{${shortcode}}}`;
    const textarea = landingTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const current = textarea.value;
      const before = current.substring(0, start);
      const after = current.substring(end);
      const updated = before + `\n${sc}\n` + after;
      setLandingHtml(updated);
      setTimeout(() => {
        textarea.focus();
        const nextPos = start + sc.length + 2;
        textarea.setSelectionRange(nextPos, nextPos);
      }, 50);
    } else {
      setLandingHtml((prev) => prev ? prev + `\n${sc}\n` : sc);
    }
    toast.success(`Inserted ${formName || shortcode} (${sc}) into Landing Page!`);
  };

  const handleDropFormOnEditor = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverEditor(false);
    const shortcode = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("application/x-form-shortcode");
    const formName = e.dataTransfer.getData("application/x-form-name") || shortcode;
    if (shortcode) {
      insertFormShortcode(shortcode, formName);
    }
  };

  const handleDropFormOnPreview = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverPreview(false);
    const shortcode = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("application/x-form-shortcode");
    const formName = e.dataTransfer.getData("application/x-form-name") || shortcode;
    if (shortcode) {
      const sc = `{{${shortcode}}}`;
      if (landingHtml.includes("</body>")) {
        setLandingHtml((prev) => prev.replace("</body>", `  ${sc}\n</body>`));
      } else {
        setLandingHtml((prev) => prev + `\n${sc}\n`);
      }
      toast.success(`Dropped ${formName} (${sc}) into Preview!`);
    }
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

  if (loading) return <div className="text-center py-12 text-[#8E9BA8]">Loading Landing Pages & Forms...</div>;

  return (
    <div className="space-y-8 font-sans">
      {/* Sub Header / Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-[#2C353D] pb-4">
        <div className="flex gap-1.5 bg-[#222930] border border-[#2C353D] rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveSubTab("landing-pages")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "landing-pages"
                ? "bg-white text-[#161B1F] shadow-sm font-bold"
                : "text-[#8E9BA8] hover:text-white"
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Landing Pages ({landingPages.length})
          </button>
          <button
            onClick={() => setActiveSubTab("forms")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "forms"
                ? "bg-white text-[#161B1F] shadow-sm font-bold"
                : "text-[#8E9BA8] hover:text-white"
            }`}
          >
            <FormInput className="w-3.5 h-3.5" /> Lead Forms ({customForms.length})
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: LANDING PAGES */}
      {activeSubTab === "landing-pages" && (
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
                  className="text-[#8E9BA8] hover:text-white p-1 rounded-lg cursor-pointer"
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

                {/* Drag-and-Drop Lead Forms Palette */}
                <div className="bg-[#14181C] border border-[#2C353D] rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-white">
                        Available Lead Forms (Drag & Drop or Click to Insert)
                      </span>
                    </div>
                    <span className="text-[11px] text-[#8E9BA8]">
                      Tip: Drag a form chip into the code editor or preview!
                    </span>
                  </div>

                  {customForms.length === 0 ? (
                    <div className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg flex items-center justify-between">
                      <span>No lead capture forms created yet. Go to the "Lead Forms" tab to create one.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFormItem(null);
                          setIsFormBuilderOpen(true);
                        }}
                        className="text-xs font-semibold text-white underline hover:text-amber-200 cursor-pointer ml-3"
                      >
                        + Create Form
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 flex-wrap pt-1">
                      {customForms.map((f) => (
                        <div
                          key={f.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", f.shortcode);
                            e.dataTransfer.setData("application/x-form-shortcode", f.shortcode);
                            e.dataTransfer.setData("application/x-form-name", f.name);
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          className="group flex items-center gap-2 bg-[#1C2227] hover:bg-[#26303A] border border-[#2C353D] hover:border-purple-500/60 px-3 py-1.5 rounded-lg text-white text-xs cursor-grab active:cursor-grabbing transition-all shadow-sm select-none"
                          title="Drag this form chip into the HTML editor or click Insert"
                        >
                          <GripVertical className="w-3.5 h-3.5 text-[#8E9BA8] group-hover:text-purple-400" />
                          <span className="font-semibold text-white text-xs">{f.name}</span>
                          <code className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                            {`{{${f.shortcode}}}`}
                          </code>
                          <button
                            type="button"
                            onClick={() => insertFormShortcode(f.shortcode, f.name)}
                            className="ml-1 bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors shadow-xs"
                            title="Click to insert at cursor position in HTML"
                          >
                            + Insert
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Side-by-Side: Left HTML Editor, Right Live Real-Time Preview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                  {/* Left Column: HTML Code Input with Drag & Drop Zone */}
                  <div
                    className={`flex flex-col space-y-2 relative rounded-xl transition-all ${
                      isDraggingOverEditor ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-[#1E252D]" : ""
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                      setIsDraggingOverEditor(true);
                    }}
                    onDragLeave={() => setIsDraggingOverEditor(false)}
                    onDrop={handleDropFormOnEditor}
                  >
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                        Raw HTML Content (with Shortcodes) *
                      </label>
                      {isDraggingOverEditor && (
                        <span className="text-[11px] font-bold text-purple-400 animate-pulse">
                          Drop form here to insert!
                        </span>
                      )}
                    </div>

                    <div className="relative flex-1 flex flex-col">
                      <textarea
                        ref={landingTextareaRef}
                        value={landingHtml}
                        onChange={(e) => setLandingHtml(e.target.value)}
                        rows={18}
                        placeholder="<!DOCTYPE html><html>... paste full HTML here or drag forms from above ...</html>"
                        className={`w-full font-mono text-xs bg-[#161B1F] border rounded-xl p-4 text-emerald-300 focus:outline-none focus:border-white transition-all flex-1 min-h-[440px] ${
                          isDraggingOverEditor ? "border-purple-500 bg-purple-500/5" : "border-[#2C353D]"
                        }`}
                        required
                      />

                      {/* Snippet chips helper */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-2">
                        <span className="text-[10px] text-[#8E9BA8] uppercase font-bold tracking-wider">Quick Snippets:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `<section style="padding: 40px; text-align: center; background: #161B22; border-radius: 12px; margin: 20px 0;">\n  <h2>Join Our Waitlist</h2>\n  <p>Fill out the form below:</p>\n  {{form_lead}}\n</section>`;
                            setLandingHtml((prev) => (prev ? prev + "\n" + snippet : snippet));
                          }}
                          className="text-[10px] bg-[#161B1F] border border-[#2C353D] hover:border-white px-2 py-0.5 rounded text-[#CBD5E1] transition-colors cursor-pointer"
                        >
                          + Form Section
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `<div style="display: flex; gap: 20px; justify-content: center; margin: 30px 0;">\n  <div style="background: #21262D; padding: 20px; border-radius: 8px;">Feature 1</div>\n  <div style="background: #21262D; padding: 20px; border-radius: 8px;">Feature 2</div>\n</div>`;
                            setLandingHtml((prev) => (prev ? prev + "\n" + snippet : snippet));
                          }}
                          className="text-[10px] bg-[#161B1F] border border-[#2C353D] hover:border-white px-2 py-0.5 rounded text-[#CBD5E1] transition-colors cursor-pointer"
                        >
                          + Feature Grid
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live HTML Preview with Drag & Drop */}
                  <div
                    className={`flex flex-col space-y-2 relative rounded-xl transition-all ${
                      isDraggingOverPreview ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-[#1E252D]" : ""
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                      setIsDraggingOverPreview(true);
                    }}
                    onDragLeave={() => setIsDraggingOverPreview(false)}
                    onDrop={handleDropFormOnPreview}
                  >
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                        Live Visual Preview
                      </label>
                      <span className="text-[11px] text-[#8E9BA8]">
                        Renders HTML & replaced forms
                      </span>
                    </div>

                    <div className="relative flex-1 bg-white rounded-xl overflow-hidden border border-[#2C353D] min-h-[440px] shadow-inner">
                      {isDraggingOverPreview && (
                        <div className="absolute inset-0 bg-purple-600/20 backdrop-blur-xs flex items-center justify-center z-10 border-2 border-dashed border-purple-500 rounded-xl">
                          <span className="bg-[#161B1F] text-white px-4 py-2 rounded-lg font-bold text-xs shadow-xl">
                            Drop to Embed Form into Landing Page
                          </span>
                        </div>
                      )}
                      <iframe
                        srcDoc={(() => {
                          let rendered = landingHtml || "<div style='font-family:sans-serif;color:#666;text-align:center;padding:50px;'>Type HTML on the left to see live preview</div>";
                          customForms.forEach((f) => {
                            const sc1 = `{{${f.shortcode}}}`;
                            const sc2 = `{{form_${f.shortcode}}}`;
                            const placeholder = `
                              <div style="border: 2px dashed #6366f1; background: #e0e7ff; color: #3730a3; padding: 24px; border-radius: 12px; margin: 16px auto; max-width: 480px; text-align: left; font-family: sans-serif;">
                                <div style="font-weight: bold; font-size: 15px; margin-bottom: 6px;">📋 Lead Form: ${f.name}</div>
                                <div style="font-size: 12px; color: #4338ca; margin-bottom: 12px;">Active Shortcode: <code>${f.shortcode}</code> (${f.fields_schema?.length || 0} fields)</div>
                                <div style="background: white; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px;">
                                  ${(f.fields_schema || []).map((fld: any) => `
                                    <div style="margin-bottom: 8px;">
                                      <label style="display:block; font-size: 11px; font-weight:600; color: #475569; margin-bottom: 3px;">${fld.label} ${fld.required ? '*' : ''}</label>
                                      <input disabled placeholder="${fld.placeholder || ''}" style="width: 100%; box-sizing: border-box; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; background: #f8fafc;" />
                                    </div>
                                  `).join('')}
                                  <button disabled style="margin-top: 6px; width: 100%; background: #4f46e5; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: bold; font-size: 12px;">${f.submit_button_text || 'Submit'}</button>
                                </div>
                              </div>
                            `;
                            rendered = rendered.split(sc1).join(placeholder);
                            rendered = rendered.split(sc2).join(placeholder);
                          });
                          return rendered;
                        })()}
                        className="w-full h-full min-h-[440px] border-0 bg-white"
                        title="Live HTML Preview"
                        sandbox="allow-same-origin allow-popups"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit button bar */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2C353D]">
                  <button
                    type="button"
                    onClick={() => setIsCreatingLanding(false)}
                    className="px-4 py-2 border border-[#2C353D] bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingLanding}
                    className="px-5 py-2.5 bg-white hover:bg-[#CBD5E1] text-[#161B1F] text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
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
                        className="p-1.5 text-[#8E9BA8] hover:text-white hover:bg-[#26303A] rounded-md transition-colors cursor-pointer"
                        title="Edit Page HTML"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLanding(page.id)}
                        className="p-1.5 text-[#8E9BA8] hover:text-red-400 hover:bg-[#26303A] rounded-md transition-colors cursor-pointer"
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

      {/* SUB-TAB 2: LEAD FORMS / FORM BUILDER */}
      {activeSubTab === "forms" && (
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
              className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
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
                        className="p-1.5 text-[#8E9BA8] hover:text-white hover:bg-[#26303A] rounded-md transition-colors cursor-pointer"
                        title="Edit Form"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteForm(form.id)}
                        className="p-1.5 text-[#8E9BA8] hover:text-red-400 hover:bg-[#26303A] rounded-md transition-colors cursor-pointer"
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

      {/* Form Builder Modal */}
      <FormBuilderModal
        isOpen={isFormBuilderOpen}
        onClose={() => setIsFormBuilderOpen(false)}
        formItem={editingFormItem}
        onSaveSuccess={() => {
          fetchCustomForms();
        }}
      />

      {/* Submissions Viewer Modal */}
      {viewingSubmissionsPage && (
        <SubmissionsViewerModal
          isOpen={true}
          onClose={() => setViewingSubmissionsPage(null)}
          landingPageId={viewingSubmissionsPage.id}
          landingPageTitle={viewingSubmissionsPage.title}
          landingPageSlug={viewingSubmissionsPage.slug}
        />
      )}
    </div>
  );
}
