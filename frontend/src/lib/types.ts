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
  userId?: string;
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
  dailyUseTokensJson?: string;
  dailyUseTokensJson_vn?: string;
  professionalUseTokensJson?: string;
  professionalUseTokensJson_vn?: string;
  context?: string;
  isProcessed?: boolean;
  updatedAt?: string;
  userId?: string;
}

export interface VocabularyReviewFields {
  vocabId: number | [string, number];
  userSentence: string;
  correctedSentence: string;
  correctionFeedback: string;
  correctionFeedback_vn?: string;
  status: 'pending_correction' | 'corrected' | 'failed';
  reviewedAt?: string;
  userId?: string;
}

export interface WritingPracticeFields {
  topic: string;
  description: string;
  description_vn: string;
  profession?: string;
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  userParagraph: string;
  correctedParagraph: string;
  correctedTokensJson?: string;
  correctionsJson: string;
  correctionsJson_vn: string;
  status: 'pending_user' | 'pending_correction' | 'corrected';
  date: string;
  userId?: string;
}

export interface ReadingPracticeFields {
  topic: string;
  germanText: string;
  tokensJson?: string;
  audioFileId: string; // Publitio file ID
  questionsJson: string; // JSON array of questions
  profession?: string;
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  userAnswersJson: string;
  correctionsJson: string;
  correctionsJson_vn: string;
  status: 'pending_user' | 'pending_evaluation' | 'evaluated';
  date: string;
  userId?: string;
}

export interface GrammarPracticeFields {
  topic: string;
  description: string;
  description_vn: string;
  questionsJson: string;
  profession?: string;
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  userAnswersJson: string;
  correctionsJson: string;
  correctionsJson_vn: string;
  status: 'pending_user' | 'evaluated';
  date: string;
  userId?: string;
}

export interface SpeakingPracticeFields {
  topic: string;
  targetText: string;
  targetTokensJson?: string;
  targetAudioFileId: string; // Publitio file ID of TTS
  profession?: string;
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  userAudioFileId: string;
  transcript: string;
  grammarFeedback: string;
  grammarFeedback_vn: string;
  pronunciationFeedback: string;
  pronunciationFeedback_vn: string;
  score: number;
  status: 'pending_recording' | 'pending_assessment' | 'assessed';
  date: string;
  userId?: string;
}

export interface ReadingPracticeSubmissionFields {
  practiceId: number | [string, number];
  userId: string;
  userAnswersJson: string;
  correctionsJson: string;
  correctionsJson_vn?: string;
  status: 'pending_user' | 'evaluated';
  date: string;
  updatedAt?: string;
}

export interface WritingPracticeSubmissionFields {
  practiceId: number | [string, number];
  userId: string;
  userParagraph: string;
  correctedParagraph: string;
  correctedTokensJson?: string;
  correctionsJson: string;
  correctionsJson_vn?: string;
  status: 'pending_user' | 'pending_correction' | 'corrected';
  date: string;
  updatedAt?: string;
}

export interface SpeakingPracticeSubmissionFields {
  practiceId: number | [string, number];
  userId: string;
  userAudioFileId: string;
  transcript: string;
  grammarFeedback: string;
  grammarFeedback_vn?: string;
  pronunciationFeedback: string;
  pronunciationFeedback_vn?: string;
  score: number;
  status: 'pending_recording' | 'pending_assessment' | 'assessed';
  date: string;
  updatedAt?: string;
}

export interface GrammarPracticeSubmissionFields {
  practiceId: number | [string, number];
  userId: string;
  userAnswersJson: string;
  correctionsJson: string;
  correctionsJson_vn?: string;
  status: 'pending_user' | 'evaluated';
  date: string;
  updatedAt?: string;
}

export type LearningContext = GristRecord<LearningContextFields>;
export type Vocabulary = GristRecord<VocabularyFields>;
export type VocabularyReview = GristRecord<VocabularyReviewFields>;
export type WritingPractice = GristRecord<WritingPracticeFields>;
export type ReadingPractice = GristRecord<ReadingPracticeFields>;
export type GrammarPractice = GristRecord<GrammarPracticeFields>;
export type SpeakingPractice = GristRecord<SpeakingPracticeFields>;

export type ReadingPracticeSubmission = GristRecord<ReadingPracticeSubmissionFields>;
export type WritingPracticeSubmission = GristRecord<WritingPracticeSubmissionFields>;
export type SpeakingPracticeSubmission = GristRecord<SpeakingPracticeSubmissionFields>;
export type GrammarPracticeSubmission = GristRecord<GrammarPracticeSubmissionFields>;

export interface VocabularyUsageFields {
  vocabId: number | [string, number];
  profession: string;
  dailyUse: string;
  dailyUse_vn?: string;
  professionalUse: string;
  professionalUse_vn?: string;
  tips: string;
  tips_vn?: string;
  caution: string;
  caution_vn?: string;
  createdAt?: string;
}
export type VocabularyUsage = GristRecord<VocabularyUsageFields>;

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  profession: string;
  targetLevel: string;
  preferredLanguage?: string;
  preferred_language?: string;
}

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

// ─── Flotiq Types ────────────────────────────────────────────────

export interface ProfessionReference {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  sampleContext: string;
  icon: string;
}
