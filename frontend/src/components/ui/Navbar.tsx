"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme-context";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect, useRef } from "react";

const THEME_ICONS: Record<string, string> = {
  light: "L",
  dark: "D",
  system: "A",
};

export function Navbar() {
  const pathname = usePathname();
  const { theme, cycle } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  const links = [
    { href: "/", label: t("Dashboard", "Bảng điều khiển") },
    { href: "/vocabulary", label: t("Vocabulary", "Từ vựng") },
    { href: "/writing", label: t("Writing", "Luyện viết") },
    { href: "/reading", label: t("Reading", "Luyện đọc") },
    { href: "/grammar", label: t("Grammar", "Ngữ pháp") },
    { href: "/speaking", label: t("Speaking", "Luyện nói") },
  ];

  return (
    <nav className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center justify-between">
          {/* Left: logo + desktop nav */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              {t("German Learning Vault", "Học tiếng Đức")}
            </Link>
            {/* Desktop nav links */}
            <div className="hidden sm:flex gap-1">
              {links.map((link) => {
                const active =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      active
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-1.5">
            {/* Language toggle */}
            <button
              onClick={() => setLanguage(language === "en" ? "vi" : "en")}
              className="px-2 py-1 rounded text-xs font-mono font-bold transition-colors cursor-pointer text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              title={t("Switch to Vietnamese", "Chuyển sang tiếng Anh")}
            >
              {language === "en" ? "EN" : "VI"}
            </button>

            {/* Theme toggle */}
            <button
              onClick={cycle}
              className="px-2 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              title={`Theme: ${theme} — click to cycle`}
            >
              {THEME_ICONS[theme]}
            </button>

            {/* User menu */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="w-7 h-7 rounded-full bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-xs font-bold flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                  title={user.email}
                  aria-label="User menu"
                >
                  {user.email?.charAt(0).toUpperCase() ?? "U"}
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-9 z-50 w-44 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1">
                    <Link
                      href="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="px-2 py-1 rounded text-xs font-medium transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Sign in
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="sm:hidden p-1.5 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                {menuOpen ? (
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 010 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 010 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 010 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="sm:hidden pb-3 border-t border-gray-200 dark:border-gray-700 mt-1">
            <div className="flex flex-col gap-1 pt-2">
              {links.map((link) => {
                const active =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`px-3 py-2 rounded text-sm transition-colors ${
                      active
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
