import { prisma } from './client';
import type { Answer, AnswerDepth } from '.prisma/client-sensie';

/**
 * Create an answer
 */
export async function createAnswer(data: {
  questionId: string;
  userId: string;
  sessionId: string;
  text: string;
  isCorrect: boolean;
  depth: AnswerDepth;
  hintsUsed?: number;
  timeToAnswer?: number;
  attemptNumber?: number;
}): Promise<Answer> {
  return prisma.answer.create({
    data: {
      questionId: data.questionId,
      userId: data.userId,
      sessionId: data.sessionId,
      text: data.text,
      isCorrect: data.isCorrect,
      depth: data.depth,
      hintsUsed: data.hintsUsed || 0,
      timeToAnswer: data.timeToAnswer,
      attemptNumber: data.attemptNumber || 1,
    },
  });
}

/**
 * Get all answers for a session
 */
export async function getAnswersBySession(sessionId: string): Promise<Answer[]> {
  return prisma.answer.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get all answers for a question by user
 */
export async function getAnswersByQuestion(
  questionId: string,
  userId: string
): Promise<Answer[]> {
  return prisma.answer.findMany({
    where: { questionId, userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get recent answers for a user
 */
export async function getRecentAnswers(
  userId: string,
  limit: number = 20
): Promise<Answer[]> {
  return prisma.answer.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Count correct answers for a session
 */
export async function countCorrectAnswers(sessionId: string): Promise<number> {
  return prisma.answer.count({
    where: { sessionId, isCorrect: true },
  });
}

/**
 * Count total answers for a session
 */
export async function countTotalAnswers(sessionId: string): Promise<number> {
  return prisma.answer.count({
    where: { sessionId },
  });
}

/**
 * Get accuracy for recent answers
 */
export async function getRecentAccuracy(
  userId: string,
  limit: number = 20
): Promise<number> {
  const answers = await prisma.answer.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { isCorrect: true },
  });

  if (answers.length === 0) return 0;

  const correct = answers.filter((a) => a.isCorrect).length;
  return Math.round((correct / answers.length) * 100);
}

/**
 * Mark answer as private (for visitor mode)
 */
export async function markAnswerPrivate(answerId: string): Promise<Answer> {
  return prisma.answer.update({
    where: { id: answerId },
    data: { isPrivate: true },
  });
}
