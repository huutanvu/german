"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSpeakingPractice, upsertSpeakingPractice } from "@/lib/grist";
import type { SpeakingPractice } from "@/lib/types";
import { MarkdownDisplay } from "@/components/ui/MarkdownDisplay";
import { WordLookupSidebar } from "@/components/ui/WordLookupSidebar";

export default function SpeakingDetail({ id }: { id: number }) {
  const router = useRouter();

  const [exercise, setExercise] = useState<SpeakingPractice | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

      await upsertSpeakingPractice(exercise.fields.topic, {
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="animate-pulse text-lg font-medium">Loading speaking module...</div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-gray-200">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">Speaking module not found.</p>
          <button
            onClick={() => router.push("/speaking")}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded text-xs font-bold cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const userRecordingUrl = exercise.fields.userAudioFileId
    ? `https://media.publit.io/file/${exercise.fields.userAudioFileId}.webm`
    : null;

  const targetAudioUrl = exercise.fields.targetAudioFileId
    ? `https://media.publit.io/file/${exercise.fields.targetAudioFileId}.mp3`
    : null;

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
          Back to Speaking Dashboard
        </button>

        {/* Header */}
        <div className="border-b border-gray-200 dark:border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 leading-snug">{exercise.fields.topic}</h1>
          <span className="text-xs text-gray-400 font-mono block mt-1">{exercise.fields.date}</span>
        </div>

        {/* Target text to read */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-2">Target Reading Text</span>
          <MarkdownDisplay content={exercise.fields.targetText} onWordLookup={handleWordLookup} />
        </div>

        {/* Recorder or displays depending on status */}
        {exercise.fields.status === "pending_recording" ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Voice Recorder</h3>
            
            <div className="flex items-center gap-3">
              {recording ? (
                <button
                  onClick={stopRecording}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  Stop Recording
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="px-5 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  Start Recording
                </button>
              )}
              {recording && (
                <span className="text-xs text-red-500 animate-pulse font-semibold">Recording your voice...</span>
              )}
            </div>

            {audioUrl && (
              <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded border border-gray-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block">Preview Recording</span>
                <audio controls src={audioUrl} className="w-full h-8" />
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-sm disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {submitting ? "Uploading recording..." : "Submit Recording"}
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
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">Your Submission Recording</span>
                  <audio controls src={userRecordingUrl} className="w-full h-8 mt-1" />
                </div>
              )}

              {exercise.fields.status === "pending_assessment" && (
                <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs p-3 rounded border border-amber-200 dark:border-amber-900/40 font-medium italic">
                  Submitted. Waiting for offline AI voice assessment...
                </div>
              )}
            </div>

            {/* Graded/Assessed Feedback Panel */}
            {exercise.fields.status === "assessed" && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider border-b border-gray-100 dark:border-slate-800 pb-2">
                  Pronunciation Assessment
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">Fluency Score</span>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {exercise.fields.score} / 100
                    </div>
                  </div>
                  
                  {targetAudioUrl && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">Reference Pronunciation</span>
                      <audio controls src={targetAudioUrl} className="w-full h-8 mt-1" />
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">Your Speech Transcript</span>
                  <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded border border-gray-100 dark:border-slate-800">
                    <MarkdownDisplay content={exercise.fields.transcript} onWordLookup={handleWordLookup} />
                  </div>
                </div>

                {exercise.fields.pronunciationFeedback && (
                  <div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">Pronunciation Feedback</span>
                    <div className="bg-red-50/20 dark:bg-red-950/10 p-4 rounded border border-red-200 dark:border-red-900/30">
                      <MarkdownDisplay content={exercise.fields.pronunciationFeedback} onWordLookup={handleWordLookup} />
                    </div>
                  </div>
                )}

                {exercise.fields.grammarFeedback && (
                  <div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 block mb-1">Grammar Corrections</span>
                    <div className="bg-blue-50/20 dark:bg-blue-950/10 p-4 rounded border border-blue-200 dark:border-blue-900/30">
                      <MarkdownDisplay content={exercise.fields.grammarFeedback} onWordLookup={handleWordLookup} />
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
