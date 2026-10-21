import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Activity, CheckCircle, XCircle, Clock, BarChart3, ArrowRight, Trash2 } from "lucide-react";
import { apiFetch, getApiUrl } from "../lib/api";
import { useToast } from "../components/Toast";

interface Campaign {
  id: number;
  name: string;
  status: string;
  type?: string;
  total_sent: number;
  total_failed: number;
  total_skipped: number;
  created_at: string;
}

export default function Campaigns() {
  const toast = useToast();
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

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    toast.confirm("Are you sure you want to delete this campaign and all its logs?", async () => {
      try {
        const res = await apiFetch(`/api/campaigns/${id}/`, {
          method: "DELETE",
        });
        if (res.ok) {
          fetchCampaigns();
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
      <div className="bg-[#222930] border border-[#2C353D] rounded-lg overflow-hidden">
        <div className="p-6 border-b border-[#2C353D] flex justify-between items-center bg-[#1C2227]">
          <h2 className="text-xl font-serif text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#CBD5E1]" /> Recent Campaigns
          </h2>
          <Link 
            to="/wizard" 
            className="bg-white hover:bg-[#CBD5E1] text-[#161B1F] font-bold rounded-md px-5 py-2.5 text-xs flex items-center gap-2 transition-all cursor-pointer"
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
                    <div className={`w-2.5 h-2.5 shrink-0 rounded-full ${campaign.status === 'running' ? 'bg-[#CBD5E1] animate-pulse' : 'bg-emerald-500'}`} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-lg sm:text-xl text-white group-hover:text-[#CBD5E1] transition-colors truncate">{campaign.name}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[#161B1F] text-[#CBD5E1] border border-[#2C353D]">
                          {campaign.type || 'email'}
                        </span>
                      </div>
                      <p className="text-xs text-[#8E9BA8] flex items-center gap-1.5 mt-1 font-mono">
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
                    {(campaign.total_skipped || 0) > 0 && (
                      <div className="text-left sm:text-right">
                        <p className="text-[10px] uppercase tracking-widest text-[#666666] mb-0.5">Skipped</p>
                        <p className="font-mono text-amber-400 font-semibold text-sm">{campaign.total_skipped}</p>
                      </div>
                    )}
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] uppercase tracking-widest text-[#666666] mb-0.5">Status</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-medium border capitalize ${
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
