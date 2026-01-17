import type {
  SocraticContext,
  Topic,
  Subtopic,
  Concept,
  Answer,
  Message,
} from '@/lib/types';
import type { LearningSession } from '.prisma/client-sensie';
import { prisma } from '@/lib/db/client';

/**
 * Context building helpers for Mastra agents
 *
 * Builds rich context from database state for agent calls
 */

/**
 * Full context for teaching interactions
 */
export interface TeachingContext extends SocraticContext {
  topic: Topic;
  subtopic: Subtopic;
  concept: Concept;
  session: LearningSession;
  recentAnswers: Answer[];
  recentMessages: Message[];
}

/**
 * Context for evaluation calls
 */
export interface EvaluationContext {
  question: {
    text: string;
    expectedElements: string[];
    difficulty: number;
  };
  userAnswer: string;
  hintsUsed: number;
  previousAttempts: string[];
  conceptName: string;
}

/**
 * Context for quiz generation
 */
export interface QuizContext {
  topicName: string;
  subtopicNames: string[];
  conceptNames: string[];
  userLevel: number;
  recentPerformance: {
    accuracy: number;
    averageDifficulty: number;
  };
}

/**
 * Build Socratic context from database state
 */
export async function buildSocraticContext(
  userId: string,
  topicId: string,
  subtopicId: string,
  conceptId: string
): Promise<SocraticContext> {
  // Get user progress for level
  const userProgress = await prisma.userProgress.findUnique({
    where: { userId },
  });

  // Get previous answers for this concept
  const previousAnswers = await prisma.answer.findMany({
    where: {
      userId,
      question: {
        conceptId,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Get hints used in current session
  const session = await prisma.learningSession.findFirst({
    where: {
      userId,
      topicId,
      isActive: true,
    },
  });

  return {
    topicId,
    subtopicId,
    conceptId,
    userLevel: userProgress?.currentLevel || 1,
    previousAnswers,
    hintsUsed: session?.hintsUsed || 0,
  };
}

/**
 * Build full teaching context
 */
export async function buildTeachingContext(
  sessionId: string
): Promise<TeachingContext> {
  const session = await prisma.learningSession.findUnique({
    where: { id: sessionId },
    include: {
      topic: true,
    },
  });

  if (!session || !session.currentSubtopicId || !session.currentConceptId) {
    throw new Error('Session not found or incomplete');
  }

  const subtopic = await prisma.subtopic.findUnique({
    where: { id: session.currentSubtopicId },
  });

  const concept = await prisma.concept.findUnique({
    where: { id: session.currentConceptId },
  });

  if (!subtopic || !concept) {
    throw new Error('Subtopic or concept not found');
  }

  // Get recent answers and messages
  const [recentAnswers, recentMessages] = await Promise.all([
    prisma.answer.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  // Get user level
  const userProgress = await prisma.userProgress.findUnique({
    where: { userId: session.userId },
  });

  return {
    topicId: session.topicId,
    subtopicId: session.currentSubtopicId,
    conceptId: session.currentConceptId,
    userLevel: userProgress?.currentLevel || 1,
    previousAnswers: recentAnswers,
    hintsUsed: session.hintsUsed,
    topic: session.topic as Topic,
    subtopic: subtopic as Subtopic,
    concept: concept as Concept,
    session,
    recentAnswers,
    recentMessages: recentMessages as Message[],
  };
}

/**
 * Build evaluation context
 */
export async function buildEvaluationContext(
  questionId: string,
  userAnswer: string
): Promise<EvaluationContext> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      concept: true,
      answers: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!question) {
    throw new Error('Question not found');
  }

  const previousAttempts = question.answers.map(a => a.text);
  const hintsUsed = question.answers.reduce((sum, a) => sum + a.hintsUsed, 0);

  return {
    question: {
      text: question.text,
      expectedElements: question.expectedElements,
      difficulty: question.difficulty,
    },
    userAnswer,
    hintsUsed,
    previousAttempts,
    conceptName: question.concept.name,
  };
}

/**
 * Build quiz context
 */
export async function buildQuizContext(
  topicId: string,
  userId: string
): Promise<QuizContext> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      subtopics: {
        include: {
          concepts: true,
        },
      },
    },
  });

  if (!topic) {
    throw new Error('Topic not found');
  }

  // Get user level and recent performance
  const [userProgress, recentAnswers] = await Promise.all([
    prisma.userProgress.findUnique({
      where: { userId },
    }),
    prisma.answer.findMany({
      where: {
        userId,
        question: {
          concept: {
            subtopic: {
              topicId,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        question: true,
      },
    }),
  ]);

  const correctAnswers = recentAnswers.filter(a => a.isCorrect).length;
  const accuracy = recentAnswers.length > 0 ? correctAnswers / recentAnswers.length : 0;
  const avgDifficulty = recentAnswers.length > 0
    ? recentAnswers.reduce((sum, a) => sum + a.question.difficulty, 0) / recentAnswers.length
    : 2;

  return {
    topicName: topic.name,
    subtopicNames: topic.subtopics.map(s => s.name),
    conceptNames: topic.subtopics.flatMap(s => s.concepts.map(c => c.name)),
    userLevel: userProgress?.currentLevel || 1,
    recentPerformance: {
      accuracy,
      averageDifficulty: avgDifficulty,
    },
  };
}

/**
 * Get recent conversation messages for context
 */
export async function getConversationContext(
  sessionId: string,
  limit: number = 10
): Promise<Message[]> {
  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return messages.reverse() as Message[];
}

/**
 * Get performance summary for context
 */
export async function getPerformanceSummary(
  userId: string,
  topicId: string
): Promise<{
  totalQuestions: number;
  correctAnswers: number;
  hintsUsed: number;
  averageDifficulty: number;
  recentAccuracy: number;
}> {
  const answers = await prisma.answer.findMany({
    where: {
      userId,
      question: {
        concept: {
          subtopic: {
            topicId,
          },
        },
      },
    },
    include: {
      question: true,
    },
  });

  if (answers.length === 0) {
    return {
      totalQuestions: 0,
      correctAnswers: 0,
      hintsUsed: 0,
      averageDifficulty: 2,
      recentAccuracy: 0,
    };
  }

  const correctAnswers = answers.filter(a => a.isCorrect).length;
  const hintsUsed = answers.reduce((sum, a) => sum + a.hintsUsed, 0);
  const avgDifficulty = answers.reduce((sum, a) => sum + a.question.difficulty, 0) / answers.length;

  // Recent accuracy (last 10)
  const recentAnswers = answers.slice(-10);
  const recentCorrect = recentAnswers.filter(a => a.isCorrect).length;
  const recentAccuracy = recentAnswers.length > 0 ? recentCorrect / recentAnswers.length : 0;

  return {
    totalQuestions: answers.length,
    correctAnswers,
    hintsUsed,
    averageDifficulty: avgDifficulty,
    recentAccuracy,
  };
}

/**
 * Format context for LLM prompt
 */
export function formatContextForPrompt(context: SocraticContext): string {
  const parts = [
    `Topic ID: ${context.topicId}`,
    `Subtopic ID: ${context.subtopicId}`,
    `Concept ID: ${context.conceptId}`,
    `User Level: ${context.userLevel}`,
    `Hints Used: ${context.hintsUsed}`,
    `Previous Answers: ${context.previousAnswers.length}`,
  ];

  if (context.previousAnswers.length > 0) {
    const recent = context.previousAnswers.slice(-3);
    parts.push('Recent answers:');
    recent.forEach((a, i) => {
      parts.push(`  ${i + 1}. ${a.isCorrect ? '✓' : '✗'} (${a.depth}): "${a.text.substring(0, 50)}..."`);
    });
  }

  return parts.join('\n');
}

/**
 * Get user's learning history for a concept
 */
export async function getConceptHistory(
  userId: string,
  conceptId: string
): Promise<{
  previousAttempts: number;
  lastAttemptDate: Date | null;
  bestDepth: 'SHALLOW' | 'MODERATE' | 'DEEP' | null;
  hintsUsedTotal: number;
}> {
  const answers = await prisma.answer.findMany({
    where: {
      userId,
      question: {
        conceptId,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (answers.length === 0) {
    return {
      previousAttempts: 0,
      lastAttemptDate: null,
      bestDepth: null,
      hintsUsedTotal: 0,
    };
  }

  // Determine best depth
  const depthOrder = ['NONE', 'SHALLOW', 'MODERATE', 'DEEP'];
  const correctAnswers = answers.filter(a => a.isCorrect);
  let bestDepth: 'SHALLOW' | 'MODERATE' | 'DEEP' | null = null;

  for (const answer of correctAnswers) {
    if (!bestDepth || depthOrder.indexOf(answer.depth) > depthOrder.indexOf(bestDepth)) {
      bestDepth = answer.depth as 'SHALLOW' | 'MODERATE' | 'DEEP';
    }
  }

  return {
    previousAttempts: answers.length,
    lastAttemptDate: answers[0].createdAt,
    bestDepth,
    hintsUsedTotal: answers.reduce((sum, a) => sum + a.hintsUsed, 0),
  };
}

/**
 * Get related concepts for broader context
 */
export async function getRelatedConcepts(
  conceptId: string
): Promise<Concept[]> {
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    include: {
      prerequisites: true,
      dependents: true,
      subtopic: {
        include: {
          concepts: true,
        },
      },
    },
  });

  if (!concept) {
    return [];
  }

  // Get prerequisites and dependents
  const related = [
    ...concept.prerequisites,
    ...concept.dependents,
  ];

  // Also include sibling concepts from same subtopic
  const siblings = concept.subtopic.concepts.filter(c => c.id !== conceptId);

  return [...related, ...siblings.slice(0, 3)] as Concept[];
}

/**
 * Build streak context for encouragement
 */
export async function getStreakContext(
  userId: string
): Promise<{
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
  isAtRisk: boolean;
}> {
  const progress = await prisma.userProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      isAtRisk: false,
    };
  }

  // Check if streak is at risk (last activity was yesterday)
  const lastActivity = progress.lastActivityDate;
  const now = new Date();
  const daysSinceActivity = lastActivity
    ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  return {
    currentStreak: progress.currentStreak,
    longestStreak: progress.longestStreak,
    lastActivityDate: progress.lastActivityDate,
    isAtRisk: daysSinceActivity === 1 && progress.currentStreak > 0,
  };
}

/**
 * Get topic completion context
 */
export async function getTopicCompletionContext(
  topicId: string,
  userId: string
): Promise<{
  completedSubtopics: number;
  totalSubtopics: number;
  masteredConcepts: number;
  totalConcepts: number;
  overallMastery: number;
}> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      subtopics: {
        include: {
          concepts: true,
        },
      },
    },
  });

  if (!topic) {
    throw new Error('Topic not found');
  }

  const totalSubtopics = topic.subtopics.length;
  const completedSubtopics = topic.subtopics.filter(s => s.masteryPercentage >= 70).length;

  const allConcepts = topic.subtopics.flatMap(s => s.concepts);
  const totalConcepts = allConcepts.length;
  const masteredConcepts = allConcepts.filter(c => c.isMastered).length;

  return {
    completedSubtopics,
    totalSubtopics,
    masteredConcepts,
    totalConcepts,
    overallMastery: topic.masteryPercentage,
  };
}
