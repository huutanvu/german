"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLearningContext, listVocabulary, listReviews, listWritingPractices, listReadingPractices, listGrammarPractices, listSpeakingPractices, listVocabularyByIds } from "@/lib/grist";
import { useLanguage } from "@/lib/language-context";
import type { LearningContext, VocabularyFields } from "@/lib/types";

export default function Dashboard() {
  const { language, t } = useLanguage();
  const [context, setContext] = useState<LearningContext | null>(null);
  const [vocabStats, setVocabStats] = useState({ total: 0, new: 0, revised: 0, permanent: 0, complicated: 0 });
  const [pendingReviews, setPendingReviews] = useState(0);
  const [activeWriting, setActiveWriting] = useState<string | null>(null);
  const [activeReading, setActiveReading] = useState<string | null>(null);
  const [activeGrammar, setActiveGrammar] = useState<string | null>(null);
  const [activeSpeaking, setActiveSpeaking] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const ctx = await getLearningContext();
        setContext(ctx);

        const reviewsAllRes = await listReviews();
        const uniqueVocabIds = Array.from(new Set(reviewsAllRes.records.map(r => Array.isArray(r.fields.vocabId) ? r.fields.vocabId[1] : r.fields.vocabId).filter(Boolean))) as number[];
        const vocabRes = await listVocabularyByIds(uniqueVocabIds);

        const stats = { total: 0, new: 0, revised: 0, permanent: 0, complicated: 0 };
        vocabRes.records.forEach((r) => {
          stats.total++;
          const type = r.fields.type as keyof typeof stats;
          if (type in stats) {
            stats[type]++;
          }
        });
        setVocabStats(stats);

        const reviewsRes = await listReviews("pending_correction");
        setPendingReviews(reviewsRes.records.filter(r => r.fields.userSentence !== "").length);

        const writingRes = await listWritingPractices();
        const activeW = writingRes.records.find(r => r.fields.status !== "corrected");
        if (activeW) setActiveWriting(activeW.fields.topic);

        const readingRes = await listReadingPractices();
        const activeR = readingRes.records.find(r => r.fields.status !== "evaluated");
        if (activeR) setActiveReading(activeR.fields.topic);

        const grammarRes = await listGrammarPractices();
        const activeG = grammarRes.records.find(r => r.fields.status !== "evaluated");
        if (activeG) setActiveGrammar(activeG.fields.topic);

        const speakingRes = await listSpeakingPractices();
        const activeS = speakingRes.records.find(r => r.fields.status !== "assessed");
        if (activeS) setActiveSpeaking(activeS.fields.topic);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200">
        <div className="animate-pulse text-lg font-medium">{t("Loading Learning Vault...", "Đang tải dữ liệu...")}</div>
      </div>
    );
  }

  const level = context?.fields.targetLevel || "B1";
  const topic = context?.fields.currentTopic || "General Software Engineering";
  
  const env = context?.fields.professionalEnvironment || "Software Engineer";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-slate-950 min-h-screen">
      {/* Header Profile Section */}
      <div className="rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 mb-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t("Welcome to your Learning Vault", "Chào mừng bạn đến với kho học tập")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {t("Context", "Ngữ cảnh")}: {env} | {t("Target Level", "Trình độ mục tiêu")}: {level}
            </p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 rounded text-xs font-semibold">
              {t("Topic", "Chủ đề")}: {topic}
            </span>
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 rounded text-xs font-semibold">
              {vocabStats.permanent} / {vocabStats.total} {t("Mastered", "Đã thuộc")}
            </span>
          </div>
        </div>
      </div>

      {/* Vocabulary Mastery Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        {[
          { label: t("Total Vocabulary", "Tổng số từ"), val: vocabStats.total, color: "border-gray-200 dark:border-slate-800" },
          { label: t("New Words", "Từ mới"), val: vocabStats.new, color: "border-blue-200 dark:border-blue-900/40" },
          { label: t("Revised Needed", "Cần ôn tập"), val: vocabStats.revised, color: "border-amber-200 dark:border-amber-900/40" },
          { label: t("Mastered (Permanent)", "Đã thuộc lòng"), val: vocabStats.permanent, color: "border-emerald-200 dark:border-emerald-950/40" },
          { label: t("Complicated (B2+)", "Từ khó (B2+)"), val: vocabStats.complicated, color: "border-indigo-200 dark:border-indigo-950/40" },
        ].map((stat, i) => (
          <div key={i} className={`bg-white dark:bg-slate-900 p-4 rounded-lg border ${stat.color} text-center shadow-sm`}>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.val}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Activity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Vocab review card */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-sm transition-transform hover:scale-[1.01]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("Vocabulary Review", "Ôn tập từ vựng")}
              </h2>
              {pendingReviews > 0 && (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 text-xs font-semibold rounded">
                  {pendingReviews} {t("Pending", "Chờ duyệt")}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              {t(
                "Practice active recall by writing custom sentences with your active vocabulary words. AI corrections are done offline.",
                "Luyện tập nhớ lại bằng cách viết câu với các từ vựng đang học. Sửa lỗi AI sẽ được xử lý offline."
              )}
            </p>
          </div>
          <Link
            href="/vocabulary"
            className="w-full text-center py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-semibold rounded text-sm transition-colors"
          >
            {t("Review Vocab", "Ôn tập")}
          </Link>
        </div>

        {/* Writing practice card */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-sm transition-transform hover:scale-[1.01]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("Writing Practice", "Luyện viết")}
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
              {t("Current Topic", "Chủ đề hiện tại")}: <span className="font-semibold text-gray-900 dark:text-gray-200">{activeWriting}</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              {t(
                "Draft formal paragraphs matching software engineering environments and submit for line-by-line feedback.",
                "Viết các đoạn văn tương ứng với môi trường phát triển phần mềm và nhận phản hồi chi tiết từ AI."
              )}
            </p>
          </div>
          <Link
            href="/writing"
            className="w-full text-center py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-semibold rounded text-sm transition-colors"
          >
            {t("Start Writing", "Bắt đầu viết")}
          </Link>
        </div>

        {/* Reading practice card */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-sm transition-transform hover:scale-[1.01]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("Reading Comprehension", "Luyện đọc hiểu")}
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
              {t("Active Passage", "Bài đọc hoạt động")}: <span className="font-semibold text-gray-900 dark:text-gray-200">{activeReading}</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              {t(
                "Read advanced tech articles, play back audio recordings, and complete comprehension questions.",
                "Đọc các bài báo kỹ thuật, nghe audio phát âm chuẩn và trả lời câu hỏi đọc hiểu."
              )}
            </p>
          </div>
          <Link
            href="/reading"
            className="w-full text-center py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-semibold rounded text-sm transition-colors"
          >
            {t("Start Reading", "Bắt đầu đọc")}
          </Link>
        </div>

        {/* Grammar practice card */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-sm transition-transform hover:scale-[1.01]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("Grammar Drills", "Luyện ngữ pháp")}
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
              {t("Active Drill", "Bài tập hoạt động")}: <span className="font-semibold text-gray-900 dark:text-gray-200">{activeGrammar}</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              {t(
                "Test grammar skills on cases, declension endings, prepositions and conjugations with instant grading.",
                "Luyện tập ngữ pháp về các cách, giới từ, chia động từ và nhận kết quả tức thì."
              )}
            </p>
          </div>
          <Link
            href="/grammar"
            className="w-full text-center py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-semibold rounded text-sm transition-colors"
          >
            {t("Start Grammar", "Bắt đầu ngữ pháp")}
          </Link>
        </div>

        {/* Speaking practice card */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-sm transition-transform hover:scale-[1.01]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("Speaking & Pronunciation", "Luyện nói & phát âm")}
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
              {t("Active Prompt", "Đoạn nói hoạt động")}: <span className="font-semibold text-gray-900 dark:text-gray-200">{activeSpeaking}</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              {t(
                "Record reading paragraphs out loud in the browser. Submit to get transcript verification and phonetics reviews.",
                "Ghi âm giọng đọc các đoạn văn trong trình duyệt. Gửi để kiểm tra độ chính xác phát âm."
              )}
            </p>
          </div>
          <Link
            href="/speaking"
            className="w-full text-center py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 font-semibold rounded text-sm transition-colors"
          >
            {t("Start Speaking", "Bắt đầu nói")}
          </Link>
        </div>
      </div>
    </div>
  );
}
