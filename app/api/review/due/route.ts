import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getReviewsDue, countReviewsDue } from '@/lib/db/reviews';

/**
 * GET /api/review/due
 * Get reviews due for current user
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    const [reviews, totalDue] = await Promise.all([
      getReviewsDue(session.userId, limit),
      countReviewsDue(session.userId),
    ]);

    return NextResponse.json({
      reviews,
      totalDue,
      hasMore: totalDue > reviews.length,
    });
  } catch (error) {
    console.error('Get reviews due error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
