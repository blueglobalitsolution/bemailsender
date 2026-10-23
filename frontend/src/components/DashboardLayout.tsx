import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wand2, FileText, LogOut, UserCircle, Database, Menu, X, BarChart3, PanelLeftClose, PanelLeftOpen, Plus, Inbox as InboxIcon, Sparkles, UserPlus, Upload, Globe, Compass, Server, Bot, Save, ExternalLink, Download, Settings as SettingsIcon, Loader2, CheckCircle2, Clock } from "lucide-react";
import { cn } from "../lib/utils";
import Beams from "./Beams";
import { apiFetch } from "../lib/api";

import { ReachEngineLogo, ReachEngineLogoMark } from "./ReachEngineLogo";

export default function DashboardLayout({ setAuth }: { setAuth: (auth: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });
  const [activeCampaign, setActiveCampaign] = useState<any>(null);

  // Poll active campaign status for the sidebar widget
  useEffect(() => {
    let isMounted = true;
    const fetchActive = async () => {
      try {
        const res = await apiFetch("/api/campaigns/active-status/");
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.active) {
            setActiveCampaign(data);
          } else {
            setActiveCampaign(null);
          }
        }
      } catch (e) {
        // silently ignore poll errors
      }
    };

    fetchActive();
    const interval = setInterval(fetchActive, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Persist collapsed state
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setAuth(false);
    navigate("/login");
  };

  const navItems = [
    { name: "Analytics", path: "/analytics", icon: BarChart3 },
    { name: "Automation Wizard", path: "/wizard", icon: Wand2 },
    { name: "Inbound & Replies", path: "/inbox", icon: InboxIcon },
    { name: "Find Leads", path: "/lead-scraper", icon: Compass },
    { name: "Email Templates", path: "/templates", icon: FileText },
    { name: "Landing Pages", path: "/landing-pages", icon: Globe },
    { name: "AI Chatbot", path: "/chatbot", icon: Bot },
    { name: "Connect Provider", path: "/identities", icon: Server },
    { name: "Leads", path: "/saved-csvs", icon: Database },
  ];

  return (
    <div className="min-h-screen bg-[#161B1F] text-[#FFFFFF] font-sans flex flex-col md:flex-row relative">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Sidebar (Desktop fixed/collapsible, Mobile sliding drawer) */}
      <aside className={cn(
        "bg-[#161B1F] border-r border-[#2C353D] text-[#FFFFFF] flex flex-col z-50 transition-all duration-300 ease-in-out shrink-0",
        "fixed md:static inset-y-0 left-0",
        collapsed ? "md:w-20" : "md:w-64",
        mobileOpen ? "w-64 translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Brand & Toggle Header */}
        <div className={cn(
          "h-16 border-b border-[#2C353D] flex items-center transition-all duration-300",
          collapsed ? "justify-center px-2" : "justify-between px-6"
        )}>
          {!collapsed ? (
            <ReachEngineLogo size={26} textSize="text-lg" />
          ) : (
            <div className="flex items-center justify-center p-1" title="ReachEngine">
              <ReachEngineLogoMark size={24} />
            </div>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            onClick={toggleCollapsed}
            className="hidden md:flex text-[#8E9BA8] hover:text-white hover:bg-[#222930] p-1.5 transition-colors cursor-pointer rounded-md"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {/* Mobile Close Button */}
          <button 
            onClick={() => setMobileOpen(false)} 
            className="md:hidden text-[#8E9BA8] hover:text-white p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.name : undefined}
                className={cn(
                  "flex items-center rounded-md text-sm font-medium transition-all group relative",
                  collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-2.5",
                  isActive 
                    ? "bg-[#FFFFFF] text-[#161B1F] font-bold shadow-[0_2px_10px_rgba(255,255,255,0.15)]" 
                    : "text-[#8E9BA8] hover:text-white hover:bg-[#222930]"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.name}</span>}

                {/* Floating tooltip when collapsed on desktop */}
                {collapsed && (
                  <div className="hidden md:group-hover:flex absolute left-full ml-3 px-2.5 py-1 bg-[#222930] border border-[#2C353D] text-white text-xs font-medium rounded-md shadow-xl whitespace-nowrap z-50 pointer-events-none">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Live Active Campaign Box in Sidebar */}
        {activeCampaign && (
          <div className="p-2.5 border-t border-[#2C353D]">
            {collapsed ? (
              <Link
                to={`/campaigns/${activeCampaign.id}/logs`}
                className="flex items-center justify-center p-2 rounded-lg bg-sky-950/40 border border-sky-500/30 text-sky-400 hover:border-sky-400 transition-all relative group"
                title={`${activeCampaign.name}: ${activeCampaign.sent}/${activeCampaign.total}`}
              >
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <div className="hidden md:group-hover:flex absolute left-full ml-3 px-3 py-2 bg-[#1C2227] border border-[#2C353D] text-white text-xs rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none flex-col gap-1">
                  <div className="font-semibold text-white truncate max-w-[150px]">{activeCampaign.name}</div>
                  <div className="text-[10px] text-sky-400 font-mono">
                    {activeCampaign.sent} / {activeCampaign.total} ({activeCampaign.total > 0 ? Math.round((activeCampaign.sent / activeCampaign.total) * 100) : 0}%)
                  </div>
                </div>
              </Link>
            ) : (
              <div className="bg-[#1C2227] border border-[#2C353D] hover:border-sky-500/40 rounded-xl p-3 space-y-2 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
                    <span className="text-xs font-semibold text-white truncate" title={activeCampaign.name}>
                      {activeCampaign.name}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 shrink-0">
                    {activeCampaign.status === "running" ? "Running" : "Scheduled"}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-[#8E9BA8]">
                    <span>{activeCampaign.sent} of {activeCampaign.total} sent</span>
                    <span className="font-bold text-white">
                      {activeCampaign.total > 0 ? Math.round((activeCampaign.sent / activeCampaign.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-[#15191C] border border-[#2C353D] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-500"
                      style={{
                        width: `${activeCampaign.total > 0 ? Math.min((activeCampaign.sent / activeCampaign.total) * 100, 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Last sent email ticker */}
                {activeCampaign.last_log && (
                  <div className="text-[10px] font-mono text-[#8E9BA8] truncate flex items-center gap-1 pt-0.5 border-t border-[#2C353D]/50">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{activeCampaign.last_log.recipient}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer / Settings */}
        <div className="p-3 border-t border-[#2C353D]">
          <Link
            to="/settings"
            title={collapsed ? "Settings" : undefined}
            className={cn(
              "flex items-center w-full rounded-md text-sm font-medium transition-all group relative",
              collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-2.5",
              location.pathname.startsWith("/settings")
                ? "bg-[#FFFFFF] text-[#161B1F] font-bold shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
                : "text-[#8E9BA8] hover:text-white hover:bg-[#222930]"
            )}
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Settings</span>}

            {collapsed && (
              <div className="hidden md:group-hover:flex absolute left-full ml-3 px-2.5 py-1 bg-[#222930] border border-[#2C353D] text-white text-xs font-medium rounded-md shadow-xl whitespace-nowrap z-50 pointer-events-none">
                Settings
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#161B1F] min-w-0 relative">
        <header className="h-16 border-b border-[#2C353D] flex items-center justify-between px-4 sm:px-8 bg-[#161B1F] shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 -ml-2 text-[#8E9BA8] hover:text-white hover:bg-[#222930] transition-colors cursor-pointer rounded-md"
              title="Open Menu"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
              {(() => {
                const path = location.pathname.split("/")[1];
                switch (path) {
                  case "analytics":
                  case "campaigns":
                    return "Analytics";
                  case "wizard":
                    return "Automation Wizard";
                  case "templates":
                    return "Email Templates";
                  case "landing-pages":
                    return "Landing Pages";
                  case "chatbot":
                    return "AI Sales Chatbot";
                  case "identities":
                    return "Connect Provider";
                  case "saved-csvs":
                    return "Leads";
                  case "lead-scraper":
                    return "Find Leads";
                  case "inbox":
                    return "Inbound Mail & Reply Center";
                  case "settings":
                    return "Settings & Deliverability Safeguards";
                  default:
                    return path ? path.replace("-", " ") : "Dashboard";
                }
              })()}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {location.pathname === "/templates" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-ai-modal"))}
                  className="bg-[#222930] hover:bg-[#29323A] border border-[#2C353D] text-[#CBD5E1] hover:text-white font-medium text-xs px-3 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> AI Writer
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-create-template-modal"))}
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold text-xs px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> New Template
                </button>
              </div>
            )}

            {location.pathname === "/landing-pages" && (
              <div className="flex items-center gap-2">
                <Link
                  to="/chatbot"
                  className="bg-[#222930] hover:bg-[#29323A] border border-[#2C353D] text-[#CBD5E1] hover:text-white font-medium text-xs px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Configure AI Sales Chatbots"
                >
                  <Bot className="w-3.5 h-3.5 text-purple-400" /> Configure Chatbot
                </Link>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-create-landing-modal"))}
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold text-xs px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Create Landing Page"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Landing Page
                </button>
              </div>
            )}

            {location.pathname === "/identities" && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-create-identity-modal"))}
                className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold text-xs px-4 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Identity
              </button>
            )}

            {location.pathname === "/saved-csvs" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("download-sample-csv"))}
                  className="bg-[#222930] hover:bg-[#29323A] border border-[#2C353D] text-[#CBD5E1] hover:text-white font-medium text-xs px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Download demo CSV format template"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" /> Sample CSV
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-add-contact-modal"))}
                  className="bg-[#222930] hover:bg-[#29323A] border border-[#2C353D] text-[#CBD5E1] hover:text-white font-medium text-xs px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Contact
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-upload-csv-modal"))}
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold text-xs px-4 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload Leads
                </button>
              </div>
            )}

            {location.pathname === "/chatbot" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("preview-chatbot-page"))}
                  className="bg-[#222930] hover:bg-[#29323A] border border-[#2C353D] text-[#CBD5E1] hover:text-white font-medium text-xs px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Open live public landing page preview"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Preview Live
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("save-chatbot-settings"))}
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold text-xs px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Save Chatbot Settings"
                >
                  <Save className="w-3.5 h-3.5" /> Save Settings
                </button>
              </div>
            )}

            {location.pathname === "/inbox" && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-inbound-config-modal"))}
                className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold text-xs px-4 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Webhook Settings
              </button>
            )}

            {location.pathname === "/settings" && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("save-settings"))}
                className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold text-xs px-4 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Save className="w-3.5 h-3.5" /> Save Changes
              </button>
            )}

            {(location.pathname === "/analytics" || location.pathname === "/campaigns" || location.pathname === "/") && (
              <Link 
                to="/wizard" 
                className="bg-[#FFFFFF] hover:bg-[#CBD5E1] text-[#161B1F] font-bold rounded-md px-4 sm:px-5 py-2 text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Launch Campaign
              </Link>
            )}
          </div>
        </header>
        <div className={cn(
          "flex-1 relative z-10 flex flex-col min-h-0",
          location.pathname === "/inbox" ? "p-0 overflow-hidden" : location.pathname === "/templates" ? "p-0 overflow-y-auto" : "p-4 sm:p-6 md:p-8 overflow-auto"
        )}>
          <div key={location.pathname} className={cn(
            "page-transition-container w-full",
            location.pathname === "/inbox" ? "flex-1 flex flex-col min-h-0 h-full" : "min-h-full"
          )}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
