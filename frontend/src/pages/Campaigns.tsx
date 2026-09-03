import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Activity, CheckCircle, XCircle, Clock, BarChart3, ArrowRight, Trash2 } from "lucide-react";
import { apiFetch, getApiUrl } from "../lib/api";

interface Campaign {
  id: number;
  name: string;
  status: string;
  type?: string;
  total_sent: number;
  total_failed: number;
  created_at: string;
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    try {
      const res = await apiFetch("/api/campaigns/");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this campaign and all its associated logs and contacts?")) return;
    
    try {
      const res = await apiFetch(`/api/campaigns/${id}/`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchCampaigns();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading dashboard...</div>;

  const totalSent = campaigns.reduce((acc, c) => acc + c.total_sent, 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + c.total_failed, 0);
  const activeCampaigns = campaigns.filter(c => c.status === "running").length;

  return (
    <div className="space-y-8">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#000000] border border-[#1a1a1a] rounded-none p-6 hover:border-[#262626] transition-all shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-sans font-semibold uppercase tracking-wider text-[#a0a0a0]">Total Sent</span>
            <div className="p-2.5 rounded-none bg-emerald-950/30 border border-emerald-800/40">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-5xl font-mono font-bold text-white tracking-tight">{totalSent}</p>
        </div>
        
        <div className="bg-[#000000] border border-[#1a1a1a] rounded-none p-6 hover:border-[#262626] transition-all shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-sans font-semibold uppercase tracking-wider text-[#a0a0a0]">Total Failed</span>
            <div className="p-2.5 rounded-none bg-red-950/30 border border-red-800/40">
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
          </div>
          <p className="text-5xl font-mono font-bold text-white tracking-tight">{totalFailed}</p>
        </div>
        
        <div className="bg-[#000000] border border-[#1a1a1a] rounded-none p-6 hover:border-[#262626] transition-all shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-sans font-semibold uppercase tracking-wider text-[#a0a0a0]">Active Campaigns</span>
            <div className="p-2.5 rounded-none bg-[#19b3d2]/10 border border-[#19b3d2]/30">
              <Activity className="w-4 h-4 text-[#19b3d2]" />
            </div>
          </div>
          <p className="text-5xl font-mono font-bold text-white tracking-tight">{activeCampaigns}</p>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-[#000000] border border-[#1a1a1a] rounded-[32px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-[#050505]">
          <h2 className="text-xl font-serif text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#00ffff]" /> Recent Campaigns
          </h2>
          <Link 
            to="/wizard" 
            className="bg-[#00ffff] hover:bg-[#33ffff] text-black font-semibold rounded-full px-5 py-2.5 text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(0,255,255,0.25)] hover:shadow-[0_0_28px_rgba(0,255,255,0.4)]"
          >
            New Campaign <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        
        <div className="divide-y divide-[#141414]">
          {campaigns.length === 0 ? (
            <div className="p-16 text-center text-[#666666] font-medium m-6 rounded-2xl bg-[#080808] border border-[#161616]">
              No campaigns launched yet. Click "New Campaign" to broadcast your first batch.
            </div>
          ) : (
            campaigns.map((campaign) => (
              <Link 
                key={campaign.id} 
                to={`/campaigns/${campaign.id}/logs`}
                className="block p-6 hover:bg-[#080808] transition-colors group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 shrink-0 rounded-none ${campaign.status === 'running' ? 'bg-[#00ffff] shadow-[0_0_8px_#00ffff] animate-pulse' : 'bg-emerald-500'}`} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-lg sm:text-xl text-white group-hover:text-[#00ffff] transition-colors truncate">{campaign.name}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-mono uppercase tracking-wider bg-[#111111] text-[#00ffff] border border-[#222222]">
                          {campaign.type || 'email'}
                        </span>
                      </div>
                      <p className="text-xs text-[#666666] flex items-center gap-1.5 mt-1 font-mono">
                        <Clock className="w-3 h-3" /> {new Date(campaign.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#141414]">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] uppercase tracking-widest text-[#666666] mb-0.5">Sent</p>
                      <p className="font-mono text-emerald-400 font-semibold text-sm">{campaign.total_sent}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] uppercase tracking-widest text-[#666666] mb-0.5">Failed</p>
                      <p className="font-mono text-rose-400 font-semibold text-sm">{campaign.total_failed}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] uppercase tracking-widest text-[#666666] mb-0.5">Status</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-none text-[10px] font-medium border capitalize ${
                        campaign.status === 'running' 
                          ? 'bg-[#00ffff]/10 text-[#00ffff] border-[#00ffff]/30 shadow-[0_0_12px_rgba(0,255,255,0.2)]' 
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
                        className="p-2 rounded-none bg-red-950/20 text-red-400 hover:bg-red-900/40 hover:text-white border border-red-900/30 transition-all cursor-pointer"
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
