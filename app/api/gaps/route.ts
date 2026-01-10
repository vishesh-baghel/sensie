import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { analyzeKnowledgeGaps, getUnresolvedGaps, resolveGap } from '@/lib/learning/gap-detector';

/**
 * GET /api/gaps
 * Get knowledge gaps for the current user
 *
 * Query params:
 * - topicId: Filter by topic (optional)
 * - analyze: If 'true', perform fresh analysis (default: false)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const url = new URL(request.url);
    const topicId = url.searchParams.get('topicId');
    const analyze = url.searchParams.get('analyze') === 'true';

    if (analyze && topicId) {
      // Perform fresh analysis
      const analysis = await analyzeKnowledgeGaps(session.userId, topicId);
      return NextResponse.json({ analysis });
    }

    // Get existing unresolved gaps
    const gaps = await getUnresolvedGaps(session.userId, topicId || undefined);

    return NextResponse.json({
      gaps,
      count: gaps.length,
      criticalCount: gaps.filter(g => g.severity === 'critical').length,
    });
  } catch (error) {
    console.error('[gaps] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get knowledge gaps' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gaps
 * Analyze knowledge gaps for a topic
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const { topicId } = body;

    if (!topicId) {
      return NextResponse.json(
        { error: 'Topic ID is required' },
        { status: 400 }
      );
    }

    const analysis = await analyzeKnowledgeGaps(session.userId, topicId);

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('[gaps] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to analyze gaps';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/gaps
 * Mark a gap as resolved
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const { gapId } = body;

    if (!gapId) {
      return NextResponse.json(
        { error: 'Gap ID is required' },
        { status: 400 }
      );
    }

    await resolveGap(gapId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[gaps] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve gap' },
      { status: 500 }
    );
  }
}
