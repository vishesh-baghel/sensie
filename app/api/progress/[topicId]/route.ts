import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getTopicById } from '@/lib/db/topics';
import { getProgressSummary, getNextAction } from '@/lib/learning/progress-tracker';
import { getReviewStats, countReviewsDue } from '@/lib/db/reviews';

interface RouteParams {
  params: Promise<{ topicId: string }>;
}

/**
 * GET /api/progress/[topicId]
 * Get progress for specific topic
 *
 * Returns:
 * - Topic mastery percentage
 * - Subtopics completed / total
 * - Concepts mastered / total
 * - Questions answered
 * - Correct rate
 * - Reviews due
 * - Next action recommendation
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getSession();
    const auth = requireAuth(session);
    if (!auth.authorized || !session) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { topicId } = await params;

    if (!topicId) {
      return NextResponse.json(
        { error: 'Topic ID is required' },
        { status: 400 }
      );
    }

    // Get the topic
    const topic = await getTopicById(topicId);
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    // Verify topic belongs to user
    if (topic.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Not authorized to access this topic' },
        { status: 403 }
      );
    }

    // Get progress summary
    const progressSummary = await getProgressSummary(topicId, session.userId);

    // Get next action recommendation
    const nextAction = await getNextAction(topicId, session.userId);

    // Get review stats
    const reviewsDue = await countReviewsDue(session.userId);
    const reviewStats = await getReviewStats(session.userId);

    return NextResponse.json({
      success: true,
      progress: {
        topicId,
        topicName: topic.name,
        status: topic.status,
        mastery: progressSummary.topicMastery,
        subtopics: {
          completed: progressSummary.subtopicsCompleted,
          total: progressSummary.totalSubtopics,
          percentage: progressSummary.totalSubtopics > 0
            ? Math.round((progressSummary.subtopicsCompleted / progressSummary.totalSubtopics) * 100)
            : 0,
        },
        concepts: {
          mastered: progressSummary.conceptsMastered,
          total: progressSummary.totalConcepts,
          percentage: progressSummary.totalConcepts > 0
            ? Math.round((progressSummary.conceptsMastered / progressSummary.totalConcepts) * 100)
            : 0,
        },
        questions: {
          answered: progressSummary.questionsAnswered,
          correctRate: progressSummary.correctRate,
        },
        reviews: {
          dueNow: reviewsDue,
          totalReviews: reviewStats.totalReviews,
          completed: reviewStats.completed,
          averageRetention: reviewStats.averageRetention,
        },
        nextAction: {
          action: nextAction.action,
          subtopicId: nextAction.subtopicId,
          conceptId: nextAction.conceptId,
          recommendation: getActionRecommendation(nextAction.action),
        },
      },
    });
  } catch (error) {
    console.error('Error getting progress:', error);
    return NextResponse.json(
      { error: 'Failed to get progress' },
      { status: 500 }
    );
  }
}

/**
 * Get human-readable recommendation based on next action
 */
function getActionRecommendation(action: string): string {
  switch (action) {
    case 'continue':
      return "Ready to continue? Let's keep that momentum going!";
    case 'review':
      return "You have reviews due! Keep that knowledge fresh.";
    case 'complete':
      return "Hohoho! You've mastered this topic. Time to celebrate!";
    case 'unlock':
      return "Great progress! Ready to unlock the next section?";
    default:
      return "Keep training, young one!";
  }
}
