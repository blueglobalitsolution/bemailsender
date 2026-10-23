import React, { createContext, useContext, useState, useEffect } from "react";

export type TooltipLang = "en" | "hi";

interface TooltipLanguageContextType {
  lang: TooltipLang;
  setLang: (lang: TooltipLang) => void;
  toggleLang: () => void;
}

const TooltipLanguageContext = createContext<TooltipLanguageContextType>({
  lang: "en",
  setLang: () => {},
  toggleLang: () => {},
});

const STORAGE_KEY = "reachengine_tooltip_lang";

export const TooltipLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<TooltipLang>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "hi" ? "hi" : "en";
    } catch {
      return "en";
    }
  });

  const setLang = (newLang: TooltipLang) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      // Dispatch storage event so other components / tabs synchronize immediately
      window.dispatchEvent(new Event("tooltip-lang-changed"));
    } catch {}
  };

  const toggleLang = () => {
    setLang(lang === "en" ? "hi" : "en");
  };

  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "hi" || saved === "en") {
          setLangState(saved);
        }
      } catch {}
    };
    window.addEventListener("tooltip-lang-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("tooltip-lang-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return (
    <TooltipLanguageContext.Provider value={{ lang, setLang, toggleLang }}>
      {children}
    </TooltipLanguageContext.Provider>
  );
};

export function useTooltipLanguage() {
  return useContext(TooltipLanguageContext);
}
