import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import {
  getTopicById,
  updateTopicStatus,
  archiveTopic,
  deleteTopic,
  startTopic,
  completeTopic,
} from '@/lib/db/topics';
import type { TopicStatus } from '@prisma/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/topics/[id]
 * Get topic details with subtopics and progress
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { id } = await params;
    const topic = await getTopicById(id, true);

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    if (topic.userId !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ topic });
  } catch (error) {
    console.error('Get topic error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/topics/[id]
 * Update topic (status, settings)
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, action } = body;

    const topic = await getTopicById(id);
    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    if (topic.userId !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let updatedTopic;

    // Handle specific actions
    if (action === 'start') {
      updatedTopic = await startTopic(id);
    } else if (action === 'complete') {
      updatedTopic = await completeTopic(id);
    } else if (action === 'archive') {
      updatedTopic = await archiveTopic(id);
    } else if (status) {
      updatedTopic = await updateTopicStatus(id, status as TopicStatus);
    } else {
      return NextResponse.json(
        { error: 'No valid action or status provided' },
        { status: 400 }
      );
    }

    return NextResponse.json({ topic: updatedTopic });
  } catch (error) {
    console.error('Update topic error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/topics/[id]
 * Archive or delete topic
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { id } = await params;
    const url = new URL(request.url);
    const permanent = url.searchParams.get('permanent') === 'true';

    const topic = await getTopicById(id);
    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    if (topic.userId !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (permanent) {
      await deleteTopic(id);
      return NextResponse.json({ success: true, deleted: true });
    } else {
      const archived = await archiveTopic(id);
      return NextResponse.json({ success: true, topic: archived });
    }
  } catch (error) {
    console.error('Delete topic error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
