import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  BarChart3, 
  TrendingUp, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Activity, 
  Server, 
  RefreshCw,
  Award,
  ArrowRight,
  Clock,
  Trash2,
  Plus
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../components/Toast";

interface Campaign {
  id: number;
  name: string;
  status: string;
  type?: string;
  total_sent: number;
  total_failed: number;
  created_at: string;
}

interface AnalyticsData {
  summary: {
    total_campaigns: number;
    completed_campaigns: number;
    running_campaigns: number;
    total_sent: number;
    total_failed: number;
    total_opened: number;
    delivery_rate: number;
    open_rate: number;
  };
  daily_stats: {
    date: string;
    sent: number;
    failed: number;
    opened: number;
  }[];
  top_templates: {
    id: number;
    name: string;
    subject: string;
    sent: number;
    opened: number;
    open_rate: number;
  }[];
  identities: {
    id: number;
    name: string;
    email: string;
    host: string;
    daily_limit: number;
    daily_sent: number;
    remaining: number;
    usage_percent: number;
  }[];
}

export default function Analytics() {
  const toast = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [analyticsRes, campaignsRes] = await Promise.all([
        apiFetch("/api/analytics/"),
        apiFetch("/api/campaigns/")
      ]);

      if (analyticsRes.ok) {
        const json = await analyticsRes.json();
        setData(json);
      }
      if (campaignsRes.ok) {
        const campaignList = await campaignsRes.json();
        setCampaigns(campaignList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    toast.confirm("Are you sure you want to delete this campaign and all its logs?", async () => {
      try {
        const res = await apiFetch(`/api/campaigns/${id}/`, {
          method: "DELETE",
        });
        if (res.ok) {
          fetchDashboardData();
          toast.success("Campaign deleted successfully.");
        } else {
          toast.error("Failed to delete campaign.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Network error deleting campaign.");
      }
    });
  };

  if (loading) {
    return (
      <div className="py-24 text-center font-mono text-xs text-[#777777] flex items-center justify-center gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-[#00ffff]" />
        <span>Loading Live Analytics & Campaign Telemetry...</span>
      </div>
    );
  }

  const summary = data?.summary || {
    total_campaigns: campaigns.length,
    completed_campaigns: campaigns.filter(c => c.status === "completed").length,
    running_campaigns: campaigns.filter(c => c.status === "running").length,
    total_sent: campaigns.reduce((acc, c) => acc + (c.total_sent || 0), 0),
    total_failed: campaigns.reduce((acc, c) => acc + (c.total_failed || 0), 0),
    total_opened: 0,
    delivery_rate: 0,
    open_rate: 0,
  };

  const daily_stats = data?.daily_stats || [];
  const top_templates = data?.top_templates || [];
  const identities = data?.identities || [];
  const maxDailyVolume = Math.max(...daily_stats.map(d => Math.max(d.sent, d.opened)), 1);

  return (
    <div className="space-y-8 pb-16">
      {/* Core KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sent */}
        <div className="bg-[#000000] border border-[#1a1a1a] p-5 hover:border-[#2a2a2a] transition-all shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-[#777777]">Total Sent</span>
            <Mail className="w-4 h-4 text-[#00ffff]" />
          </div>
          <div className="text-3xl font-mono font-bold text-white tracking-tight">
            {summary.total_sent.toLocaleString()}
          </div>
          <p className="text-[10px] font-mono text-[#555555] mt-1">
            Across {summary.total_campaigns} campaigns
          </p>
        </div>

        {/* Delivery Rate */}
        <div className="bg-[#000000] border border-[#1a1a1a] p-5 hover:border-[#2a2a2a] transition-all shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-[#777777]">Delivery Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-mono font-bold text-emerald-400 tracking-tight">
            {summary.delivery_rate}%
          </div>
          <p className="text-[10px] font-mono text-[#555555] mt-1">
            {summary.total_failed} rejected / failed
          </p>
        </div>

        {/* Unique Opens */}
        <div className="bg-[#000000] border border-[#1a1a1a] p-5 hover:border-[#2a2a2a] transition-all shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-[#777777]">Unique Opens</span>
            <Eye className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-mono font-bold text-sky-400 tracking-tight">
            {summary.total_opened.toLocaleString()}
          </div>
          <p className="text-[10px] font-mono text-[#555555] mt-1">
            {summary.open_rate}% avg open rate
          </p>
        </div>

        {/* Active Running Campaigns */}
        <div className="bg-[#000000] border border-[#1a1a1a] p-5 hover:border-[#2a2a2a] transition-all shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-[#777777]">Active Campaigns</span>
            <Activity className="w-4 h-4 text-[#19b3d2]" />
          </div>
          <div className="text-3xl font-mono font-bold text-[#00ffff] tracking-tight">
            {summary.running_campaigns}
          </div>
          <p className="text-[10px] font-mono text-[#555555] mt-1">
            {summary.completed_campaigns} completed
          </p>
        </div>
      </div>

      {/* 7-Day Velocity & Telemetry Activity Chart */}
      {daily_stats.length > 0 && (
        <div className="bg-[#000000] border border-[#1a1a1a] p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#141414]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00ffff]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                7-Day Outbound Volume & Engagement Velocity
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-[#00ffff]">
                <span className="w-2.5 h-2.5 bg-[#00ffff] inline-block"></span> Sent
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 bg-emerald-400 inline-block"></span> Opened
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-3 h-52 items-end pt-4 font-mono">
            {daily_stats.map((day, idx) => {
              const sentHeight = (day.sent / maxDailyVolume) * 100;
              const openHeight = (day.opened / maxDailyVolume) * 100;

              return (
                <div key={idx} className="flex flex-col items-center h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1.5 h-40 pb-2 border-b border-[#1a1a1a]">
                    {/* Sent Bar */}
                    <div
                      style={{ height: `${Math.max(sentHeight, 4)}%` }}
                      className="w-1/2 max-w-[28px] bg-[#00ffff]/80 group-hover:bg-[#00ffff] transition-all relative"
                      title={`${day.date}: ${day.sent} Sent`}
                    >
                      {day.sent > 0 && (
                        <span className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] bg-black text-[#00ffff] px-1 border border-[#00ffff]/30 whitespace-nowrap transition-opacity">
                          {day.sent}
                        </span>
                      )}
                    </div>

                    {/* Opened Bar */}
                    <div
                      style={{ height: `${Math.max(openHeight, day.opened > 0 ? 4 : 0)}%` }}
                      className="w-1/2 max-w-[28px] bg-emerald-400/80 group-hover:bg-emerald-400 transition-all relative"
                      title={`${day.date}: ${day.opened} Opened`}
                    >
                      {day.opened > 0 && (
                        <span className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] bg-black text-emerald-400 px-1 border border-emerald-400/30 whitespace-nowrap transition-opacity">
                          {day.opened}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-[#777777] mt-2 group-hover:text-white transition-colors">
                    {day.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Two Column Section: Top Templates & Sender Infrastructure Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Converting Script Architect Templates */}
        <div className="bg-[#000000] border border-[#1a1a1a] p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#141414]">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                Top Performing Templates
              </h3>
            </div>

            {top_templates.length === 0 ? (
              <p className="text-xs font-mono text-[#666666] py-10 text-center">
                Run campaigns with templates to generate performance rankings.
              </p>
            ) : (
              <div className="space-y-3">
                {top_templates.map((tmpl, i) => (
                  <div key={tmpl.id} className="p-3 bg-[#050505] border border-[#161616] flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#00ffff] bg-[#00ffff]/10 px-1.5 py-0.5 border border-[#00ffff]/20">
                          #{i + 1}
                        </span>
                        <h4 className="text-xs font-bold text-white truncate font-mono">{tmpl.name}</h4>
                      </div>
                      <p className="text-[11px] text-[#777777] truncate font-mono mt-1">
                        Subject: {tmpl.subject || "No subject"}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold font-mono text-emerald-400">
                        {tmpl.open_rate}% <span className="text-[10px] text-[#777777] font-normal">Open</span>
                      </div>
                      <p className="text-[10px] font-mono text-[#666666]">
                        {tmpl.opened} / {tmpl.sent} sent
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sender Identity Infrastructure Health & Quotas */}
        <div className="bg-[#000000] border border-[#1a1a1a] p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#141414]">
              <Server className="w-4 h-4 text-[#00ffff]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                Sender Identity Quota & Health
              </h3>
            </div>

            {identities.length === 0 ? (
              <p className="text-xs font-mono text-[#666666] py-10 text-center">
                No sender identities configured yet.
              </p>
            ) : (
              <div className="space-y-4">
                {identities.map((idn) => (
                  <div key={idn.id} className="p-3 bg-[#050505] border border-[#161616]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="truncate pr-2">
                        <span className="text-xs font-bold text-white font-mono block truncate">{idn.name}</span>
                        <span className="text-[10px] text-[#777777] font-mono truncate block">{idn.email}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#00ffff] bg-[#00ffff]/10 border border-[#00ffff]/20 px-2 py-0.5 shrink-0">
                        {idn.daily_sent} / {idn.daily_limit} today
                      </span>
                    </div>

                    {/* Quota Progress bar */}
                    <div className="w-full bg-[#161616] h-1.5 overflow-hidden">
                      <div 
                        style={{ width: `${Math.min(idn.usage_percent, 100)}%` }}
                        className={`h-full transition-all duration-500 ${
                          idn.usage_percent > 90 ? "bg-rose-500" : idn.usage_percent > 60 ? "bg-amber-400" : "bg-[#00ffff]"
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Merged Recent Campaigns Live Management Table */}
      <div className="bg-[#000000] border border-[#1a1a1a] shadow-xl">
        <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-[#050505]">
          <div>
            <h3 className="text-lg font-serif text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00ffff]" /> Live Campaigns Telemetry
            </h3>
            <p className="text-xs text-[#666666] font-mono mt-0.5">Track live progress, logs, and deliverability status across campaigns.</p>
          </div>
          <Link 
            to="/wizard" 
            className="text-xs text-[#00ffff] hover:text-white flex items-center gap-1 font-mono transition-colors"
          >
            Create New Batch <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        
        <div className="divide-y divide-[#141414]">
          {campaigns.length === 0 ? (
            <div className="p-16 text-center text-[#666666] font-mono text-xs m-6 bg-[#080808] border border-[#161616]">
              No campaigns launched yet. Click "Launch Campaign" to broadcast your first batch.
            </div>
          ) : (
            campaigns.map((campaign) => (
              <Link 
                key={campaign.id} 
                to={`/campaigns/${campaign.id}/logs`}
                className="block p-5 hover:bg-[#070707] transition-colors group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 shrink-0 rounded-full ${campaign.status === 'running' ? 'bg-[#CBD5E1] animate-pulse' : 'bg-emerald-500'}`} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-serif text-base text-white group-hover:text-[#CBD5E1] transition-colors truncate">{campaign.name}</h4>
                        <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-mono uppercase tracking-wider bg-[#161B1F] text-[#CBD5E1] border border-[#2C353D]">
                          {campaign.type || 'email'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8E9BA8] flex items-center gap-1.5 mt-1 font-mono">
                        <Clock className="w-3 h-3" /> {new Date(campaign.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-5 sm:gap-8 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#141414]">
                    <div className="text-left sm:text-right">
                      <p className="text-[9px] uppercase tracking-widest text-[#666666]">Sent</p>
                      <p className="font-mono text-emerald-400 font-semibold text-xs">{campaign.total_sent}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[9px] uppercase tracking-widest text-[#666666]">Failed</p>
                      <p className="font-mono text-rose-400 font-semibold text-xs">{campaign.total_failed}</p>
                    </div>
                    <div className="text-left sm:text-right min-w-[70px]">
                      <p className="text-[9px] uppercase tracking-widest text-[#666666] mb-0.5">Status</p>
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium border capitalize ${
                        campaign.status === 'running' 
                          ? 'bg-white/10 text-white border-white/20' 
                          : campaign.status === 'scheduled'
                          ? 'bg-amber-950/30 text-amber-400 border-amber-800/40'
                          : 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => handleDelete(e, campaign.id)}
                        className="p-1.5 bg-red-950/20 text-red-400 hover:bg-red-900/40 hover:text-white border border-red-900/30 transition-all cursor-pointer"
                        title="Delete Campaign"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ArrowRight className="w-4 h-4 text-[#444444] group-hover:text-white group-hover:translate-x-1 transition-all hidden sm:block" />
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
