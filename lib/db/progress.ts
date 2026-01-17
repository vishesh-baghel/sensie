import { prisma } from './client';
import type { UserProgress, Badge, LearningAnalytics } from '.prisma/client-sensie';

// XP thresholds for each level (1-10)
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

/**
 * Get or create user progress
 */
export async function getUserProgress(userId: string): Promise<UserProgress> {
  let progress = await prisma.userProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    progress = await prisma.userProgress.create({
      data: { userId },
    });
  }

  return progress;
}

/**
 * Update XP and level
 */
export async function updateXP(userId: string, xpToAdd: number): Promise<UserProgress> {
  const progress = await getUserProgress(userId);
  const newTotalXP = progress.totalXP + xpToAdd;
  const newLevel = calculateLevel(newTotalXP);

  return prisma.userProgress.update({
    where: { userId },
    data: {
      totalXP: newTotalXP,
      currentLevel: newLevel,
    },
  });
}

/**
 * Update streak
 */
export async function updateStreak(userId: string): Promise<UserProgress> {
  const progress = await getUserProgress(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActivity = new Date(progress.lastActivityDate);
  lastActivity.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

  let newStreak = progress.currentStreak;

  if (daysDiff === 0) {
    // Same day, no change
    return progress;
  } else if (daysDiff === 1) {
    // Next day, increment streak
    newStreak = progress.currentStreak + 1;
  } else {
    // Missed days, reset streak
    newStreak = 1;
  }

  const longestStreak = Math.max(progress.longestStreak, newStreak);

  return prisma.userProgress.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak,
      lastActivityDate: new Date(),
    },
  });
}

/**
 * Reset streak (called if user misses a day)
 */
export async function resetStreak(userId: string): Promise<UserProgress> {
  return prisma.userProgress.update({
    where: { userId },
    data: {
      currentStreak: 0,
    },
  });
}

/**
 * Use a streak freeze
 */
export async function useStreakFreeze(userId: string): Promise<UserProgress> {
  const progress = await getUserProgress(userId);

  if (progress.streakFreezes <= 0) {
    throw new Error('No streak freezes available');
  }

  return prisma.userProgress.update({
    where: { userId },
    data: {
      streakFreezes: { decrement: 1 },
      lastActivityDate: new Date(),
    },
  });
}

/**
 * Award a badge to user
 */
export async function awardBadge(
  userId: string,
  badgeType: string,
  name: string,
  description: string,
  icon: string
): Promise<Badge> {
  return prisma.badge.create({
    data: {
      userId,
      badgeType,
      name,
      description,
      icon,
    },
  });
}

/**
 * Check if user has badge
 */
export async function hasBadge(
  userId: string,
  badgeType: string
): Promise<boolean> {
  const badge = await prisma.badge.findUnique({
    where: { userId_badgeType: { userId, badgeType } },
  });
  return !!badge;
}

/**
 * Get all badges for user
 */
export async function getUserBadges(userId: string): Promise<Badge[]> {
  return prisma.badge.findMany({
    where: { userId },
    orderBy: { earnedAt: 'desc' },
  });
}

/**
 * Get or create today's analytics
 */
export async function getTodayAnalytics(
  userId: string
): Promise<LearningAnalytics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let analytics = await prisma.learningAnalytics.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (!analytics) {
    analytics = await prisma.learningAnalytics.create({
      data: { userId, date: today },
    });
  }

  return analytics;
}

/**
 * Update today's analytics
 */
export async function updateTodayAnalytics(
  userId: string,
  data: {
    questionsAnswered?: number;
    questionsCorrect?: number;
    conceptsMastered?: number;
    reviewsCompleted?: number;
    timeSpent?: number;
    xpEarned?: number;
  }
): Promise<LearningAnalytics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.learningAnalytics.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      date: today,
      questionsAnswered: data.questionsAnswered || 0,
      questionsCorrect: data.questionsCorrect || 0,
      conceptsMastered: data.conceptsMastered || 0,
      reviewsCompleted: data.reviewsCompleted || 0,
      timeSpent: data.timeSpent || 0,
      xpEarned: data.xpEarned || 0,
    },
    update: {
      questionsAnswered: data.questionsAnswered !== undefined
        ? { increment: data.questionsAnswered }
        : undefined,
      questionsCorrect: data.questionsCorrect !== undefined
        ? { increment: data.questionsCorrect }
        : undefined,
      conceptsMastered: data.conceptsMastered !== undefined
        ? { increment: data.conceptsMastered }
        : undefined,
      reviewsCompleted: data.reviewsCompleted !== undefined
        ? { increment: data.reviewsCompleted }
        : undefined,
      timeSpent: data.timeSpent !== undefined
        ? { increment: data.timeSpent }
        : undefined,
      xpEarned: data.xpEarned !== undefined
        ? { increment: data.xpEarned }
        : undefined,
    },
  });
}

/**
 * Get analytics for date range
 */
export async function getAnalyticsRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<LearningAnalytics[]> {
  return prisma.learningAnalytics.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });
}

/**
 * Calculate level from XP
 */
export function calculateLevel(totalXP: number): number {
  for (let level = LEVEL_THRESHOLDS.length - 1; level >= 0; level--) {
    if (totalXP >= LEVEL_THRESHOLDS[level]) {
      return level + 1;
    }
  }
  return 1;
}
