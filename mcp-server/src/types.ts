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
}

export interface VocabularyReviewFields {
  vocabId: number | [string, number];
  userSentence: string;
  correctedSentence: string;
  correctionFeedback: string;
  status: string;
  reviewedAt?: string;
}

export interface WritingPracticeFields {
  topic: string;
  description: string;
  userParagraph: string;
  correctedParagraph: string;
  correctionsJson: string;
  status: string;
  date: string;
}

export interface ReadingPracticeFields {
  topic: string;
  germanText: string;
  audioFileId: string;
  questionsJson: string;
  userAnswersJson: string;
  correctionsJson: string;
  status: string;
  date: string;
}

export interface SpeakingPracticeFields {
  topic: string;
  targetText: string;
  userAudioFileId: string;
  transcript: string;
  grammarFeedback: string;
  pronunciationFeedback: string;
  targetAudioFileId: string;
  score: number;
  status: string;
  date: string;
}
