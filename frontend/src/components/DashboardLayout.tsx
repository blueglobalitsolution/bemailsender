import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wand2, FileText, LogOut, UserCircle, MessageSquare, History } from "lucide-react";
import { cn } from "../lib/utils";

export default function DashboardLayout({ setAuth }: { setAuth: (auth: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setAuth(false);
    navigate("/login");
  };

  const navItems = [
    { name: "Live Dashboard", path: "/campaigns", icon: LayoutDashboard },
    { name: "Automation Wizard", path: "/wizard", icon: Wand2 },
    { name: "WhatsApp Connect", path: "/whatsapp", icon: MessageSquare },
    { name: "Script Architect", path: "/templates", icon: FileText },
    { name: "Sender Identities", path: "/identities", icon: UserCircle },
    { name: "Campaign Logs", path: "/logs", icon: History },
  ];

  return (
    <div className="min-h-screen bg-transparent text-gray-900 font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 skeuo-sidebar text-gray-100 flex flex-col">
        <div className="p-6 border-b border-gray-800/50 shadow-[0_1px_0_rgba(255,255,255,0.05)]">
          <h1 className="text-xl font-bold tracking-tight skeuo-text-light">BEmailSender</h1>
          <p className="text-xs text-white/50 mt-1 uppercase tracking-widest">Mission Control</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all skeuo-nav-item",
                  isActive && "active"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800/50 shadow-[0_-1px_0_rgba(255,255,255,0.05)]">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all skeuo-nav-item"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b border-gray-300 shadow-[0_1px_0_rgba(255,255,255,0.8)] flex items-center px-8 bg-transparent">
          <h2 className="text-lg font-bold skeuo-text capitalize">
            {location.pathname.split("/")[1] || "Dashboard"}
          </h2>
        </header>
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
