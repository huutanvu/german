"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSpeakingPractice, upsertSpeakingPractice, listSpeakingPractices, createSpeakingPractice, updateSpeakingPractice } from "@/lib/grist";
import type { SpeakingPractice } from "@/lib/types";
import { MarkdownDisplay, PlainMarkdown } from "@/components/ui/MarkdownDisplay";
import { WordLookupSidebar } from "@/components/ui/WordLookupSidebar";
import { useLanguage } from "@/lib/language-context";

export default function SpeakingDetail({ id }: { id: number }) {
  const router = useRouter();

  const [exercise, setExercise] = useState<SpeakingPractice | null>(null);
  const [attempts, setAttempts] = useState<SpeakingPractice[]>([]);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [loading, setLoading] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Word lookup states
  const [lookupWord, setLookupWord] = useState("");
  const [lookupSentence, setLookupSentence] = useState("");
  const [lookupClickedWord, setLookupClickedWord] = useState("");
  const [lookupSeparablePrefix, setLookupSeparablePrefix] = useState<string | undefined>(undefined);
  const [isLookupOpen, setIsLookupOpen] = useState(false);

  function handleWordLookup(canonical: string, sentence: string, clickedWord: string, separablePrefix?: string) {
    setLookupWord(canonical);
    setLookupSentence(sentence);
    setLookupClickedWord(clickedWord);
    setLookupSeparablePrefix(separablePrefix);
    setIsLookupOpen(true);
  }

  async function loadExerciseData() {
    if (isNaN(id)) return;
    try {
      setLoading(true);
      const ex = await getSpeakingPractice(id);
      if (!ex) {
        console.error("Exercise not found");
        return;
      }
      setExercise(ex);
      setAudioUrl(null);
      setAudioBlob(null);
      setRecording(false);

      // Fetch all attempts for this topic
      const listRes = await listSpeakingPractices();
      const topicAttempts = listRes.records.filter(r => r.fields.topic === ex.fields.topic);
      topicAttempts.sort((a, b) => a.id - b.id);
      setAttempts(topicAttempts);
    } catch (err) {
      console.error("Failed to load speaking exercise details:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExerciseData();
  }, [id]);

  async function startRecording() {
    setAudioUrl(null);
    setAudioBlob(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Failed to start voice recording:", err);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
    }
  }

  async function handleSubmit() {
    if (!exercise || !audioBlob) return;

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", audioBlob, `speaking_recording_${exercise.id}.webm`);
      
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload failed: ${errText}`);
      }

      const uploadData = await uploadRes.json();
      const fileId = uploadData.id;

      await updateSpeakingPractice(exercise.id, {
        userAudioFileId: fileId,
        status: "pending_assessment",
      });

      await loadExerciseData();
    } catch (err) {
      console.error("Failed to submit speaking exercise:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetry() {
    if (!exercise) return;
    try {
      setRetrying(true);
      const newAttempt = await createSpeakingPractice(
        exercise.fields.topic,
        exercise.fields.targetText,
        {
          status: "pending_recording",
          userAudioFileId: "",
          transcript: "",
          grammarFeedback: "",
          grammarFeedback_vn: "",
          pronunciationFeedback: "",
          pronunciationFeedback_vn: "",
          targetAudioFileId: exercise.fields.targetAudioFileId || "",
          score: 0,
        }
      );
      router.push(`/speaking/${newAttempt.id}`);
    } catch (err) {
      console.error("Failed to create retry speaking practice:", err);
    } finally {
      setRetrying(false);
    }
  }

  const { language, t } = useLanguage();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="animate-pulse text-lg font-medium">{t("Loading speaking module...", "Đang tải bài nói...")}</div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">{t("Speaking module not found.", "Không tìm thấy bài nói.")}</p>
          <button
            onClick={() => router.push("/speaking")}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded text-xs font-bold cursor-pointer"
          >
            {t("Back to Dashboard", "Quay lại Bảng điều khiển")}
          </button>
        </div>
      </div>
    );
  }

  const userRecordingUrl = exercise.fields.userAudioFileId
    ? `https://media.publit.io/file/german/${exercise.fields.userAudioFileId}.webm`
    : null;

  const targetAudioUrl = exercise.fields.targetAudioFileId
    ? `https://media.publit.io/file/german/${exercise.fields.targetAudioFileId}.mp3`
    : null;

  // Resolve pronunciation and grammar feedback JSON/text columns based on language setting
  const pronunciationFeedbackVal = language === "vi" && exercise.fields.pronunciationFeedback_vn
    ? exercise.fields.pronunciationFeedback_vn
    : exercise.fields.pronunciationFeedback;

  const grammarFeedbackVal = language === "vi" && exercise.fields.grammarFeedback_vn
    ? exercise.fields.grammarFeedback_vn
    : exercise.fields.grammarFeedback;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <button
          onClick={() => router.push("/speaking")}
          className="flex items-center text-xs font-bold text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-gray-200 cursor-pointer gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          {t("Back to Speaking Dashboard", "Quay lại Trang nói")}
        </button>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 dark:border-slate-800 pb-4 gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 leading-snug">{exercise.fields.topic}</h1>
            <span className="text-xs text-gray-400 font-mono block mt-1">{exercise.fields.date}</span>
          </div>
          {exercise.fields.status === "assessed" && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-lg text-xs cursor-pointer shadow-xs disabled:opacity-50 transition-all flex items-center gap-1.5 self-start md:self-center"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4" />
              </svg>
              {retrying ? t("Creating attempt...", "Đang tạo lượt mới...") : t("Retry / Try Again", "Luyện lại / Thử lại")}
            </button>
          )}
        </div>

        {/* Attempts Tabs */}
        {attempts.length > 1 && (
          <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-slate-800 pb-3">
            {attempts.map((att, idx) => {
              const isActive = att.id === id;
              return (
                <button
                  key={att.id}
                  onClick={() => router.push(`/speaking/${att.id}`)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {t("Attempt", "Lần")} {idx + 1}
                </button>
              );
            })}
          </div>
        )}

        {/* Target text to read */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-2">
            {t("Target Reading Text", "Đoạn văn đọc mục tiêu")}
          </span>
          <MarkdownDisplay
            content={exercise.fields.targetText}
            tokensJson={exercise.fields.targetTokensJson || ""}
            onWordLookup={handleWordLookup}
          />
        </div>

        {/* Recorder or displays depending on status */}
        {exercise.fields.status === "pending_recording" ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
              {t("Voice Recorder", "Ghi âm giọng nói")}
            </h3>
            
            <div className="flex items-center gap-3">
              {recording ? (
                <button
                  onClick={stopRecording}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  {t("Stop Recording", "Dừng ghi âm")}
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="px-5 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  {t("Start Recording", "Bắt đầu ghi âm")}
                </button>
              )}
              {recording && (
                <span className="text-xs text-red-500 animate-pulse font-semibold">
                  {t("Recording your voice...", "Đang ghi âm giọng nói...")}
                </span>
              )}
            </div>

            {audioUrl && (
              <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded border border-gray-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block">
                  {t("Preview Recording", "Nghe thử bản ghi âm")}
                </span>
                <audio controls src={audioUrl} className="w-full h-8" />
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-sm disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {submitting ? t("Uploading recording...", "Đang tải bản ghi âm lên...") : t("Submit Recording", "Nộp bản ghi âm")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Audio submitted display */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              {userRecordingUrl && (
                <div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">
                    {t("Your Submission Recording", "Bản ghi âm đã nộp của bạn")}
                  </span>
                  <audio controls src={userRecordingUrl} className="w-full h-8 mt-1" />
                </div>
              )}

              {exercise.fields.status === "pending_assessment" && (
                <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs p-3 rounded border border-amber-200 dark:border-amber-900/40 font-medium italic">
                  {t(
                    "Submitted. Waiting for offline AI voice assessment...",
                    "Đã nộp. Đang chờ AI đánh giá phát âm..."
                  )}
                </div>
              )}
            </div>

            {/* Graded/Assessed Feedback Panel */}
            {exercise.fields.status === "assessed" && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider border-b border-gray-100 dark:border-slate-800 pb-2">
                  {t("Pronunciation Assessment", "Đánh giá phát âm")}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">
                      {t("Fluency Score", "Điểm trôi chảy")}
                    </span>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {exercise.fields.score} / 100
                    </div>
                  </div>
                  
                  {targetAudioUrl && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">
                        {t("Reference Pronunciation", "Phát âm mẫu tham khảo")}
                      </span>
                      <audio controls src={targetAudioUrl} className="w-full h-8 mt-1" />
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">
                    {t("Your Speech Transcript", "Bản dịch chữ giọng nói của bạn")}
                  </span>
                  <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded border border-gray-100 dark:border-slate-800">
                    <PlainMarkdown content={exercise.fields.transcript} />
                  </div>
                </div>

                {pronunciationFeedbackVal && (
                  <div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">
                      {t("Pronunciation Feedback", "Nhận xét phát âm chi tiết")}
                    </span>
                    <div className="bg-red-50/20 dark:bg-red-950/10 p-4 rounded border border-red-200 dark:border-red-900/30">
                      <PlainMarkdown content={pronunciationFeedbackVal} />
                    </div>
                  </div>
                )}

                {grammarFeedbackVal && (
                  <div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">
                      {t("Grammar Corrections", "Sửa lỗi ngữ pháp")}
                    </span>
                    <div className="bg-blue-50/20 dark:bg-blue-950/10 p-4 rounded border border-blue-200 dark:border-blue-900/30">
                      <PlainMarkdown content={grammarFeedbackVal} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <WordLookupSidebar
        isOpen={isLookupOpen}
        word={lookupWord}
        sentence={lookupSentence}
        clickedWord={lookupClickedWord}
        separablePrefix={lookupSeparablePrefix}
        onClose={() => setIsLookupOpen(false)}
      />
    </div>
  );
}
