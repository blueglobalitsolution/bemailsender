import React, { useState } from "react";
import {
  Search,
  MapPin,
  Globe,
  Mail,
  CheckCircle,
  Download,
  Loader2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  FolderPlus,
  ShieldCheck,
  XCircle,
  PlusCircle,
  UserCheck,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useToast } from "../components/Toast";

interface ScrapedLead {
  name: string;
  website: string;
  domain: string;
  email: string;
  all_emails: string[];
  description: string;
  about_text?: string;
  is_qualified?: boolean;
  qualification_status?: "qualified" | "disqualified" | "review";
  qualification_score?: number;
  qualification_reason?: string;
  decision_maker_name?: string;
  decision_maker_title?: string;
  decision_maker_email?: string;
}

const BUSINESS_CATEGORIES = [
  { label: "Dental Clinics & Dentists", query: "Dentist" },
  { label: "Hardware & Tools Stores", query: "Hardware store" },
  { label: "Hospitals & Medical Centers", query: "Hospital" },
  { label: "Real Estate & Property Agents", query: "Real estate agency" },
  { label: "Software & IT Companies", query: "Software company" },
  { label: "Digital Marketing & SEO Agencies", query: "Digital marketing agency" },
  { label: "Plumbing Contractors", query: "Plumbers" },
  { label: "Law Firms & Advocates", query: "Law firm" },
  { label: "Chartered Accountants & CA Firms", query: "Chartered accountant" },
  { label: "Architects & Interior Designers", query: "Architects" },
  { label: "Manufacturing Companies", query: "Manufacturer" },
  { label: "Restaurants & Cafes", query: "Restaurant" },
  { label: "Gyms & Fitness Centers", query: "Gym" },
  { label: "Hotels & Resorts", query: "Hotel" },
  { label: "Logistics & Transport", query: "Logistics company" },
  { label: "Custom Search...", query: "" },
];

export default function LeadScraper() {
  const toast = useToast();

  // Search form (Step 1: Scraper)
  const [selectedCategory, setSelectedCategory] = useState<string>("Dental Clinics & Dentists");
  const [query, setQuery] = useState("Dentist");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [location, setLocation] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Results & Qualification (Step 2: AI Qualification)
  const [leads, setLeads] = useState<ScrapedLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [qualifying, setQualifying] = useState(false);
  const [qualificationDone, setQualificationDone] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "qualified" | "disqualified">("all");

  // Save to CSV modal
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [csvListName, setCsvListName] = useState("");
  const [savingCsv, setSavingCsv] = useState(false);

  const getEffectiveQuery = () => {
    if (isCustomCategory) {
      return query.trim();
    }
    const found = BUSINESS_CATEGORIES.find((c) => c.label === selectedCategory);
    return found?.query || query.trim();
  };

  // Step 1: Initial Search - Always fetches 50 leads first
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const effectiveQuery = getEffectiveQuery();
    if (!effectiveQuery) {
      toast.error("Please enter a business keyword (e.g. Dentists, Real Estate)");
      return;
    }

    setSearching(true);
    setSearchedOnce(true);
    setQualificationDone(false);
    setActiveTab("all");
    setSelectedLeads(new Set());

    try {
      const res = await apiFetch("/api/scraper/search/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: effectiveQuery,
          location: location.trim(),
          limit: 50,
          offset: 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Search failed");
      }

      const data = await res.json();
      const list: ScrapedLead[] = data.leads || [];
      setLeads(list);

      // By default select all leads that have an email found
      const initialSelected = new Set<number>();
      list.forEach((l, idx) => {
        if (l.email) initialSelected.add(idx);
      });
      setSelectedLeads(initialSelected);

      if (list.length > 0) {
        const withEmails = list.filter((l) => l.email).length;
        toast.success(`Found ${list.length} leads (${withEmails} with verified emails)!`);
      } else {
        toast.info("No business leads found. Try a different location or query.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to scrape leads");
    } finally {
      setSearching(false);
    }
  };

  // Load More Leads - Fetches the next batch of 50 from the given location
  const handleLoadMore = async () => {
    const effectiveQuery = getEffectiveQuery();
    if (!effectiveQuery || loadingMore) return;

    setLoadingMore(true);
    try {
      const existingDomains = leads.map((l) => l.domain).filter(Boolean);

      const res = await apiFetch("/api/scraper/search/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: effectiveQuery,
          location: location.trim(),
          limit: 50,
          offset: leads.length,
          exclude_domains: existingDomains,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load more leads");
      }

      const data = await res.json();
      const newBatch: ScrapedLead[] = data.leads || [];

      if (newBatch.length === 0) {
        toast.info("No additional leads found for this location.");
      } else {
        setLeads((prev) => {
          const combined = [...prev, ...newBatch];
          // Auto select new leads with email
          setSelectedLeads((prevSelected) => {
            const next = new Set(prevSelected);
            newBatch.forEach((lead, idx) => {
              if (lead.email) {
                next.add(prev.length + idx);
              }
            });
            return next;
          });
          return combined;
        });

        toast.success(`Loaded ${newBatch.length} more leads from ${location || "search"}!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load more leads");
    } finally {
      setLoadingMore(false);
    }
  };

  // Step 2: Separate Mechanism - AI Lead Qualification via Laya Model
  const handleQualifyLeads = async () => {
    if (leads.length === 0) return;

    setQualifying(true);
    try {
      const res = await apiFetch("/api/scraper/qualify/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: leads,
          target_category: isCustomCategory ? query : selectedCategory,
          location: location.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "AI qualification failed");
      }

      const data = await res.json();
      const evaluatedLeads: ScrapedLead[] = data.leads || [];
      setLeads(evaluatedLeads);
      setQualificationDone(true);

      // Auto-select qualified leads with emails
      const qualifiedSelected = new Set<number>();
      evaluatedLeads.forEach((lead, idx) => {
        if (lead.is_qualified && lead.email) {
          qualifiedSelected.add(idx);
        }
      });
      setSelectedLeads(qualifiedSelected);

      toast.success(
        `AI Qualified ${data.qualified_count} leads (${data.disqualified_count} disqualified as listicles/aggregators)!`
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to qualify leads with AI");
    } finally {
      setQualifying(false);
    }
  };

  const toggleSelectAll = () => {
    const currentVisibleIndices = filteredLeads.map((item) => item.originalIndex);
    const allVisibleSelected = currentVisibleIndices.every((idx) => selectedLeads.has(idx));

    const next = new Set(selectedLeads);
    if (allVisibleSelected) {
      currentVisibleIndices.forEach((idx) => next.delete(idx));
    } else {
      currentVisibleIndices.forEach((idx) => next.add(idx));
    }
    setSelectedLeads(next);
  };

  const toggleSelectLead = (index: number) => {
    const next = new Set(selectedLeads);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedLeads(next);
  };

  const selectOnlyQualified = () => {
    const next = new Set<number>();
    leads.forEach((l, idx) => {
      if (l.is_qualified) next.add(idx);
    });
    setSelectedLeads(next);
  };

  const handleSaveToCsv = async () => {
    const chosenLeads = leads.filter((_, idx) => selectedLeads.has(idx));
    if (chosenLeads.length === 0) {
      toast.error("Select at least 1 lead to save");
      return;
    }

    setSavingCsv(true);
    try {
      const defaultName = `${query} (${chosenLeads.length} leads)`;
      const res = await apiFetch("/api/scraper/save-csv/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: csvListName.trim() || defaultName,
          leads: chosenLeads,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save CSV");
      }

      const data = await res.json();
      toast.success(data.message || "Leads saved to Saved CSVs!");
      setIsSaveModalOpen(false);
      setCsvListName("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error saving leads");
    } finally {
      setSavingCsv(false);
    }
  };

  // Filtered list based on active tab
  const filteredLeads = leads
    .map((lead, originalIndex) => ({ lead, originalIndex }))
    .filter(({ lead }) => {
      if (!qualificationDone) return true;
      if (activeTab === "qualified") return lead.is_qualified === true;
      if (activeTab === "disqualified") return lead.is_qualified === false;
      return true;
    });

  const qualifiedCount = leads.filter((l) => l.is_qualified === true).length;
  const disqualifiedCount = leads.filter((l) => l.is_qualified === false).length;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Search Card (Step 1: Scraper) */}
      <div className="bg-[#1C2227] border border-[#2C353D] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className={isCustomCategory ? "md:col-span-4" : "md:col-span-6"}>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                Business Category *
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCategory(val);
                  if (val === "Custom Search...") {
                    setIsCustomCategory(true);
                    setQuery("");
                  } else {
                    setIsCustomCategory(false);
                    const found = BUSINESS_CATEGORIES.find((c) => c.label === val);
                    if (found) setQuery(found.query);
                  }
                }}
                className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-all cursor-pointer font-medium"
              >
                {BUSINESS_CATEGORIES.map((cat) => (
                  <option key={cat.label} value={cat.label} className="bg-[#1C2227] text-white">
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {isCustomCategory && (
              <div className="md:col-span-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                  Custom Keywords *
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8E9BA8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. Solar panel installers"
                    className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-all placeholder-[#64748B]"
                    required
                  />
                </div>
              </div>
            )}

            <div className={isCustomCategory ? "md:col-span-3" : "md:col-span-4"}>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                City / Area / Region *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#8E9BA8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Vadodara, Mumbai, Austin TX"
                  className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-all placeholder-[#64748B]"
                  required
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={searching || !query.trim()}
                className="w-full bg-white hover:bg-[#CBD5E1] disabled:opacity-40 text-[#161B1F] font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                {searching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#161B1F]" />
                    <span>Finding Leads...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 text-emerald-600" />
                    <span>Find Leads</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Results Header Bar */}
      {leads.length > 0 && (
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#1C2227] border border-[#2C353D] rounded-xl px-5 py-3.5 shadow-md">
          {/* Left: Selection and counts */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={
                  filteredLeads.length > 0 &&
                  filteredLeads.every((item) => selectedLeads.has(item.originalIndex))
                }
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-[#2C353D] text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
              />
              <span className="text-xs font-semibold text-white">
                Select All ({filteredLeads.length})
              </span>
            </label>

            <span className="text-xs text-[#8E9BA8] border-l border-[#2C353D] pl-3">
              <strong className="text-white">{selectedLeads.size}</strong> selected
            </span>

            <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {leads.filter((l) => l.email).length} with email
            </span>

            {qualificationDone && leads.filter((l) => l.decision_maker_name).length > 0 && (
              <span className="text-xs text-teal-400 font-medium bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                {leads.filter((l) => l.decision_maker_name).length} Decision Makers
              </span>
            )}

            {qualificationDone && (
              <button
                type="button"
                onClick={selectOnlyQualified}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 ml-1 cursor-pointer"
              >
                Select Only Qualified
              </button>
            )}
          </div>

          {/* Right: AI Qualification mechanism & Save CSV */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Qualification Filter Tabs (visible after qualification is executed) */}
            {qualificationDone && (
              <div className="flex items-center gap-1 bg-[#161B1F] p-1 rounded-lg border border-[#2C353D]">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeTab === "all" ? "bg-[#2C353D] text-white" : "text-[#8E9BA8] hover:text-white"
                  }`}
                >
                  All ({leads.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("qualified")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                    activeTab === "qualified"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "text-[#8E9BA8] hover:text-white"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Qualified ({qualifiedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("disqualified")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                    activeTab === "disqualified"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : "text-[#8E9BA8] hover:text-white"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Disqualified ({disqualifiedCount})
                </button>
              </div>
            )}

            {/* Separate AI Qualification Action Button */}
            <button
              type="button"
              onClick={handleQualifyLeads}
              disabled={qualifying}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              {qualifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Qualifying with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{qualificationDone ? "Re-qualify with AI" : "Qualify Leads with AI"}</span>
                </>
              )}
            </button>

            {/* Save to CSV Button */}
            <button
              type="button"
              onClick={() => {
                const queryParts = [query, location].filter(Boolean).join(" in ");
                setCsvListName(`${queryParts} Leads`);
                setIsSaveModalOpen(true);
              }}
              disabled={selectedLeads.size === 0}
              className="bg-white hover:bg-[#CBD5E1] disabled:opacity-40 text-black font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Download className="w-3.5 h-3.5" /> Save {selectedLeads.size} to CSV
            </button>
          </div>
        </div>
      )}

      {/* Loading State for Initial Scraper */}
      {searching && (
        <div className="bg-[#1C2227] border border-[#2C353D] rounded-2xl p-12 text-center space-y-2">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
          <h3 className="text-sm font-semibold text-white">Finding Leads...</h3>
        </div>
      )}

      {/* Empty State */}
      {!searching && searchedOnce && leads.length === 0 && (
        <div className="bg-[#1C2227] border border-[#2C353D] rounded-2xl p-12 text-center">
          <AlertCircle className="w-8 h-8 text-[#8E9BA8] mx-auto mb-2 opacity-60" />
          <h3 className="text-base font-bold text-white mb-1">No Leads Found</h3>
          <p className="text-xs text-[#8E9BA8]">Try a broader keyword or city.</p>
        </div>
      )}

      {/* Leads Table */}
      {!searching && leads.length > 0 && (
        <div className="bg-[#1C2227] border border-[#2C353D] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161B1F] text-[#8E9BA8] uppercase tracking-wider font-semibold border-b border-[#2C353D]">
                <tr>
                  <th className="p-4 w-12 text-center">#</th>
                  <th className="p-4">Business Name</th>
                  <th className="p-4">Contact Email</th>
                  <th className="p-4">Website</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C353D]/50 text-[#CBD5E1]">
                {filteredLeads.map(({ lead, originalIndex }) => {
                  const isChecked = selectedLeads.has(originalIndex);
                  const hasEmail = Boolean(lead.email);

                  return (
                    <tr
                      key={originalIndex}
                      onClick={() => toggleSelectLead(originalIndex)}
                      className={`hover:bg-[#222930]/60 transition-colors cursor-pointer ${
                        isChecked ? "bg-emerald-500/5" : ""
                      }`}
                    >
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectLead(originalIndex)}
                          className="w-4 h-4 rounded border-[#2C353D] text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                        />
                      </td>

                      <td className="p-4 font-semibold text-white max-w-sm">
                        <div className="flex items-center gap-2">
                          <span className="truncate" title={lead.name}>
                            {lead.name}
                          </span>

                          {/* Show qualification status ONLY after the qualification mechanism has run */}
                          {qualificationDone && lead.is_qualified === true && (
                            <span
                              className="text-[10px] shrink-0 font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"
                              title={lead.qualification_reason || "AI Qualified Business"}
                            >
                              <ShieldCheck className="w-2.5 h-2.5" /> Qualified ({lead.qualification_score || 85}%)
                            </span>
                          )}

                          {qualificationDone && lead.is_qualified === false && (
                            <span
                              className="text-[10px] shrink-0 font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"
                              title={lead.qualification_reason || "Disqualified lead"}
                            >
                              <XCircle className="w-2.5 h-2.5" /> Disqualified
                            </span>
                          )}
                        </div>

                        {/* Decision Maker extracted by LLaMA during qualification */}
                        {lead.decision_maker_name && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md w-fit font-medium">
                            <UserCheck className="w-3 h-3 text-teal-400 shrink-0" />
                            <span>{lead.decision_maker_name}</span>
                            {lead.decision_maker_title && (
                              <span className="text-[#8E9BA8] font-normal">• {lead.decision_maker_title}</span>
                            )}
                          </div>
                        )}

                        {/* Description or qualification reason */}
                        {qualificationDone && lead.is_qualified === false && lead.qualification_reason ? (
                          <p className="text-[11px] text-rose-400/80 font-normal mt-0.5">
                            {lead.qualification_reason}
                          </p>
                        ) : lead.description ? (
                          <p className="text-[11px] text-[#8E9BA8] line-clamp-1 font-normal mt-0.5">
                            {lead.description}
                          </p>
                        ) : null}
                      </td>

                      <td className="p-4">
                        {hasEmail ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-medium">
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[260px]" title={lead.email}>
                                {lead.email}
                              </span>
                            </div>
                            {lead.decision_maker_name && lead.decision_maker_email && (
                              <span className="text-[10px] text-teal-400/90 font-sans flex items-center gap-1">
                                Decision Maker Direct
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#64748B] italic">No direct email found</span>
                        )}
                      </td>

                      <td className="p-4 max-w-[220px]">
                        {lead.website ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-mono truncate"
                            title={lead.website}
                          >
                            <Globe className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{lead.domain || lead.website}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-[#64748B]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Load More Button */}
          <div className="p-4 border-t border-[#2C353D] bg-[#161B1F]/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#8E9BA8]">
              Showing <strong className="text-white">{leads.length}</strong> leads from{" "}
              <strong className="text-emerald-400">{location || "all locations"}</strong>
            </span>

            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="bg-[#222930] hover:bg-[#2C353D] border border-[#2C353D] hover:border-emerald-500/50 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Finding More Leads...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  <span>Load More Leads</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Save Leads to CSV Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-in fade-in">
          <div className="bg-[#1C2227] border border-[#2C353D] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2C353D] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-emerald-400" /> Save {selectedLeads.size} Leads as CSV
              </h3>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-[#8E9BA8] hover:text-white p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#CBD5E1] mb-1.5">
                Saved List Name *
              </label>
              <input
                type="text"
                value={csvListName}
                onChange={(e) => setCsvListName(e.target.value)}
                placeholder="e.g. Austin Dentists Campaign Leads"
                className="w-full bg-[#161B1F] border border-[#2C353D] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-all placeholder-[#64748B]"
                required
              />
              <p className="text-[11px] text-[#8E9BA8] mt-1.5">
                This list will be saved into <strong>Saved CSVs</strong> and will be ready to select in the <strong>Automation Wizard</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 border border-[#2C353D] bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingCsv || !csvListName.trim()}
                onClick={handleSaveToCsv}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold text-xs rounded-lg flex items-center gap-2 transition-all cursor-pointer shadow-md"
              >
                {savingCsv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Save & Add to Audience
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
