import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, Terminal } from "lucide-react";
import { apiFetch } from "../lib/api";

interface Log {
  id: number;
  recipient: string;
  status: string;
  message: string;
  created_at: string;
}

export default function CampaignLogs() {
  const { id } = useParams();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await apiFetch(`/api/campaigns/${id}/logs/`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading logs...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/campaigns" className="inline-flex items-center text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors skeuo-text">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Campaigns
        </Link>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 skeuo-text">
          <Terminal className="w-6 h-6 text-gray-700 drop-shadow-sm" /> Campaign Logs
        </h2>
      </div>

      <div className="skeuo-panel rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-900 bg-gradient-to-b from-gray-800 to-gray-900 flex items-center gap-2 shadow-[0_1px_0_rgba(255,255,255,0.1)]">
          <div className="w-3 h-3 rounded-full bg-red-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.5)] border border-red-700" />
          <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.5)] border border-yellow-700" />
          <div className="w-3 h-3 rounded-full bg-green-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.5)] border border-green-700" />
          <span className="ml-4 font-mono text-xs text-gray-400 font-bold text-shadow-[0_-1px_0_rgba(0,0,0,0.5)]">Live Stream</span>
        </div>

        <div className="p-6 h-[600px] overflow-y-auto font-mono text-sm space-y-2 bg-gray-900 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
          {logs.length === 0 ? (
            <div className="text-center text-gray-500 py-12 font-bold">No logs yet...</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`flex items-start gap-4 p-3 rounded-lg border shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${log.status === 'success' ? 'bg-gradient-to-b from-green-900/40 to-green-900/20 border-green-800 text-green-400' : 'bg-gradient-to-b from-red-900/40 to-red-900/20 border-red-800 text-red-400'
                }`}>
                <span className="text-gray-500 whitespace-nowrap font-bold">
                  [{new Date(log.created_at).toLocaleTimeString()}]
                </span>
                {log.status === 'success' ? (
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 drop-shadow-[0_0_2px_rgba(74,222,128,0.5)]" />
                ) : (
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0 drop-shadow-[0_0_2px_rgba(248,113,113,0.5)]" />
                )}
                <div className="flex-1">
                  <span className="font-bold text-gray-300">{log.recipient}</span>
                  <span className="mx-2 text-gray-600">-</span>
                  <span className="text-shadow-[0_1px_0_rgba(0,0,0,0.5)]">{log.message}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
