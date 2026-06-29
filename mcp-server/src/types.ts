export interface GristRecord<T> {
  id: number;
  fields: T;
}

export interface GristRecordsResponse<T> {
  records: GristRecord<T>[];
}

export interface LearningContextFields {
  targetLevel: string;
  currentTopic: string;
  professionalEnvironment: string;
  updatedAt?: string;
  userId?: string;
}

export interface VocabularyFields {
  word: string;
  meanings: string;
  level: string;
  type: string;
  correctCount: number;
  grammar: string;
  dailyUse: string;
  professionalUse: string;
  tips: string;
  caution: string;
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
  status: string;
  reviewedAt?: string;
  userId?: string;
}

export interface WritingPracticeFields {
  topic: string;
  description: string;
  description_vn?: string;
  profession?: string;
  level?: string;
}

export interface ReadingPracticeFields {
  topic: string;
  germanText: string;
  audioFileId: string;
  questionsJson: string;
  profession?: string;
  level?: string;
}

export interface SpeakingPracticeFields {
  topic: string;
  targetText: string;
  targetAudioFileId: string;
  profession?: string;
  level?: string;
}

export interface GrammarPracticeFields {
  topic: string;
  description: string;
  questionsJson: string;
  profession?: string;
  level?: string;
}

export interface ReadingPracticeSubmissionFields {
  practiceId: number | [string, number];
  userId: string;
  userAnswersJson: string;
  correctionsJson: string;
  correctionsJson_vn?: string;
  status: string;
  date: string;
  updatedAt?: string;
}

export interface WritingPracticeSubmissionFields {
  practiceId: number | [string, number];
  userId: string;
  userParagraph: string;
  correctedParagraph: string;
  correctionsJson: string;
  correctionsJson_vn?: string;
  status: string;
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
  status: string;
  date: string;
  updatedAt?: string;
}

export interface GrammarPracticeSubmissionFields {
  practiceId: number | [string, number];
  userId: string;
  userAnswersJson: string;
  correctionsJson: string;
  correctionsJson_vn?: string;
  status: string;
  date: string;
  updatedAt?: string;
}

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
  userId?: string;
}

