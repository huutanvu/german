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
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  type: 'new' | 'revised' | 'permanent' | 'complicated';
  correctCount: number;
  grammar: string;
  dailyUse: string;
  professionalUse: string;
  tips: string;
  caution: string;
  context?: string;
  isProcessed?: boolean;
  updatedAt?: string;
}

export interface VocabularyReviewFields {
  vocabId: number | [string, number];
  userSentence: string;
  correctedSentence: string;
  correctionFeedback: string;
  status: 'pending_correction' | 'corrected' | 'failed';
  reviewedAt?: string;
}

export interface WritingPracticeFields {
  topic: string;
  description: string;
  userParagraph: string;
  correctedParagraph: string;
  correctionsJson: string; // JSON detail breakdown
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
  status: 'pending_user' | 'pending_evaluation' | 'evaluated';
  date: string;
}

export interface SpeakingPracticeFields {
  topic: string;
  targetText: string;
  userAudioFileId: string; // Publitio file ID
  transcript: string;
  grammarFeedback: string;
  pronunciationFeedback: string;
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
