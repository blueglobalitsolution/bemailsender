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
  Plus,
  MousePointerClick,
  Zap
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../components/Toast";
import { motion } from "motion/react";
import { CountingNumber, AnimatedCard, AnimatedProgress } from "../components/animate-ui";

interface Campaign {
  id: number;
  name: string;
  status: string;
  type?: string;
  total_sent: number;
  total_failed: number;
  total_opened?: number;
  total_clicked?: number;
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
    total_clicks?: number;
    delivery_rate: number;
    open_rate: number;
    click_rate?: number;
    intent_followups_sent?: number;
    intent_followups_scheduled?: number;
  };
  daily_stats: {
    date: string;
    sent: number;
    failed: number;
    opened: number;
    clicked?: number;
  }[];
  top_templates: {
    id: number;
    name: string;
    subject: string;
    sent: number;
    opened: number;
    clicks?: number;
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
    total_clicks: 0,
    delivery_rate: 0,
    open_rate: 0,
    click_rate: 0,
    intent_followups_sent: 0,
    intent_followups_scheduled: 0,
  };

  const daily_stats = data?.daily_stats || [];
  const top_templates = data?.top_templates || [];
  const identities = data?.identities || [];
  const maxDailyVolume = Math.max(...daily_stats.map(d => Math.max(d.sent, d.opened, d.clicked || 0)), 1);

  return (
    <div className="space-y-8 pb-16 font-sans">
      {/* Core KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total Sent */}
        <AnimatedCard delay={0.05} className="bg-[#222930] border border-[#2C353D] rounded-lg p-4 hover:border-[#CBD5E1] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase text-[#8E9BA8] font-medium tracking-wider">Total Sent</span>
            <Mail className="w-4 h-4 text-[#CBD5E1]" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            <CountingNumber value={summary.total_sent} />
          </div>
          <p className="text-[10px] text-[#8E9BA8] mt-1 font-mono">
            {summary.total_campaigns} campaigns
          </p>
        </AnimatedCard>

        {/* Delivery Rate */}
        <AnimatedCard delay={0.1} className="bg-[#222930] border border-[#2C353D] rounded-lg p-4 hover:border-[#CBD5E1] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase text-[#8E9BA8] font-medium tracking-wider">Delivery Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            <CountingNumber value={summary.delivery_rate} suffix="%" />
          </div>
          <p className="text-[10px] text-[#8E9BA8] mt-1 font-mono">
            {summary.total_failed} rejected / failed
          </p>
        </AnimatedCard>

        {/* Unique Opens */}
        <AnimatedCard delay={0.15} className="bg-[#222930] border border-[#2C353D] rounded-lg p-4 hover:border-[#CBD5E1] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase text-[#8E9BA8] font-medium tracking-wider">Unique Opens</span>
            <Eye className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-400 tracking-tight">
            <CountingNumber value={summary.total_opened} />
          </div>
          <p className="text-[10px] text-[#8E9BA8] mt-1 font-mono">
            <CountingNumber value={summary.open_rate} suffix="%" /> avg open rate
          </p>
        </AnimatedCard>

        {/* Link Clicks (High Intent) */}
        <AnimatedCard delay={0.18} className="bg-[#222930] border border-[#2C353D] rounded-lg p-4 hover:border-[#CBD5E1] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase text-[#8E9BA8] font-medium tracking-wider">Link Clicks</span>
            <MousePointerClick className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 tracking-tight">
            <CountingNumber value={summary.total_clicks || 0} />
          </div>
          <p className="text-[10px] text-[#8E9BA8] mt-1 font-mono">
            <CountingNumber value={summary.click_rate || 0} suffix="%" /> CTR
          </p>
        </AnimatedCard>

        {/* High-Intent Retargeting Dispatched */}
        <AnimatedCard delay={0.2} className="bg-[#222930] border border-[#2C353D] rounded-lg p-4 hover:border-[#CBD5E1] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase text-[#8E9BA8] font-medium tracking-wider">Retargeted</span>
            <Zap className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-orange-400 tracking-tight">
            <CountingNumber value={summary.intent_followups_sent || 0} />
          </div>
          <p className="text-[10px] text-[#8E9BA8] mt-1 font-mono">
            {summary.intent_followups_scheduled || 0} in queue
          </p>
        </AnimatedCard>

        {/* Active Running Campaigns */}
        <AnimatedCard delay={0.22} className="bg-[#222930] border border-[#2C353D] rounded-lg p-4 hover:border-[#CBD5E1] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase text-[#8E9BA8] font-medium tracking-wider">Active Status</span>
            <Activity className="w-4 h-4 text-[#CBD5E1]" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            <CountingNumber value={summary.running_campaigns} />
          </div>
          <p className="text-[10px] text-[#8E9BA8] mt-1 font-mono">
            {summary.completed_campaigns} completed
          </p>
        </AnimatedCard>
      </div>

      {/* Combined Analytics & Infrastructure Hub: Left Chart (Larger), Right Widgets (Stacked) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: 7-Day Velocity & Telemetry Activity Chart (Larger width: 7 of 12 columns) */}
        {daily_stats.length > 0 && (
          <AnimatedCard delay={0.25} hoverEffect={false} className="lg:col-span-7 bg-[#222930] border border-[#2C353D] rounded-lg p-6 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between mb-6 pb-4 border-b border-[#2C353D] gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#CBD5E1]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    7-Day Outbound Volume & Velocity
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-white">
                    <span className="w-2.5 h-2.5 bg-white inline-block rounded-xs"></span> Sent
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2.5 h-2.5 bg-emerald-400 inline-block rounded-xs"></span> Opened
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <span className="w-2.5 h-2.5 bg-amber-400 inline-block rounded-xs"></span> Clicked
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-3 h-64 items-end pt-4 font-mono">
                {daily_stats.map((day, idx) => {
                  const sentHeight = (day.sent / maxDailyVolume) * 100;
                  const openHeight = (day.opened / maxDailyVolume) * 100;
                  const clickHeight = ((day.clicked || 0) / maxDailyVolume) * 100;

                  return (
                    <div key={idx} className="flex flex-col items-center h-full justify-end group">
                      <div className="w-full flex items-end justify-center gap-1 h-52 pb-2 border-b border-[#2C353D]">
                        {/* Sent Bar */}
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(sentHeight, 4)}%` }}
                          transition={{ duration: 0.65, delay: 0.1 + idx * 0.05, ease: "easeOut" }}
                          className="w-1/3 max-w-[20px] bg-white group-hover:bg-[#CBD5E1] rounded-t-xs transition-colors relative"
                          title={`${day.date}: ${day.sent} Sent`}
                        >
                          {day.sent > 0 && (
                            <span className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] bg-[#161B1F] text-white px-1.5 py-0.5 rounded border border-[#2C353D] whitespace-nowrap transition-opacity">
                              {day.sent}
                            </span>
                          )}
                        </motion.div>

                        {/* Opened Bar */}
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(openHeight, day.opened > 0 ? 4 : 0)}%` }}
                          transition={{ duration: 0.65, delay: 0.15 + idx * 0.05, ease: "easeOut" }}
                          className="w-1/3 max-w-[20px] bg-emerald-400 group-hover:bg-emerald-300 rounded-t-xs transition-colors relative"
                          title={`${day.date}: ${day.opened} Opened`}
                        >
                          {day.opened > 0 && (
                            <span className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] bg-[#161B1F] text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap transition-opacity">
                              {day.opened}
                            </span>
                          )}
                        </motion.div>

                        {/* Clicked Bar */}
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(clickHeight, (day.clicked || 0) > 0 ? 4 : 0)}%` }}
                          transition={{ duration: 0.65, delay: 0.2 + idx * 0.05, ease: "easeOut" }}
                          className="w-1/3 max-w-[20px] bg-amber-400 group-hover:bg-amber-300 rounded-t-xs transition-colors relative"
                          title={`${day.date}: ${day.clicked || 0} Clicked`}
                        >
                          {(day.clicked || 0) > 0 && (
                            <span className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] bg-[#161B1F] text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 whitespace-nowrap transition-opacity">
                              {day.clicked}
                            </span>
                          )}
                        </motion.div>
                      </div>
                      <span className="text-[11px] text-[#8E9BA8] mt-2 group-hover:text-white transition-colors">
                        {day.date}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </AnimatedCard>
        )}

        {/* Right Column: Stacked Widgets (Top Templates + Sender Quota) (5 of 12 columns) */}
        <div className={`space-y-6 flex flex-col justify-between ${daily_stats.length > 0 ? "lg:col-span-5" : "lg:col-span-12"}`}>
          {/* Top Converting Script Architect Templates */}
          <AnimatedCard delay={0.3} hoverEffect={false} className="bg-[#222930] border border-[#2C353D] rounded-lg p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-[#2C353D]">
                <Award className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Top Performing Templates
                </h3>
              </div>

              {top_templates.length === 0 ? (
                <p className="text-xs text-[#8E9BA8] py-6 text-center font-medium">
                  Run campaigns with templates to generate rankings.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {top_templates.slice(0, 2).map((tmpl, i) => (
                    <div key={tmpl.id} className="p-3 bg-[#161B1F] border border-[#2C353D] rounded-md flex items-center justify-between hover:border-[#CBD5E1]/40 transition-colors">
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#161B1F] bg-white font-bold px-1.5 py-0.5 rounded">
                            #{i + 1}
                          </span>
                          <h4 className="text-xs font-bold text-white truncate">{tmpl.name}</h4>
                        </div>
                        <p className="text-[11px] text-[#8E9BA8] truncate mt-0.5">
                          {tmpl.subject || "No subject"}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold font-mono text-emerald-400">
                          {tmpl.open_rate}% <span className="text-[10px] text-[#8E9BA8] font-normal">Open</span>
                        </div>
                        <p className="text-[10px] font-mono text-[#8E9BA8]">
                          {tmpl.opened}/{tmpl.sent}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AnimatedCard>

          {/* Sender Identity Infrastructure Health & Quotas */}
          <AnimatedCard delay={0.35} hoverEffect={false} className="bg-[#222930] border border-[#2C353D] rounded-lg p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-[#2C353D]">
                <Server className="w-4 h-4 text-[#CBD5E1]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Sender Identity Quota & Health
                </h3>
              </div>

              {identities.length === 0 ? (
                <p className="text-xs text-[#8E9BA8] py-6 text-center font-medium">
                  No sender identities configured yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {identities.slice(0, 2).map((idn) => (
                    <div key={idn.id} className="p-3 bg-[#161B1F] border border-[#2C353D] rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <div className="truncate pr-2">
                          <span className="text-xs font-bold text-white block truncate">{idn.name}</span>
                          <span className="text-[10px] text-[#8E9BA8] font-mono truncate block">{idn.email}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#CBD5E1] bg-[#222930] border border-[#2C353D] px-2 py-0.5 rounded shrink-0">
                          {idn.daily_sent} / {idn.daily_limit} today
                        </span>
                      </div>

                      {/* Quota Progress bar with spring animation */}
                      <AnimatedProgress
                        value={idn.usage_percent}
                        barClassName={
                          idn.usage_percent > 90 ? "bg-rose-500" : idn.usage_percent > 60 ? "bg-amber-400" : "bg-white"
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AnimatedCard>
        </div>
      </div>

      {/* Merged Recent Campaigns Live Management Table */}
      <AnimatedCard delay={0.4} hoverEffect={false} className="bg-[#222930] border border-[#2C353D] rounded-lg overflow-hidden">
        <div className="p-6 border-b border-[#2C353D] flex justify-between items-center bg-[#1C2227]">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#CBD5E1]" /> Live Campaigns Telemetry
            </h3>
            <p className="text-xs text-[#8E9BA8] mt-0.5">Track live progress, logs, and deliverability status across campaigns.</p>
          </div>
          <Link 
            to="/wizard" 
            className="text-xs text-[#CBD5E1] hover:text-white flex items-center gap-1 font-medium transition-colors"
          >
            Create New Batch <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        
        <div className="divide-y divide-[#2C353D]">
          {campaigns.length === 0 ? (
            <div className="p-16 text-center text-[#8E9BA8] text-xs m-6 bg-[#161B1F] border border-[#2C353D] rounded-lg">
              No campaigns launched yet. Click "Create New Batch" to broadcast your first batch.
            </div>
          ) : (
            campaigns.map((campaign) => (
              <Link 
                key={campaign.id} 
                to={`/campaigns/${campaign.id}/logs`}
                className="block p-5 hover:bg-[#29323A] transition-colors group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 shrink-0 rounded-full ${campaign.status === 'running' ? 'bg-[#CBD5E1] animate-pulse' : 'bg-emerald-500'}`} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-sm text-white group-hover:text-[#CBD5E1] transition-colors truncate">{campaign.name}</h4>
                        <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-mono uppercase tracking-wider bg-[#161B1F] text-[#CBD5E1] border border-[#2C353D] rounded">
                          {campaign.type || 'email'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8E9BA8] flex items-center gap-1.5 mt-1 font-mono">
                        <Clock className="w-3 h-3" /> {new Date(campaign.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-5 sm:gap-7 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#2C353D]">
                    <div className="text-left sm:text-right">
                      <p className="text-[9px] uppercase tracking-widest text-[#8E9BA8]">Sent</p>
                      <p className="font-mono text-emerald-400 font-semibold text-xs">{campaign.total_sent}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[9px] uppercase tracking-widest text-[#8E9BA8] flex items-center gap-1 sm:justify-end">
                        <Eye className="w-2.5 h-2.5 text-sky-400 inline" /> Opens
                      </p>
                      <p className="font-mono text-sky-400 font-semibold text-xs">
                        {campaign.total_opened ?? 0}
                        {campaign.total_sent > 0 && (
                          <span className="text-[10px] text-[#8E9BA8] font-normal ml-1">
                            ({Math.round(((campaign.total_opened ?? 0) / campaign.total_sent) * 100)}%)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[9px] uppercase tracking-widest text-[#8E9BA8]">Failed</p>
                      <p className="font-mono text-rose-400 font-semibold text-xs">{campaign.total_failed}</p>
                    </div>
                    <div className="text-left sm:text-right min-w-[70px]">
                      <p className="text-[9px] uppercase tracking-widest text-[#8E9BA8] mb-0.5">Status</p>
                      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium border rounded capitalize ${
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
                        className="p-1.5 bg-red-950/20 text-red-400 hover:bg-red-900/40 hover:text-white border border-red-900/30 rounded transition-all cursor-pointer"
                        title="Delete Campaign"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ArrowRight className="w-4 h-4 text-[#8E9BA8] group-hover:text-white group-hover:translate-x-1 transition-all hidden sm:block" />
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </AnimatedCard>
    </div>
  );
}
