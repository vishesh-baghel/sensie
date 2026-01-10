import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getTopicsByUser } from '@/lib/db/topics';
import { getUserProgress, getUserBadges, getTodayAnalytics } from '@/lib/db/progress';
import { countReviewsDue } from '@/lib/db/reviews';

/**
 * GET /api/progress
 * Get overall progress for current user
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Fetch all progress data in parallel
    const [topics, userProgress, badges, todayAnalytics, reviewsDue] = await Promise.all([
      getTopicsByUser(session.userId),
      getUserProgress(session.userId),
      getUserBadges(session.userId),
      getTodayAnalytics(session.userId),
      countReviewsDue(session.userId),
    ]);

    // Calculate aggregate stats
    const completedTopics = topics.filter(t => t.status === 'COMPLETED').length;
    const activeTopics = topics.filter(t => t.status === 'ACTIVE').length;
    const totalMastery = topics.length > 0
      ? Math.round(topics.reduce((sum, t) => sum + t.masteryPercentage, 0) / topics.length)
      : 0;

    return NextResponse.json({
      overview: {
        totalXP: userProgress.totalXP,
        level: userProgress.currentLevel,
        currentStreak: userProgress.currentStreak,
        longestStreak: userProgress.longestStreak,
      },
      topics: {
        total: topics.length,
        active: activeTopics,
        completed: completedTopics,
        averageMastery: totalMastery,
      },
      today: {
        questionsAnswered: todayAnalytics.questionsAnswered,
        questionsCorrect: todayAnalytics.questionsCorrect,
        conceptsMastered: todayAnalytics.conceptsMastered,
        timeSpent: todayAnalytics.timeSpent,
        xpEarned: todayAnalytics.xpEarned,
      },
      reviews: {
        due: reviewsDue,
      },
      badges: badges.map(b => ({
        type: b.badgeType,
        name: b.name,
        icon: b.icon,
        earnedAt: b.earnedAt,
      })),
    });
  } catch (error) {
    console.error('Get progress error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
