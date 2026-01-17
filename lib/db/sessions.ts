import { prisma } from './client';
import type { LearningSession, Message, MessageRole, Prisma } from '.prisma/client-sensie';

const MAX_SKIPS = 3;

/**
 * Create a new learning session
 */
export async function createSession(data: {
  userId: string;
  topicId: string;
  currentSubtopicId?: string;
  currentConceptId?: string;
}): Promise<LearningSession> {
  return prisma.learningSession.create({
    data: {
      userId: data.userId,
      topicId: data.topicId,
      currentSubtopicId: data.currentSubtopicId,
      currentConceptId: data.currentConceptId,
      isActive: true,
    },
  });
}

/**
 * Get session by ID with optional messages
 */
export async function getSessionById(
  sessionId: string,
  includeMessages: boolean = false
): Promise<LearningSession | null> {
  return prisma.learningSession.findUnique({
    where: { id: sessionId },
    include: includeMessages ? { messages: { orderBy: { createdAt: 'asc' } } } : undefined,
  });
}

/**
 * Get active session for a topic
 */
export async function getActiveSession(
  topicId: string
): Promise<LearningSession | null> {
  return prisma.learningSession.findUnique({
    where: { topicId },
  });
}

/**
 * Get active sessions for a user
 */
export async function getActiveSessionsByUser(
  userId: string
): Promise<LearningSession[]> {
  return prisma.learningSession.findMany({
    where: { userId, isActive: true },
    orderBy: { lastActivity: 'desc' },
  });
}

/**
 * Update session state
 */
export async function updateSessionState(
  sessionId: string,
  data: {
    currentSubtopicId?: string;
    currentConceptId?: string;
    currentQuestionId?: string;
    currentAttempts?: number;
    hintsUsed?: number;
  }
): Promise<LearningSession> {
  return prisma.learningSession.update({
    where: { id: sessionId },
    data: {
      ...data,
      lastActivity: new Date(),
    },
  });
}

/**
 * Use a skip in session
 */
export async function useSkip(
  sessionId: string,
  questionId: string
): Promise<LearningSession> {
  const session = await prisma.learningSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) throw new Error('Session not found');
  if (session.skipsUsed >= MAX_SKIPS) throw new Error('No skips remaining');

  return prisma.learningSession.update({
    where: { id: sessionId },
    data: {
      skipsUsed: { increment: 1 },
      skippedQuestionIds: [...session.skippedQuestionIds, questionId],
      lastActivity: new Date(),
    },
  });
}

/**
 * End a session
 */
export async function endSession(sessionId: string): Promise<LearningSession> {
  return prisma.learningSession.update({
    where: { id: sessionId },
    data: {
      isActive: false,
      endedAt: new Date(),
    },
  });
}

/**
 * Add a message to session
 */
export async function addMessage(data: {
  sessionId: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<Message> {
  return prisma.message.create({
    data: {
      sessionId: data.sessionId,
      role: data.role,
      content: data.content,
      metadata: data.metadata as Prisma.InputJsonValue,
    },
  });
}

/**
 * Get messages for a session
 */
export async function getSessionMessages(
  sessionId: string,
  limit?: number
): Promise<Message[]> {
  return prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

/**
 * Reset skip count (for new subtopic)
 */
export async function resetSkips(sessionId: string): Promise<LearningSession> {
  return prisma.learningSession.update({
    where: { id: sessionId },
    data: {
      skipsUsed: 0,
      skippedQuestionIds: [],
    },
  });
}

/**
 * Update last activity timestamp
 */
export async function updateLastActivity(
  sessionId: string
): Promise<LearningSession> {
  return prisma.learningSession.update({
    where: { id: sessionId },
    data: { lastActivity: new Date() },
  });
}
