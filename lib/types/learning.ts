import type {
  User as PrismaUser,
  Topic as PrismaTopic,
  Subtopic as PrismaSubtopic,
  Concept as PrismaConcept,
  Question as PrismaQuestion,
  Answer as PrismaAnswer,
  TopicStatus,
  QuestionType,
  AnswerDepth,
  UserRole,
} from '.prisma/client-sensie';

// Re-export Prisma enums
export { TopicStatus, QuestionType, AnswerDepth, UserRole };

// User type for auth
export interface User {
  id: string;
  username: string;
  role: 'OWNER' | 'VISITOR';
  createdAt: Date;
}

// Extended Prisma user with relations
export type PrismaUserFull = PrismaUser;

// Extended types with relations
export type Topic = PrismaTopic & {
  subtopics?: Subtopic[];
};

export type Subtopic = PrismaSubtopic & {
  concepts?: Concept[];
};

export type Concept = PrismaConcept & {
  questions?: Question[];
};

export type Question = PrismaQuestion;
export type Answer = PrismaAnswer;

// Learning Path types
export interface LearningPath {
  topicName: string;
  domain: 'technical' | 'soft-skills' | 'career';
  estimatedHours: number;
  subtopics: LearningPathSubtopic[];
}

export interface LearningPathSubtopic {
  name: string;
  description: string;
  order: number;
  concepts: LearningPathConcept[];
}

export interface LearningPathConcept {
  name: string;
  keyPoints: string[];
}

// Socratic types
export interface SocraticContext {
  topicId: string;
  subtopicId: string;
  conceptId: string;
  userLevel: number;
  previousAnswers: Answer[];
  hintsUsed: number;
}

export interface SocraticQuestion {
  id?: string;
  text: string;
  type: QuestionType;
  difficulty: number;
  expectedElements: string[];
  hints: string[];
  followUpPrompts: string[];
}

export interface AnswerEvaluation {
  isCorrect: boolean;
  depth: AnswerDepth;
  feedback: string;
  missingElements: string[];
  followUpQuestion?: SocraticQuestion;
}

export interface KnowledgeGap {
  concept: string;
  severity: 'minor' | 'moderate' | 'critical';
  evidence: string;
  prerequisitesNeeded: string[];
}

// Performance tracking
export interface PerformanceMetrics {
  totalQuestions: number;
  correctAnswers: number;
  hintsUsed: number;
  averageTimeToAnswer: number;
  recentAccuracy: number; // Last 10 questions
}

// Content types
export interface TeachingContent {
  conceptId: string;
  introduction: string;
  explanation: string;
  codeExamples: CodeExample[];
  analogies: string[];
  keyPoints: string[];
}

export interface CodeExample {
  language: string;
  code: string;
  explanation: string;
}

export interface CachedContent {
  conceptId: string;
  coreExplanation: string;
  keyPoints: string[];
  commonMisconceptions: string[];
  prerequisites: string[];
  cachedAt: Date;
}

// Quiz types
export interface Quiz {
  id?: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  totalPoints: number;
  passingScore: number;
  timeLimit?: number;
}

export interface QuizQuestion {
  id?: string;
  question: string;
  type: 'UNDERSTANDING' | 'APPLICATION' | 'ANALYSIS';
  difficulty: number;
  expectedAnswer: string;
  scoringCriteria: string[];
}

// Feynman Technique types
export interface FeynmanExercise {
  id: string;
  userId: string;
  topicId: string;
  subtopicId?: string;
  conceptId?: string;
  conceptName: string;
  status: FeynmanStatus;
  explanation: string; // User's explanation
  targetAudience: 'child' | 'beginner' | 'peer';
  evaluation?: FeynmanEvaluation;
  attempts: number;
  createdAt: Date;
  completedAt?: Date;
}

export type FeynmanStatus = 'PENDING' | 'IN_PROGRESS' | 'NEEDS_REFINEMENT' | 'COMPLETED';

export interface FeynmanEvaluation {
  score: number; // 0-100
  clarity: number; // 0-10
  accuracy: number; // 0-10
  simplicity: number; // 0-10
  feedback: string;
  unclearParts: FeynmanUnclearPart[];
  probingQuestions: string[];
  suggestions: string[];
  isApproved: boolean;
}

export interface FeynmanUnclearPart {
  text: string;
  issue: string;
  suggestion: string;
}

export interface FeynmanContext {
  userId: string;
  topicId: string;
  subtopicId?: string;
  conceptId?: string;
  conceptName: string;
  conceptExplanation?: string;
  targetAudience: 'child' | 'beginner' | 'peer';
  previousAttempts: string[];
}

// Learning Analytics types
export interface LearningAnalyticsSummary {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'all-time';
  startDate: Date;
  endDate: Date;

  // Activity metrics
  totalStudyTime: number; // minutes
  sessionsCount: number;
  questionsAnswered: number;
  questionsCorrect: number;
  accuracy: number; // percentage

  // Progress metrics
  topicsMastered: number;
  subtopicsMastered: number;
  conceptsLearned: number;
  reviewsCompleted: number;
  feynmanExercisesCompleted: number;

  // Gamification
  xpEarned: number;
  currentStreak: number;
  longestStreak: number;
  badgesEarned: string[];

  // Trends
  dailyActivity: DailyActivity[];
}

export interface DailyActivity {
  date: Date;
  studyTime: number;
  questionsAnswered: number;
  questionsCorrect: number;
  xpEarned: number;
}

// Advanced Gap Detection types
export interface KnowledgeGapAnalysis {
  userId: string;
  topicId: string;
  analyzedAt: Date;
  gaps: DetailedKnowledgeGap[];
  recommendedActions: GapRecommendation[];
  overallStrength: number; // 0-100
  criticalGapsCount: number;
}

export interface DetailedKnowledgeGap extends KnowledgeGap {
  conceptId?: string;
  subtopicId?: string;
  frequency: number; // How often this gap appears
  lastOccurrence: Date;
  relatedMisconceptions: string[];
  suggestedResources: string[];
}

export interface GapRecommendation {
  type: 'reteach' | 'practice' | 'review' | 'prerequisite';
  priority: 'high' | 'medium' | 'low';
  targetConceptId?: string;
  targetConceptName: string;
  reason: string;
  estimatedTime: number; // minutes
}
