import type {
  LearningSession as PrismaLearningSession,
  Message as PrismaMessage,
  MessageRole,
} from '.prisma/client-sensie';

// Re-export Prisma enums
export { MessageRole };

// Extended types
export type LearningSession = PrismaLearningSession & {
  messages?: Message[];
};

export type Message = PrismaMessage;

// Session state for managing learning flow
export interface SessionState {
  sessionId: string;
  topicId: string;
  currentSubtopicId: string | null;
  currentConceptId: string | null;
  currentQuestionId: string | null;
  isActive: boolean;
  skipsUsed: number;
  skippedQuestionIds: string[];
  currentAttempts: number;
  hintsUsed: number;
}

// Chat message types for UI
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  metadata?: ChatMessageMetadata;
  createdAt: Date;
}

export interface ChatMessageMetadata {
  questionId?: string;
  isCorrect?: boolean;
  depth?: string;
  conceptUnlocked?: string;
  masteryUpdated?: number;
}

// Session commands
export type SessionCommand =
  | '/progress'
  | '/topics'
  | '/hint'
  | '/skip'
  | '/break'
  | '/review'
  | '/quiz'
  | '/explain'
  | '/continue';

export interface CommandResult {
  command: SessionCommand;
  success: boolean;
  message: string;
  data?: unknown;
}
