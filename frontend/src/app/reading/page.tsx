"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listReadingPractices } from "@/lib/grist";
import { useLanguage } from "@/lib/language-context";
import type { ReadingPractice } from "@/lib/types";

type SortField = "date-desc" | "date-asc" | "status" | "level-asc" | "level-desc";
const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function ReadingDashboard() {
  const { language, t } = useLanguage();
  const [exercises, setExercises] = useState<ReadingPractice[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("date-desc");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const res = await listReadingPractices();
        setExercises(res.records);
      } catch (err) {
        console.error("Failed to load reading practices:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter and sort list
  const filteredExercises = exercises
    .filter((ex) => ex.fields.topic.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "date-desc") {
        return b.fields.date.localeCompare(a.fields.date);
      } else if (sortBy === "date-asc") {
        return a.fields.date.localeCompare(b.fields.date);
      } else if (sortBy === "level-asc") {
        return LEVEL_ORDER.indexOf(a.fields.level || 'B1') - LEVEL_ORDER.indexOf(b.fields.level || 'B1');
      } else if (sortBy === "level-desc") {
        return LEVEL_ORDER.indexOf(b.fields.level || 'B1') - LEVEL_ORDER.indexOf(a.fields.level || 'B1');
      } else {
        return a.fields.status.localeCompare(b.fields.status);
      }
    });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="animate-pulse text-lg font-medium">{t("Loading reading dashboard...", "Đang tải danh sách bài đọc...")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 font-sans p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 dark:border-slate-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">{t("Reading Practices", "Luyện đọc hiểu")}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {t("Select an article to practice reading comprehension, listening, and lookup definitions.", "Chọn một bài đọc để luyện đọc hiểu, nghe và tra cứu từ vựng.")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder={t("Search passages...", "Tìm bài đọc...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded text-gray-900 dark:text-gray-100 focus:outline-none min-w-[200px]"
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded text-gray-700 dark:text-gray-300 font-semibold focus:outline-none"
            >
              <option value="date-desc">{t("Newest First", "Mới nhất trước")}</option>
              <option value="date-asc">{t("Oldest First", "Cũ nhất trước")}</option>
              <option value="level-asc">{t("Level (A1-C2)", "Trình độ tăng dần")}</option>
              <option value="level-desc">{t("Level (C2-A1)", "Trình độ giảm dần")}</option>
              <option value="status">{t("Status", "Trạng thái")}</option>
            </select>
          </div>
        </div>

        {/* Grid List */}
        {filteredExercises.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800">
            {t("No reading practices found.", "Không tìm thấy bài luyện đọc nào.")}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExercises.map((ex) => {
              const hasCorrection = ex.fields.status === "evaluated";
              const isPending = ex.fields.status === "pending_evaluation";

              return (
                <div
                  key={ex.id}
                  onClick={() => router.push(`/reading/${ex.id}`)}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-5 shadow-xs transition-all duration-200 flex flex-col justify-between min-h-[160px] cursor-pointer group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono font-bold">
                        {ex.fields.date}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {ex.fields.level && (
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                            {ex.fields.level}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                            hasCorrection
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                              : isPending
                              ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                              : "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300"
                          }`}
                        >
                          {hasCorrection
                            ? t("Feedback Available", "Có nhận xét")
                            : isPending
                            ? t("Pending AI", "Đang chờ chấm")
                            : t("Unanswered", "Chưa trả lời")}
                        </span>
                      </div>
                    </div>

                    <h2 className="text-sm font-extrabold text-gray-900 dark:text-gray-100 group-hover:text-blue-500 transition-colors leading-snug line-clamp-2">
                      {ex.fields.topic}
                    </h2>
                  </div>

                  <div className="flex items-center justify-end text-[11px] font-bold text-gray-400 group-hover:text-blue-500 transition-colors pt-4 border-t border-gray-50 dark:border-slate-800/40">
                    {t("Open Practice", "Mở luyện tập")}
                    <svg className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
