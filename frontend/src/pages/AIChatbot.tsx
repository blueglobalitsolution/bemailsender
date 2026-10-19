import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Bot,
  Sparkles,
  Save,
  Send,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  MessageSquare,
  Users,
  Code,
  FileText,
  Sliders,
  Eye,
  HelpCircle,
  ChevronDown,
  Globe,
  Trash2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../components/Toast";
import SubmissionsViewerModal from "../components/SubmissionsViewerModal";

interface LandingPageSummary {
  id: number;
  title: string;
  slug: string;
  chatbot_enabled?: boolean;
  chatbot_name?: string;
  chatbot_welcome_message?: string;
  chatbot_script?: string;
  views_count: number;
  submissions_count: number;
  created_at: string;
}

interface ChatMessage {
  role: "bot" | "user";
  text: string;
  timestamp?: string;
}

const TEMPLATES = [
  {
    name: "SaaS / Software Product",
    desc: "Pricing tiers, core features, trial & refund policy",
    script: `Product Name: ReachEngine Pro
Description: High-deliverability cold email outreach and automated warmup platform.
Target Audience: B2B agencies, founders, sales teams, and SDRs.

Pricing:
- Starter Plan: $49/month (Up to 5 mailboxes, 10,000 emails/month, AI lead scraper)
- Growth Plan: $99/month (Up to 25 mailboxes, unlimited emails, priority inbox rotation)
- Enterprise Plan: $249/month (Dedicated IP pool, custom integrations, dedicated account manager)

Key Features:
- Multi-mailbox rotation with automated deliverability warming
- AI personalization based on prospect website & LinkedIn
- Real-time lead scraping and automated verification
- Inbound reply tracking and auto-categorization

Guarantee & Trials:
- 14-day 100% money-back guarantee, no questions asked.
- No setup fees, cancel anytime directly from your dashboard.

Support & Contact:
- 24/7 priority live chat & email support at support@reachengine.com
- Documentation and setup guides at docs.reachengine.com`
  },
  {
    name: "Agency / Consulting Services",
    desc: "Outreach done-for-you, booking calls, onboarding",
    script: `Company Name: OutboundScale Agency
Description: Done-for-you cold outreach systems that generate 15-30 qualified sales calls every single month.

Core Services:
- Full setup of secondary sending domains and SPF/DKIM/DMARC authentication
- High-converting ICP targeting and verified B2B lead list building
- Customized copywriting and split-tested email sequences
- Positive reply management and calendar booking direct to your sales team

Pricing & Packages:
- Performance Tier: $1,500/month flat management fee + $100 per qualified meeting booked.
- Full Growth Retainer: $2,800/month all-inclusive (unlimited leads, copy, domains, and warmups).

Onboarding Timeline:
- Complete system launched within 7 business days of signing.

How to get started:
- Invite visitors to schedule a free 15-minute Outbound Strategy Call with our founder at cal.com/outboundscale-audit.`
  },
  {
    name: "E-Commerce / Digital Assets",
    desc: "Product bundles, instant downloads, guarantees",
    script: `Brand Name: Creator Kit Pro
Description: Premium ready-to-use email templates, cold outreach scripts, and Notion operating systems.

Products & Pricing:
- Cold Email Master Bundle: $47 (Over 120+ tested cold email templates with 40%+ open rates)
- Full Creator OS: $97 (Complete client onboarding, proposal templates, and sales CRM)
- Lifetime Access Pass: $147 (All current bundles plus lifetime monthly template updates)

Delivery & Access:
- Instant digital download link sent to visitor's email immediately after purchase.

Refund & Return Policy:
- 30-day risk-free satisfaction guarantee. If it doesn't book you meetings, full refund provided.

Support:
- Questions and support via support@creatorkitpro.com.`
  }
];

export default function AIChatbot() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = searchParams.get("page");

  const [landingPages, setLandingPages] = useState<LandingPageSummary[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [chatbotEnabled, setChatbotEnabled] = useState(true);
  const [chatbotName, setChatbotName] = useState("AI Sales Assistant");
  const [chatbotWelcomeMessage, setChatbotWelcomeMessage] = useState(
    "Hi there! 👋 Welcome! Please introduce yourself below to start chatting."
  );
  const [chatbotScript, setChatbotScript] = useState("");

  // Simulator states
  const [activeTab, setActiveTab] = useState<"simulator" | "leads">("simulator");
  const [testVisitorName, setTestVisitorName] = useState("Demo Visitor");
  const [testVisitorEmail, setTestVisitorEmail] = useState("visitor@example.com");
  const [testLeadIntroduced, setTestLeadIntroduced] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Submissions Modal
  const [isSubmissionsOpen, setIsSubmissionsOpen] = useState(false);

  useEffect(() => {
    fetchLandingPages();
  }, []);

  const fetchLandingPages = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/landing-pages/");
      if (res.ok) {
        const data: LandingPageSummary[] = await res.json();
        setLandingPages(data);

        if (data.length > 0) {
          let target = data[0];
          if (pageParam) {
            const matched = data.find((p) => p.id === Number(pageParam));
            if (matched) target = matched;
          }
          selectLandingPage(target);
        }
      } else {
        toast.error("Failed to load landing pages");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading landing pages");
    } finally {
      setLoading(false);
    }
  };

  const selectLandingPage = (page: LandingPageSummary) => {
    setSelectedPageId(page.id);
    setChatbotEnabled(page.chatbot_enabled ?? true);
    setChatbotName(page.chatbot_name || "AI Sales Assistant");
    setChatbotWelcomeMessage(
      page.chatbot_welcome_message ||
        "Hi there! 👋 Welcome! Please introduce yourself below to start chatting."
    );
    setChatbotScript(page.chatbot_script || "");
    setSearchParams({ page: String(page.id) });

    // Reset simulator conversation for this page
    resetSimulator(page.chatbot_name || "AI Sales Assistant", page.chatbot_welcome_message || "Hi there! 👋 Welcome! Please introduce yourself below to start chatting.");
  };

  const resetSimulator = (botName?: string, welcome?: string) => {
    const greeting = welcome || chatbotWelcomeMessage;
    setChatMessages([
      {
        role: "bot",
        text: greeting,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
    setTestLeadIntroduced(false);
    setUserInput("");
  };

  const handleSaveSettings = async () => {
    if (!selectedPageId) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/landing-pages/${selectedPageId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbot_enabled: chatbotEnabled,
          chatbot_name: chatbotName,
          chatbot_welcome_message: chatbotWelcomeMessage,
          chatbot_script: chatbotScript
        })
      });

      if (res.ok) {
        const updatedPage = await res.json();
        toast.success("AI Chatbot settings saved successfully!");
        setLandingPages((prev) =>
          prev.map((p) => (p.id === selectedPageId ? { ...p, ...updatedPage } : p))
        );
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update chatbot settings");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || chatLoading) return;

    const page = landingPages.find((p) => p.id === selectedPageId);
    if (!page) return;

    const userMsg = userInput.trim();
    setUserInput("");

    // Append user message
    const updatedMessages: ChatMessage[] = [
      ...chatMessages,
      {
        role: "user",
        text: userMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ];
    setChatMessages(updatedMessages);

    // Scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    setChatLoading(true);
    try {
      // Build conversation history in expected format
      const history = updatedMessages.map((m) => ({
        role: m.role === "bot" ? "assistant" : "user",
        text: m.text
      }));

      const res = await apiFetch(`/api/public/chat/${page.slug}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: history,
          lead_data: {
            name: testVisitorName,
            email: testVisitorEmail
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text: data.reply || "I am here to help! Ask me anything regarding our services.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text: "Sorry, I am having trouble connecting right now. Please verify that your product script is set and try again.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Connection error. Make sure your server is running and try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setChatLoading(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  };

  const handleStartChatWithLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testVisitorName.trim() || !testVisitorEmail.trim()) {
      toast.error("Please enter a name and email for the simulation test");
      return;
    }
    setTestLeadIntroduced(true);
    setChatMessages((prev) => [
      ...prev,
      {
        role: "bot",
        text: `Nice to meet you, ${testVisitorName}! 👋 What questions can I answer for you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  };

  const copyPublicLink = (slug: string) => {
    const url = `${window.location.origin}/p/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Public link copied to clipboard!");
  };

  const applyTemplate = (script: string) => {
    setChatbotScript(script);
    toast.success("Template applied! Click 'Save Changes' to update your live bot.");
  };

  const selectedPage = landingPages.find((p) => p.id === selectedPageId);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-[#8E9BA8] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <p className="text-sm">Loading AI Sales Chatbot settings...</p>
      </div>
    );
  }

  if (landingPages.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
          <Bot className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">No Landing Pages Found</h2>
          <p className="text-sm text-[#8E9BA8]">
            To configure and activate your AI Sales Chatbot, you first need at least one landing page.
          </p>
        </div>
        <Link
          to="/landing-pages"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold rounded-xl text-sm transition-all shadow-lg"
        >
          <Globe className="w-4 h-4" /> Go to Landing Pages & Create One
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans pb-16 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-[#1E252D] border border-[#2C353D] rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-purple-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                AI Sales Chatbot
              </h1>
              <span className="text-[11px] bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Powered by Laya AI
              </span>
            </div>
            <p className="text-xs text-[#8E9BA8] mt-1 max-w-2xl">
              Floating conversational agent that greets page visitors, captures contact details, and answers product questions using your custom script 24/7.
            </p>
          </div>
        </div>

        {/* Global Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          {selectedPage && (
            <a
              href={`/p/${selectedPage.slug}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2.5 bg-[#222930] hover:bg-[#2C353D] border border-[#2C353D] text-[#CBD5E1] hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
              title="Open Public Page"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Preview Live</span>
            </a>
          )}
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-5 py-2.5 bg-white hover:bg-[#CBD5E1] text-[#161B1F] text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {/* Target Landing Page Switcher Bar */}
      <div className="bg-[#191F26] border border-[#2C353D] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-[#8E9BA8] shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
              Select Landing Page:
            </span>
            <div className="relative">
              <select
                value={selectedPageId || ""}
                onChange={(e) => {
                  const target = landingPages.find((p) => p.id === Number(e.target.value));
                  if (target) selectLandingPage(target);
                }}
                className="bg-[#14181C] border border-[#2C353D] hover:border-white text-white text-xs font-semibold rounded-lg px-3.5 py-2 pr-8 appearance-none focus:outline-none cursor-pointer transition-colors"
              >
                {landingPages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.title} (/p/{page.slug})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E9BA8] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {selectedPage && (
          <div className="flex items-center gap-3 flex-wrap justify-between md:justify-end">
            <div className="flex items-center gap-2 bg-[#14181C] border border-[#2C353D] px-3 py-1.5 rounded-lg text-xs font-mono text-[#CBD5E1]">
              <span className="truncate max-w-[200px] sm:max-w-[280px]">
                {window.location.origin}/p/{selectedPage.slug}
              </span>
              <button
                onClick={() => copyPublicLink(selectedPage.slug)}
                className="text-[#8E9BA8] hover:text-white transition-colors cursor-pointer"
                title="Copy Link"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Enable/Disable Switch */}
            <label className="flex items-center gap-2 cursor-pointer bg-[#14181C] border border-[#2C353D] px-3.5 py-1.5 rounded-lg select-none">
              <input
                type="checkbox"
                checked={chatbotEnabled}
                onChange={(e) => setChatbotEnabled(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
              <span
                className={`text-xs font-bold ${
                  chatbotEnabled ? "text-emerald-400" : "text-[#8E9BA8]"
                }`}
              >
                {chatbotEnabled ? "Chatbot Active" : "Chatbot Disabled"}
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Configuration Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Persona & Greeting Card */}
          <div className="bg-[#1E252D] border border-[#2C353D] rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#2C353D]">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                1. Bot Persona & Greeting
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                  Bot Display Name
                </label>
                <input
                  type="text"
                  value={chatbotName}
                  onChange={(e) => setChatbotName(e.target.value)}
                  placeholder="e.g. AI Sales Assistant or Sarah (Sales)"
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white transition-all font-mono"
                />
                <p className="text-[11px] text-[#8E9BA8] mt-1">
                  Shown in header & chat messages.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                  Welcome Greeting
                </label>
                <input
                  type="text"
                  value={chatbotWelcomeMessage}
                  onChange={(e) => setChatbotWelcomeMessage(e.target.value)}
                  placeholder="e.g. Hi there! 👋 Welcome! Please introduce yourself below to start chatting."
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white transition-all font-mono"
                />
                <p className="text-[11px] text-[#8E9BA8] mt-1">
                  The initial greeting visitors see when opening the bot.
                </p>
              </div>
            </div>
          </div>

          {/* Product Script & Knowledge Base Card */}
          <div className="bg-[#1E252D] border border-[#2C353D] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C353D] flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  2. Product Script & Knowledge Base (Laya AI)
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#8E9BA8]">
                Laya AI strictly uses this script to answer questions
              </span>
            </div>

            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              Describe your product, service, pricing plans, special guarantees, and FAQs. The AI will strictly follow these instructions and never hallucinate outside of this knowledge.
            </p>

            {/* Quick Templates Selector */}
            <div className="bg-[#161B1F] border border-[#2C353D] rounded-xl p-3 space-y-2">
              <span className="text-[11px] font-bold text-[#8E9BA8] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" /> One-Click Script Templates:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyTemplate(tmpl.script)}
                    className="p-2.5 rounded-lg border border-[#2C353D] hover:border-purple-500/50 bg-[#1E252D] hover:bg-purple-500/10 text-left transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-white group-hover:text-purple-300">
                      {tmpl.name}
                    </div>
                    <div className="text-[10px] text-[#8E9BA8] line-clamp-1 mt-0.5">
                      {tmpl.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Script Textarea */}
            <div>
              <textarea
                rows={14}
                value={chatbotScript}
                onChange={(e) => setChatbotScript(e.target.value)}
                placeholder="Product Name: ...&#10;Pricing: ...&#10;Features: ...&#10;Refund Policy: ...&#10;Support: ..."
                className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl p-4 text-xs text-white focus:outline-none focus:border-white transition-all font-mono leading-relaxed resize-y"
              />
              <div className="flex items-center justify-between text-[11px] text-[#8E9BA8] mt-1.5 px-1">
                <span>Tip: Include pricing, refund guarantees, and contact email for best conversion.</span>
                <span>{chatbotScript.length} characters</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-6 py-2.5 bg-white hover:bg-[#CBD5E1] text-[#161B1F] text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save All Chatbot Changes</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Simulator & Leads (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Subtab Switcher */}
          <div className="bg-[#1E252D] border border-[#2C353D] p-1.5 rounded-xl flex items-center gap-1 shadow-md">
            <button
              onClick={() => setActiveTab("simulator")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === "simulator"
                  ? "bg-white text-[#161B1F] shadow"
                  : "text-[#8E9BA8] hover:text-white hover:bg-[#26303A]"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Simulator</span>
            </button>
            <button
              onClick={() => {
                if (selectedPage) {
                  setIsSubmissionsOpen(true);
                }
              }}
              className="flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer text-[#8E9BA8] hover:text-white hover:bg-[#26303A]"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Captured Leads ({selectedPage?.submissions_count || 0})</span>
            </button>
          </div>

          {/* Simulator Box */}
          <div className="bg-[#1A1F26] border border-[#2C353D] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[650px]">
            {/* Widget Top Bar */}
            <div className="bg-[#14181C] border-b border-[#2C353D] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md font-bold text-xs">
                    <Bot className="w-5 h-5" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#14181C] rounded-full animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white leading-tight">
                    {chatbotName || "AI Sales Assistant"}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                    <span>Online & Ready</span>
                    <span className="text-[#8E9BA8]">•</span>
                    <span className="text-[#8E9BA8] font-mono">Simulator</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => resetSimulator()}
                className="p-1.5 text-[#8E9BA8] hover:text-white hover:bg-[#222930] rounded-lg transition-colors cursor-pointer"
                title="Reset conversation"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Conversation Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#12161A]/80 font-sans">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "bg-white text-[#161B1F] font-medium rounded-tr-none"
                        : "bg-[#1E252D] border border-[#2C353D] text-[#CBD5E1] rounded-tl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.timestamp && (
                    <span className="text-[9px] text-[#8E9BA8] mt-1 px-1 font-mono">
                      {msg.timestamp}
                    </span>
                  )}
                </div>
              ))}

              {/* Step 1: Simulated Lead Capture Form Card if not yet submitted */}
              {!testLeadIntroduced && (
                <div className="bg-[#1A2028] border border-emerald-500/30 rounded-xl p-3.5 space-y-2.5 shadow-lg my-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Test Lead Capture Step:</span>
                  </div>
                  <p className="text-[11px] text-[#8E9BA8] leading-tight">
                    Visitors see this mini-form inside the chat to provide Name & Email before asking custom questions.
                  </p>
                  <form onSubmit={handleStartChatWithLead} className="space-y-2">
                    <input
                      type="text"
                      required
                      value={testVisitorName}
                      onChange={(e) => setTestVisitorName(e.target.value)}
                      placeholder="Visitor Full Name"
                      className="w-full bg-[#14181C] border border-[#2C353D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                    <input
                      type="email"
                      required
                      value={testVisitorEmail}
                      onChange={(e) => setTestVisitorEmail(e.target.value)}
                      placeholder="Visitor Email Address"
                      className="w-full bg-[#14181C] border border-[#2C353D] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="submit"
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      Start Conversation →
                    </button>
                  </form>
                </div>
              )}

              {/* Typing indicator */}
              {chatLoading && (
                <div className="flex items-center gap-1.5 bg-[#1E252D] border border-[#2C353D] text-[#8E9BA8] text-xs px-3.5 py-2 rounded-2xl rounded-tl-none w-fit">
                  <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                  <span className="text-[11px]">Thinking based on script...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts Suggestions */}
            <div className="p-2 bg-[#161B1F] border-t border-[#2C353D] flex items-center gap-1.5 overflow-x-auto text-[10px] text-[#8E9BA8]">
              <span className="shrink-0 font-bold uppercase text-[#CBD5E1] px-1">Test:</span>
              <button
                type="button"
                onClick={() => {
                  setUserInput("What is the pricing?");
                }}
                className="px-2.5 py-1 bg-[#1E252D] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white rounded-md whitespace-nowrap border border-[#2C353D] transition-colors cursor-pointer"
              >
                What is the pricing?
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserInput("Do you offer a refund policy?");
                }}
                className="px-2.5 py-1 bg-[#1E252D] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white rounded-md whitespace-nowrap border border-[#2C353D] transition-colors cursor-pointer"
              >
                Refund policy?
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserInput("How do I contact support?");
                }}
                className="px-2.5 py-1 bg-[#1E252D] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white rounded-md whitespace-nowrap border border-[#2C353D] transition-colors cursor-pointer"
              >
                Contact support?
              </button>
            </div>

            {/* Widget Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-[#14181C] border-t border-[#2C353D] flex items-center gap-2"
            >
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={
                  testLeadIntroduced
                    ? "Ask a question about the product..."
                    : "Introduce above first or type question..."
                }
                className="flex-1 bg-[#1A1F26] border border-[#2C353D] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#8E9BA8] focus:outline-none focus:border-white transition-all"
              />
              <button
                type="submit"
                disabled={!userInput.trim() || chatLoading}
                className="p-2 bg-white hover:bg-[#CBD5E1] disabled:opacity-30 text-[#161B1F] rounded-xl transition-all cursor-pointer shadow"
                title="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Submissions Modal for viewing captured leads */}
      {selectedPage && (
        <SubmissionsViewerModal
          isOpen={isSubmissionsOpen}
          onClose={() => setIsSubmissionsOpen(false)}
          pageId={selectedPage.id}
          pageTitle={selectedPage.title}
          pageSlug={selectedPage.slug}
        />
      )}
    </div>
  );
}
