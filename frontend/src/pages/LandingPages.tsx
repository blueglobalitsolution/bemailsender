import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
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
  X,
  Bot,
  MessageSquare,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ListFilter,
  Eye
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../components/Toast";
import SubmissionsViewerModal from "../components/SubmissionsViewerModal";

interface FormFieldInfo {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
}

interface DetectedFormInfo {
  form_index: number;
  action: string;
  method: string;
  fields_count: number;
  fields: FormFieldInfo[];
  submit_button: string;
  is_shortcode?: boolean;
}

interface LandingPageItem {
  id: number;
  title: string;
  slug: string;
  html_content: string;
  views_count: number;
  chatbot_enabled?: boolean;
  chatbot_name?: string;
  chatbot_welcome_message?: string;
  chatbot_script?: string;
  public_url: string;
  submissions_count: number;
  created_at: string;
}

export default function LandingPages() {
  const toast = useToast();
  const [landingPages, setLandingPages] = useState<LandingPageItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Landing Page creation/edit states
  const [isCreatingLanding, setIsCreatingLanding] = useState(false);
  const [editingLandingId, setEditingLandingId] = useState<number | null>(null);
  const [landingTitle, setLandingTitle] = useState("");
  const [landingHtml, setLandingHtml] = useState("");
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [chatbotName, setChatbotName] = useState("AI Sales Assistant");
  const [chatbotWelcomeMessage, setChatbotWelcomeMessage] = useState("Hi there! 👋 Welcome! Please introduce yourself below to start chatting.");
  const [chatbotScript, setChatbotScript] = useState("");
  const [savingLanding, setSavingLanding] = useState(false);
  const landingTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Form detection state
  const [detectedForms, setDetectedForms] = useState<DetectedFormInfo[]>([]);
  const [showDetectedForms, setShowDetectedForms] = useState(false);

  // Submissions Modal State
  const [viewingSubmissionsPage, setViewingSubmissionsPage] = useState<{ id: number; title: string; slug: string } | null>(null);

  useEffect(() => {
    fetchLandingPages();

    const handleOpenCreateLanding = () => {
      setEditingLandingId(null);
      setLandingTitle("");
      setLandingHtml(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Special Offer & Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0B0E14; color: #FFFFFF; padding: 60px 20px; text-align: center; }
    .container { max-width: 640px; margin: 0 auto; background: #161B22; padding: 48px 32px; border-radius: 20px; border: 1px solid #30363D; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    h1 { font-size: 32px; font-weight: 800; margin-bottom: 16px; background: linear-gradient(135deg, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p { color: #94A3B8; font-size: 16px; line-height: 1.6; margin-bottom: 32px; }
    .badge { display: inline-block; padding: 6px 14px; background: rgba(99, 102, 241, 0.15); color: #818CF8; border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">🚀 Exclusive Launch</div>
    <h1>Scale Your Outreach on Autopilot</h1>
    <p>Automate deliverability, warm up mailboxes, and convert high-ticket leads seamlessly. Have questions? Ask our AI sales assistant below!</p>
  </div>
</body>
</html>`);
      setChatbotEnabled(true);
      setChatbotName("AI Sales Assistant");
      setChatbotWelcomeMessage("Hi there! 👋 Welcome! Please introduce yourself below to start chatting.");
      setChatbotScript("");
      setIsCreatingLanding(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    window.addEventListener("open-create-landing-modal", handleOpenCreateLanding);

    return () => {
      window.removeEventListener("open-create-landing-modal", handleOpenCreateLanding);
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

  // Real-time HTML Form Inspector
  useEffect(() => {
    if (!landingHtml || !landingHtml.trim()) {
      setDetectedForms([]);
      return;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(landingHtml, "text/html");
      const formEls = doc.querySelectorAll("form");
      const results: DetectedFormInfo[] = [];

      // If form tags found, parse them
      formEls.forEach((formEl, idx) => {
        const action = formEl.getAttribute("action") || "Local Page Submission";
        const method = (formEl.getAttribute("method") || "POST").toUpperCase();

        const inputElements = formEl.querySelectorAll("input, textarea, select");
        const fields: FormFieldInfo[] = [];

        inputElements.forEach((el) => {
          const tag = el.tagName.toLowerCase();
          const type = (el.getAttribute("type") || "text").toLowerCase();
          if (["hidden", "submit", "button", "reset", "image"].includes(type)) return;

          const name = el.getAttribute("name") || "";
          const placeholder = el.getAttribute("placeholder") || "";
          const required = el.hasAttribute("required");

          // Try finding associated label
          let labelText = "";
          const id = el.getAttribute("id");
          if (id) {
            const labelEl = doc.querySelector(`label[for="${id}"]`);
            if (labelEl) labelText = labelEl.textContent?.trim() || "";
          }
          if (!labelText) {
            const parentLabel = el.closest("label");
            if (parentLabel) {
              const clone = parentLabel.cloneNode(true) as HTMLElement;
              clone.querySelectorAll("input, textarea, select").forEach((n) => n.remove());
              labelText = clone.textContent?.trim() || "";
            }
          }
          if (!labelText) labelText = placeholder || name || `Field (${tag})`;

          fields.push({
            name: name || "(missing name)",
            label: labelText,
            type: tag === "textarea" ? "textarea" : tag === "select" ? "select" : type,
            required,
            placeholder,
          });
        });

        // Submit button
        const submitBtn = formEl.querySelector("button[type='submit'], input[type='submit'], button:not([type])");
        const submitText = submitBtn
          ? (submitBtn.getAttribute("value") || submitBtn.textContent?.trim() || "Submit")
          : "Submit";

        results.push({
          form_index: idx + 1,
          action,
          method,
          fields_count: fields.length,
          fields,
          submit_button: submitText,
        });
      });

      // Fallback: If no <form> tag was found, check if there are standalone input/textarea elements in HTML
      if (formEls.length === 0) {
        const standaloneInputs = doc.querySelectorAll("input, textarea, select");
        const looseFields: FormFieldInfo[] = [];
        standaloneInputs.forEach((el) => {
          const tag = el.tagName.toLowerCase();
          const type = (el.getAttribute("type") || "text").toLowerCase();
          if (["hidden", "submit", "button", "reset", "image"].includes(type)) return;
          const name = el.getAttribute("name") || "";
          const placeholder = el.getAttribute("placeholder") || "";
          const required = el.hasAttribute("required");
          looseFields.push({
            name: name || "(missing name)",
            label: placeholder || name || `Field (${tag})`,
            type: tag === "textarea" ? "textarea" : tag === "select" ? "select" : type,
            required,
            placeholder,
          });
        });

        if (looseFields.length > 0) {
          results.push({
            form_index: 1,
            action: "Unenclosed Form (Standalone Inputs)",
            method: "POST",
            fields_count: looseFields.length,
            fields: looseFields,
            submit_button: "Auto-Detected Button",
          });
        }
      }

      // Also detect shortcode forms {{form_xxx}}
      const shortcodes = landingHtml.match(/\{\{(form_[a-zA-Z0-9_-]+)\}\}/g);
      if (shortcodes) {
        shortcodes.forEach((sc) => {
          const cleanCode = sc.replace(/[{}]/g, "");
          results.push({
            form_index: results.length + 1,
            action: `Shortcode (${cleanCode})`,
            method: "POST",
            fields_count: 0,
            fields: [],
            submit_button: "Submit",
            is_shortcode: true,
          });
        });
      }

      setDetectedForms(results);
    } catch (e) {
      console.error("Error parsing HTML for forms:", e);
    }
  }, [landingHtml]);


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
          chatbot_enabled: chatbotEnabled,
          chatbot_name: chatbotName,
          chatbot_welcome_message: chatbotWelcomeMessage,
          chatbot_script: chatbotScript,
        }),
      });

      if (res.ok) {
        toast.success(editingLandingId ? "Landing page updated successfully!" : "Landing page created!");
        setIsCreatingLanding(false);
        setEditingLandingId(null);
        setLandingTitle("");
        setLandingHtml("");
        setChatbotEnabled(true);
        setChatbotName("AI Sales Assistant");
        setChatbotWelcomeMessage("Hi there! 👋 Welcome! Please introduce yourself below to start chatting.");
        setChatbotScript("");
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

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  if (loading) return <div className="text-center py-12 text-[#8E9BA8]">Loading Landing Pages...</div>;

  return (
    <div className="space-y-6 font-sans">
          {isCreatingLanding && (
            <div className="bg-[#1E252D] border border-[#2C353D] rounded-2xl p-6 shadow-xl relative">
              <button
                type="button"
                onClick={() => setIsCreatingLanding(false)}
                className="absolute top-4 right-4 text-[#8E9BA8] hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>

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
                  <div className="flex flex-col space-y-2 relative rounded-xl transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                          Landing Page HTML Content *
                        </label>
                        {detectedForms.length > 0 ? (
                          <span
                            onClick={() => setShowDetectedForms(true)}
                            className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-semibold cursor-pointer hover:bg-emerald-500/30 transition-all shadow-sm animate-pulse"
                            title="Click to view detected form fields"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            {detectedForms.length} Form{detectedForms.length > 1 ? "s" : ""} ({detectedForms.reduce((acc, f) => acc + f.fields_count, 0)} Fields)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#8E9BA8] bg-[#161B1F] border border-[#2C353D] px-2 py-0.5 rounded-full">
                            No &lt;form&gt; tag yet
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#8E9BA8]">
                        Standard HTML5 & Inline CSS
                      </span>
                    </div>

                    <div className="relative flex-1 flex flex-col">
                      <textarea
                        ref={landingTextareaRef}
                        value={landingHtml}
                        onChange={(e) => setLandingHtml(e.target.value)}
                        rows={18}
                        placeholder="<!DOCTYPE html><html>... paste or write your landing page HTML here ...</html>"
                        className="w-full font-mono text-xs bg-[#161B1F] border border-[#2C353D] rounded-xl p-4 text-emerald-300 focus:outline-none focus:border-white transition-all flex-1 min-h-[440px]"
                        required
                      />

                      {/* Snippet chips helper */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-2">
                        <span className="text-[10px] text-[#8E9BA8] uppercase font-bold tracking-wider">Quick Snippets:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `<section style="padding: 40px; text-align: center; background: #161B22; border-radius: 12px; margin: 20px 0; border: 1px solid #30363D;">\n  <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">Explore Our Features</h2>\n  <p style="color: #94A3B8; font-size: 14px;">Everything you need to grow your outreach.</p>\n</section>`;
                            setLandingHtml((prev) => (prev ? prev + "\n" + snippet : snippet));
                          }}
                          className="text-[10px] bg-[#161B1F] border border-[#2C353D] hover:border-white px-2 py-0.5 rounded text-[#CBD5E1] transition-colors cursor-pointer"
                        >
                          + Feature Section
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const snippet = `<div style="display: flex; gap: 20px; justify-content: center; margin: 30px 0; flex-wrap: wrap;">\n  <div style="background: #21262D; padding: 20px; border-radius: 10px; border: 1px solid #30363D; min-width: 180px;">\n    <h3 style="margin-top: 0;">Starter</h3>\n    <p style="color: #94A3B8; font-size: 13px;">$49/mo - 5,000 emails</p>\n  </div>\n  <div style="background: #21262D; padding: 20px; border-radius: 10px; border: 1px solid #6366F1; min-width: 180px;">\n    <h3 style="margin-top: 0; color: #818CF8;">Pro</h3>\n    <p style="color: #94A3B8; font-size: 13px;">$99/mo - Unlimited</p>\n  </div>\n</div>`;
                            setLandingHtml((prev) => (prev ? prev + "\n" + snippet : snippet));
                          }}
                          className="text-[10px] bg-[#161B1F] border border-[#2C353D] hover:border-white px-2 py-0.5 rounded text-[#CBD5E1] transition-colors cursor-pointer"
                        >
                          + Pricing Cards
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live HTML Preview */}
                  <div className="flex flex-col space-y-2 relative rounded-xl transition-all">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                        Live Visual Preview
                      </label>
                      {chatbotEnabled && (
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                          <Bot className="w-3.5 h-3.5" /> AI Chatbot Widget Active
                        </span>
                      )}
                    </div>

                    <div className="relative flex-1 bg-white rounded-xl overflow-hidden border border-[#2C353D] min-h-[440px] shadow-inner">
                      <iframe
                        srcDoc={(() => {
                          let rendered = landingHtml || "<div style='font-family:sans-serif;color:#666;text-align:center;padding:50px;'>Type HTML on the left to see live preview</div>";
                          if (chatbotEnabled) {
                            const badge = `
                              <div style="position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;align-items:center;gap:10px;background:#14181C;color:#FFFFFF;border:1px solid #2C353D;padding:10px 18px;border-radius:9999px;font-size:13px;font-weight:600;box-shadow:0 10px 28px rgba(0,0,0,0.5);font-family:-apple-system,BlinkMacSystemFont,sans-serif;pointer-events:none;">
                                <div style="display:flex;align-items:center;justify-content:center;position:relative;width:8px;height:8px;">
                                  <div style="width:8px;height:8px;background:#10B981;border-radius:50%;"></div>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                                <span>Chat with us</span>
                              </div>
                            `;
                            if (rendered.includes("</body>")) {
                              rendered = rendered.replace("</body>", `${badge}</body>`);
                            } else {
                              rendered += badge;
                            }
                          }
                          return rendered;
                        })()}
                        className="w-full h-full min-h-[440px] border-0 bg-white"
                        title="Live HTML Preview"
                        sandbox="allow-same-origin allow-popups"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Auto-Detection Banner & Fields Inspector */}
                <div className="bg-[#161B1F] border border-[#2C353D] rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg border ${
                        detectedForms.length > 0
                          ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400"
                          : "bg-[#222930] border-[#2C353D] text-[#8E9BA8]"
                      }`}>
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                            Form Auto-Detection
                          </h4>
                          {detectedForms.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                              <CheckCircle2 className="w-3 h-3" />
                              {detectedForms.length} Form{detectedForms.length > 1 ? "s" : ""} Found ({detectedForms.reduce((acc, f) => acc + f.fields_count, 0)} Total Fields)
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#8E9BA8] bg-[#222930] px-2 py-0.5 rounded-full">
                              No &lt;form&gt; tag detected
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8E9BA8] mt-0.5">
                          {detectedForms.length > 0
                            ? "System parsed your HTML and discovered the form fields below. Submissions will be automatically captured into Lead Qualification."
                            : "Add a <form>...</form> block with inputs to automatically capture submissions and qualify leads."}
                        </p>
                      </div>
                    </div>

                    {detectedForms.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowDetectedForms(!showDetectedForms)}
                        className="px-3 py-1.5 bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white border border-[#2C353D] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        <ListFilter className="w-3.5 h-3.5" />
                        {showDetectedForms ? "Hide Detected Fields" : "View Field Breakdown"}
                      </button>
                    )}
                  </div>

                  {/* Detected Forms Detail Table */}
                  {showDetectedForms && detectedForms.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#2C353D] space-y-4">
                      {detectedForms.map((form, fIdx) => (
                        <div key={fIdx} className="bg-[#1C2227] border border-[#2C353D] rounded-lg p-3.5">
                          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#2C353D]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">Form #{form.form_index}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#161B1F] text-sky-400 rounded border border-[#2C353D]">
                                Method: {form.method}
                              </span>
                              <span className="text-[10px] font-mono text-[#8E9BA8] hidden sm:inline">
                                Action: {form.action}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-emerald-400">
                              {form.fields_count} Input Field{form.fields_count !== 1 ? "s" : ""}
                            </span>
                          </div>

                          {form.fields.length === 0 ? (
                            <p className="text-xs text-[#8E9BA8] italic">No input fields found inside this form block.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="text-[10px] uppercase text-[#8E9BA8] border-b border-[#2C353D]/50 font-semibold">
                                  <tr>
                                    <th className="py-1.5 px-2">#</th>
                                    <th className="py-1.5 px-2">Field Name (`name="..."`)</th>
                                    <th className="py-1.5 px-2">Detected Label / Title</th>
                                    <th className="py-1.5 px-2">Type</th>
                                    <th className="py-1.5 px-2 text-center">Required</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#2C353D]/30 font-mono">
                                  {form.fields.map((field, idx) => (
                                    <tr key={idx} className="hover:bg-[#161B1F]/50">
                                      <td className="py-2 px-2 text-[#8E9BA8]">{idx + 1}</td>
                                      <td className="py-2 px-2">
                                        {field.name === "(missing name)" ? (
                                          <span className="text-amber-400 flex items-center gap-1 font-sans">
                                            <AlertCircle className="w-3 h-3" /> Missing `name`
                                          </span>
                                        ) : (
                                          <span className="text-white font-bold">{field.name}</span>
                                        )}
                                      </td>
                                      <td className="py-2 px-2 text-[#CBD5E1] font-sans">
                                        {field.label}
                                      </td>
                                      <td className="py-2 px-2">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161B1F] text-sky-300 border border-sky-800/40">
                                          {field.type}
                                        </span>
                                      </td>
                                      <td className="py-2 px-2 text-center">
                                        {field.required ? (
                                          <span className="text-red-400 font-bold">Yes (*)</span>
                                        ) : (
                                          <span className="text-[#8E9BA8]">Optional</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          <div className="mt-2.5 pt-2 border-t border-[#2C353D]/50 flex items-center justify-between text-[11px] text-[#8E9BA8]">
                            <span>Submit Trigger: <strong className="text-white font-sans">{form.submit_button}</strong></span>
                            <span className="text-emerald-400">Ready for automated submissions</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-[#8E9BA8] font-mono">
                            /p/{page.slug}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingLandingId(page.id);
                          setLandingTitle(page.title);
                          setLandingHtml(page.html_content);
                          setChatbotEnabled(page.chatbot_enabled ?? true);
                          setChatbotName(page.chatbot_name || "AI Sales Assistant");
                          setChatbotWelcomeMessage(page.chatbot_welcome_message || "Hi there! 👋 Before we begin, may I know your name?");
                          setChatbotScript(page.chatbot_script || "");
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

                {/* Footer Action: AI Chatbot & View Leads */}
                <div className="pt-3 border-t border-[#2C353D] flex items-center gap-2">
                  <Link
                    to={`/chatbot?page=${page.id}`}
                    className="flex-1 bg-[#222930] hover:bg-[#29323A] border border-[#2C353D] hover:border-emerald-500/40 text-[#CBD5E1] hover:text-white font-semibold py-2 px-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all"
                    title="Configure AI Chatbot for this page"
                  >
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    <span>AI Chatbot</span>
                  </Link>
                  <button
                    onClick={() =>
                      setViewingSubmissionsPage({ id: page.id, title: page.title, slug: page.slug })
                    }
                    className="flex-1 bg-[#222930] hover:bg-[#29323A] border border-[#2C353D] text-white font-semibold py-2 px-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-white" />
                    <span>Leads ({page.submissions_count})</span>
                  </button>
                </div>
              </div>
            ))}

            {landingPages.length === 0 && !isCreatingLanding && (
              <div className="col-span-full py-16 text-center border border-dashed border-[#2C353D] rounded-2xl bg-[#1E252D]/40">
                <Globe className="w-10 h-10 text-[#8E9BA8] mx-auto mb-3 opacity-60" />
                <h4 className="text-base font-bold text-white mb-1">No Custom Landing Pages Yet</h4>
                <p className="text-xs text-[#8E9BA8] max-w-sm mx-auto mb-4">
                  Deploy custom HTML landing pages with AI-powered conversational sales chatbots and live visitor lead tracking.
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
  <h1>Welcome to our Product</h1>
  <p>Chat with our AI assistant below to get started!</p>
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
