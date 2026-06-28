// ─── Grist Types ────────────────────────────────────────────────

export interface GristRecord<T> {
  id: number;
  fields: T;
}

export interface GristResponse<T> {
  records: GristRecord<T>[];
}

export interface LearningContextFields {
  targetLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  currentTopic: string;
  professionalEnvironment: string;
  updatedAt?: string;
}

export interface VocabularyFields {
  word: string;
  meanings: string;
  meanings_vn?: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  type: 'new' | 'revised' | 'permanent' | 'complicated';
  correctCount: number;
  grammar: string;
  grammar_vn?: string;
  dailyUse: string;
  dailyUse_vn?: string;
  professionalUse: string;
  professionalUse_vn?: string;
  tips: string;
  tips_vn?: string;
  caution: string;
  caution_vn?: string;
  context?: string;
  isProcessed?: boolean;
  updatedAt?: string;
}

export interface VocabularyReviewFields {
  vocabId: number | [string, number];
  userSentence: string;
  correctedSentence: string;
  correctionFeedback: string;
  correctionFeedback_vn?: string;
  status: 'pending_correction' | 'corrected' | 'failed';
  reviewedAt?: string;
}

export interface WritingPracticeFields {
  topic: string;
  description: string;
  userParagraph: string;
  correctedParagraph: string;
  correctionsJson: string; // JSON detail breakdown
  correctionsJson_vn?: string;
  status: 'pending_user' | 'pending_correction' | 'corrected';
  date: string;
}

export interface ReadingPracticeFields {
  topic: string;
  germanText: string;
  audioFileId: string; // Publitio file ID
  questionsJson: string; // JSON array of 5 questions
  userAnswersJson: string; // JSON array of user answers
  correctionsJson: string; // JSON grading/feedback
  correctionsJson_vn?: string; // JSON grading/feedback in Vietnamese
  status: 'pending_user' | 'pending_evaluation' | 'evaluated';
  date: string;
}

export interface GrammarPracticeFields {
  topic: string;
  description: string;
  questionsJson: string;
  userAnswersJson: string;
  correctionsJson: string;
  correctionsJson_vn?: string;
  status: 'pending_user' | 'evaluated';
  date: string;
}

export interface SpeakingPracticeFields {
  topic: string;
  targetText: string;
  userAudioFileId: string; // Publitio file ID
  transcript: string;
  grammarFeedback: string;
  grammarFeedback_vn?: string;
  pronunciationFeedback: string;
  pronunciationFeedback_vn?: string;
  targetAudioFileId: string; // Publitio file ID
  score: number;
  status: 'pending_recording' | 'pending_assessment' | 'assessed';
  date: string;
}

export type LearningContext = GristRecord<LearningContextFields>;
export type Vocabulary = GristRecord<VocabularyFields>;
export type VocabularyReview = GristRecord<VocabularyReviewFields>;
export type WritingPractice = GristRecord<WritingPracticeFields>;
export type ReadingPractice = GristRecord<ReadingPracticeFields>;
export type GrammarPractice = GristRecord<GrammarPracticeFields>;
export type SpeakingPractice = GristRecord<SpeakingPracticeFields>;

// ─── Publit.io Types ────────────────────────────────────────────

export interface PublitioFile {
  id: string;
  public_id: string | null;
  title: string;
  type: string;
  extension: string;
  size: number;
  width: number;
  height: number;
  privacy: string;
  url_preview: string;
  url_download: string;
  created_at: string;
  updated_at: string;
}

// ─── Supabase Types ─────────────────────────────────────────────

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email: string;
  };
}

export interface AuthError {
  error: string;
  error_description?: string;
}
