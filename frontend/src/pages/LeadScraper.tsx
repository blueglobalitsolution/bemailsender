import React, { useState } from "react";
import {
  Search,
  MapPin,
  Navigation,
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
  UserCheck,
  Linkedin,
  Twitter,
  Building2,
  Users,
  Cpu,
  Layers,
  Zap,
  Eye,
  Copy,
  Check,
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
  // Free Apollo-style Enrichment fields
  is_enriched?: boolean;
  enriching?: boolean;
  technologies?: string[];
  company_size?: string;
  industry?: string;
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  email_pattern?: string;
  predicted_email?: string;
  summary?: string;
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
  const [gmapsSessionId, setGmapsSessionId] = useState<string | null>(null);
  const [gmapsProgress, setGmapsProgress] = useState<{ count: number; target: number } | null>(null);
  const gmapsPopupRef = React.useRef<Window | null>(null);
  const pollIntervalRef = React.useRef<any>(null);

  // Results & Qualification (Step 2: AI Qualification)
  const [leads, setLeads] = useState<ScrapedLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [qualifying, setQualifying] = useState(false);
  const [qualificationDone, setQualificationDone] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "qualified" | "disqualified">("all");

  // Lead Enrichment state (Apollo-style Free Enrichment)
  const [enrichingBatch, setEnrichingBatch] = useState(false);
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<ScrapedLead | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

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

  const stopGmapsScrape = async (sid?: string) => {
    const id = sid || gmapsSessionId;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (gmapsPopupRef.current && !gmapsPopupRef.current.closed) {
      try { gmapsPopupRef.current.close(); } catch(e) {}
    }
    if (id) {
      try {
        await apiFetch(`/api/gmaps/stop/${id}/`, { method: "POST" });
      } catch (e) {}
    }
    setSearching(false);
    setGmapsProgress(null);
    setGmapsSessionId(null);
  };

  const handleGmapsSearch = async (effectiveQuery: string) => {
    setSearching(true);
    setSearchedOnce(true);
    setQualificationDone(false);
    setActiveTab("all");
    setSelectedLeads(new Set());
    setGmapsProgress({ count: 0, target: 50 });

    try {
      const startRes = await apiFetch("/api/gmaps/start/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `${effectiveQuery} ${location}`.trim(),
          targetCount: 50,
        }),
      });

      if (!startRes.ok) {
        throw new Error("Failed to start Google Maps scraper session.");
      }

      const startData = await startRes.json();
      const sid = startData.sessionId;
      setGmapsSessionId(sid);

      // Open companion popup window
      const gmapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(effectiveQuery + " " + location)}?bemailsender_session=${sid}`;
      const popup = window.open(
        gmapsUrl,
        "gmaps_companion_popup",
        "width=650,height=750,left=150,top=100"
      );
      gmapsPopupRef.current = popup;

      toast.success("Google Maps companion popup opened! Scraping live...");

      pollIntervalRef.current = setInterval(async () => {
        try {
          const streamRes = await apiFetch(`/api/gmaps/stream/${sid}/`);
          if (!streamRes.ok) return;

          const streamData = await streamRes.json();
          const rawLeads: any[] = streamData.leads || [];

          setGmapsProgress({ count: streamData.count, target: streamData.targetCount });

          const mappedLeads: ScrapedLead[] = rawLeads.map((l: any) => ({
            name: l.name,
            website: l.website,
            domain: l.domain,
            email: l.email || "",
            all_emails: l.all_emails || (l.email ? [l.email] : []),
            description: `${l.fullAddress || ""} | Phone: ${l.phone || "N/A"} | Rating: ⭐ ${l.averageRating || "N/A"} (${l.reviewCount || 0} reviews)`,
            about_text: l.fullAddress,
            is_enriched: l.is_enriched || !!l.email,
            technologies: l.categories || [],
            linkedin_url: l.linkedin,
            twitter_url: l.twitter,
            summary: l.fullAddress,
          }));

          setLeads(mappedLeads);

          const initialSelected = new Set<number>();
          mappedLeads.forEach((l, idx) => {
            if (l.email) initialSelected.add(idx);
          });
          setSelectedLeads(initialSelected);

          if (!streamData.isActive || streamData.count >= streamData.targetCount) {
            toast.success(`Google Maps scraping complete! Found ${streamData.count} leads.`);
            stopGmapsScrape(sid);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 1500);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to start Google Maps scraping.");
      setSearching(false);
      setGmapsProgress(null);
    }
  };

  // Step 1: Initial Search - Starts Google Maps Scraper
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const effectiveQuery = getEffectiveQuery();
    if (!effectiveQuery) {
      toast.error("Please enter a business keyword (e.g. Dentists, Real Estate)");
      return;
    }

    return handleGmapsSearch(effectiveQuery);
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

  // Step 3: Free Apollo-style Lead Enrichment Layer
  const handleEnrichLead = async (originalIndex: number) => {
    const targetLead = leads[originalIndex];
    if (!targetLead || targetLead.enriching) return;

    setLeads((prev) =>
      prev.map((l, idx) => (idx === originalIndex ? { ...l, enriching: true } : l))
    );

    try {
      const res = await apiFetch("/api/scraper/enrich/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead: targetLead }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Enrichment failed");
      }

      const data = await res.json();
      const enrichedLead: ScrapedLead = data.lead;

      setLeads((prev) =>
        prev.map((l, idx) => (idx === originalIndex ? { ...enrichedLead, enriching: false } : l))
      );

      if (selectedLeadForDetail && leads[originalIndex]?.domain === selectedLeadForDetail.domain) {
        setSelectedLeadForDetail({ ...enrichedLead, enriching: false });
      }

      toast.success(
        `Enriched ${enrichedLead.name}! Found ${enrichedLead.technologies?.length || 0} tech tags & decision maker details.`
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to enrich lead");
      setLeads((prev) =>
        prev.map((l, idx) => (idx === originalIndex ? { ...l, enriching: false } : l))
      );
    }
  };

  const handleBulkEnrichLeads = async () => {
    const indicesToEnrich = selectedLeads.size > 0
      ? Array.from(selectedLeads)
      : leads.slice(0, 10).map((_, i) => i);

    if (indicesToEnrich.length === 0) return;

    setEnrichingBatch(true);
    try {
      const batchPayload = indicesToEnrich.map((idx) => leads[idx]);
      const res = await apiFetch("/api/scraper/enrich/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: batchPayload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Batch enrichment failed");
      }

      const data = await res.json();
      const enrichedList: ScrapedLead[] = data.leads || [];

      setLeads((prev) => {
        const next = [...prev];
        indicesToEnrich.forEach((origIdx, i) => {
          if (enrichedList[i]) {
            next[origIdx] = enrichedList[i];
          }
        });
        return next;
      });

      toast.success(`Successfully enriched ${enrichedList.length} leads with tech stacks & decision makers!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Bulk enrichment failed");
    } finally {
      setEnrichingBatch(false);
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
      toast.success(data.message || "Leads saved to Leads list!");
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
        
        {/* Scraper Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2C353D]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
              <Navigation className="w-3.5 h-3.5" />
              Google Maps Live Scraper
            </div>
          </div>
        </div>

        {/* Live Scraping Progress Banner */}
        {gmapsProgress && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">
                  Google Maps Live Scraping in Progress...
                </p>
                <p className="text-xs text-emerald-400/80">
                  Collected {gmapsProgress.count} / {gmapsProgress.target} verified leads from Google Maps
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => stopGmapsScrape()}
              className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-all"
            >
              Stop & Keep Leads
            </button>
          </div>
        )}

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
              disabled={qualifying || enrichingBatch}
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

            {/* Free Apollo-style Lead Enrichment Button */}
            <button
              type="button"
              onClick={handleBulkEnrichLeads}
              disabled={enrichingBatch || qualifying}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              {enrichingBatch ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enriching Profiles...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-yellow-300" />
                  <span>
                    Enrich {selectedLeads.size > 0 ? `${selectedLeads.size} Selected` : "Top Leads"}
                  </span>
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
      {searching && leads.length === 0 && (
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
      {leads.length > 0 && (
        <div className="bg-[#1C2227] border border-[#2C353D] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161B1F] text-[#8E9BA8] uppercase tracking-wider font-semibold border-b border-[#2C353D]">
                <tr>
                  <th className="p-4 w-12 text-center">#</th>
                  <th className="p-4">Business & Intelligence</th>
                  <th className="p-4">Decision Maker & Socials</th>
                  <th className="p-4">Contact & Email Pattern</th>
                  <th className="p-4">Tech Stack</th>
                  <th className="p-4 text-center">Enrichment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C353D]/50 text-[#CBD5E1]">
                {filteredLeads.map(({ lead, originalIndex }) => {
                  const isChecked = selectedLeads.has(originalIndex);
                  const hasEmail = Boolean(lead.email);
                  const isEnriched = Boolean(lead.is_enriched);

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

                      <td className="p-4 font-semibold text-white max-w-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate max-w-[200px]" title={lead.name}>
                            {lead.name}
                          </span>

                          {/* Company Size & Industry pill */}
                          {lead.company_size && (
                            <span className="text-[10px] font-normal bg-[#222930] text-[#94A3B8] border border-[#2C353D] px-1.5 py-0.5 rounded">
                              {lead.company_size}
                            </span>
                          )}

                          {/* Show qualification status */}
                          {qualificationDone && lead.is_qualified === true && (
                            <span
                              className="text-[10px] shrink-0 font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1"
                              title={lead.qualification_reason || "AI Qualified"}
                            >
                              <ShieldCheck className="w-2.5 h-2.5" /> Qualified
                            </span>
                          )}

                          {qualificationDone && lead.is_qualified === false && (
                            <span
                              className="text-[10px] shrink-0 font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1"
                              title={lead.qualification_reason || "Disqualified"}
                            >
                              <XCircle className="w-2.5 h-2.5" /> Disqualified
                            </span>
                          )}
                        </div>

                        {/* Website link */}
                        {lead.website && (
                          <div className="mt-1">
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 font-mono truncate max-w-[200px]"
                            >
                              <Globe className="w-3 h-3 shrink-0" />
                              <span className="truncate">{lead.domain || lead.website}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                            </a>
                          </div>
                        )}

                        {/* Description */}
                        {lead.description ? (
                          <p className="text-[11px] text-[#8E9BA8] line-clamp-1 font-normal mt-0.5">
                            {lead.description}
                          </p>
                        ) : null}
                      </td>

                      {/* Decision Maker & Socials */}
                      <td className="p-4 max-w-xs">
                        {lead.decision_maker_name ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-white font-medium">
                              <UserCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                              <span className="truncate">{lead.decision_maker_name}</span>
                            </div>
                            {lead.decision_maker_title && (
                              <p className="text-[11px] text-[#8E9BA8] truncate">
                                {lead.decision_maker_title}
                              </p>
                            )}

                            {/* Direct LinkedIn Badge */}
                            {lead.linkedin_url && (
                              <a
                                href={lead.linkedin_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[10px] text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 px-2 py-0.5 rounded transition-colors font-medium mt-0.5"
                              >
                                <Linkedin className="w-3 h-3" />
                                <span>LinkedIn Profile</span>
                                <ExternalLink className="w-2 h-2 opacity-70" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#64748B] italic text-[11px]">
                            {isEnriched ? "No executive found" : "Click Enrich to extract"}
                          </span>
                        )}
                      </td>

                      {/* Contact & Corporate Pattern */}
                      <td className="p-4 max-w-xs">
                        {hasEmail ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-medium text-xs">
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[200px]" title={lead.email}>
                                {lead.email}
                              </span>
                            </div>

                            {/* Pattern badge */}
                            {lead.email_pattern && (
                              <div className="text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded font-mono w-fit">
                                Pattern: {lead.email_pattern}
                              </div>
                            )}
                          </div>
                        ) : lead.predicted_email ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-amber-400 font-mono font-medium text-xs">
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[200px]" title={lead.predicted_email}>
                                {lead.predicted_email}
                              </span>
                            </div>
                            <span className="text-[10px] text-amber-400/80 font-sans">
                              (Predicted from pattern)
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#64748B] italic text-[11px]">No direct email</span>
                        )}
                      </td>

                      {/* Tech Stack & Tools */}
                      <td className="p-4 max-w-xs">
                        {lead.technologies && lead.technologies.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {lead.technologies.slice(0, 3).map((tech) => (
                              <span
                                key={tech}
                                className="text-[10px] bg-[#161B1F] text-[#CBD5E1] border border-[#2C353D] px-1.5 py-0.5 rounded font-mono"
                              >
                                {tech}
                              </span>
                            ))}
                            {lead.technologies.length > 3 && (
                              <span className="text-[10px] bg-[#222930] text-[#8E9BA8] px-1.5 py-0.5 rounded">
                                +{lead.technologies.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#64748B] text-[11px]">—</span>
                        )}
                      </td>

                      {/* Enrichment Actions */}
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEnrichLead(originalIndex)}
                            disabled={lead.enriching}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm ${
                              isEnriched
                                ? "bg-[#222930] hover:bg-[#2C353D] text-violet-300 border border-violet-500/30"
                                : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
                            }`}
                            title={isEnriched ? "Re-enrich profile" : "Enrich with tech & executive details"}
                          >
                            {lead.enriching ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Enriching...</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3 h-3 text-yellow-300" />
                                <span>{isEnriched ? "Re-enrich" : "Enrich"}</span>
                              </>
                            )}
                          </button>

                          {isEnriched && (
                            <button
                              type="button"
                              onClick={() => setSelectedLeadForDetail(lead)}
                              className="p-1.5 rounded-lg bg-[#161B1F] hover:bg-[#2C353D] border border-[#2C353D] text-[#8E9BA8] hover:text-white transition-colors cursor-pointer"
                              title="View Apollo Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-4 border-t border-[#2C353D] bg-[#161B1F]/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#8E9BA8]">
              Showing <strong className="text-white">{leads.length}</strong> leads from{" "}
              <strong className="text-emerald-400">{location || "all locations"}</strong>
            </span>
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
                This list will be saved into <strong>Leads</strong> and will be ready to select in the <strong>Automation Wizard</strong>.
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

      {/* Apollo-Style Enriched Lead Profile Modal */}
      {selectedLeadForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1C2227] border border-[#2C353D] rounded-2xl w-full max-w-2xl p-6 sm:p-7 shadow-2xl space-y-6 text-white max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#2C353D] pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 rounded-full mb-1">
                  <Zap className="w-3 h-3 text-yellow-300" /> Free Apollo-Style Lead Intelligence
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {selectedLeadForDetail.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#8E9BA8]">
                  {selectedLeadForDetail.website && (
                    <a
                      href={selectedLeadForDetail.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-mono"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{selectedLeadForDetail.domain || selectedLeadForDetail.website}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  )}
                  {selectedLeadForDetail.industry && (
                    <span className="bg-[#222930] px-2 py-0.5 rounded border border-[#2C353D] text-[#CBD5E1]">
                      {selectedLeadForDetail.industry}
                    </span>
                  )}
                  {selectedLeadForDetail.company_size && (
                    <span className="bg-[#222930] px-2 py-0.5 rounded border border-[#2C353D] text-[#CBD5E1] flex items-center gap-1">
                      <Users className="w-3 h-3 text-teal-400" />
                      {selectedLeadForDetail.company_size} Employees
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLeadForDetail(null)}
                className="text-[#8E9BA8] hover:text-white p-1.5 rounded-lg hover:bg-[#2C353D] transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Decision Maker Card */}
            <div className="bg-[#161B1F] border border-[#2C353D] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-md">
                    {selectedLeadForDetail.decision_maker_name
                      ? selectedLeadForDetail.decision_maker_name.charAt(0)
                      : "E"}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      {selectedLeadForDetail.decision_maker_name || "Decision Maker Identified"}
                      {selectedLeadForDetail.linkedin_url && (
                        <a
                          href={selectedLeadForDetail.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:text-sky-300"
                          title="View Verified LinkedIn Profile"
                        >
                          <Linkedin className="w-4 h-4" />
                        </a>
                      )}
                    </h4>
                    <p className="text-xs text-[#8E9BA8]">
                      {selectedLeadForDetail.decision_maker_title || "Executive / Founder"}
                    </p>
                  </div>
                </div>

                {selectedLeadForDetail.linkedin_url && (
                  <a
                    href={selectedLeadForDetail.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden sm:inline-flex items-center gap-1.5 text-xs text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                    <span>View LinkedIn Profile</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                )}
              </div>

              {/* Email & Pattern Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#2C353D]/50 text-xs">
                <div className="bg-[#1C2227] p-3 rounded-lg border border-[#2C353D]/60 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#8E9BA8] tracking-wider">
                    Direct Corporate Email
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-emerald-400 truncate font-medium">
                      {selectedLeadForDetail.email || selectedLeadForDetail.predicted_email || "No direct email"}
                    </span>
                    {(selectedLeadForDetail.email || selectedLeadForDetail.predicted_email) && (
                      <button
                        type="button"
                        onClick={() => {
                          const em = selectedLeadForDetail.email || selectedLeadForDetail.predicted_email || "";
                          navigator.clipboard.writeText(em);
                          setCopiedEmail(em);
                          setTimeout(() => setCopiedEmail(null), 2000);
                        }}
                        className="text-[#8E9BA8] hover:text-white p-1 rounded"
                        title="Copy Email"
                      >
                        {copiedEmail === (selectedLeadForDetail.email || selectedLeadForDetail.predicted_email) ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-[#1C2227] p-3 rounded-lg border border-[#2C353D]/60 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#8E9BA8] tracking-wider">
                    Corporate Email Pattern
                  </span>
                  <p className="font-mono text-violet-300 font-medium">
                    {selectedLeadForDetail.email_pattern || "{first}@{domain}"}
                  </p>
                </div>
              </div>
            </div>

            {/* Detected Technology Stack */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Detected Technology Stack & Digital Tools
              </h4>
              {selectedLeadForDetail.technologies && selectedLeadForDetail.technologies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedLeadForDetail.technologies.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 rounded-lg bg-[#161B1F] border border-[#2C353D] text-xs font-mono text-white flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#8E9BA8] italic">No public script signatures detected.</p>
              )}
            </div>

            {/* Company Social Media Links */}
            {(selectedLeadForDetail.linkedin_url || selectedLeadForDetail.twitter_url || selectedLeadForDetail.github_url) && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-sky-400" /> Social Channels & Presence
                </h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedLeadForDetail.linkedin_url && (
                    <a
                      href={selectedLeadForDetail.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 bg-[#161B1F] hover:bg-[#222930] border border-[#2C353D] px-3 py-1.5 rounded-lg text-sky-400 transition-colors"
                    >
                      <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                    </a>
                  )}
                  {selectedLeadForDetail.twitter_url && (
                    <a
                      href={selectedLeadForDetail.twitter_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 bg-[#161B1F] hover:bg-[#222930] border border-[#2C353D] px-3 py-1.5 rounded-lg text-sky-300 transition-colors"
                    >
                      <Twitter className="w-3.5 h-3.5" /> Twitter / X
                    </a>
                  )}
                  {selectedLeadForDetail.github_url && (
                    <a
                      href={selectedLeadForDetail.github_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 bg-[#161B1F] hover:bg-[#222930] border border-[#2C353D] px-3 py-1.5 rounded-lg text-white transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" /> GitHub
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* AI Summary / Overview */}
            {selectedLeadForDetail.summary && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                  Company Overview & Value Proposition
                </h4>
                <div className="bg-[#161B1F] border border-[#2C353D] rounded-xl p-3.5 text-xs text-[#CBD5E1] leading-relaxed">
                  {selectedLeadForDetail.summary}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2C353D]">
              <button
                type="button"
                onClick={() => setSelectedLeadForDetail(null)}
                className="px-4 py-2 border border-[#2C353D] bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
