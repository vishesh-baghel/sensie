import { prisma } from '@/lib/db/client';

/**
 * ProgressTracker - Mastery calculation and progress management
 *
 * Calculates mastery percentages using weighted factors:
 * - Correct answers (40%)
 * - Answer depth (30%)
 * - Recency (20%)
 * - No hints bonus (10%)
 */

const MASTERY_WEIGHTS = {
  ACCURACY: 0.4,
  DEPTH: 0.3,
  RECENCY: 0.2,
  NO_HINTS_BONUS: 0.1,
};

const RECENCY_DECAY = {
  HALF_LIFE_DAYS: 7, // Mastery halves every 7 days without activity
  MAX_DECAY: 0.3, // Maximum 30% decay
};

const UNLOCK_THRESHOLD = 70; // 70% mastery to unlock next subtopic

/**
 * Calculate mastery percentage for a topic
 */
export async function calculateTopicMastery(
  topicId: string,
  userId: string
): Promise<number> {
  // Get all subtopics for this topic
  const subtopics = await prisma.subtopic.findMany({
    where: { topicId },
    include: {
      concepts: true,
    },
  });

  if (subtopics.length === 0) {
    return 0;
  }

  // Calculate mastery for each subtopic and average
  let totalMastery = 0;
  let weightedCount = 0;

  for (const subtopic of subtopics) {
    const subtopicMastery = await calculateSubtopicMastery(subtopic.id, userId);
    // Weight by number of concepts (more concepts = more important)
    const weight = subtopic.concepts.length || 1;
    totalMastery += subtopicMastery * weight;
    weightedCount += weight;
  }

  return weightedCount > 0 ? Math.round(totalMastery / weightedCount) : 0;
}

/**
 * Calculate mastery percentage for a subtopic
 */
export async function calculateSubtopicMastery(
  subtopicId: string,
  userId: string
): Promise<number> {
  // Get all answers for this subtopic
  const answers = await prisma.answer.findMany({
    where: {
      userId,
      question: {
        concept: {
          subtopicId,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      question: true,
    },
  });

  if (answers.length === 0) {
    return 0;
  }

  // Calculate metrics
  const totalAnswers = answers.length;
  const correctAnswers = answers.filter(a => a.isCorrect).length;
  const deepAnswers = answers.filter(a => a.depth === 'DEEP').length;
  const hintsUsed = answers.reduce((sum, a) => sum + a.hintsUsed, 0);

  // Get days since last activity
  const lastAnswer = answers[0];
  const daysSinceLastActivity = Math.floor(
    (Date.now() - lastAnswer.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  return calculateWeightedMastery({
    correctAnswers,
    totalAnswers,
    deepAnswers,
    hintsUsed,
    daysSinceLastActivity,
  });
}

/**
 * Update mastery percentage in database
 */
export async function updateMastery(
  topicId: string,
  userId: string
): Promise<void> {
  const mastery = await calculateTopicMastery(topicId, userId);

  // Update topic mastery
  await prisma.topic.update({
    where: { id: topicId },
    data: {
      masteryPercentage: mastery,
    },
  });

  // Update subtopic masteries
  const subtopics = await prisma.subtopic.findMany({
    where: { topicId },
  });

  for (const subtopic of subtopics) {
    const subtopicMastery = await calculateSubtopicMastery(subtopic.id, userId);
    await prisma.subtopic.update({
      where: { id: subtopic.id },
      data: { masteryPercentage: subtopicMastery },
    });
  }
}

/**
 * Check if topic is mastered based on user threshold
 */
export function isTopicMastered(
  mastery: number,
  threshold: number
): boolean {
  return mastery >= threshold;
}

/**
 * Calculate weighted mastery score
 */
export function calculateWeightedMastery(metrics: {
  correctAnswers: number;
  totalAnswers: number;
  deepAnswers: number;
  hintsUsed: number;
  daysSinceLastActivity: number;
}): number {
  const { correctAnswers, totalAnswers, deepAnswers, hintsUsed, daysSinceLastActivity } = metrics;

  if (totalAnswers === 0) {
    return 0;
  }

  // 1. Accuracy score (40%)
  const accuracyScore = (correctAnswers / totalAnswers) * 100;

  // 2. Depth score (30%) - based on percentage of deep answers
  const depthScore = (deepAnswers / totalAnswers) * 100;

  // 3. Recency score (20%) - apply decay based on inactivity
  const recencyScore = applyRecencyDecay(100, daysSinceLastActivity);

  // 4. No hints bonus (10%) - bonus for not using hints
  const avgHintsPerQuestion = hintsUsed / totalAnswers;
  // Max bonus if no hints, decreases by 25% per hint used on average
  const noHintsScore = Math.max(0, 100 - avgHintsPerQuestion * 25);

  // Calculate weighted total
  const weightedMastery =
    accuracyScore * MASTERY_WEIGHTS.ACCURACY +
    depthScore * MASTERY_WEIGHTS.DEPTH +
    recencyScore * MASTERY_WEIGHTS.RECENCY +
    noHintsScore * MASTERY_WEIGHTS.NO_HINTS_BONUS;

  return Math.round(Math.min(100, Math.max(0, weightedMastery)));
}

/**
 * Apply recency decay to mastery score
 * Mastery decreases slightly over time without practice
 */
export function applyRecencyDecay(
  mastery: number,
  daysSinceLastActivity: number
): number {
  if (daysSinceLastActivity <= 0) {
    return mastery;
  }

  // Exponential decay with half-life
  const decayFactor = Math.pow(0.5, daysSinceLastActivity / RECENCY_DECAY.HALF_LIFE_DAYS);
  const decay = 1 - decayFactor;
  const cappedDecay = Math.min(decay, RECENCY_DECAY.MAX_DECAY);

  return mastery * (1 - cappedDecay);
}

/**
 * Get progress summary for a topic
 */
export async function getProgressSummary(
  topicId: string,
  userId: string
): Promise<{
  topicMastery: number;
  subtopicsCompleted: number;
  totalSubtopics: number;
  conceptsMastered: number;
  totalConcepts: number;
  questionsAnswered: number;
  correctRate: number;
}> {
  // Get topic with subtopics and concepts
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

  // Get all answers for this topic
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
  });

  const totalSubtopics = topic.subtopics.length;
  const subtopicsCompleted = topic.subtopics.filter(
    s => s.masteryPercentage >= UNLOCK_THRESHOLD
  ).length;

  const totalConcepts = topic.subtopics.reduce(
    (sum, s) => sum + s.concepts.length,
    0
  );

  // Get concepts with mastered questions
  const conceptIds = topic.subtopics.flatMap(s => s.concepts.map(c => c.id));
  const masteredConcepts = await prisma.concept.count({
    where: {
      id: { in: conceptIds },
      isMastered: true,
    },
  });

  const questionsAnswered = answers.length;
  const correctAnswers = answers.filter(a => a.isCorrect).length;
  const correctRate = questionsAnswered > 0
    ? Math.round((correctAnswers / questionsAnswered) * 100)
    : 0;

  return {
    topicMastery: topic.masteryPercentage,
    subtopicsCompleted,
    totalSubtopics,
    conceptsMastered: masteredConcepts,
    totalConcepts,
    questionsAnswered,
    correctRate,
  };
}

/**
 * Check if user should unlock next subtopic
 */
export async function shouldUnlockNextSubtopic(
  currentSubtopicId: string
): Promise<boolean> {
  const currentSubtopic = await prisma.subtopic.findUnique({
    where: { id: currentSubtopicId },
  });

  if (!currentSubtopic) {
    return false;
  }

  return currentSubtopic.masteryPercentage >= UNLOCK_THRESHOLD;
}

/**
 * Get next action for user in topic
 */
export async function getNextAction(
  topicId: string,
  userId: string
): Promise<{
  action: 'continue' | 'review' | 'complete' | 'unlock';
  subtopicId?: string;
  conceptId?: string;
}> {
  // Get topic with subtopics and their concepts
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      subtopics: {
        orderBy: { order: 'asc' },
        include: {
          concepts: true,
        },
      },
    },
  });

  if (!topic) {
    throw new Error('Topic not found');
  }

  // Check if topic is complete
  if (topic.masteryPercentage >= 100 || topic.status === 'COMPLETED') {
    return { action: 'complete' };
  }

  // Check for reviews due
  const reviewsDue = await prisma.review.count({
    where: {
      userId,
      topicId,
      nextReview: { lte: new Date() },
      status: { not: 'GRADUATED' },
    },
  });

  if (reviewsDue > 0) {
    return { action: 'review' };
  }

  // Find the current active subtopic
  const activeSubtopic = topic.subtopics.find((s: typeof topic.subtopics[number]) => !s.isLocked && s.masteryPercentage < UNLOCK_THRESHOLD);

  if (activeSubtopic) {
    // Find an uncompleted concept in this subtopic
    const activeConcept = activeSubtopic.concepts.find((c: typeof activeSubtopic.concepts[number]) => !c.isMastered);

    if (activeConcept) {
      return {
        action: 'continue',
        subtopicId: activeSubtopic.id,
        conceptId: activeConcept.id,
      };
    }
  }

  // Check if we should unlock the next subtopic
  const unlockedSubtopics = topic.subtopics.filter((s: typeof topic.subtopics[number]) => !s.isLocked);
  const lastUnlockedSubtopic = unlockedSubtopics[unlockedSubtopics.length - 1];

  if (lastUnlockedSubtopic && await shouldUnlockNextSubtopic(lastUnlockedSubtopic.id)) {
    // Find the next locked subtopic
    const nextLockedSubtopic = topic.subtopics.find(
      (s: typeof topic.subtopics[number]) => s.isLocked && s.order > lastUnlockedSubtopic.order
    );

    if (nextLockedSubtopic) {
      return {
        action: 'unlock',
        subtopicId: nextLockedSubtopic.id,
      };
    }
  }

  // Default to continuing with the first active subtopic
  const firstActiveSubtopic = topic.subtopics.find((s: typeof topic.subtopics[number]) => !s.isLocked);
  if (firstActiveSubtopic) {
    const firstConcept = firstActiveSubtopic.concepts[0];
    return {
      action: 'continue',
      subtopicId: firstActiveSubtopic.id,
      conceptId: firstConcept?.id,
    };
  }

  // Topic complete
  return { action: 'complete' };
}
