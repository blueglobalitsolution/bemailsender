import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wand2, FileText, LogOut, UserCircle, Database, Menu, X, BarChart3, PanelLeftClose, PanelLeftOpen, Plus, Inbox as InboxIcon, Sparkles, UserPlus, Upload } from "lucide-react";
import { cn } from "../lib/utils";
import Beams from "./Beams";

import { ReachEngineLogo, ReachEngineLogoMark } from "./ReachEngineLogo";

export default function DashboardLayout({ setAuth }: { setAuth: (auth: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

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
    { name: "Inbound & Replies", path: "/inbox", icon: InboxIcon },
    { name: "Automation Wizard", path: "/wizard", icon: Wand2 },
    { name: "Script Architect", path: "/templates", icon: FileText },
    { name: "Sender Identities", path: "/identities", icon: UserCircle },
    { name: "Saved CSVs", path: "/saved-csvs", icon: Database },
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

        {/* Footer / Sign Out */}
        <div className="p-3 border-t border-[#2C353D]">
          <button 
            onClick={handleLogout}
            title={collapsed ? "Sign Out" : undefined}
            className={cn(
              "flex items-center w-full rounded-md text-sm font-medium text-[#8E9BA8] hover:text-[#f87171] hover:bg-[#222930] transition-all cursor-pointer group relative",
              collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-2.5"
            )}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Sign Out</span>}

            {collapsed && (
              <div className="hidden md:group-hover:flex absolute left-full ml-3 px-2.5 py-1 bg-[#222930] border border-[#3a1a1a] text-[#f87171] text-xs font-medium rounded-md shadow-xl whitespace-nowrap z-50 pointer-events-none">
                Sign Out
              </div>
            )}
          </button>
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
                    return "Script Architect";
                  case "identities":
                    return "Sender Identities";
                  case "saved-csvs":
                    return "Saved CSVs";
                  case "inbox":
                    return "Inbound Mail & Reply Center";
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
                  onClick={() => window.dispatchEvent(new CustomEvent("open-form-builder-modal"))}
                  className="bg-[#222930] hover:bg-[#29323A] border border-[#2C353D] text-[#CBD5E1] hover:text-white font-medium text-xs px-3 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Drag & Drop Form Builder"
                >
                  <Plus className="w-3.5 h-3.5" /> Form Builder
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-create-landing-modal"))}
                  className="bg-[#222930] hover:bg-[#29323A] border border-[#2C353D] text-[#CBD5E1] hover:text-white font-medium text-xs px-3 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Create Landing Page with HTML"
                >
                  <Plus className="w-3.5 h-3.5" /> Landing Page
                </button>
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
                  onClick={() => window.dispatchEvent(new CustomEvent("open-add-contact-modal"))}
                  className="bg-[#222930] hover:bg-[#29323A] border border-[#2C353D] text-[#CBD5E1] hover:text-white font-medium text-xs px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Contact
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-upload-csv-modal"))}
                  className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold text-xs px-4 py-2 rounded-md flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload CSV
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
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 relative z-10">
          <div key={location.pathname} className="page-transition-container w-full min-h-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
