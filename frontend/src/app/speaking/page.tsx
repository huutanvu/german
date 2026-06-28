"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listSpeakingPractices } from "@/lib/grist";
import type { SpeakingPractice } from "@/lib/types";

type SortField = "date-desc" | "date-asc" | "status";

export default function SpeakingDashboard() {
  const [exercises, setExercises] = useState<SpeakingPractice[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("date-desc");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const res = await listSpeakingPractices();
        setExercises(res.records);
      } catch (err) {
        console.error("Failed to load speaking practices:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredExercises = exercises
    .filter((ex) => ex.fields.topic.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "date-desc") {
        return b.fields.date.localeCompare(a.fields.date);
      } else if (sortBy === "date-asc") {
        return a.fields.date.localeCompare(b.fields.date);
      } else {
        return a.fields.status.localeCompare(b.fields.status);
      }
    });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="animate-pulse text-lg font-medium">Loading speaking dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 font-sans p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 dark:border-slate-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Speaking Practices</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Select a task to read German out loud, record your voice, check pronunciation accuracy, and lookup vocabulary.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded text-gray-900 dark:text-gray-100 focus:outline-none min-w-[200px]"
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded text-gray-700 dark:text-gray-300 font-semibold focus:outline-none"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>

        {/* Grid List */}
        {filteredExercises.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800">
            No speaking practices found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExercises.map((ex) => {
              const hasCorrection = ex.fields.status === "assessed";
              const isPending = ex.fields.status === "pending_assessment";

              return (
                <div
                  key={ex.id}
                  onClick={() => router.push(`/speaking/${ex.id}`)}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-5 shadow-xs transition-all duration-200 flex flex-col justify-between min-h-[160px] cursor-pointer group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono font-bold">
                        {ex.fields.date}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                          hasCorrection
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                            : isPending
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                            : "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300"
                        }`}
                      >
                        {hasCorrection ? "Assessed" : isPending ? "Pending AI" : "Pending Rec"}
                      </span>
                    </div>

                    <h2 className="text-sm font-extrabold text-gray-900 dark:text-gray-100 group-hover:text-blue-500 transition-colors leading-snug line-clamp-2">
                      {ex.fields.topic}
                    </h2>
                  </div>

                  <div className="flex items-center justify-end text-[11px] font-bold text-gray-400 group-hover:text-blue-500 transition-colors pt-4 border-t border-gray-50 dark:border-slate-800/40">
                    Open Practice
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
