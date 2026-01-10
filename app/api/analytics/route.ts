import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getLearningAnalytics } from '@/lib/learning/analytics-engine';

/**
 * GET /api/analytics
 * Get learning analytics for the current user
 *
 * Query params:
 * - period: 'daily' | 'weekly' | 'monthly' | 'all-time' (default: 'weekly')
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const url = new URL(request.url);
    const periodParam = url.searchParams.get('period') || 'weekly';

    // Validate period
    const validPeriods = ['daily', 'weekly', 'monthly', 'all-time'];
    if (!validPeriods.includes(periodParam)) {
      return NextResponse.json(
        { error: 'Invalid period. Use: daily, weekly, monthly, or all-time' },
        { status: 400 }
      );
    }

    const period = periodParam as 'daily' | 'weekly' | 'monthly' | 'all-time';

    const analytics = await getLearningAnalytics(session.userId, period);

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error('[analytics] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get analytics' },
      { status: 500 }
    );
  }
}
