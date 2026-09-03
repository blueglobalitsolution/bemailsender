import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wand2, FileText, LogOut, UserCircle, Database, Menu, X } from "lucide-react";
import { cn } from "../lib/utils";
import Beams from "./Beams";

export default function DashboardLayout({ setAuth }: { setAuth: (auth: boolean) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

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
    { name: "Live Dashboard", path: "/campaigns", icon: LayoutDashboard },
    { name: "Automation Wizard", path: "/wizard", icon: Wand2 },
    { name: "Script Architect", path: "/templates", icon: FileText },
    { name: "Sender Identities", path: "/identities", icon: UserCircle },
    { name: "Saved CSVs", path: "/saved-csvs", icon: Database },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] font-sans flex flex-col md:flex-row relative">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Sidebar (Desktop fixed, Mobile sliding drawer) */}
      <aside className={cn(
        "w-64 bg-[#000000] border-r border-[#161616] text-[#ededed] flex flex-col z-50 transition-transform duration-300 ease-in-out",
        "fixed md:static inset-y-0 left-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="h-16 border-b border-[#161616] flex items-center justify-between px-6">
          <h1 className="text-2xl font-serif text-white tracking-tight">BEmailSender</h1>
          <button 
            onClick={() => setMobileOpen(false)} 
            className="md:hidden text-[#777777] hover:text-white p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-none text-sm font-medium transition-all",
                  isActive 
                    ? "bg-[#19b3d2] text-black font-semibold" 
                    : "text-[#888888] hover:text-white hover:bg-[#111111]"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#141414]">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-none text-sm font-medium text-[#777777] hover:text-[#f87171] hover:bg-[#1a0f0f] transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content with Blurred Dynamic Beams Background */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0a0a0a] min-w-0 relative">
        {/* Blurred Beams Background Canvas */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 filter blur-[40px] opacity-40">
          <Beams 
            lightColor="#19b3d2"
            beamNumber={30}
            beamWidth={4.7}
            beamHeight={30}
            speed={4.5}
            noiseIntensity={1.4}
            scale={0.15}
            rotation={-31}
          />
        </div>

        <header className="h-16 border-b border-[#161616] flex items-center justify-between px-4 sm:px-8 bg-[#000000]/70 backdrop-blur-xl shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 -ml-2 text-[#cccccc] hover:text-white hover:bg-[#111111] transition-colors cursor-pointer"
              title="Open Menu"
            >
              <Menu className="w-5 h-5 text-[#19b3d2]" />
            </button>
            <h2 className="text-xl sm:text-2xl font-serif text-white capitalize tracking-wide truncate">
              {location.pathname.split("/")[1] ? location.pathname.split("/")[1].replace("-", " ") : "Dashboard"}
            </h2>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
