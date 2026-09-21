import React, { useState, useEffect } from "react";
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
  Award
} from "lucide-react";
import { apiFetch } from "../lib/api";

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
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      const res = await apiFetch("/api/analytics/");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 120000); // Automatically refresh every 2 minutes
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center font-mono text-xs text-[#777777] flex items-center justify-center gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-[#00ffff]" />
        <span>Loading Deliverability & Performance Analytics...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center font-mono text-sm text-[#777777]">
        No analytics data available yet.
      </div>
    );
  }

  const { summary, daily_stats, top_templates, identities } = data;
  const maxDailyVolume = Math.max(...daily_stats.map(d => Math.max(d.sent, d.opened)), 1);

  return (
    <div className="space-y-8 pb-16">
      {/* Core KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="skeuo-card p-5 border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-[#777777]">Total Sent</span>
            <Mail className="w-4 h-4 text-[#00ffff]" />
          </div>
          <div className="text-2xl font-serif font-bold text-white tracking-tight">
            {summary.total_sent.toLocaleString()}
          </div>
          <p className="text-[10px] font-mono text-[#555555] mt-1">
            Across {summary.total_campaigns} campaigns
          </p>
        </div>

        <div className="skeuo-card p-5 border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-[#777777]">Delivery Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-emerald-400 tracking-tight">
            {summary.delivery_rate}%
          </div>
          <p className="text-[10px] font-mono text-[#555555] mt-1">
            {summary.total_failed} delivery rejections
          </p>
        </div>

        <div className="skeuo-card p-5 border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-[#777777]">Unique Opens</span>
            <Eye className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-sky-400 tracking-tight">
            {summary.total_opened.toLocaleString()}
          </div>
          <p className="text-[10px] font-mono text-[#555555] mt-1">
            Tracked engagement pixels
          </p>
        </div>

        <div className="skeuo-card p-5 border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase text-[#777777]">Average Open Rate</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-amber-400 tracking-tight">
            {summary.open_rate}%
          </div>
          <p className="text-[10px] font-mono text-[#555555] mt-1">
            Industry avg benchmark: ~18-22%
          </p>
        </div>
      </div>

      {/* 7-Day Velocity & Telemetry Activity Chart */}
      <div className="skeuo-card p-6 border border-[#1e1e1e]">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1f1f23]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#00ffff]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
              7-Day Outbound Volume & Engagement Velocity
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-[#00ffff]">
              <span className="w-2.5 h-2.5 bg-[#00ffff] rounded-none inline-block"></span> Sent
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-none inline-block"></span> Opened
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-3 h-52 items-end pt-4 font-mono">
          {daily_stats.map((day, idx) => {
            const sentHeight = (day.sent / maxDailyVolume) * 100;
            const openHeight = (day.opened / maxDailyVolume) * 100;

            return (
              <div key={idx} className="flex flex-col items-center h-full justify-end group">
                <div className="w-full flex items-end justify-center gap-1.5 h-40 pb-2 border-b border-[#222222]">
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

      {/* Two Column Section: Top Templates & Sender Infrastructure Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Converting Script Architect Templates */}
        <div className="skeuo-card p-6 border border-[#1e1e1e] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1f1f23]">
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
                  <div key={tmpl.id} className="p-3 bg-[#050505] border border-[#1a1a1e] flex items-center justify-between">
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
        <div className="skeuo-card p-6 border border-[#1e1e1e] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1f1f23]">
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
                  <div key={idn.id} className="p-3 bg-[#050505] border border-[#1a1a1e]">
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
    </div>
  );
}
