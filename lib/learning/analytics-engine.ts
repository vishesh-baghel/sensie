/**
 * Learning Analytics Engine
 *
 * Provides comprehensive analytics about a user's learning journey:
 * - Activity metrics (study time, sessions, questions)
 * - Progress metrics (topics, concepts, reviews)
 * - Gamification (XP, streaks, badges)
 * - Trends (daily activity patterns)
 */

import type { LearningAnalyticsSummary, DailyActivity } from '@/lib/types';
import { prisma } from '@/lib/db/client';

/**
 * Get learning analytics for a user over a specified period
 */
export async function getLearningAnalytics(
  userId: string,
  period: 'daily' | 'weekly' | 'monthly' | 'all-time'
): Promise<LearningAnalyticsSummary> {
  // Calculate date range
  const endDate = new Date();
  const startDate = getStartDate(period);

  // Get analytics records for the period
  const analyticsRecords = await prisma.learningAnalytics.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: 'asc' },
  });

  // Get user progress for streaks and XP
  const userProgress = await prisma.userProgress.findUnique({
    where: { userId },
  });

  // Get badges earned
  const badges = await prisma.badge.findMany({
    where: {
      userId,
      earnedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Get sessions for study time estimation
  const sessions = await prisma.learningSession.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      createdAt: true,
      lastActivity: true,
    },
  });

  // Get answers for accuracy calculation
  const answers = await prisma.answer.findMany({
    where: {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      isCorrect: true,
    },
  });

  // Get completed reviews
  const reviews = await prisma.review.findMany({
    where: {
      userId,
      lastReviewed: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Get completed Feynman exercises
  const feynmanExercises = await prisma.feynmanExercise.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Get topics mastered (completed)
  const topicsMastered = await prisma.topic.count({
    where: {
      userId,
      status: 'COMPLETED',
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Get concepts learned (mastered)
  const conceptsLearned = await prisma.concept.count({
    where: {
      subtopic: {
        topic: {
          userId,
        },
      },
      isMastered: true,
      masteredAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Calculate aggregated metrics
  const totalStudyTime = calculateStudyTime(sessions);
  const questionsAnswered = answers.length;
  const questionsCorrect = answers.filter(a => a.isCorrect).length;
  const accuracy = questionsAnswered > 0
    ? Math.round((questionsCorrect / questionsAnswered) * 100)
    : 0;

  // Aggregate from analytics records
  const totalXpFromRecords = analyticsRecords.reduce((sum, r) => sum + r.xpEarned, 0);

  // Build daily activity array
  const dailyActivity = buildDailyActivity(analyticsRecords, period);

  return {
    userId,
    period,
    startDate,
    endDate,
    totalStudyTime,
    sessionsCount: sessions.length,
    questionsAnswered,
    questionsCorrect,
    accuracy,
    topicsMastered,
    subtopicsMastered: 0, // Not tracked separately in MVP
    conceptsLearned,
    reviewsCompleted: reviews.length,
    feynmanExercisesCompleted: feynmanExercises.length,
    xpEarned: totalXpFromRecords || userProgress?.totalXP || 0,
    currentStreak: userProgress?.currentStreak || 0,
    longestStreak: userProgress?.longestStreak || 0,
    badgesEarned: badges.map(b => b.name),
    dailyActivity,
  };
}

/**
 * Record daily analytics for a user
 * Called after each learning action
 */
export async function recordAnalytics(
  userId: string,
  action: {
    questionsAnswered?: number;
    questionsCorrect?: number;
    conceptsMastered?: number;
    reviewsCompleted?: number;
    timeSpent?: number;
    xpEarned?: number;
  }
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.learningAnalytics.upsert({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    update: {
      questionsAnswered: action.questionsAnswered
        ? { increment: action.questionsAnswered }
        : undefined,
      questionsCorrect: action.questionsCorrect
        ? { increment: action.questionsCorrect }
        : undefined,
      conceptsMastered: action.conceptsMastered
        ? { increment: action.conceptsMastered }
        : undefined,
      reviewsCompleted: action.reviewsCompleted
        ? { increment: action.reviewsCompleted }
        : undefined,
      timeSpent: action.timeSpent
        ? { increment: action.timeSpent }
        : undefined,
      xpEarned: action.xpEarned
        ? { increment: action.xpEarned }
        : undefined,
    },
    create: {
      userId,
      date: today,
      questionsAnswered: action.questionsAnswered || 0,
      questionsCorrect: action.questionsCorrect || 0,
      conceptsMastered: action.conceptsMastered || 0,
      reviewsCompleted: action.reviewsCompleted || 0,
      timeSpent: action.timeSpent || 0,
      xpEarned: action.xpEarned || 0,
    },
  });
}

/**
 * Update user streak
 * Called when user completes a learning activity
 */
export async function updateStreak(userId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  streakBroken: boolean;
}> {
  const userProgress = await prisma.userProgress.findUnique({
    where: { userId },
  });

  if (!userProgress) {
    // Create initial progress
    const created = await prisma.userProgress.create({
      data: {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: new Date(),
      },
    });
    return {
      currentStreak: created.currentStreak,
      longestStreak: created.longestStreak,
      streakBroken: false,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActivity = new Date(userProgress.lastActivityDate);
  lastActivity.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

  let newStreak = userProgress.currentStreak;
  let streakBroken = false;

  if (daysDiff === 0) {
    // Same day, streak unchanged
  } else if (daysDiff === 1) {
    // Consecutive day, increment streak
    newStreak += 1;
  } else {
    // Streak broken
    streakBroken = true;
    newStreak = 1;
  }

  const newLongest = Math.max(userProgress.longestStreak, newStreak);

  await prisma.userProgress.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActivityDate: new Date(),
    },
  });

  return {
    currentStreak: newStreak,
    longestStreak: newLongest,
    streakBroken,
  };
}

/**
 * Award XP to a user
 */
export async function awardXP(userId: string, amount: number, reason?: string): Promise<number> {
  const userProgress = await prisma.userProgress.upsert({
    where: { userId },
    update: {
      totalXP: { increment: amount },
    },
    create: {
      userId,
      totalXP: amount,
    },
  });

  // Record in daily analytics
  await recordAnalytics(userId, { xpEarned: amount });

  // Check for level up
  const newLevel = calculateLevel(userProgress.totalXP);
  if (newLevel > userProgress.currentLevel) {
    await prisma.userProgress.update({
      where: { userId },
      data: { currentLevel: newLevel },
    });
  }

  console.log(`[analytics] XP awarded: ${amount} to user ${userId}${reason ? ` for ${reason}` : ''}`);

  return userProgress.totalXP;
}

/**
 * Calculate level from XP
 * Level 1: 0-99 XP
 * Level 2: 100-299 XP
 * Level 3: 300-599 XP
 * etc. (increases by 200 each level)
 */
export function calculateLevel(xp: number): number {
  let level = 1;
  let threshold = 100;
  let remaining = xp;

  while (remaining >= threshold) {
    remaining -= threshold;
    level++;
    threshold += 200;
  }

  return Math.min(level, 10); // Max level 10
}

/**
 * Get XP required for next level
 */
export function getXPForNextLevel(currentLevel: number): number {
  let threshold = 100;
  for (let i = 1; i < currentLevel; i++) {
    threshold += 200;
  }
  return threshold;
}

// Helper functions

function getStartDate(period: 'daily' | 'weekly' | 'monthly' | 'all-time'): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  switch (period) {
    case 'daily':
      // Today
      return date;
    case 'weekly':
      // Start of week (Sunday)
      date.setDate(date.getDate() - date.getDay());
      return date;
    case 'monthly':
      // Start of month
      date.setDate(1);
      return date;
    case 'all-time':
      // Beginning of time
      return new Date(0);
  }
}

function calculateStudyTime(
  sessions: Array<{ createdAt: Date; lastActivity: Date }>
): number {
  let totalMinutes = 0;

  for (const session of sessions) {
    const start = new Date(session.createdAt);
    const end = new Date(session.lastActivity);
    const minutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    // Cap at 120 minutes per session to avoid outliers
    totalMinutes += Math.min(minutes, 120);
  }

  return totalMinutes;
}

function buildDailyActivity(
  records: Array<{
    date: Date;
    questionsAnswered: number;
    questionsCorrect: number;
    xpEarned: number;
    timeSpent: number;
  }>,
  period: 'daily' | 'weekly' | 'monthly' | 'all-time'
): DailyActivity[] {
  // For daily period, return just today
  if (period === 'daily') {
    const today = records[0];
    if (today) {
      return [{
        date: today.date,
        studyTime: today.timeSpent,
        questionsAnswered: today.questionsAnswered,
        questionsCorrect: today.questionsCorrect,
        xpEarned: today.xpEarned,
      }];
    }
    return [];
  }

  // For other periods, return all records
  return records.map(r => ({
    date: r.date,
    studyTime: r.timeSpent,
    questionsAnswered: r.questionsAnswered,
    questionsCorrect: r.questionsCorrect,
    xpEarned: r.xpEarned,
  }));
}
