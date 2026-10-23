import React, { useState, useRef, useEffect } from "react";
import { Info, Languages } from "lucide-react";
import { useTooltipLanguage } from "../context/TooltipLanguageContext";
import { TOOLTIP_TRANSLATIONS } from "../lib/tooltipTranslations";

interface InfoTooltipProps {
  id?: string;
  title?: string;
  description?: string;
  whyItMatters?: string;
  titleHi?: string;
  descriptionHi?: string;
  whyItMattersHi?: string;
  className?: string;
}

export default function InfoTooltip({
  id,
  title,
  description,
  whyItMatters,
  titleHi,
  descriptionHi,
  whyItMattersHi,
  className = "",
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang, setLang } = useTooltipLanguage();

  // If translation key provided, pull defaults from centralized translation catalog
  const translation = id ? TOOLTIP_TRANSLATIONS[id] : null;

  const currentTitle =
    lang === "hi"
      ? (titleHi || translation?.titleHi || title || translation?.title || "")
      : (title || translation?.title || "");

  const currentDesc =
    lang === "hi"
      ? (descriptionHi || translation?.descriptionHi || description || translation?.description || "")
      : (description || translation?.description || "");

  const currentWhy =
    lang === "hi"
      ? (whyItMattersHi || translation?.whyItMattersHi || whyItMatters || translation?.whyItMatters)
      : (whyItMatters || translation?.whyItMatters);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="p-0.5 rounded-full text-[#8E9BA8] hover:text-white hover:bg-[#2C353D]/50 transition-colors cursor-pointer"
        aria-label="More information"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-72 p-3.5 bg-[#181E24] border border-[#2C353D] rounded-xl shadow-2xl text-left animate-in fade-in duration-150"
        >
          {/* Header with Title and Language Switcher */}
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-[#2C353D]/60">
            <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <Info className="w-3 h-3 text-sky-400 shrink-0" />
              <span className="truncate">{currentTitle}</span>
            </div>

            {/* Language Toggle Pills */}
            <div className="flex items-center bg-[#101417] border border-[#2C353D] rounded-md p-0.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLang("en");
                }}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold ${
                  lang === "en"
                    ? "bg-white text-[#161B1F] shadow-xs"
                    : "text-[#8E9BA8] hover:text-white"
                }`}
                title="Switch to English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLang("hi");
                }}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold ${
                  lang === "hi"
                    ? "bg-amber-400 text-[#161B1F] shadow-xs"
                    : "text-[#8E9BA8] hover:text-white"
                }`}
                title="Hinglish mein dekhein"
              >
                HING
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1 mb-2">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#8E9BA8] block font-semibold">
              {lang === "hi" ? "Yeh kya karta hai:" : "What it does:"}
            </span>
            <p className="text-[11px] text-[#CBD5E1] leading-relaxed">
              {currentDesc}
            </p>
          </div>

          {/* Why it matters */}
          {currentWhy && (
            <div className="pt-2 border-t border-[#2C353D]/60 text-[10px] text-amber-300/90 leading-tight">
              <strong className="text-amber-400 font-semibold block mb-0.5">
                {lang === "hi" ? "Kyun zaroori hai:" : "Why it matters:"}
              </strong>
              <span>{currentWhy}</span>
            </div>
          )}

          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 w-2 h-2 bg-[#181E24] border-r border-b border-[#2C353D] rotate-45 pointer-events-none"></div>
        </div>
      )}
    </div>
  );
}
