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
  AlertCircle,
  BookOpen,
  Plus,
  Edit3,
  X
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
  assigned_script?: number | null;
  assigned_script_title?: string | null;
  views_count: number;
  submissions_count: number;
  created_at: string;
}

interface ChatbotScriptItem {
  id: number;
  title: string;
  content: string;
  landing_pages_count: number;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  role: "bot" | "user";
  text: string;
  timestamp?: string;
}

export default function AIChatbot() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = searchParams.get("page");

  const [landingPages, setLandingPages] = useState<LandingPageSummary[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Script Library states
  const [scripts, setScripts] = useState<ChatbotScriptItem[]>([]);
  const [assignedScriptId, setAssignedScriptId] = useState<number | null>(null);
  const [isCreateScriptModalOpen, setIsCreateScriptModalOpen] = useState(false);
  const [isManageScriptsModalOpen, setIsManageScriptsModalOpen] = useState(false);
  const [newScriptTitle, setNewScriptTitle] = useState("");
  const [newScriptContent, setNewScriptContent] = useState("");
  const [creatingScript, setCreatingScript] = useState(false);
  const [editingScript, setEditingScript] = useState<ChatbotScriptItem | null>(null);
  const [updatingLibraryScript, setUpdatingLibraryScript] = useState(false);

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
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchLandingPages(), fetchScripts()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchScripts = async (): Promise<ChatbotScriptItem[]> => {
    try {
      const res = await apiFetch("/api/chatbot-scripts/");
      if (res.ok) {
        const data: ChatbotScriptItem[] = await res.json();
        setScripts(data);
        return data;
      }
    } catch (err) {
      console.error("Error loading scripts:", err);
    }
    return [];
  };

  const fetchLandingPages = async () => {
    try {
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
    setAssignedScriptId(page.assigned_script ?? null);
    setChatbotScript(page.chatbot_script || "");
    setSearchParams({ page: String(page.id) });

    // Reset simulator conversation for this page
    resetSimulator(
      page.chatbot_name || "AI Sales Assistant",
      page.chatbot_welcome_message || "Hi there! 👋 Welcome! Please introduce yourself below to start chatting."
    );
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
          chatbot_script: chatbotScript,
          assigned_script: assignedScriptId
        })
      });

      if (res.ok) {
        const updatedPage = await res.json();
        toast.success("AI Chatbot settings saved successfully!");
        setLandingPages((prev) =>
          prev.map((p) => (p.id === selectedPageId ? { ...p, ...updatedPage } : p))
        );
        fetchScripts();
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

  // Global listeners for header buttons in DashboardLayout
  useEffect(() => {
    const handleGlobalSave = () => {
      handleSaveSettings();
    };

    const handleGlobalPreview = () => {
      const page = landingPages.find((p) => p.id === selectedPageId);
      if (page) {
        window.open(`/p/${page.slug}`, "_blank");
      } else {
        toast.error("Please select a landing page first");
      }
    };

    window.addEventListener("save-chatbot-settings", handleGlobalSave);
    window.addEventListener("preview-chatbot-page", handleGlobalPreview);

    return () => {
      window.removeEventListener("save-chatbot-settings", handleGlobalSave);
      window.removeEventListener("preview-chatbot-page", handleGlobalPreview);
    };
  }, [selectedPageId, chatbotEnabled, chatbotName, chatbotWelcomeMessage, chatbotScript, assignedScriptId, landingPages]);

  // Create new script in library and assign to current page
  const handleCreateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScriptTitle.trim()) {
      toast.error("Please enter a title for the script");
      return;
    }

    setCreatingScript(true);
    try {
      const res = await apiFetch("/api/chatbot-scripts/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newScriptTitle.trim(),
          content: newScriptContent
        })
      });

      if (res.ok) {
        const created: ChatbotScriptItem = await res.json();
        toast.success(`Script "${created.title}" created and assigned!`);
        await fetchScripts();
        setAssignedScriptId(created.id);
        setChatbotScript(created.content);
        setIsCreateScriptModalOpen(false);
        setNewScriptTitle("");
        setNewScriptContent("");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create script");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error creating script");
    } finally {
      setCreatingScript(false);
    }
  };

  // Update existing script in library across all pages using it
  const handleUpdateLibraryScript = async () => {
    if (!assignedScriptId) return;
    setUpdatingLibraryScript(true);
    try {
      const res = await apiFetch(`/api/chatbot-scripts/${assignedScriptId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: chatbotScript
        })
      });

      if (res.ok) {
        toast.success("Library script updated successfully!");
        fetchScripts();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update library script");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error updating library script");
    } finally {
      setUpdatingLibraryScript(false);
    }
  };

  // Delete script from library
  const handleDeleteScript = async (id: number) => {
    toast.confirm("Are you sure you want to delete this script from the library?", async () => {
      try {
        const res = await apiFetch(`/api/chatbot-scripts/${id}/`, {
          method: "DELETE"
        });
        if (res.ok) {
          toast.success("Script deleted from library");
          if (assignedScriptId === id) {
            setAssignedScriptId(null);
          }
          fetchScripts();
        } else {
          toast.error("Failed to delete script");
        }
      } catch (err) {
        console.error(err);
        toast.error("Error deleting script");
      }
    });
  };

  // Update title/content from Manage modal
  const handleSaveEditedScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScript) return;

    try {
      const res = await apiFetch(`/api/chatbot-scripts/${editingScript.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingScript.title,
          content: editingScript.content
        })
      });

      if (res.ok) {
        toast.success("Script updated successfully!");
        if (assignedScriptId === editingScript.id) {
          setChatbotScript(editingScript.content);
        }
        setEditingScript(null);
        fetchScripts();
      } else {
        toast.error("Failed to update script");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating script");
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

  const selectedPage = landingPages.find((p) => p.id === selectedPageId);
  const currentAssignedScript = scripts.find((s) => s.id === assignedScriptId);

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
                  2. Product Script & Knowledge Base
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#8E9BA8]">
                The AI strictly uses this script to answer questions
              </span>
            </div>

            {/* Reusable Script Selector & Assignment Bar */}
            <div className="bg-[#14181C] border border-[#2C353D] rounded-xl p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                    Assign Script To This Page:
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setNewScriptTitle(selectedPage?.title ? `${selectedPage.title} Script` : "New Script");
                      setNewScriptContent(chatbotScript);
                      setIsCreateScriptModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-[#222930] hover:bg-[#2C353D] text-white border border-[#2C353D] rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Create a new script in library"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+ New Script</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsManageScriptsModalOpen(true)}
                    className="px-2.5 py-1.5 bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white border border-[#2C353D] rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Manage all scripts"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Manage Library ({scripts.length})</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={assignedScriptId ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setAssignedScriptId(null);
                        toast.info("Using custom script for this page only");
                      } else {
                        const sId = Number(val);
                        setAssignedScriptId(sId);
                        const found = scripts.find((s) => s.id === sId);
                        if (found) {
                          setChatbotScript(found.content);
                          toast.success(`Assigned "${found.title}" to this landing page!`);
                        }
                      }
                    }}
                    className="w-full bg-[#1A1F26] border border-[#2C353D] hover:border-purple-500/50 text-white text-xs font-semibold rounded-lg px-3.5 py-2.5 pr-8 appearance-none focus:outline-none cursor-pointer transition-colors"
                  >
                    <option value="">
                      -- Custom Script for this Landing Page only (Unassigned) --
                    </option>
                    {scripts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.landing_pages_count} {s.landing_pages_count === 1 ? "page" : "pages"} assigned)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#8E9BA8] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* If assigned to a library script, allow syncing/updating it directly */}
                {assignedScriptId && (
                  <button
                    type="button"
                    onClick={handleUpdateLibraryScript}
                    disabled={updatingLibraryScript}
                    className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    title="Update this script in library across all assigned landing pages"
                  >
                    {updatingLibraryScript ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Update Library Script</span>
                  </button>
                )}
              </div>

              {currentAssignedScript && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    Linked to library script: <strong>{currentAssignedScript.title}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Script Textarea */}
            <div>
              <textarea
                rows={15}
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

      {/* Create New Script Modal */}
      {isCreateScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1E252D] border border-[#2C353D] rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C353D]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Create New Product Script</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateScriptModalOpen(false)}
                className="text-[#8E9BA8] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateScript} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                  Script Title *
                </label>
                <input
                  type="text"
                  required
                  value={newScriptTitle}
                  onChange={(e) => setNewScriptTitle(e.target.value)}
                  placeholder="e.g. Dog Food Nutrition Script, B2B SaaS Offer"
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-white transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                  Knowledge Base & Script Content
                </label>
                <textarea
                  rows={8}
                  value={newScriptContent}
                  onChange={(e) => setNewScriptContent(e.target.value)}
                  placeholder="Product Name: ...&#10;Pricing: ...&#10;Features: ...&#10;Refunds: ..."
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-white transition-all font-mono leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#2C353D]">
                <button
                  type="button"
                  onClick={() => setIsCreateScriptModalOpen(false)}
                  className="px-4 py-2 border border-[#2C353D] bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingScript}
                  className="px-5 py-2 bg-white hover:bg-[#CBD5E1] text-[#161B1F] text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {creatingScript ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save & Assign to Page</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Scripts Library Modal */}
      {isManageScriptsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1E252D] border border-[#2C353D] rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C353D] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Scripts & Knowledge Base Library</h3>
                  <p className="text-[11px] text-[#8E9BA8]">
                    Manage reusable scripts that can be assigned across your landing pages.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManageScriptsModalOpen(false);
                  setEditingScript(null);
                }}
                className="text-[#8E9BA8] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List or Edit Mode */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {editingScript ? (
                <form onSubmit={handleSaveEditedScript} className="space-y-4 p-4 bg-[#161B1F] border border-[#2C353D] rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Edit Script: {editingScript.title}</span>
                    <button
                      type="button"
                      onClick={() => setEditingScript(null)}
                      className="text-xs text-[#8E9BA8] hover:text-white"
                    >
                      ← Back to list
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1">
                      Script Title
                    </label>
                    <input
                      type="text"
                      required
                      value={editingScript.title}
                      onChange={(e) => setEditingScript({ ...editingScript, title: e.target.value })}
                      className="w-full bg-[#1A1F26] border border-[#2C353D] rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1">
                      Script Content
                    </label>
                    <textarea
                      rows={10}
                      value={editingScript.content}
                      onChange={(e) => setEditingScript({ ...editingScript, content: e.target.value })}
                      className="w-full bg-[#1A1F26] border border-[#2C353D] rounded-lg p-3 text-xs text-white font-mono leading-relaxed"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingScript(null)}
                      className="px-3 py-1.5 border border-[#2C353D] bg-[#222930] text-xs font-semibold rounded-lg text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-white text-[#161B1F] text-xs font-bold rounded-lg shadow"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : scripts.length === 0 ? (
                <div className="py-12 text-center text-[#8E9BA8] border border-dashed border-[#2C353D] rounded-xl">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold">No saved scripts in library yet.</p>
                  <p className="text-[11px] mt-1">Create one to assign it across landing pages!</p>
                </div>
              ) : (
                scripts.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 bg-[#161B1F] border border-[#2C353D] hover:border-[#3E4A56] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{s.title}</span>
                        {assignedScriptId === s.id && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-semibold">
                            Currently Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8E9BA8] line-clamp-2 font-mono">
                        {s.content || "(Empty script content)"}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-[#8E9BA8]">
                        <span>Assigned to {s.landing_pages_count} {s.landing_pages_count === 1 ? "page" : "pages"}</span>
                        <span>•</span>
                        <span>Updated {new Date(s.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAssignedScriptId(s.id);
                          setChatbotScript(s.content);
                          toast.success(`Assigned "${s.title}" to current page!`);
                          setIsManageScriptsModalOpen(false);
                        }}
                        className="px-3 py-1.5 bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white border border-[#2C353D] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Assign to Page
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingScript(s)}
                        className="p-1.5 text-[#8E9BA8] hover:text-white hover:bg-[#26303A] rounded-lg transition-colors cursor-pointer"
                        title="Edit Script"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteScript(s.id)}
                        className="p-1.5 text-[#8E9BA8] hover:text-red-400 hover:bg-[#26303A] rounded-lg transition-colors cursor-pointer"
                        title="Delete Script"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-[#2C353D] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setNewScriptTitle("");
                  setNewScriptContent("");
                  setIsCreateScriptModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Script</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsManageScriptsModalOpen(false);
                  setEditingScript(null);
                }}
                className="px-4 py-1.5 border border-[#2C353D] bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
