import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getReviewById, updateReviewAfterRating } from '@/lib/db/reviews';
import { updateTodayAnalytics } from '@/lib/db/progress';
import { fsrs, Grade, Rating } from 'ts-fsrs';
import type { ReviewStatus } from '.prisma/client-sensie';

// Initialize FSRS scheduler
const scheduler = fsrs();

/**
 * POST /api/review/record
 * Record a review rating (1-4 FSRS scale)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const { reviewId, rating } = body;

    if (!reviewId || typeof rating !== 'number' || rating < 1 || rating > 4) {
      return NextResponse.json(
        { error: 'Valid reviewId and rating (1-4) required' },
        { status: 400 }
      );
    }

    const review = await getReviewById(reviewId);
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (review.userId !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build FSRS card from current review state
    const card = {
      due: new Date(review.nextReview),
      stability: review.stability,
      difficulty: review.difficulty,
      elapsed_days: review.elapsedDays,
      scheduled_days: review.scheduledDays,
      reps: review.reps,
      lapses: review.lapses,
      state: review.state,
      last_review: review.lastReviewed || undefined,
    };

    // Convert rating to FSRS Grade
    const gradeMap: Record<number, Grade> = {
      1: Rating.Again,
      2: Rating.Hard,
      3: Rating.Good,
      4: Rating.Easy,
    };

    // Schedule next review using FSRS
    const now = new Date();
    const scheduling = scheduler.repeat(card, now);
    const result = scheduling[gradeMap[rating]];

    // Map FSRS state to our ReviewStatus
    const stateToStatus: Record<number, ReviewStatus> = {
      0: 'NEW',
      1: 'LEARNING',
      2: 'GRADUATED',
      3: 'LAPSED',
    };

    // Update review with new scheduling
    const updatedReview = await updateReviewAfterRating(reviewId, {
      stability: result.card.stability,
      difficulty: result.card.difficulty,
      elapsedDays: result.card.elapsed_days,
      scheduledDays: result.card.scheduled_days,
      reps: result.card.reps,
      lapses: result.card.lapses,
      state: result.card.state,
      lastReviewed: now,
      nextReview: result.card.due,
      lastRating: rating,
      status: stateToStatus[result.card.state] || 'LEARNING',
    });

    // Update today's analytics
    await updateTodayAnalytics(session.userId, {
      reviewsCompleted: 1,
    });

    return NextResponse.json({
      review: updatedReview,
      nextReview: result.card.due,
    });
  } catch (error) {
    console.error('Record review error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
