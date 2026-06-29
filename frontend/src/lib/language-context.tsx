"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

import { useAuth } from "./auth-context";

const STORAGE_KEY = "german-learning:language";

export type Language = "en" | "vi";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (enText: string, viText: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
  t: (enText) => enText,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const { user } = useAuth();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored === "en" || stored === "vi") {
        setLanguageState(stored);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (user) {
      fetch('/api/profile')
        .then((res) => {
          if (!res.ok) return null;
          return res.json();
        })
        .then((profile) => {
          if (profile && (profile.preferred_language === 'en' || profile.preferred_language === 'vi')) {
            setLanguageState(profile.preferred_language as Language);
            try {
              localStorage.setItem(STORAGE_KEY, profile.preferred_language);
            } catch {}
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch { /* */ }
  }, []);

  const t = useCallback((enText: string, viText: string) => {
    return language === "vi" ? viText : enText;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
