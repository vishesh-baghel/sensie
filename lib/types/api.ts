import type { TopicStatus, AnswerDepth, ReviewStatus } from '.prisma/client-sensie';

// Generic API response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Auth types
export interface LoginRequest {
  passphrase: string;
}

export interface LoginResponse {
  success: boolean;
  isOwner: boolean;
  userId: string;
}

export interface Session {
  userId: string;
  isOwner: boolean;
  isVisitor: boolean;
}

// Topic API types
export interface CreateTopicRequest {
  name: string;
  userGoal?: string;
}

export interface TopicResponse {
  id: string;
  name: string;
  description: string | null;
  status: TopicStatus;
  masteryPercentage: number;
  subtopicCount: number;
  createdAt: Date;
}

export interface TopicDetailResponse extends TopicResponse {
  subtopics: SubtopicResponse[];
}

export interface SubtopicResponse {
  id: string;
  name: string;
  description: string | null;
  order: number;
  masteryPercentage: number;
  isLocked: boolean;
  conceptCount: number;
}

// Chat API types
export interface ChatMessageRequest {
  message: string;
  sessionId?: string;
}

export interface ChatMessageResponse {
  sessionId: string;
  response: string;
  questionId?: string;
  feedback?: {
    isCorrect: boolean;
    depth: AnswerDepth;
    message: string;
  };
  masteryUpdate?: {
    conceptMastery?: number;
    subtopicMastery?: number;
    topicMastery?: number;
  };
  nextUnlock?: {
    type: 'concept' | 'subtopic';
    name: string;
  };
}

// Question API types
export interface AnswerRequest {
  questionId: string;
  sessionId: string;
  answer: string;
}

export interface AnswerResponse {
  isCorrect: boolean;
  depth: AnswerDepth;
  feedback: string;
  hintsRemaining: number;
  followUpQuestion?: {
    id: string;
    text: string;
  };
}

export interface HintRequest {
  questionId: string;
  sessionId: string;
}

export interface HintResponse {
  hint: string;
  hintNumber: number;
  hintsRemaining: number;
}

// Progress API types
export interface ProgressResponse {
  topic: {
    id: string;
    name: string;
    masteryPercentage: number;
    status: TopicStatus;
  };
  subtopics: {
    id: string;
    name: string;
    masteryPercentage: number;
    isLocked: boolean;
    isComplete: boolean;
  }[];
  stats: {
    questionsAnswered: number;
    correctAnswers: number;
    hintsUsed: number;
    currentStreak: number;
  };
}

// Review API types
export interface ReviewDueResponse {
  reviews: {
    id: string;
    topicName: string;
    subtopicName?: string;
    conceptName?: string;
    dueDate: Date;
    status: ReviewStatus;
  }[];
  totalDue: number;
}

export interface ReviewStartResponse {
  sessionId: string;
  totalItems: number;
  firstQuestion: {
    id: string;
    reviewId: string;
    text: string;
    topicName: string;
  };
}

export interface ReviewAnswerRequest {
  reviewId: string;
  rating: 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
}

export interface ReviewAnswerResponse {
  nextReviewDate: Date;
  newStatus: ReviewStatus;
  nextQuestion?: {
    id: string;
    reviewId: string;
    text: string;
    topicName: string;
  };
  isComplete: boolean;
  summary?: {
    totalReviewed: number;
    averageRating: number;
  };
}

// Quiz API types
export interface QuizStartRequest {
  topicId: string;
  questionCount?: number; // Default 5
}

export interface QuizStartResponse {
  quizId: string;
  questions: {
    id: string;
    text: string;
    difficulty: number;
  }[];
  totalQuestions: number;
}

export interface QuizAnswerRequest {
  quizId: string;
  questionId: string;
  answer: string;
}

export interface QuizResultResponse {
  score: number;
  totalQuestions: number;
  percentage: number;
  breakdown: {
    questionId: string;
    isCorrect: boolean;
    depth: AnswerDepth;
  }[];
  masteryChange: number;
}

// Settings API types (Bug #9, #10 fixes)
export interface PreferencesResponse {
  masteryThreshold: number;
  dailyReviewLimit: number;
  dailyGoal: number;
  theme: string;
  personalityLevel: string;
  reviewReminders: boolean;
  achievementAlerts: boolean;
}

export interface UpdatePreferencesRequest {
  masteryThreshold?: number;
  dailyReviewLimit?: number;
  dailyGoal?: number;
  theme?: string;
  personalityLevel?: string;
}

// Change Passphrase API types (Bug #11 fix)
export interface ChangePassphraseRequest {
  currentPassphrase: string;
  newPassphrase: string;
}

export interface ChangePassphraseResponse {
  success: boolean;
  message?: string;
  error?: string;
}
