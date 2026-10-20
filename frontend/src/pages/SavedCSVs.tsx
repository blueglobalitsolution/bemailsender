import React, { useState, useEffect, useMemo } from "react";
import {
  Database,
  Upload,
  Save,
  Trash2,
  FileText,
  ChevronDown,
  ChevronRight,
  Shield,
  Loader2,
  CheckCircle,
  X,
  AlertCircle,
  Edit3,
  Plus,
  Search,
  Check,
  RefreshCw,
  UserPlus,
  Download,
  ChevronLeft,
  Filter,
  CheckCircle2,
  Layers,
  UserX,
  Ban,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../components/Toast";

interface SavedCsv {
  id: number;
  name: string;
  columns: string[];
  row_count: number;
  created_at: string;
}

export default function SavedCSVs() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'lists' | 'suppression'>('lists');
  const [csvs, setCsvs] = useState<SavedCsv[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Selected List
  const [activeCsvId, setActiveCsvId] = useState<number | null>(null);
  const [activeCsvName, setActiveCsvName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loadingTable, setLoadingTable] = useState<boolean>(false);
  const [savingTable, setSavingTable] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Upload CSV Modal
  const [isUploading, setIsUploading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);

  // Suppression State
  const [suppressions, setSuppressions] = useState<any[]>([]);
  const [loadingSuppressions, setLoadingSuppressions] = useState(false);
  const [suppressionSearch, setSuppressionSearch] = useState("");
  const [isAddingSuppression, setIsAddingSuppression] = useState(false);
  const [suppressionEmailInput, setSuppressionEmailInput] = useState("");
  const [suppressionReasonInput, setSuppressionReasonInput] = useState("unsubscribed");

  // Quick Add Contact Modal
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactCompany, setContactCompany] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  // Validate / Scan State
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [checkGravatar, setCheckGravatar] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const fetchSuppressions = async () => {
    try {
      setLoadingSuppressions(true);
      const res = await apiFetch("/api/suppressions/");
      if (res.ok) {
        setSuppressions(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSuppressions(false);
    }
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppressionEmailInput.trim()) {
      toast.warning("Email is required");
      return;
    }
    try {
      const res = await apiFetch("/api/suppressions/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: suppressionEmailInput.trim().toLowerCase(),
          reason: suppressionReasonInput,
        }),
      });
      if (res.ok) {
        toast.success("Address added to suppression list.");
        setSuppressionEmailInput("");
        setIsAddingSuppression(false);
        fetchSuppressions();
      } else {
        const err = await res.json();
        toast.error(err.email?.[0] || err.error || "Failed to add suppression");
      }
    } catch (err) {
      toast.error("Error adding to suppression list");
    }
  };

  const handleDeleteSuppression = (id: number, email: string) => {
    toast.confirm(`Remove ${email} from suppression list?`, async () => {
      try {
        const res = await apiFetch(`/api/suppressions/${id}/`, {
          method: "DELETE",
        });
        if (res.ok) {
          toast.success("Removed from suppression list.");
          fetchSuppressions();
        } else {
          toast.error("Failed to remove suppression.");
        }
      } catch (err) {
        toast.error("Network error removing suppression.");
      }
    });
  };

  // Fetch all CSV lists
  const fetchCsvs = async (targetSelectId?: number) => {
    try {
      const res = await apiFetch("/api/saved-csvs/");
      if (res.ok) {
        const data: SavedCsv[] = await res.json();
        setCsvs(data);

        if (data.length > 0) {
          const nextId = targetSelectId ?? (activeCsvId && data.some(c => c.id === activeCsvId) ? activeCsvId : data[0].id);
          selectCsv(nextId);
        } else {
          setActiveCsvId(null);
          setHeaders([]);
          setRows([]);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load lead lists");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const sampleHeaders = ["email", "first_name", "last_name", "company", "title", "website"];
    const sampleRows = [
      ["alex.johnson@example.com", "Alex", "Johnson", "Acme Corp", "Head of Growth", "https://example.com"],
      ["sarah.miller@techcorp.io", "Sarah", "Miller", "TechCorp Solutions", "VP Sales", "https://techcorp.io"],
      ["david.smith@innovate.co", "David", "Smith", "Innovate Digital", "Founder & CEO", "https://innovate.co"],
      ["emma.watson@growthwave.com", "Emma", "Watson", "GrowthWave Media", "Marketing Director", "https://growthwave.com"],
    ];

    const escapeCell = (val: string) => {
      const str = String(val ?? "");
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      sampleHeaders.join(","),
      ...sampleRows.map(r => r.map(escapeCell).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_leads_format.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Sample CSV format template downloaded!");
  };

  useEffect(() => {
    fetchCsvs();
    fetchSuppressions();

    const handleOpenAddContact = () => {
      setIsAddingContact(true);
      setIsUploading(false);
      resetAddContactForm();
    };

    const handleOpenUploadCsv = () => {
      setIsUploading(true);
      setIsAddingContact(false);
      setNewName("");
      setNewFile(null);
    };

    const handleDownloadSample = () => {
      handleDownloadSampleCsv();
    };

    window.addEventListener("open-add-contact-modal", handleOpenAddContact);
    window.addEventListener("open-upload-csv-modal", handleOpenUploadCsv);
    window.addEventListener("download-sample-csv", handleDownloadSample);

    return () => {
      window.removeEventListener("open-add-contact-modal", handleOpenAddContact);
      window.removeEventListener("open-upload-csv-modal", handleOpenUploadCsv);
      window.removeEventListener("download-sample-csv", handleDownloadSample);
    };
  }, []);

  const selectCsv = async (id: number) => {
    setActiveCsvId(id);
    setLoadingTable(true);
    setSearchQuery("");
    setCurrentPage(1);
    setHasUnsavedChanges(false);
    setScanResult(null);

    try {
      const res = await apiFetch(`/api/saved-csvs/${id}/content/`);
      if (res.ok) {
        const data = await res.json();
        setActiveCsvName(data.name || "");
        const parsed = parseCsvText(data.csv_content || "");
        setHeaders(parsed.headers);
        setRows(parsed.rows);
      } else {
        toast.error("Failed to load contacts for this list");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading contact rows");
    } finally {
      setLoadingTable(false);
    }
  };

  // CSV Text Parser
  const parseCsvText = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (!lines.length) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          result.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseLine(lines[0]).map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const vals = parseLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = vals[idx] !== undefined ? vals[idx] : "";
      });
      return row;
    });

    return { headers, rows };
  };

  // CSV Serializer
  const serializeToCsv = (cols: string[], dataRows: Record<string, string>[]): string => {
    const escapeCell = (val: string) => {
      const str = String(val ?? "");
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = cols.map(escapeCell).join(",");
    const rowLines = dataRows.map(r => cols.map(h => escapeCell(r[h] || "")).join(","));
    return [headerLine, ...rowLines].join("\n");
  };

  // Cell Change handler
  const handleCellChange = (rowIndex: number, header: string, value: string) => {
    setRows(prev => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [header]: value };
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  // Add row directly to table
  const handleAddRow = () => {
    const newRow: Record<string, string> = {};
    headers.forEach(h => { newRow[h] = ""; });
    setRows(prev => [newRow, ...prev]);
    setHasUnsavedChanges(true);
    setCurrentPage(1);
    toast.info("Added new blank contact row at the top.");
  };

  // Delete row directly
  const handleDeleteRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  // Add Column
  const handleAddColumn = () => {
    const colName = prompt("Enter new column name (e.g. phone, job_title, linkedin):");
    if (!colName || !colName.trim()) return;
    const cleanName = colName.trim().toLowerCase();
    if (headers.some(h => h.toLowerCase() === cleanName)) {
      toast.warning("Column already exists");
      return;
    }
    setHeaders(prev => [...prev, cleanName]);
    setRows(prev => prev.map(r => ({ ...r, [cleanName]: "" })));
    setHasUnsavedChanges(true);
    toast.success(`Added column "${cleanName}"`);
  };

  // Delete Column
  const handleDeleteColumn = (headerToDelete: string) => {
    if (headers.length <= 1) {
      toast.warning("Table must have at least one column");
      return;
    }
    toast.confirm(`Are you sure you want to delete column "${headerToDelete}"?`, () => {
      setHeaders(prev => prev.filter(h => h !== headerToDelete));
      setRows(prev => prev.map(r => {
        const copy = { ...r };
        delete copy[headerToDelete];
        return copy;
      }));
      setHasUnsavedChanges(true);
      toast.success(`Deleted column "${headerToDelete}".`);
    });
  };

  // Save changes to backend
  const handleSaveChanges = async () => {
    if (!activeCsvId) return;
    setSavingTable(true);
    try {
      const updatedCsvText = serializeToCsv(headers, rows);
      const res = await apiFetch(`/api/saved-csvs/${activeCsvId}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: activeCsvName,
          csv_content: updatedCsvText,
        }),
      });

      if (res.ok) {
        toast.success("Contacts saved successfully!");
        setHasUnsavedChanges(false);
        // Refresh list row counts
        const updatedList = await apiFetch("/api/saved-csvs/");
        if (updatedList.ok) setCsvs(await updatedList.json());
      } else {
        const data = await res.json();
        toast.error(Object.values(data).flat().join("\n") || "Failed to save contacts");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error while saving contacts");
    } finally {
      setSavingTable(false);
    }
  };

  // Download CSV
  const handleDownloadCsv = () => {
    if (!activeCsvId || !rows.length) {
      toast.warning("No contacts to download");
      return;
    }
    const csvContent = serializeToCsv(headers, rows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeCsvName || "leads"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV download started.");
  };

  // Delete List
  const handleDeleteList = (id: number) => {
    toast.confirm("Are you sure you want to delete this entire contact list?", async () => {
      try {
        const res = await apiFetch(`/api/saved-csvs/${id}/`, { method: "DELETE" });
        if (res.ok) {
          toast.success("Contact list deleted.");
          fetchCsvs();
        } else {
          toast.error("Failed to delete contact list.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Network error deleting list.");
      }
    });
  };

  // Validate CSV scan
  const handleScan = async () => {
    if (!activeCsvId) return;
    setScanning(true);
    try {
      const res = await apiFetch("/api/campaigns/scan-csv/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedCsvId: activeCsvId, gravatar: checkGravatar }),
      });
      if (res.ok) {
        const data = await res.json();
        setScanResult(data);
        toast.success("Scan completed successfully.");
      } else {
        const err = await res.json();
        toast.error(err.error || "Scan failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Scan failed");
    } finally {
      setScanning(false);
    }
  };

  // Remove invalid emails from CSV
  const removeEmails = async (emails: string[]) => {
    if (!activeCsvId || !emails.length) return;
    toast.confirm(`Remove ${emails.length} invalid email(s) from this list?`, async () => {
      try {
        const res = await apiFetch(`/api/saved-csvs/${activeCsvId}/clean/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remove_emails: emails }),
        });
        if (res.ok) {
          toast.success(`Removed ${emails.length} email(s).`);
          setScanResult(null);
          selectCsv(activeCsvId);
        } else {
          const err = await res.json();
          toast.error(err.error || "Failed to clean CSV");
        }
      } catch (err) {
        console.error(err);
        toast.error("Network error while cleaning CSV.");
      }
    });
  };

  // Upload new CSV
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
      const created = await res.json();
      setIsUploading(false);
      setNewName("");
      setNewFile(null);
      toast.success("CSV uploaded successfully.");
      fetchCsvs(created.id);
    } else {
      const data = await res.json();
      toast.error(Object.values(data).flat().join("\n") || "Upload failed");
    }
  };

  // Quick Add Contact modal
  const handleQuickAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail.trim()) {
      toast.warning("Email is required");
      return;
    }

    setSavingContact(true);
    try {
      if (csvs.length === 0 || !activeCsvId) {
        const initialHeaders = ["email", "first_name", "last_name", "company"];
        const row = [contactEmail.trim(), contactName.trim(), "", contactCompany.trim()];
        const csvContent = `${initialHeaders.join(",")}\n${row.map(c => `"${c.replace(/"/g, '""')}"`).join(",")}`;

        const res = await apiFetch("/api/saved-csvs/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Contact List", csv_content: csvContent }),
        });

        if (res.ok) {
          toast.success("Contact added to new list.");
          setIsAddingContact(false);
          resetAddContactForm();
          const created = await res.json();
          fetchCsvs(created.id);
        } else {
          const err = await res.json();
          toast.error(Object.values(err).flat().join("\n") || "Failed to create contact");
        }
      } else {
        const emailCol = headers.find(h => ["email", "e-mail", "email_address", "recipient"].includes(h.toLowerCase())) || headers[0] || "email";
        const nameCol = headers.find(h => ["first_name", "name", "full_name", "contact_name"].includes(h.toLowerCase()));
        const companyCol = headers.find(h => ["company", "company_name", "business"].includes(h.toLowerCase()));

        const newRow: Record<string, string> = {};
        headers.forEach(h => { newRow[h] = ""; });
        newRow[emailCol] = contactEmail.trim();
        if (nameCol && contactName) newRow[nameCol] = contactName.trim();
        if (companyCol && contactCompany) newRow[companyCol] = contactCompany.trim();

        const updatedRows = [newRow, ...rows];
        setRows(updatedRows);
        setHasUnsavedChanges(true);

        const updatedCsvText = serializeToCsv(headers, updatedRows);
        await apiFetch(`/api/saved-csvs/${activeCsvId}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: activeCsvName,
            csv_content: updatedCsvText,
          }),
        });

        toast.success("Contact added and saved!");
        setIsAddingContact(false);
        resetAddContactForm();
        setHasUnsavedChanges(false);
        fetchCsvs(activeCsvId);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error adding contact");
    } finally {
      setSavingContact(false);
    }
  };

  const resetAddContactForm = () => {
    setContactEmail("");
    setContactName("");
    setContactCompany("");
  };

  // Filter & Pagination Calculations
  const filteredRowsWithIndices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => {
        if (!q) return true;
        return Object.values(row).some(val => String(val).toLowerCase().includes(q));
      });
  }, [rows, searchQuery]);

  const totalFiltered = filteredRowsWithIndices.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredRowsWithIndices.slice(start, start + pageSize);
  }, [filteredRowsWithIndices, safeCurrentPage, pageSize]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[#8E9BA8]">
        <Loader2 className="w-6 h-6 animate-spin text-white mb-2" />
        <span className="text-xs font-mono">Loading leads workspace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans pb-16">
      {/* Top Tab Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 bg-[#222930] border border-[#2C353D] rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('lists')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'lists'
                ? 'bg-white text-[#161B1F] shadow-sm'
                : 'text-[#8E9BA8] hover:text-white'
            }`}
          >
            Contact Lists ({csvs.length})
          </button>
          <button
            onClick={() => { setActiveTab('suppression'); fetchSuppressions(); }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === 'suppression'
                ? 'bg-white text-[#161B1F] shadow-sm'
                : 'text-[#8E9BA8] hover:text-white'
            }`}
          >
            Suppression & Unsubscribes ({suppressions.length})
          </button>
        </div>
      </div>

      {activeTab === 'lists' && (
        <>
          {/* Main Table Card */}
          {activeCsvId ? (
            <div className="bg-[#181E24] border border-[#2C353D] rounded-2xl shadow-xl flex flex-col overflow-hidden">
              {/* Table Toolbar Header */}
              <div className="p-4 sm:p-5 border-b border-[#2C353D] bg-[#1A1F26] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {csvs.length > 1 ? (
                  <div className="relative">
                    <select
                      value={activeCsvId || ""}
                      onChange={(e) => selectCsv(Number(e.target.value))}
                      className="bg-[#14181C] border border-[#2C353D] hover:border-white text-white text-xs font-bold rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none cursor-pointer"
                    >
                      {csvs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.row_count} contacts)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#8E9BA8] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={activeCsvName}
                    onChange={(e) => {
                      setActiveCsvName(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="bg-[#14181C] border border-[#2C353D] hover:border-white/50 focus:border-white text-white font-bold text-sm sm:text-base px-3 py-1.5 rounded-lg outline-none font-mono transition-all"
                    title="Click to rename list"
                  />
                )}
                <span className="text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg shrink-0">
                  {rows.length} Total Contacts
                </span>
              </div>
            </div>

            {/* Search, Add Row, Add Column, Save */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E9BA8]" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-[#14181C] border border-[#2C353D] focus:border-white text-xs text-white pl-8 pr-7 py-2 rounded-xl outline-none font-mono w-44 sm:w-56 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E9BA8] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Add Row Button */}
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-2 bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white border border-[#2C353D] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Add a new contact row"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Add Row</span>
              </button>

              {/* Add Column Button */}
              <button
                type="button"
                onClick={handleAddColumn}
                className="px-3 py-2 bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white border border-[#2C353D] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Add a new custom column"
              >
                <Plus className="w-3.5 h-3.5 text-purple-400" />
                <span>+ Column</span>
              </button>

              {/* Save Changes Button */}
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={savingTable || !hasUnsavedChanges}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                  hasUnsavedChanges
                    ? "bg-emerald-400 hover:bg-emerald-300 text-black shadow-emerald-500/20 ring-2 ring-emerald-400/40 animate-pulse"
                    : "bg-[#222930] text-[#8E9BA8] border border-[#2C353D] cursor-not-allowed opacity-60"
                }`}
                title="Save table changes to database"
              >
                {savingTable ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{hasUnsavedChanges ? "Save Changes *" : "Saved"}</span>
              </button>

              <div className="h-5 w-px bg-[#2C353D] mx-1 hidden sm:block" />

              {/* Validate CSV */}
              <button
                type="button"
                onClick={() => setIsValidationOpen(true)}
                className="px-3 py-2 bg-[#14181C] hover:bg-[#1E252D] text-[#CBD5E1] hover:text-white border border-[#2C353D] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Validate & Clean invalid emails"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Validate CSV</span>
              </button>

              {/* Export CSV */}
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="px-3 py-2 bg-[#14181C] hover:bg-[#1E252D] text-[#CBD5E1] hover:text-white border border-[#2C353D] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Export as CSV file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              {/* Delete List */}
              <button
                type="button"
                onClick={() => handleDeleteList(activeCsvId)}
                className="p-2 bg-[#14181C] hover:bg-rose-950/40 text-[#8E9BA8] hover:text-rose-400 border border-[#2C353D] hover:border-rose-900 rounded-xl text-xs transition-colors cursor-pointer"
                title="Delete this entire list"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Table Container */}
          {loadingTable ? (
            <div className="py-24 text-center text-xs font-mono text-[#8E9BA8] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-white" /> Loading contacts spreadsheet...
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] border-b border-[#2C353D] bg-[#14181C]">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="sticky top-0 bg-[#161B1F] border-b border-[#2C353D] z-10 shadow-sm">
                  <tr>
                    <th className="py-3 px-3 text-[10px] uppercase text-[#8E9BA8] border-r border-[#2C353D] w-12 text-center bg-[#161B1F]">
                      #
                    </th>
                    <th className="py-3 px-3 text-[10px] uppercase text-[#8E9BA8] border-r border-[#2C353D] w-14 text-center bg-[#161B1F]">
                      Action
                    </th>
                    {headers.map((header) => (
                      <th
                        key={header}
                        className="py-3 px-3.5 text-[11px] uppercase tracking-wider text-[#CBD5E1] font-bold border-r border-[#2C353D] whitespace-nowrap bg-[#161B1F]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white">{header}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteColumn(header)}
                            title={`Delete column "${header}"`}
                            className="text-[#8E9BA8] hover:text-rose-400 p-1 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#2C353D]/60">
                  {paginatedRows.map(({ row, originalIndex }) => (
                    <tr
                      key={originalIndex}
                      className="hover:bg-[#1A2026] group transition-colors"
                    >
                      {/* Row Index */}
                      <td className="py-2 px-2.5 text-center text-[#8E9BA8] border-r border-[#2C353D] font-mono text-[11px] bg-[#14181C]/50">
                        {originalIndex + 1}
                      </td>

                      {/* Row Action (Delete) */}
                      <td className="py-2 px-2.5 text-center border-r border-[#2C353D] bg-[#14181C]/50">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(originalIndex)}
                          title="Delete contact"
                          className="text-[#8E9BA8] hover:text-rose-400 p-1 hover:bg-rose-950/40 rounded transition-colors cursor-pointer opacity-60 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>

                      {/* Editable Cells */}
                      {headers.map((header) => (
                        <td
                          key={header}
                          className="p-1 border-r border-[#2C353D]/50 focus-within:bg-[#1E252D]"
                        >
                          <input
                            type="text"
                            value={row[header] ?? ""}
                            onChange={(e) => handleCellChange(originalIndex, header, e.target.value)}
                            className="w-full bg-transparent px-2.5 py-1.5 text-xs text-white outline-none focus:bg-[#12161A] focus:ring-1 focus:ring-white/40 rounded font-mono transition-all"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}

                  {paginatedRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={headers.length + 2}
                        className="py-16 text-center text-xs text-[#8E9BA8] font-mono"
                      >
                        {searchQuery
                          ? `No contacts matching "${searchQuery}".`
                          : "This list has no contact rows yet. Click '+ Add Row' to add one."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer: Pagination & Counts */}
          <div className="p-4 bg-[#161B1F] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-[#8E9BA8]">
            <div className="flex items-center gap-2">
              <span>
                Showing {totalFiltered === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1} -{" "}
                {Math.min(safeCurrentPage * pageSize, totalFiltered)} of {totalFiltered} contacts
              </span>
              {searchQuery && (
                <span className="text-emerald-400 font-semibold">(filtered from {rows.length})</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Page size selector */}
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-[#14181C] border border-[#2C353D] text-white rounded px-2 py-1 text-xs outline-none cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                </select>
              </div>

              {/* Prev / Next buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded-lg bg-[#222930] hover:bg-[#2C353D] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-white font-semibold">
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg bg-[#222930] hover:bg-[#2C353D] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State when no list exists */
        <div className="bg-[#181E24] border border-[#2C353D] rounded-2xl p-16 text-center shadow-xl space-y-4">
          <Database className="w-12 h-12 text-[#8E9BA8] mx-auto opacity-40" />
          <h3 className="text-base font-bold text-white">No Contact Lists Found</h3>
          <p className="text-xs text-[#8E9BA8] max-w-md mx-auto">
            Upload a CSV file or add single contacts to start organizing your leads and launching cold email campaigns.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setIsUploading(true)}
              className="px-4 py-2 bg-white text-[#161B1F] text-xs font-bold rounded-xl flex items-center gap-2 hover:bg-[#CBD5E1] transition-all cursor-pointer shadow"
            >
              <Upload className="w-3.5 h-3.5" /> Upload CSV
            </button>
            <button
              onClick={() => setIsAddingContact(true)}
              className="px-4 py-2 bg-[#222930] hover:bg-[#2C353D] text-white border border-[#2C353D] text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add Single Contact
            </button>
          </div>
        </div>
      )}

      {/* Validate CSV Modal */}
      {isValidationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1E252D] border border-[#2C353D] rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C353D]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Validate & Clean Contacts</h3>
                  <p className="text-[11px] text-[#8E9BA8]">
                    Scan list for syntax errors, disposable inboxes, and bounce risks.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsValidationOpen(false)}
                className="text-[#8E9BA8] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer bg-[#14181C] p-3 rounded-xl border border-[#2C353D]">
                <input
                  type="checkbox"
                  checked={checkGravatar}
                  onChange={(e) => setCheckGravatar(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
                <span className="text-xs text-white font-medium">
                  Check Gravatar (identifies active avatar profiles)
                </span>
              </label>

              <button
                onClick={handleScan}
                disabled={scanning}
                className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow disabled:opacity-50"
              >
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                <span>{scanning ? "Scanning emails..." : "Start Email Verification"}</span>
              </button>

              {scanResult && (
                <div className="space-y-4 pt-2 border-t border-[#2C353D]">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <div className="text-emerald-400 font-bold text-base">{scanResult.stats.valid}</div>
                      <div className="text-[10px] text-[#8E9BA8] mt-0.5">Safe</div>
                    </div>
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <div className="text-rose-400 font-bold text-base">{scanResult.stats.invalid}</div>
                      <div className="text-[10px] text-[#8E9BA8] mt-0.5">Invalid</div>
                    </div>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <div className="text-amber-400 font-bold text-base">{scanResult.stats.disposable}</div>
                      <div className="text-[10px] text-[#8E9BA8] mt-0.5">Disposable</div>
                    </div>
                  </div>

                  {scanResult.results.filter((r: any) => !r.valid).length > 0 && (
                    <div className="space-y-2">
                      <div className="max-h-40 overflow-y-auto space-y-1 bg-[#14181C] p-2 rounded-xl border border-[#2C353D]">
                        {scanResult.results
                          .filter((r: any) => !r.valid)
                          .map((r: any, idx: number) => (
                            <div
                              key={idx}
                              className="text-xs font-mono flex items-center justify-between text-rose-300 p-1"
                            >
                              <span className="truncate">{r.email}</span>
                              <span className="text-[10px] text-rose-500 shrink-0">{r.reason}</span>
                            </div>
                          ))}
                      </div>

                      <button
                        onClick={() =>
                          removeEmails(
                            scanResult.results.filter((r: any) => !r.valid).map((r: any) => r.email)
                          )
                        }
                        className="w-full py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove All Invalid Emails</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload CSV Modal */}
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1E252D] border border-[#2C353D] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C353D]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Upload New CSV</h3>
              </div>
              <button
                onClick={() => setIsUploading(false)}
                className="text-[#8E9BA8] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                  List Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Q3 Dentists Leads, Solar Installers"
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white transition-all font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs px-0.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">CSV File *</span>
                  <button
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold underline flex items-center gap-1 cursor-pointer text-[11px]"
                  >
                    <Download className="w-3 h-3" /> Download Sample Format
                  </button>
                </div>

                <div className="p-8 text-center relative cursor-pointer border-2 border-dashed border-[#2C353D] hover:border-white/50 rounded-xl transition-colors bg-[#14181C]">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    required
                  />
                  <Upload className="w-8 h-8 text-[#8E9BA8] mx-auto mb-2" />
                  <p className="font-semibold text-xs text-white">
                    {newFile ? newFile.name : "Click to choose CSV file"}
                  </p>
                  {newFile && (
                    <p className="text-[11px] text-emerald-400 mt-1 font-mono">
                      {(newFile.size / 1024).toFixed(1)} KB
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#2C353D]">
                <button
                  type="button"
                  onClick={() => setIsUploading(false)}
                  className="px-4 py-2 border border-[#2C353D] bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-white hover:bg-[#CBD5E1] text-[#161B1F] text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Upload & Open</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Single Contact Modal */}
      {isAddingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1E252D] border border-[#2C353D] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C353D]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Add Single Contact</h3>
              </div>
              <button
                onClick={() => setIsAddingContact(false)}
                className="text-[#8E9BA8] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddContact} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white transition-all font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                  Full / First Name
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                  Company Name
                </label>
                <input
                  type="text"
                  value={contactCompany}
                  onChange={(e) => setContactCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white transition-all font-mono"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#2C353D]">
                <button
                  type="button"
                  onClick={() => setIsAddingContact(false)}
                  className="px-4 py-2 border border-[#2C353D] bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingContact}
                  className="px-5 py-2 bg-white hover:bg-[#CBD5E1] text-[#161B1F] text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow disabled:opacity-50"
                >
                  {savingContact ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Add to List</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}

      {/* Suppression List Tab */}
      {activeTab === 'suppression' && (
        <div className="space-y-6">
          {/* Top Info Banner */}
          <div className="bg-[#222930] border border-[#2C353D] rounded-xl p-5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Automated Consent & Suppression Enforcement</h3>
                <p className="text-xs text-[#8E9BA8] mt-1 leading-relaxed">
                  Contacts on this list are guaranteed never to receive emails from any of your campaigns, protecting your domain deliverability and ensuring compliance with CAN-SPAM and GDPR regulations.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAddingSuppression(!isAddingSuppression)}
              className="px-4 py-2 bg-white hover:bg-[#CBD5E1] text-[#161B1F] text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-sm"
            >
              <UserX className="w-3.5 h-3.5 text-rose-600" />
              {isAddingSuppression ? "Cancel" : "Add Address"}
            </button>
          </div>

          {/* Add Suppression Form */}
          {isAddingSuppression && (
            <div className="bg-[#222930] border border-[#2C353D] rounded-xl p-6 animate-in fade-in duration-200">
              <h4 className="text-sm font-bold text-white mb-1">Add Contact to Suppression List</h4>
              <p className="text-xs text-[#8E9BA8] mb-4">Manually exclude an email from all future outreach campaigns.</p>
              <form onSubmit={handleAddSuppression} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={suppressionEmailInput}
                  onChange={(e) => setSuppressionEmailInput(e.target.value)}
                  placeholder="recipient@domain.com"
                  required
                  className="flex-1 bg-[#1C2227] border border-[#2C353D] rounded-lg px-3.5 py-2 text-xs text-white placeholder-[#8E9BA8] focus:outline-none focus:border-[#CBD5E1] font-mono"
                />
                <select
                  value={suppressionReasonInput}
                  onChange={(e) => setSuppressionReasonInput(e.target.value)}
                  className="bg-[#1C2227] border border-[#2C353D] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#CBD5E1]"
                >
                  <option value="unsubscribed">Unsubscribed (Opt-Out)</option>
                  <option value="bounced">Bounced (Hard / Permanent)</option>
                  <option value="complaint">Spam Complaint</option>
                  <option value="manual">Manual Entry</option>
                </select>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0"
                >
                  Confirm Suppression
                </button>
              </form>
            </div>
          )}

          {/* Stats Bar & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono px-3 py-1 bg-[#1C2227] border border-[#2C353D] rounded-md text-white font-bold">
                Total: {suppressions.length}
              </span>
              <span className="text-xs font-mono px-3 py-1 bg-amber-950/30 border border-amber-800/40 rounded-md text-amber-400">
                Unsubscribed: {suppressions.filter(s => s.reason === 'unsubscribed').length}
              </span>
              <span className="text-xs font-mono px-3 py-1 bg-rose-950/30 border border-rose-800/40 rounded-md text-rose-400">
                Bounced: {suppressions.filter(s => s.reason === 'bounced').length}
              </span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8E9BA8]" />
              <input
                type="text"
                placeholder="Search suppressed..."
                value={suppressionSearch}
                onChange={(e) => setSuppressionSearch(e.target.value)}
                className="w-full bg-[#1C2227] border border-[#2C353D] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#8E9BA8] focus:outline-none focus:border-[#CBD5E1] font-mono"
              />
            </div>
          </div>

          {/* Suppressions Table */}
          <div className="bg-[#222930] border border-[#2C353D] rounded-xl overflow-hidden">
            {loadingSuppressions ? (
              <div className="py-12 text-center text-xs text-[#8E9BA8] font-mono">Loading suppression list...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1C2227] text-[#8E9BA8] font-semibold border-b border-[#2C353D]">
                    <tr>
                      <th className="py-3 px-4">Suppressed Address</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Source Campaign</th>
                      <th className="py-3 px-4">Date Suppressed</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C353D]">
                    {suppressions
                      .filter(s => !suppressionSearch || s.email.toLowerCase().includes(suppressionSearch.toLowerCase()))
                      .map((item) => (
                        <tr key={item.id} className="hover:bg-[#29323A]/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-white">
                            {item.email}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${
                              item.reason === 'unsubscribed'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                : item.reason === 'bounced'
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                                : 'bg-gray-500/10 text-gray-300 border-gray-500/20'
                            }`}>
                              {item.reason}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#8E9BA8]">
                            {item.campaign_name || "—"}
                          </td>
                          <td className="py-3 px-4 text-[#8E9BA8] font-mono">
                            {new Date(item.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteSuppression(item.id, item.email)}
                              title="Remove suppression"
                              className="p-1.5 hover:bg-rose-950/40 text-[#8E9BA8] hover:text-rose-400 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    {suppressions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xs text-[#8E9BA8]">
                          No suppressed contacts yet. Recipients who click unsubscribe will automatically appear here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
