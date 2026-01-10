import type { PerformanceMetrics } from '@/lib/types';
import { prisma } from '@/lib/db/client';

/**
 * DifficultyAdjuster - Adaptive difficulty based on performance
 *
 * Adjusts question difficulty (1-5) based on:
 * - Accuracy rate
 * - Hint usage
 * - Time to answer
 * - Rolling window of recent answers
 */

/**
 * Difficulty thresholds
 */
export const DIFFICULTY_THRESHOLDS = {
  INCREASE: 0.8, // Accuracy > 80% -> increase difficulty
  MAINTAIN_UPPER: 0.8,
  MAINTAIN_LOWER: 0.5,
  DECREASE: 0.5, // Accuracy < 50% -> decrease difficulty
  MIN_SAMPLE_SIZE: 5,
  HINT_PENALTY: 0.1, // 10% penalty per hint
  MAX_DIFFICULTY: 5,
  MIN_DIFFICULTY: 1,
};

/**
 * Calculate recommended difficulty based on performance
 * Returns a difficulty level from 1-5
 */
export function calculateDifficulty(metrics: PerformanceMetrics): number {
  if (!hasSufficientSampleSize(metrics)) {
    // Default to medium difficulty with insufficient data
    return 3;
  }

  const effectiveAccuracy = calculateEffectiveAccuracy(metrics);

  // Map accuracy to difficulty
  // High accuracy (>80%) -> difficulty 4-5
  // Medium accuracy (50-80%) -> difficulty 3
  // Low accuracy (<50%) -> difficulty 1-2
  if (effectiveAccuracy >= 0.9) {
    return 5;
  } else if (effectiveAccuracy >= 0.8) {
    return 4;
  } else if (effectiveAccuracy >= 0.6) {
    return 3;
  } else if (effectiveAccuracy >= 0.4) {
    return 2;
  } else {
    return 1;
  }
}

/**
 * Check if difficulty should be adjusted
 */
export function shouldAdjust(
  currentDifficulty: number,
  performance: PerformanceMetrics
): boolean {
  if (!hasSufficientSampleSize(performance)) {
    return false;
  }

  const effectiveAccuracy = calculateEffectiveAccuracy(performance);

  // Should increase if doing well and not at max
  if (effectiveAccuracy >= DIFFICULTY_THRESHOLDS.INCREASE && currentDifficulty < DIFFICULTY_THRESHOLDS.MAX_DIFFICULTY) {
    return true;
  }

  // Should decrease if struggling and not at min
  if (effectiveAccuracy < DIFFICULTY_THRESHOLDS.DECREASE && currentDifficulty > DIFFICULTY_THRESHOLDS.MIN_DIFFICULTY) {
    return true;
  }

  return false;
}

/**
 * Get the next difficulty level
 * Increases if accuracy > 80%, decreases if < 50%
 */
export function getNextDifficulty(
  currentDifficulty: number,
  metrics: PerformanceMetrics
): number {
  if (!hasSufficientSampleSize(metrics)) {
    return currentDifficulty;
  }

  const effectiveAccuracy = calculateEffectiveAccuracy(metrics);

  if (effectiveAccuracy >= DIFFICULTY_THRESHOLDS.INCREASE) {
    // Increase difficulty, but cap at max
    return Math.min(currentDifficulty + 1, DIFFICULTY_THRESHOLDS.MAX_DIFFICULTY);
  } else if (effectiveAccuracy < DIFFICULTY_THRESHOLDS.DECREASE) {
    // Decrease difficulty, but floor at min
    return Math.max(currentDifficulty - 1, DIFFICULTY_THRESHOLDS.MIN_DIFFICULTY);
  }

  // Maintain current difficulty
  return currentDifficulty;
}

/**
 * Apply hint penalty to accuracy score
 * Each hint reduces effective score by 10%
 */
export function applyHintPenalty(
  baseScore: number,
  hintsUsed: number
): number {
  const penalty = hintsUsed * DIFFICULTY_THRESHOLDS.HINT_PENALTY;
  const adjustedScore = baseScore * (1 - penalty);
  return Math.max(0, adjustedScore); // Don't go below 0
}

/**
 * Calculate effective accuracy including penalties
 */
export function calculateEffectiveAccuracy(metrics: PerformanceMetrics): number {
  if (metrics.totalQuestions === 0) {
    return 0;
  }

  const baseAccuracy = metrics.correctAnswers / metrics.totalQuestions;

  // Apply hint penalty based on average hints per question
  const avgHintsPerQuestion = metrics.hintsUsed / metrics.totalQuestions;
  const effectiveAccuracy = applyHintPenalty(baseAccuracy, avgHintsPerQuestion);

  // Use recent accuracy if available and weighted
  // Recent performance matters more than overall
  if (metrics.recentAccuracy > 0) {
    const weightedAccuracy = effectiveAccuracy * 0.4 + metrics.recentAccuracy * 0.6;
    return weightedAccuracy;
  }

  return effectiveAccuracy;
}

/**
 * Check if sample size is sufficient for adjustment
 * Need at least 5 questions for reliable adjustment
 */
export function hasSufficientSampleSize(metrics: PerformanceMetrics): boolean {
  return metrics.totalQuestions >= DIFFICULTY_THRESHOLDS.MIN_SAMPLE_SIZE;
}

/**
 * Get performance metrics from recent answers
 */
export async function getPerformanceMetrics(
  userId: string,
  subtopicId: string,
  windowSize: number = 20
): Promise<PerformanceMetrics> {
  // Get recent answers for this subtopic
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
    take: windowSize,
    include: {
      question: true,
    },
  });

  if (answers.length === 0) {
    return {
      totalQuestions: 0,
      correctAnswers: 0,
      hintsUsed: 0,
      averageTimeToAnswer: 0,
      recentAccuracy: 0,
    };
  }

  const totalQuestions = answers.length;
  const correctAnswers = answers.filter(a => a.isCorrect).length;
  const hintsUsed = answers.reduce((sum, a) => sum + a.hintsUsed, 0);

  // Calculate average time (if we have timing data)
  const answersWithTime = answers.filter(a => a.timeToAnswer !== null);
  const averageTimeToAnswer = answersWithTime.length > 0
    ? answersWithTime.reduce((sum, a) => sum + (a.timeToAnswer || 0), 0) / answersWithTime.length
    : 0;

  // Recent accuracy is last 10 questions
  const recentAnswers = answers.slice(0, Math.min(10, answers.length));
  const recentCorrect = recentAnswers.filter(a => a.isCorrect).length;
  const recentAccuracy = recentAnswers.length > 0
    ? recentCorrect / recentAnswers.length
    : 0;

  return {
    totalQuestions,
    correctAnswers,
    hintsUsed,
    averageTimeToAnswer,
    recentAccuracy,
  };
}
