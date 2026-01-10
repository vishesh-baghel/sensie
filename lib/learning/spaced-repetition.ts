import { fsrs, createEmptyCard, Rating as FSRSRating, State as FSRSState, type Grade } from 'ts-fsrs';
import type { Card, Rating, State, ReviewItem, ReviewResult, ReviewStatus } from '@/lib/types';
import { prisma } from '@/lib/db/client';

/**
 * SpacedRepetitionScheduler - FSRS algorithm implementation
 *
 * Uses the ts-fsrs library for optimal review scheduling.
 * FSRS (Free Spaced Repetition Scheduler) is a modern SRS algorithm.
 */

// Initialize FSRS with default parameters
const scheduler = fsrs();

// Maximum reviews per session to prevent fatigue
export const MAX_REVIEWS_PER_SESSION = 20;

/**
 * Create a new card for spaced repetition
 */
export function createCard(): Card {
  const emptyCard = createEmptyCard();
  return {
    due: emptyCard.due,
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty,
    elapsed_days: emptyCard.elapsed_days,
    scheduled_days: emptyCard.scheduled_days,
    reps: emptyCard.reps,
    lapses: emptyCard.lapses,
    state: emptyCard.state as unknown as State,
    last_review: emptyCard.last_review ?? undefined,
  };
}

/**
 * Schedule next review based on FSRS algorithm
 * @param card - Current card state
 * @param rating - User rating (1=Again, 2=Hard, 3=Good, 4=Easy)
 */
export function scheduleNextReview(card: Card, rating: Rating): Card {
  const fsrsCard = {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as unknown as FSRSState,
    last_review: card.last_review,
  };

  const now = new Date();

  // Map our rating to FSRS rating (Grade type)
  const ratingMap: Record<Rating, Grade> = {
    1: FSRSRating.Again,
    2: FSRSRating.Hard,
    3: FSRSRating.Good,
    4: FSRSRating.Easy,
  };

  const fsrsRating = ratingMap[rating];

  // Use next for a specific rating
  const result = scheduler.next(fsrsCard, now, fsrsRating);

  return {
    due: result.card.due,
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    elapsed_days: result.card.elapsed_days,
    scheduled_days: result.card.scheduled_days,
    reps: result.card.reps,
    lapses: result.card.lapses,
    state: result.card.state as unknown as State,
    last_review: result.card.last_review ?? undefined,
  };
}

/**
 * Get reviews due for a user
 * @param userId - User ID
 * @param limit - Maximum number of reviews (default 20)
 */
export async function getReviewsDue(
  userId: string,
  limit: number = MAX_REVIEWS_PER_SESSION
): Promise<ReviewItem[]> {
  const now = new Date();

  const reviews = await prisma.review.findMany({
    where: {
      userId,
      nextReview: { lte: now },
      status: { not: 'GRADUATED' },
    },
    orderBy: [
      { nextReview: 'asc' }, // Oldest due first
    ],
    take: limit,
    include: {
      topic: {
        select: { name: true },
      },
    },
  });

  // Fetch subtopic and concept names separately if needed
  const reviewItems: ReviewItem[] = [];
  for (const review of reviews) {
    let subtopicName: string | undefined;
    let conceptName: string | undefined;

    if (review.subtopicId) {
      const subtopic = await prisma.subtopic.findUnique({
        where: { id: review.subtopicId },
        select: { name: true },
      });
      subtopicName = subtopic?.name;
    }

    if (review.conceptId) {
      const concept = await prisma.concept.findUnique({
        where: { id: review.conceptId },
        select: { name: true },
      });
      conceptName = concept?.name;
    }

    reviewItems.push({
      id: review.id,
      userId: review.userId,
      topicId: review.topicId,
      topicName: review.topic.name,
      subtopicId: review.subtopicId ?? undefined,
      subtopicName,
      conceptId: review.conceptId ?? undefined,
      conceptName,
      type: review.type,
      dueDate: review.nextReview,
      status: review.status,
      lastReviewed: review.lastReviewed ?? undefined,
    });
  }

  return reviewItems;
}

/**
 * Create a new review item in the database
 */
export async function createReviewItem(
  userId: string,
  itemId: string,
  itemType: 'TOPIC' | 'SUBTOPIC' | 'CONCEPT'
): Promise<ReviewItem> {
  // Determine which field to set based on type
  const itemData = itemType === 'TOPIC'
    ? { topicId: itemId }
    : itemType === 'SUBTOPIC'
      ? { subtopicId: itemId }
      : { conceptId: itemId };

  // Get the topicId for the review (required field)
  let topicId: string;
  if (itemType === 'TOPIC') {
    topicId = itemId;
  } else if (itemType === 'SUBTOPIC') {
    const subtopic = await prisma.subtopic.findUnique({
      where: { id: itemId },
      select: { topicId: true },
    });
    if (!subtopic) throw new Error('Subtopic not found');
    topicId = subtopic.topicId;
  } else {
    const concept = await prisma.concept.findUnique({
      where: { id: itemId },
      include: { subtopic: { select: { topicId: true } } },
    });
    if (!concept) throw new Error('Concept not found');
    topicId = concept.subtopic.topicId;
  }

  // Create a new card
  const card = createCard();

  const review = await prisma.review.create({
    data: {
      userId,
      topicId,
      ...itemData,
      type: itemType,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsed_days,
      scheduledDays: card.scheduled_days,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      nextReview: card.due,
      status: 'NEW',
    },
    include: {
      topic: { select: { name: true } },
    },
  });

  // Fetch subtopic and concept names if they exist
  let subtopicName: string | undefined;
  let conceptName: string | undefined;

  if (review.subtopicId) {
    const subtopic = await prisma.subtopic.findUnique({
      where: { id: review.subtopicId },
      select: { name: true },
    });
    subtopicName = subtopic?.name;
  }

  if (review.conceptId) {
    const concept = await prisma.concept.findUnique({
      where: { id: review.conceptId },
      select: { name: true },
    });
    conceptName = concept?.name;
  }

  return {
    id: review.id,
    userId: review.userId,
    topicId: review.topicId,
    topicName: review.topic.name,
    subtopicId: review.subtopicId ?? undefined,
    subtopicName,
    conceptId: review.conceptId ?? undefined,
    conceptName,
    type: review.type,
    dueDate: review.nextReview,
    status: review.status,
    lastReviewed: review.lastReviewed ?? undefined,
  };
}

/**
 * Record a review result and update schedule
 */
export async function recordReview(
  reviewId: string,
  rating: Rating
): Promise<ReviewResult> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw new Error('Review not found');
  }

  // Build card from review state
  const card: Card = {
    due: review.nextReview,
    stability: review.stability,
    difficulty: review.difficulty,
    elapsed_days: review.elapsedDays,
    scheduled_days: review.scheduledDays,
    reps: review.reps,
    lapses: review.lapses,
    state: review.state as State,
    last_review: review.lastReviewed ?? undefined,
  };

  // Schedule next review
  const updatedCard = scheduleNextReview(card, rating);
  const newStatus = stateToStatus(updatedCard.state);

  // Update review in database
  await prisma.review.update({
    where: { id: reviewId },
    data: {
      stability: updatedCard.stability,
      difficulty: updatedCard.difficulty,
      elapsedDays: updatedCard.elapsed_days,
      scheduledDays: updatedCard.scheduled_days,
      reps: updatedCard.reps,
      lapses: updatedCard.lapses,
      state: updatedCard.state,
      lastReviewed: new Date(),
      nextReview: updatedCard.due,
      lastRating: rating,
      status: newStatus,
    },
  });

  return {
    reviewId,
    rating,
    nextReviewDate: updatedCard.due,
    newStatus,
  };
}

/**
 * Get the next review date for a card
 */
export function getNextReviewDate(card: Card, rating: Rating): Date {
  const updatedCard = scheduleNextReview(card, rating);
  return updatedCard.due;
}

/**
 * Check if card is due for review
 */
export function isCardDue(card: Card): boolean {
  return card.due <= new Date();
}

/**
 * Convert FSRS state to review status
 */
export function stateToStatus(state: State): ReviewStatus {
  const stateMap: Record<State, ReviewStatus> = {
    0: 'NEW', // State.New
    1: 'LEARNING', // State.Learning
    2: 'GRADUATED', // State.Review
    3: 'LAPSED', // State.Relearning
  };
  return stateMap[state] || 'LEARNING';
}

/**
 * Calculate retention probability for a card
 * Uses FSRS formula: R = (1 + elapsed_days / (9 * stability))^(-1)
 */
export function calculateRetention(card: Card): number {
  if (card.stability === 0) {
    return 0;
  }

  const daysSinceReview = card.last_review
    ? (Date.now() - card.last_review.getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  // FSRS retention formula
  const retention = Math.pow(1 + daysSinceReview / (9 * card.stability), -1);
  return Math.max(0, Math.min(1, retention));
}

/**
 * Get optimal review interval based on desired retention
 * Default retention target is 90%
 */
export function getOptimalInterval(
  card: Card,
  desiredRetention: number = 0.9
): number {
  if (card.stability === 0 || desiredRetention <= 0 || desiredRetention >= 1) {
    return 0;
  }

  // Solve for interval: R = (1 + I / (9 * S))^(-1)
  // I = 9 * S * (R^(-1) - 1)
  const interval = 9 * card.stability * (Math.pow(desiredRetention, -1) - 1);
  return Math.max(0, Math.round(interval));
}

/**
 * Count reviews due for a user
 */
export async function countReviewsDue(userId: string): Promise<number> {
  const now = new Date();

  return prisma.review.count({
    where: {
      userId,
      nextReview: { lte: now },
      status: { not: 'GRADUATED' },
    },
  });
}

/**
 * Get review statistics for a user
 */
export async function getReviewStats(userId: string): Promise<{
  totalReviews: number;
  reviewsDue: number;
  graduated: number;
  learning: number;
  averageRetention: number;
}> {
  const now = new Date();

  const [total, due, graduated, learning] = await Promise.all([
    prisma.review.count({ where: { userId } }),
    prisma.review.count({
      where: { userId, nextReview: { lte: now }, status: { not: 'GRADUATED' } },
    }),
    prisma.review.count({ where: { userId, status: 'GRADUATED' } }),
    prisma.review.count({ where: { userId, status: 'LEARNING' } }),
  ]);

  // Calculate average retention from recent reviews
  const recentReviews = await prisma.review.findMany({
    where: { userId, lastReviewed: { not: null } },
    orderBy: { lastReviewed: 'desc' },
    take: 50,
  });

  const retentions = recentReviews.map(r => {
    const card: Card = {
      due: r.nextReview,
      stability: r.stability,
      difficulty: r.difficulty,
      elapsed_days: r.elapsedDays,
      scheduled_days: r.scheduledDays,
      reps: r.reps,
      lapses: r.lapses,
      state: r.state as State,
      last_review: r.lastReviewed ?? undefined,
    };
    return calculateRetention(card);
  });

  const averageRetention = retentions.length > 0
    ? retentions.reduce((sum, r) => sum + r, 0) / retentions.length
    : 0;

  return {
    totalReviews: total,
    reviewsDue: due,
    graduated,
    learning,
    averageRetention: Math.round(averageRetention * 100) / 100,
  };
}
