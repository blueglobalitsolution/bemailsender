import React, { useState, useEffect } from "react";
import { Database, Upload, Save, Trash2, FileText, ChevronDown, ChevronRight, Shield, Loader2, CheckCircle, X, AlertCircle } from "lucide-react";
import { apiFetch } from "../lib/api";

interface SavedCsv {
  id: number;
  name: string;
  columns: string[];
  row_count: number;
  created_at: string;
}

export default function SavedCSVs() {
  const [csvs, setCsvs] = useState<SavedCsv[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [scanning, setScanning] = useState<Record<number, boolean>>({});
  const [scanData, setScanData] = useState<Record<number, any>>({});
  const [checkGravatar, setCheckGravatar] = useState(false);

  const fetchCsvs = async () => {
    try {
      const res = await apiFetch("/api/saved-csvs/");
      if (res.ok) setCsvs(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCsvs(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFile || !newName.trim()) return;
    const text = await newFile.text();
    const res = await apiFetch("/api/saved-csvs/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), csv_content: text }),
    });
    if (res.ok) {
      setIsUploading(false);
      setNewName("");
      setNewFile(null);
      fetchCsvs();
    } else {
      const data = await res.json();
      alert(Object.values(data).flat().join("\n") || "Upload failed");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this saved CSV?")) return;
    await apiFetch(`/api/saved-csvs/${id}/`, { method: "DELETE" });
    fetchCsvs();
  };

  const handleScan = async (id: number) => {
    setScanning(prev => ({ ...prev, [id]: true }));
    try {
      const res = await apiFetch("/api/campaigns/scan-csv/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedCsvId: id, gravatar: checkGravatar }),
      });
      if (res.ok) {
        const data = await res.json();
        setScanData(prev => ({ ...prev, [id]: data }));
      } else {
        const err = await res.json();
        alert(err.error || "Scan failed");
      }
    } catch (err) {
      console.error(err);
      alert("Scan failed");
    } finally {
      setScanning(prev => ({ ...prev, [id]: false }));
    }
  };

  const clearScan = (id: number) => {
    setScanData(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const removeEmails = async (id: number, emails: string[]) => {
    if (!emails.length) return;
    if (!confirm(`Remove ${emails.length} email(s) from this CSV?`)) return;
    const res = await apiFetch(`/api/saved-csvs/${id}/clean/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove_emails: emails }),
    });
    if (res.ok) {
      clearScan(id);
      fetchCsvs();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to clean CSV");
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading saved CSVs...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-serif text-white flex items-center gap-3">
          <Database className="w-6 h-6 text-[#00ffff]" /> Saved CSVs
        </h2>
        <button
          onClick={() => { setIsUploading(true); setNewName(""); setNewFile(null); }}
          className="bg-[#00ffff] hover:bg-[#33ffff] text-black font-semibold rounded-full px-5 py-2.5 text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(0,255,255,0.25)] hover:shadow-[0_0_28px_rgba(0,255,255,0.4)] cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" /> Upload CSV
        </button>
      </div>

      {isUploading && (
        <div className="skeuo-card p-8">
          <h3 className="text-xl font-bold mb-6 skeuo-text">Upload New CSV</h3>
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Name (Reference)</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full skeuo-input py-3 px-4"
                placeholder="e.g., Q3 Leads"
                required
              />
            </div>
            <div className="skeuo-inset-box p-12 text-center relative cursor-pointer border-dashed border-2">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                required
              />
              <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3 drop-shadow-sm" />
              <p className="font-bold skeuo-text">
                {newFile ? newFile.name : "Click to select CSV file"}
              </p>
              {newFile && (
                <p className="text-xs text-gray-500 mt-1 font-medium">{(newFile.size / 1024).toFixed(1)} KB</p>
              )}
            </div>
            <div className="flex justify-end gap-4">
              <button type="button" onClick={() => setIsUploading(false)} className="bg-[#111111] hover:bg-[#1a1a1a] text-[#888888] hover:text-white px-5 py-2.5 rounded-none text-xs font-semibold border border-[#222222] transition-all cursor-pointer">
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#19b3d2] hover:bg-[#20c4e6] text-black font-semibold rounded-none px-7 py-2.5 text-xs flex items-center gap-2 transition-all cursor-pointer border border-[#1499b4]"
              >
                <Save className="w-4 h-4" /> Upload & Save
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {csvs.map((csv) => (
          <div key={csv.id} className="skeuo-card p-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [csv.id]: !prev[csv.id] }))}
                className="flex items-center gap-3 flex-1 text-left"
              >
                {expanded[csv.id] ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}
                <FileText className="w-5 h-5 text-blue-600 drop-shadow-sm" />
                <h3 className="font-bold text-lg skeuo-text">{csv.name}</h3>
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {csv.row_count} rows
                </span>
              </button>
              <button onClick={() => handleDelete(csv.id)} className="p-2 skeuo-btn-danger">
                <Trash2 className="w-4 h-4 drop-shadow-sm" />
              </button>
            </div>

            {expanded[csv.id] && (
              <div className="mt-4 space-y-4">
                <div className="skeuo-inset-box p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Columns</p>
                  <div className="flex flex-wrap gap-2">
                    {csv.columns.map((col) => (
                      <span key={col} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-mono font-bold rounded border border-blue-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.1)]">
                        {col}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Uploaded {new Date(csv.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-4 skeuo-inset-box p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkGravatar}
                      onChange={(e) => setCheckGravatar(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-gray-700 skeuo-text">Check Gravatar</span>
                  </label>
                  <button
                    onClick={() => handleScan(csv.id)}
                    disabled={scanning[csv.id]}
                    className="skeuo-btn-primary px-4 py-2 text-sm font-bold flex items-center gap-2"
                  >
                    {scanning[csv.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {scanning[csv.id] ? "Scanning..." : "Validate CSV"}
                  </button>
                  {scanData[csv.id] && (
                    <button onClick={() => clearScan(csv.id)} className="skeuo-btn px-3 py-2 text-sm font-bold">
                      Clear
                    </button>
                  )}
                </div>

                {scanData[csv.id] && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex flex-wrap gap-4 text-sm font-bold">
                      <span className="flex items-center gap-1 text-green-700">
                        <CheckCircle className="w-4 h-4" /> {scanData[csv.id].stats.valid} Safe
                      </span>
                      {scanData[csv.id].stats.gravatar > 0 && (
                        <span className="flex items-center gap-1 text-purple-600">
                          <CheckCircle className="w-4 h-4" /> {scanData[csv.id].stats.gravatar} Gravatar
                        </span>
                      )}
                      {scanData[csv.id].stats.disposable > 0 && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <AlertCircle className="w-4 h-4" /> {scanData[csv.id].stats.disposable} Disposable
                        </span>
                      )}
                      {scanData[csv.id].stats.bounced > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <X className="w-4 h-4" /> {scanData[csv.id].stats.bounced} Bounced
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-red-600">
                        <X className="w-4 h-4" /> {scanData[csv.id].stats.invalid} Invalid
                      </span>
                    </div>

                    {scanData[csv.id].results.filter((r: any) => !r.valid).length > 0 && (
                      <div className="skeuo-card p-4">
                        <h4 className="font-bold text-sm skeuo-text text-red-600 mb-2">Invalid ({scanData[csv.id].stats.invalid})</h4>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {scanData[csv.id].results.filter((r: any) => !r.valid).map((r: any, i: number) => (
                            <div key={i} className="text-xs flex items-center gap-2 p-1.5 rounded bg-red-50 text-red-700 font-medium">
                              <X className="w-3 h-3 shrink-0" />
                              <span className="truncate flex-1">{r.email} <span className="text-red-500">— {r.reason}</span></span>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => removeEmails(csv.id, scanData[csv.id].results.filter((r: any) => !r.valid).map((r: any) => r.email))} className="mt-3 skeuo-btn-danger px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                          <Trash2 className="w-3 h-3" /> Remove All Invalid
                        </button>
                      </div>
                    )}

                    {scanData[csv.id].results.filter((r: any) => r.flags.includes("bounced") && r.valid).length > 0 && (
                      <div className="skeuo-card p-4">
                        <h4 className="font-bold text-sm skeuo-text text-blue-600 mb-2">Previously Bounced ({scanData[csv.id].stats.bounced})</h4>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {scanData[csv.id].results.filter((r: any) => r.flags.includes("bounced") && r.valid).map((r: any, i: number) => (
                            <div key={i} className="text-xs flex items-center gap-2 p-1.5 rounded bg-blue-50 text-blue-700 font-medium">
                              <X className="w-3 h-3 shrink-0" />
                              <span className="truncate flex-1">{r.email} <span className="text-blue-500">(bounced {r.bounce_count}x)</span></span>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => removeEmails(csv.id, scanData[csv.id].results.filter((r: any) => r.flags.includes("bounced") && r.valid).map((r: any) => r.email))} className="mt-3 skeuo-btn px-3 py-1.5 text-xs font-bold flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg">
                          <Trash2 className="w-3 h-3" /> Remove All Bounced
                        </button>
                      </div>
                    )}

                    {scanData[csv.id].results.filter((r: any) => r.flags.includes("disposable")).length > 0 && (
                      <div className="skeuo-card p-4">
                        <h4 className="font-bold text-sm skeuo-text text-orange-600 mb-2">Disposable ({scanData[csv.id].stats.disposable})</h4>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {scanData[csv.id].results.filter((r: any) => r.flags.includes("disposable")).map((r: any, i: number) => (
                            <div key={i} className="text-xs flex items-center gap-2 p-1.5 rounded bg-orange-50 text-orange-700 font-medium">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span className="truncate flex-1">{r.email} <span className="text-orange-500">— {r.warning}</span></span>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => removeEmails(csv.id, scanData[csv.id].results.filter((r: any) => r.flags.includes("disposable")).map((r: any) => r.email))} className="mt-3 skeuo-btn px-3 py-1.5 text-xs font-bold flex items-center gap-1 bg-orange-600 text-white hover:bg-orange-700 rounded-lg">
                          <Trash2 className="w-3 h-3" /> Remove All Disposable
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {csvs.length === 0 && !isUploading && (
          <div className="text-center py-12 text-gray-500 skeuo-inset-box font-bold">
            No saved CSVs yet. Upload one to reuse across campaigns!
          </div>
        )}
      </div>
    </div>
  );
}
