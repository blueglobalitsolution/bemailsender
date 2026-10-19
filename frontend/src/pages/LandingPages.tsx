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
  X,
  FormInput,
  Bot,
  MessageSquare,
  Sparkles
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
  const [activeSubTab, setActiveSubTab] = useState<"landing-pages" | "forms">("landing-pages");
  const [landingPages, setLandingPages] = useState<LandingPageItem[]>([]);
  const [customForms, setCustomForms] = useState<CustomForm[]>([]);
  const [loading, setLoading] = useState(true);

  // Landing Page creation/edit states
  const [isCreatingLanding, setIsCreatingLanding] = useState(false);
  const [editingLandingId, setEditingLandingId] = useState<number | null>(null);
  const [landingTitle, setLandingTitle] = useState("");
  const [landingHtml, setLandingHtml] = useState("");
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [chatbotName, setChatbotName] = useState("AI Sales Assistant");
  const [chatbotWelcomeMessage, setChatbotWelcomeMessage] = useState("Hi there! 👋 Before we begin, may I know your name?");
  const [chatbotScript, setChatbotScript] = useState("");
  const [savingLanding, setSavingLanding] = useState(false);
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
      setActiveSubTab("landing-pages");
      setChatbotEnabled(true);
      setChatbotName("AI Sales Assistant");
      setChatbotWelcomeMessage("Hi there! 👋 Before we begin, may I know your name?");
      setChatbotScript("");
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
        setChatbotWelcomeMessage("Hi there! 👋 Before we begin, may I know your name?");
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
                      Design your custom HTML landing page. Leads are captured interactively via the integrated AI Sales Chatbot!
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

                {/* Side-by-Side: Left HTML Editor, Right Live Real-Time Preview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                  {/* Left Column: HTML Code Input */}
                  <div className="flex flex-col space-y-2 relative rounded-xl transition-all">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                        Landing Page HTML Content *
                      </label>
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
                              <div style="position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#059669,#10b981);color:white;padding:10px 18px;border-radius:9999px;box-shadow:0 8px 24px rgba(5,150,105,0.4);font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;font-weight:700;pointer-events:none;">
                                <span>💬 Chat with ${chatbotName || 'AI Assistant'}</span>
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

                {/* AI Lead Capture Chatbot Configuration */}
                <div className="bg-[#14181C] border border-[#2C353D] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#2C353D]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          AI Sales Chatbot <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded font-mono font-semibold flex items-center gap-1"><Sparkles className="w-3 h-3 text-purple-400" /> Powered by Laya AI</span>
                        </h4>
                        <p className="text-[11px] text-[#8E9BA8]">
                          Floating animated widget that captures visitor Name & Email and answers product questions using your script.
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <span className="text-xs text-[#CBD5E1] font-semibold">Enable Chatbot</span>
                      <input
                        type="checkbox"
                        checked={chatbotEnabled}
                        onChange={(e) => setChatbotEnabled(e.target.checked)}
                        className="w-4 h-4 accent-emerald-500 cursor-pointer"
                      />
                    </label>
                  </div>

                  {chatbotEnabled && (
                    <div className="space-y-4 pt-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                            Bot Display Name
                          </label>
                          <input
                            type="text"
                            value={chatbotName}
                            onChange={(e) => setChatbotName(e.target.value)}
                            placeholder="e.g. Sarah (Product Specialist)"
                            className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-white transition-all font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                            Initial Greeting
                          </label>
                          <input
                            type="text"
                            value={chatbotWelcomeMessage}
                            onChange={(e) => setChatbotWelcomeMessage(e.target.value)}
                            placeholder="e.g. Hi there! 👋 Before we begin, may I know your name?"
                            className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-white transition-all font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                            Product Script & Knowledge Base (for Laya AI)
                          </label>
                          <span className="text-[10px] text-[#8E9BA8] font-mono">
                            The AI strictly uses this script to answer questions
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          value={chatbotScript}
                          onChange={(e) => setChatbotScript(e.target.value)}
                          placeholder="Describe your product, pricing, plans, key features, refund policy, and common FAQs here. E.g.:&#10;- Product Name: ReachEngine Pro&#10;- Price: $49/month or $399/year&#10;- Key Features: Automated cold email sequences, lead scraper, AI personalization&#10;- Guarantee: 14-day money back guarantee"
                          className="w-full bg-[#161B1F] border border-[#2C353D] rounded-lg p-3 text-xs text-white focus:outline-none focus:border-white transition-all font-mono"
                        />
                      </div>
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
                          {page.chatbot_enabled !== false && (
                            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <Bot className="w-2.5 h-2.5" /> AI Chat
                            </span>
                          )}
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
