import { prisma } from './client';
import type { Review, ReviewType, ReviewStatus } from '@prisma/client';

const MAX_REVIEWS_PER_SESSION = 20;

/**
 * Create a new review item
 */
export async function createReview(data: {
  userId: string;
  topicId: string;
  subtopicId?: string;
  conceptId?: string;
  type: ReviewType;
  nextReview: Date;
}): Promise<Review> {
  return prisma.review.create({
    data: {
      userId: data.userId,
      topicId: data.topicId,
      subtopicId: data.subtopicId,
      conceptId: data.conceptId,
      type: data.type,
      nextReview: data.nextReview,
      status: 'NEW',
    },
  });
}

/**
 * Get reviews due for a user
 */
export async function getReviewsDue(
  userId: string,
  limit: number = MAX_REVIEWS_PER_SESSION
): Promise<Review[]> {
  return prisma.review.findMany({
    where: {
      userId,
      nextReview: { lte: new Date() },
    },
    orderBy: { nextReview: 'asc' },
    take: limit,
  });
}

/**
 * Get review by ID
 */
export async function getReviewById(reviewId: string): Promise<Review | null> {
  return prisma.review.findUnique({
    where: { id: reviewId },
  });
}

/**
 * Count reviews due for a user
 */
export async function countReviewsDue(userId: string): Promise<number> {
  return prisma.review.count({
    where: {
      userId,
      nextReview: { lte: new Date() },
    },
  });
}

/**
 * Update review after rating (FSRS algorithm)
 */
export async function updateReviewAfterRating(
  reviewId: string,
  data: {
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    state: number;
    lastReviewed: Date;
    nextReview: Date;
    lastRating: number;
    status: ReviewStatus;
  }
): Promise<Review> {
  return prisma.review.update({
    where: { id: reviewId },
    data,
  });
}

/**
 * Get reviews by status
 */
export async function getReviewsByStatus(
  userId: string,
  status: ReviewStatus
): Promise<Review[]> {
  return prisma.review.findMany({
    where: { userId, status },
    orderBy: { nextReview: 'asc' },
  });
}

/**
 * Check if review exists for item
 */
export async function reviewExistsForItem(
  userId: string,
  topicId: string,
  subtopicId?: string,
  conceptId?: string
): Promise<boolean> {
  const review = await prisma.review.findFirst({
    where: {
      userId,
      topicId,
      ...(subtopicId && { subtopicId }),
      ...(conceptId && { conceptId }),
    },
  });
  return !!review;
}

/**
 * Get review stats for user
 */
export async function getReviewStats(userId: string): Promise<{
  totalReviews: number;
  dueToday: number;
  completed: number;
  averageRetention: number;
}> {
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const endOfDay = new Date(now.setHours(23, 59, 59, 999));

  const [totalReviews, dueToday, graduated] = await Promise.all([
    prisma.review.count({ where: { userId } }),
    prisma.review.count({
      where: {
        userId,
        nextReview: { gte: startOfDay, lte: endOfDay },
      },
    }),
    prisma.review.count({
      where: { userId, status: 'GRADUATED' },
    }),
  ]);

  // Calculate average retention based on graduated vs total
  const averageRetention = totalReviews > 0
    ? Math.round((graduated / totalReviews) * 100)
    : 0;

  return {
    totalReviews,
    dueToday,
    completed: graduated,
    averageRetention,
  };
}
