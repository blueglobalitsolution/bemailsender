import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Activity, CheckCircle, XCircle, Clock, BarChart3, ArrowRight, Trash2 } from "lucide-react";
import { apiFetch, getApiUrl } from "../lib/api";

interface Campaign {
  id: number;
  name: string;
  status: string;
  type: 'email' | 'whatsapp';
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
        <div className="skeuo-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 skeuo-text">Total Sent</h3>
            <div className="p-2 rounded-full bg-gradient-to-b from-green-50 to-green-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.1)] border border-green-200">
              <CheckCircle className="w-5 h-5 text-green-600 drop-shadow-sm" />
            </div>
          </div>
          <p className="text-4xl font-bold font-mono skeuo-text">{totalSent}</p>
        </div>
        
        <div className="skeuo-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 skeuo-text">Total Failed</h3>
            <div className="p-2 rounded-full bg-gradient-to-b from-red-50 to-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.1)] border border-red-200">
              <XCircle className="w-5 h-5 text-red-600 drop-shadow-sm" />
            </div>
          </div>
          <p className="text-4xl font-bold font-mono skeuo-text">{totalFailed}</p>
        </div>
        
        <div className="skeuo-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 skeuo-text">Active Campaigns</h3>
            <div className="p-2 rounded-full bg-gradient-to-b from-blue-50 to-blue-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.1)] border border-blue-200">
              <Activity className="w-5 h-5 text-blue-600 drop-shadow-sm" />
            </div>
          </div>
          <p className="text-4xl font-bold font-mono skeuo-text">{activeCampaigns}</p>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="skeuo-card overflow-hidden">
        <div className="p-6 border-b border-gray-300 shadow-[0_1px_0_rgba(255,255,255,0.8)] flex justify-between items-center bg-gradient-to-b from-gray-50 to-gray-100">
          <h2 className="text-lg font-bold flex items-center gap-2 skeuo-text">
            <BarChart3 className="w-5 h-5 text-gray-600 drop-shadow-sm" /> Recent Campaigns
          </h2>
          <Link to="/wizard" className="skeuo-btn-primary px-4 py-2 text-sm font-bold flex items-center gap-2">
            New Campaign <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="divide-y divide-gray-200">
          {campaigns.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-bold skeuo-inset-box m-6">
              No campaigns found. Start your first campaign!
            </div>
          ) : (
            campaigns.map((campaign) => (
              <Link 
                key={campaign.id} 
                to={`/campaigns/${campaign.id}/logs`}
                className="block p-6 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.5)] border ${campaign.status === 'running' ? 'bg-blue-500 border-blue-700 animate-pulse' : 'bg-green-500 border-green-700'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg skeuo-text">{campaign.name}</h3>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter border shadow-sm ${
                          campaign.type === 'whatsapp' 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {campaign.type || 'email'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1 font-medium">
                        <Clock className="w-3 h-3 drop-shadow-sm" /> {new Date(campaign.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 skeuo-text">Sent</p>
                      <p className="font-mono text-green-700 font-bold">{campaign.total_sent}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 skeuo-text">Failed</p>
                      <p className="font-mono text-red-700 font-bold">{campaign.total_failed}</p>
                    </div>
                    <div className="text-right w-24">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 skeuo-text">Status</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.1)] border capitalize ${
                        campaign.status === 'running' 
                          ? 'bg-gradient-to-b from-blue-50 to-blue-100 text-blue-800 border-blue-200' 
                          : campaign.status === 'scheduled'
                          ? 'bg-gradient-to-b from-amber-50 to-amber-100 text-amber-800 border-amber-200'
                          : 'bg-gradient-to-b from-green-50 to-green-100 text-green-800 border-green-200'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => handleDelete(e, campaign.id)}
                        className="p-2 skeuo-btn-danger"
                        title="Delete Campaign"
                      >
                        <Trash2 className="w-5 h-5 drop-shadow-sm" />
                      </button>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-800 transition-colors drop-shadow-sm" />
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
