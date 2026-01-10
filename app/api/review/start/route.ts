import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getReviewsDue, countReviewsDue, getReviewStats } from '@/lib/db/reviews';
import { prisma } from '@/lib/db/client';
import { generateQuestion } from '@/lib/mastra/agents/sensie';
import type { SocraticContext, QuestionType } from '@/lib/types';

const MAX_REVIEWS_PER_SESSION = 20;

/**
 * POST /api/review/start
 * Start a spaced repetition review session
 *
 * Request body (optional):
 * - limit?: number - Max reviews to return (default 20)
 * - topicId?: string - Optional filter by topic
 *
 * Returns:
 * - Review items due with questions
 * - Stats about the review session
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const auth = requireAuth(session);
    if (!auth.authorized || !session) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    // Parse optional body
    let limit = MAX_REVIEWS_PER_SESSION;
    let topicId: string | undefined;

    try {
      const body = await request.json();
      limit = Math.min(body.limit || MAX_REVIEWS_PER_SESSION, MAX_REVIEWS_PER_SESSION);
      topicId = body.topicId;
    } catch {
      // No body provided, use defaults
    }

    // Get reviews due
    const reviewsDue = await getReviewsDue(session.userId, limit);

    // Filter by topic if specified
    const filteredReviews = topicId
      ? reviewsDue.filter(r => r.topicId === topicId)
      : reviewsDue;

    if (filteredReviews.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Hohoho! No reviews due right now. Great work keeping up with your training!",
        reviewSession: {
          totalDue: 0,
          items: [],
        },
        stats: await getReviewStats(session.userId),
      });
    }

    // Get review items with their associated content
    const reviewItems = await Promise.all(
      filteredReviews.map(async (review) => {
        // Get the concept being reviewed
        const concept = review.conceptId
          ? await prisma.concept.findUnique({
              where: { id: review.conceptId },
              include: {
                subtopic: {
                  include: { topic: true },
                },
              },
            })
          : null;

        // Get the subtopic if reviewing a subtopic
        const subtopic = review.subtopicId && !review.conceptId
          ? await prisma.subtopic.findUnique({
              where: { id: review.subtopicId },
              include: { topic: true },
            })
          : null;

        // Get the topic if reviewing a whole topic
        const topic = !review.subtopicId && !review.conceptId
          ? await prisma.topic.findUnique({
              where: { id: review.topicId },
            })
          : null;

        // Generate a review question for this item
        let reviewQuestion = null;
        if (concept) {
          const context: SocraticContext = {
            topicId: review.topicId,
            subtopicId: review.subtopicId || concept.subtopicId,
            conceptId: concept.id,
            userLevel: 5,
            previousAnswers: [],
            hintsUsed: 0,
          };

          try {
            reviewQuestion = await generateQuestion(context);
          } catch (error) {
            console.error('Error generating review question:', error);
            // Fallback question
            reviewQuestion = {
              text: `What can you tell me about ${concept.name}?`,
              type: 'RECALL' as QuestionType,
              difficulty: review.difficulty || 3,
              expectedElements: [],
              hints: [],
              followUpPrompts: [],
            };
          }
        }

        return {
          reviewId: review.id,
          type: review.type,
          status: review.status,
          topicName: concept?.subtopic.topic.name || subtopic?.topic.name || topic?.name,
          subtopicName: concept?.subtopic.name || subtopic?.name,
          conceptName: concept?.name,
          conceptId: concept?.id,
          // FSRS card data
          stability: review.stability,
          difficulty: review.difficulty,
          reps: review.reps,
          lapses: review.lapses,
          lastReviewed: review.lastReviewed,
          // The review question
          question: reviewQuestion,
        };
      })
    );

    // Get overall stats
    const stats = await getReviewStats(session.userId);
    const totalDue = await countReviewsDue(session.userId);

    return NextResponse.json({
      success: true,
      message: `You have ${totalDue} review${totalDue === 1 ? '' : 's'} due. Let's keep that knowledge fresh!`,
      reviewSession: {
        totalDue,
        sessionSize: reviewItems.length,
        items: reviewItems,
      },
      stats: {
        ...stats,
        message: getReviewStatsMessage(stats),
      },
    });
  } catch (error) {
    console.error('Error starting review session:', error);
    return NextResponse.json(
      { error: 'Failed to start review session' },
      { status: 500 }
    );
  }
}

/**
 * Generate an encouraging message based on review stats
 */
function getReviewStatsMessage(stats: {
  totalReviews: number;
  dueToday: number;
  completed: number;
  averageRetention: number;
}): string {
  if (stats.averageRetention >= 90) {
    return "Hohoho! Your memory is as sharp as a master's blade!";
  } else if (stats.averageRetention >= 70) {
    return "Good retention! Keep up the consistent practice.";
  } else if (stats.averageRetention >= 50) {
    return "Room for improvement. More frequent reviews will help.";
  } else {
    return "Let's strengthen that memory! Regular reviews are key.";
  }
}
