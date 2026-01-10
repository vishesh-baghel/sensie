import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getActiveSession, getSessionMessages } from '@/lib/db/sessions';
import { getTopicById } from '@/lib/db/topics';

/**
 * GET /api/chat/messages
 * Get messages for a topic's active session
 * Query params: topicId
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get('topicId');

    if (!topicId) {
      return new Response(JSON.stringify({ error: 'topicId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify topic belongs to user
    const topic = await getTopicById(topicId);
    if (!topic || topic.userId !== session.userId) {
      return new Response(JSON.stringify({ error: 'Topic not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get active session for this topic
    const learningSession = await getActiveSession(topicId);
    if (!learningSession) {
      // No session yet, return empty messages
      return new Response(JSON.stringify({ messages: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get messages for the session
    const dbMessages = await getSessionMessages(learningSession.id);

    // Convert to AI SDK v6 UIMessage format
    // Map SENSIE -> assistant, USER -> user
    const messages = dbMessages.map((msg) => ({
      id: msg.id,
      role: (msg.role === 'SENSIE' ? 'assistant' : 'user') as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: msg.content }],
      createdAt: msg.createdAt,
    }));

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
