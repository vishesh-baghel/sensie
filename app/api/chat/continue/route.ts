import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getActiveSessionsByUser, getSessionMessages } from '@/lib/db/sessions';
import { getActiveTopics, getTopicById } from '@/lib/db/topics';

/**
 * GET /api/chat/continue
 * Returns the topic to continue learning, without creating any messages
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // First, check for active sessions
    const activeSessions = await getActiveSessionsByUser(session.userId);

    if (activeSessions.length > 0) {
      const latestSession = activeSessions[0];
      const topic = await getTopicById(latestSession.topicId, true);

      if (topic) {
        return NextResponse.json({
          success: true,
          topicId: topic.id,
          topicName: topic.name,
          sessionId: latestSession.id,
          mastery: topic.masteryPercentage,
        });
      }
    }

    // No active sessions, check for active topics
    const activeTopics = await getActiveTopics(session.userId);

    if (activeTopics.length > 0) {
      const topic = activeTopics[0];
      return NextResponse.json({
        success: true,
        topicId: topic.id,
        topicName: topic.name,
        mastery: topic.masteryPercentage,
      });
    }

    // No active topics
    return NextResponse.json({
      success: false,
      error: 'No active topics to continue',
      navigateTo: '/topics',
    });
  } catch (error) {
    console.error('[continue] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get continue target' },
      { status: 500 }
    );
  }
}
