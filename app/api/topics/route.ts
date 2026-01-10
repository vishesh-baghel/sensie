import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getTopicsByUser, countActiveTopics } from '@/lib/db/topics';
import { generatePath, createTopicFromPath } from '@/lib/learning/learning-path-generator';
import { topicsLogger } from '@/lib/observability/logger';
import type { TopicStatus } from '@prisma/client';

const MAX_ACTIVE_TOPICS = 3;

/**
 * GET /api/topics
 * List all topics for current user
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as TopicStatus | null;

    topicsLogger.info('Fetching topics', { userId: session.userId, status: status || 'all' });

    const rawTopics = await getTopicsByUser(session.userId, status || undefined);

    // Transform subtopics to match UI expected format
    const topics = rawTopics.map(topic => ({
      ...topic,
      subtopics: topic.subtopics?.map(st => ({
        id: st.id,
        name: st.name,
        isLocked: st.isLocked,
        mastery: st.masteryPercentage,
      })),
    }));

    topicsLogger.info('Topics fetched successfully', { userId: session.userId, count: topics.length });

    return NextResponse.json({ topics });
  } catch (error) {
    topicsLogger.error('Failed to fetch topics', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/topics
 * Create a new topic with auto-generated learning path and subtopics
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const { name, goal } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Topic name is required' },
        { status: 400 }
      );
    }

    topicsLogger.info('Creating new topic', { userId: session.userId, topicName: name.trim() });

    // Check active topic count to determine if new topic should be queued
    const activeCount = await countActiveTopics(session.userId);
    const maxActive = session.role === 'visitor' ? 1 : MAX_ACTIVE_TOPICS;
    const shouldQueue = activeCount >= maxActive;

    if (shouldQueue) {
      topicsLogger.info('Topic will be queued', { userId: session.userId, activeCount, maxActive });
    }

    // Generate learning path with subtopics using LLM
    topicsLogger.info('Generating learning path', { topicName: name.trim(), goal });
    const learningPath = await generatePath(name.trim(), goal?.trim());

    topicsLogger.info('Learning path generated', {
      topicName: name.trim(),
      domain: learningPath.domain,
      subtopicCount: learningPath.subtopics.length,
      estimatedHours: learningPath.estimatedHours,
    });

    // Create topic with subtopics and concepts in database
    // If user has max active topics, the new topic will be queued
    const topic = await createTopicFromPath(learningPath, session.userId, shouldQueue);

    topicsLogger.info('Topic created successfully', {
      userId: session.userId,
      topicId: topic.id,
      topicName: topic.name,
      subtopicCount: topic.subtopics?.length || 0,
    });

    // Transform for UI
    const transformedTopic = {
      ...topic,
      subtopics: topic.subtopics?.map(st => ({
        id: st.id,
        name: st.name,
        isLocked: st.isLocked,
        mastery: st.masteryPercentage,
      })),
    };

    return NextResponse.json({ topic: transformedTopic }, { status: 201 });
  } catch (error) {
    topicsLogger.error('Failed to create topic', error);
    return NextResponse.json(
      { error: 'Failed to create topic. Please try again.' },
      { status: 500 }
    );
  }
}
