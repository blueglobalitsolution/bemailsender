import React, { useState, useEffect } from "react";
import { Database, Upload, Save, Trash2, FileText, ChevronDown, ChevronRight, Shield, Loader2, CheckCircle, X, AlertCircle, Edit3, Plus, Search, Check, RefreshCw } from "lucide-react";
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

  // CSV Editor State
  const [editingCsvId, setEditingCsvId] = useState<number | null>(null);
  const [editingCsvName, setEditingCsvName] = useState<string>("");
  const [editorHeaders, setEditorHeaders] = useState<string[]>([]);
  const [editorRows, setEditorRows] = useState<Record<string, string>[]>([]);
  const [editorSearch, setEditorSearch] = useState<string>("");
  const [loadingEditor, setLoadingEditor] = useState<boolean>(false);
  const [savingEditor, setSavingEditor] = useState<boolean>(false);
  const [editorSavedMsg, setEditorSavedMsg] = useState<boolean>(false);

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
    if (editingCsvId === id) setEditingCsvId(null);
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
      if (editingCsvId === id) openEditor(id);
    } else {
      const err = await res.json();
      alert(err.error || "Failed to clean CSV");
    }
  };

  // CSV Parser & Serializer helpers
  const parseCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });
      rows.push(row);
    }

    return { headers, rows };
  };

  const serializeToCsv = (headers: string[], rows: Record<string, string>[]): string => {
    const escapeCell = (val: string) => {
      const str = val === undefined || val === null ? "" : String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.map(escapeCell).join(",");
    const rowLines = rows.map(r => headers.map(h => escapeCell(r[h] || "")).join(","));
    return [headerLine, ...rowLines].join("\n");
  };

  // Editor Actions
  const openEditor = async (id: number) => {
    setEditingCsvId(id);
    setLoadingEditor(true);
    setEditorSearch("");
    try {
      const res = await apiFetch(`/api/saved-csvs/${id}/content/`);
      if (res.ok) {
        const data = await res.json();
        setEditingCsvName(data.name);
        const { headers, rows } = parseCsvText(data.csv_content || "");
        setEditorHeaders(headers);
        setEditorRows(rows);
      } else {
        alert("Failed to load CSV content");
        setEditingCsvId(null);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load CSV content");
      setEditingCsvId(null);
    } finally {
      setLoadingEditor(false);
    }
  };

  const handleCellChange = (rowIndex: number, header: string, value: string) => {
    setEditorRows(prev => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [header]: value };
      return updated;
    });
  };

  const handleAddRow = () => {
    const newRow: Record<string, string> = {};
    editorHeaders.forEach(h => { newRow[h] = ""; });
    setEditorRows(prev => [newRow, ...prev]);
  };

  const handleDeleteRow = (index: number) => {
    setEditorRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddColumn = () => {
    const colName = prompt("Enter new column name:");
    if (!colName || !colName.trim()) return;
    const cleanName = colName.trim().toUpperCase();
    if (editorHeaders.includes(cleanName)) {
      alert("Column already exists");
      return;
    }
    setEditorHeaders(prev => [...prev, cleanName]);
    setEditorRows(prev => prev.map(r => ({ ...r, [cleanName]: "" })));
  };

  const handleDeleteColumn = (headerToDelete: string) => {
    if (editorHeaders.length <= 1) {
      alert("CSV must have at least one column");
      return;
    }
    if (!confirm(`Are you sure you want to delete column "${headerToDelete}"?`)) return;
    setEditorHeaders(prev => prev.filter(h => h !== headerToDelete));
    setEditorRows(prev => prev.map(r => {
      const copy = { ...r };
      delete copy[headerToDelete];
      return copy;
    }));
  };

  const handleSaveEditor = async () => {
    if (!editingCsvId) return;
    setSavingEditor(true);
    try {
      const updatedCsvText = serializeToCsv(editorHeaders, editorRows);
      const res = await apiFetch(`/api/saved-csvs/${editingCsvId}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingCsvName,
          csv_content: updatedCsvText,
        }),
      });

      if (res.ok) {
        setEditorSavedMsg(true);
        setTimeout(() => setEditorSavedMsg(false), 3000);
        fetchCsvs();
      } else {
        const data = await res.json();
        alert(Object.values(data).flat().join("\n") || "Failed to save CSV");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving CSV");
    } finally {
      setSavingEditor(false);
    }
  };

  // Filtered rows for editor search
  const filteredEditorRows = editorRows.map((row, originalIndex) => ({ row, originalIndex })).filter(({ row }) => {
    if (!editorSearch.trim()) return true;
    const query = editorSearch.toLowerCase();
    return Object.values(row).some(val => String(val).toLowerCase().includes(query));
  });

  if (loading) return <div className="text-center py-12 text-gray-500 font-mono">Loading saved CSVs...</div>;

  return (
    <div className="space-y-8 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Database className="w-6 h-6 text-[#00ffff]" /> Saved CSVs & Contact Editor
          </h2>
          <p className="text-xs text-[#888888] mt-1 font-mono">
            Manage, edit, validate, and clean your contact database directly.
          </p>
        </div>
        <button
          onClick={() => { setIsUploading(true); setNewName(""); setNewFile(null); }}
          className="bg-[#00ffff] hover:bg-[#33ffff] text-black font-semibold rounded-none px-5 py-2.5 text-xs flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(0,255,255,0.25)] hover:shadow-[0_0_28px_rgba(0,255,255,0.4)] cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" /> Upload CSV
        </button>
      </div>

      {/* Upload Modal / Form */}
      {isUploading && (
        <div className="skeuo-card p-8 border border-[#00ffff]/30 shadow-[0_0_24px_rgba(0,255,255,0.08)]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold skeuo-text">Upload New CSV</h3>
            <button onClick={() => setIsUploading(false)} className="text-xs text-[#888888] hover:text-white">✕ Close</button>
          </div>
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Name (Reference)</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full skeuo-input py-3 px-4"
                placeholder="e.g., Q3 Dentist Leads"
                required
              />
            </div>
            <div className="skeuo-inset-box p-10 text-center relative cursor-pointer border-dashed border-2 border-[#222222] hover:border-[#00ffff]/40 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                required
              />
              <Upload className="w-8 h-8 text-[#00ffff] mx-auto mb-2 opacity-80" />
              <p className="font-bold text-sm text-white">
                {newFile ? newFile.name : "Click to select plain CSV file"}
              </p>
              {newFile && (
                <p className="text-xs text-[#00ffff] mt-1 font-mono">{(newFile.size / 1024).toFixed(1)} KB</p>
              )}
            </div>
            <div className="flex justify-end gap-4">
              <button type="button" onClick={() => setIsUploading(false)} className="bg-[#111111] hover:bg-[#1a1a1a] text-[#888888] hover:text-white px-5 py-2.5 rounded-none text-xs font-semibold border border-[#222222] transition-all cursor-pointer">
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#00ffff] hover:bg-[#33ffff] text-black font-semibold rounded-none px-7 py-2.5 text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" /> Upload & Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CSV Spreadsheet Editor Modal / Full View */}
      {editingCsvId !== null && (
        <div className="skeuo-card p-6 border border-[#00ffff]/40 shadow-[0_0_30px_rgba(0,255,255,0.12)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#1f1f23]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#00ffff]/10 border border-[#00ffff]/30">
                <Edit3 className="w-5 h-5 text-[#00ffff]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingCsvName}
                    onChange={(e) => setEditingCsvName(e.target.value)}
                    className="text-lg font-bold bg-[#09090b] border border-[#222222] focus:border-[#00ffff] px-2.5 py-1 text-white tracking-wide outline-none font-mono"
                  />
                  <span className="text-xs font-mono text-[#00ffff] bg-[#00ffff]/10 border border-[#00ffff]/20 px-2 py-1">
                    {editorRows.length} Contacts
                  </span>
                </div>
                <p className="text-[11px] text-[#777777] font-mono mt-1">
                  Click on any cell to edit contact details directly.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={editorSearch}
                  onChange={(e) => setEditorSearch(e.target.value)}
                  className="bg-[#050505] border border-[#1e1e1e] focus:border-[#00ffff] text-xs text-white pl-8 pr-3 py-2 outline-none font-mono w-48 lg:w-64"
                />
              </div>

              <button
                onClick={handleAddRow}
                className="bg-[#111111] hover:bg-[#1a1a1a] text-white border border-[#262626] hover:border-[#00ffff]/50 text-xs font-mono px-3.5 py-2 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#00ffff]" /> + Add Row
              </button>

              <button
                onClick={handleAddColumn}
                className="bg-[#111111] hover:bg-[#1a1a1a] text-white border border-[#262626] hover:border-[#00ffff]/50 text-xs font-mono px-3.5 py-2 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#00ffff]" /> + Add Column
              </button>

              <button
                onClick={handleSaveEditor}
                disabled={savingEditor}
                className="bg-[#00ffff] hover:bg-[#33ffff] text-black font-bold text-xs px-6 py-2 flex items-center gap-1.5 transition-all shadow-[0_0_16px_rgba(0,255,255,0.3)] cursor-pointer disabled:opacity-50"
              >
                {savingEditor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {savingEditor ? "Saving..." : "Save CSV"}
              </button>

              <button
                onClick={() => setEditingCsvId(null)}
                className="bg-[#141414] hover:bg-[#202020] text-[#888888] hover:text-white border border-[#222222] text-xs px-3.5 py-2 cursor-pointer transition-all"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {editorSavedMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-4 py-2 mt-4 flex items-center gap-2 font-mono animate-in fade-in">
              <Check className="w-4 h-4" /> CSV successfully saved to database.
            </div>
          )}

          {loadingEditor ? (
            <div className="py-20 text-center text-xs font-mono text-[#777777] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#00ffff]" /> Loading contact sheet...
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto max-h-[550px] border border-[#1f1f23] bg-[#050505] scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="sticky top-0 bg-[#0c0c0e] border-b border-[#1f1f23] z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-[10px] uppercase text-[#666666] border-r border-[#1a1a1e] w-14 text-center">Action</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase text-[#666666] border-r border-[#1a1a1e] w-12 text-center">#</th>
                    {editorHeaders.map((header) => (
                      <th key={header} className="py-2.5 px-3 text-[11px] uppercase tracking-wider text-[#00ffff] font-bold border-r border-[#1a1a1e] whitespace-nowrap">
                        <div className="flex items-center justify-between gap-2">
                          <span>{header}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteColumn(header)}
                            title={`Delete "${header}" column`}
                            className="text-[#666666] hover:text-rose-400 p-0.5 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141417]">
                  {filteredEditorRows.map(({ row, originalIndex }, idx) => (
                    <tr key={originalIndex} className="hover:bg-[#0a0a0d] group transition-colors">
                      <td className="py-1.5 px-2 text-center border-r border-[#141417] bg-[#070709]">
                        <button
                          onClick={() => handleDeleteRow(originalIndex)}
                          title="Delete Row"
                          className="px-1.5 py-0.5 text-xs text-[#666666] hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 rounded transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                      <td className="py-2 px-3 text-[10px] text-[#555555] text-center border-r border-[#141417] select-none">
                        {originalIndex + 1}
                      </td>
                      {editorHeaders.map((header) => (
                        <td key={header} className="p-0 border-r border-[#141417] min-w-[140px]">
                          <input
                            type="text"
                            value={row[header] || ""}
                            onChange={(e) => handleCellChange(originalIndex, header, e.target.value)}
                            className="w-full bg-transparent px-3 py-2 text-xs text-[#cccccc] focus:text-white focus:bg-[#0c0c12] focus:outline-none focus:ring-1 focus:ring-[#00ffff]/50 border-none font-mono"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {filteredEditorRows.length === 0 && (
                    <tr>
                      <td colSpan={editorHeaders.length + 2} className="py-12 text-center text-xs text-[#555555]">
                        {editorSearch ? "No contacts matching search query." : "No contact rows found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CSV List Cards */}
      <div className="space-y-4">
        {csvs.map((csv) => (
          <div key={csv.id} className="skeuo-card p-6 border border-[#1e1e1e] hover:border-[#2a2a2a] transition-all">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [csv.id]: !prev[csv.id] }))}
                className="flex items-center gap-3 flex-1 text-left cursor-pointer min-w-[200px]"
              >
                {expanded[csv.id] ? (
                  <ChevronDown className="w-5 h-5 text-[#00ffff]" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-[#666666]" />
                )}
                <FileText className="w-5 h-5 text-[#00ffff] drop-shadow-sm shrink-0" />
                <h3 className="font-bold text-base text-white tracking-wide">{csv.name}</h3>
                <span className="text-[11px] font-mono font-bold text-[#00ffff] bg-[#00ffff]/10 border border-[#00ffff]/20 px-2.5 py-0.5">
                  {csv.row_count} rows
                </span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditor(csv.id)}
                  title="Open in Spreadsheet Editor"
                  className="px-3 py-1.5 bg-[#111111] hover:bg-[#1a1a1a] text-[#cccccc] hover:text-[#00ffff] border border-[#222222] hover:border-[#00ffff]/40 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#00ffff]" /> Edit Contacts
                </button>
                <button 
                  onClick={() => handleDelete(csv.id)} 
                  title="Delete CSV"
                  className="p-2 skeuo-btn-danger rounded-none cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 drop-shadow-sm" />
                </button>
              </div>
            </div>

            {expanded[csv.id] && (
              <div className="mt-5 space-y-4 pt-4 border-t border-[#1a1a1a]">
                <div className="skeuo-inset-box p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 skeuo-text">Columns</p>
                  <div className="flex flex-wrap gap-2">
                    {csv.columns.map((col) => (
                      <span key={col} className="px-2.5 py-1 bg-[#00ffff]/10 text-[#00ffff] text-xs font-mono font-bold border border-[#00ffff]/20">
                        {col}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-3 font-mono">
                    Uploaded {new Date(csv.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-4 skeuo-inset-box p-3 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkGravatar}
                      onChange={(e) => setCheckGravatar(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-700 bg-black text-[#00ffff] focus:ring-[#00ffff]"
                    />
                    <span className="text-xs font-bold text-gray-400 skeuo-text">Check Gravatar</span>
                  </label>
                  <button
                    onClick={() => handleScan(csv.id)}
                    disabled={scanning[csv.id]}
                    className="skeuo-btn-primary px-4 py-2 text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    {scanning[csv.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                    {scanning[csv.id] ? "Scanning..." : "Validate CSV"}
                  </button>
                  {scanData[csv.id] && (
                    <button onClick={() => clearScan(csv.id)} className="skeuo-btn px-3 py-2 text-xs font-bold cursor-pointer">
                      Clear Scan
                    </button>
                  )}
                </div>

                {scanData[csv.id] && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex flex-wrap gap-4 text-xs font-mono font-bold">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="w-4 h-4" /> {scanData[csv.id].stats.valid} Safe
                      </span>
                      {scanData[csv.id].stats.gravatar > 0 && (
                        <span className="flex items-center gap-1 text-purple-400">
                          <CheckCircle className="w-4 h-4" /> {scanData[csv.id].stats.gravatar} Gravatar
                        </span>
                      )}
                      {scanData[csv.id].stats.disposable > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <AlertCircle className="w-4 h-4" /> {scanData[csv.id].stats.disposable} Disposable
                        </span>
                      )}
                      {scanData[csv.id].stats.bounced > 0 && (
                        <span className="flex items-center gap-1 text-sky-400">
                          <X className="w-4 h-4" /> {scanData[csv.id].stats.bounced} Bounced
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-rose-400">
                        <X className="w-4 h-4" /> {scanData[csv.id].stats.invalid} Invalid
                      </span>
                    </div>

                    {scanData[csv.id].results.filter((r: any) => !r.valid).length > 0 && (
                      <div className="skeuo-card p-4 border border-rose-950/40">
                        <h4 className="font-bold text-xs font-mono text-rose-400 mb-2">Invalid ({scanData[csv.id].stats.invalid})</h4>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {scanData[csv.id].results.filter((r: any) => !r.valid).map((r: any, i: number) => (
                            <div key={i} className="text-xs font-mono flex items-center gap-2 p-1.5 bg-[#080505] border border-rose-950/50 text-rose-300">
                              <X className="w-3 h-3 shrink-0 text-rose-400" />
                              <span className="truncate flex-1">{r.email} <span className="text-rose-500">— {r.reason}</span></span>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => removeEmails(csv.id, scanData[csv.id].results.filter((r: any) => !r.valid).map((r: any) => r.email))} className="mt-3 skeuo-btn-danger px-3 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer">
                          <Trash2 className="w-3 h-3" /> Remove All Invalid
                        </button>
                      </div>
                    )}

                    {scanData[csv.id].results.filter((r: any) => r.flags.includes("bounced") && r.valid).length > 0 && (
                      <div className="skeuo-card p-4 border border-sky-950/40">
                        <h4 className="font-bold text-xs font-mono text-sky-400 mb-2">Previously Bounced ({scanData[csv.id].stats.bounced})</h4>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {scanData[csv.id].results.filter((r: any) => r.flags.includes("bounced") && r.valid).map((r: any, i: number) => (
                            <div key={i} className="text-xs font-mono flex items-center gap-2 p-1.5 bg-[#05080c] border border-sky-950/50 text-sky-300">
                              <X className="w-3 h-3 shrink-0 text-sky-400" />
                              <span className="truncate flex-1">{r.email} <span className="text-sky-500">(bounced {r.bounce_count}x)</span></span>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => removeEmails(csv.id, scanData[csv.id].results.filter((r: any) => r.flags.includes("bounced") && r.valid).map((r: any) => r.email))} className="mt-3 px-3 py-1.5 text-xs font-bold flex items-center gap-1 bg-sky-600/20 text-sky-400 border border-sky-500/40 hover:bg-sky-600/30 transition-all cursor-pointer">
                          <Trash2 className="w-3 h-3" /> Remove All Bounced
                        </button>
                      </div>
                    )}

                    {scanData[csv.id].results.filter((r: any) => r.flags.includes("disposable")).length > 0 && (
                      <div className="skeuo-card p-4 border border-amber-950/40">
                        <h4 className="font-bold text-xs font-mono text-amber-400 mb-2">Disposable ({scanData[csv.id].stats.disposable})</h4>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {scanData[csv.id].results.filter((r: any) => r.flags.includes("disposable")).map((r: any, i: number) => (
                            <div key={i} className="text-xs font-mono flex items-center gap-2 p-1.5 bg-[#0a0704] border border-amber-950/50 text-amber-300">
                              <AlertCircle className="w-3 h-3 shrink-0 text-amber-400" />
                              <span className="truncate flex-1">{r.email} <span className="text-amber-500">— {r.warning}</span></span>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => removeEmails(csv.id, scanData[csv.id].results.filter((r: any) => r.flags.includes("disposable")).map((r: any) => r.email))} className="mt-3 px-3 py-1.5 text-xs font-bold flex items-center gap-1 bg-amber-600/20 text-amber-400 border border-amber-500/40 hover:bg-amber-600/30 transition-all cursor-pointer">
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
