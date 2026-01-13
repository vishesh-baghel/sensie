import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getTopicById, updateTopicStatus, countActiveTopics } from '@/lib/db/topics';
import { createSession, getActiveSession } from '@/lib/db/sessions';
import { prisma } from '@/lib/db/client';
import { teachConcept, suggestNextConcept } from '@/lib/mastra/agents/sensie';

// Bug #7 fix: Enforce topic limits when starting a queued topic
const MAX_ACTIVE_TOPICS_OWNER = 3;
const MAX_ACTIVE_TOPICS_VISITOR = 1;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/topics/[id]/start
 * Start a learning session for topic
 *
 * This endpoint:
 * 1. Creates a new learning session (or resumes existing)
 * 2. Determines the next concept to learn
 * 3. Returns teaching content and first question
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getSession();
    const auth = requireAuth(session);
    if (!auth.authorized || !session) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: topicId } = await params;

    if (!topicId) {
      return NextResponse.json(
        { error: 'Topic ID is required' },
        { status: 400 }
      );
    }

    // Get the topic with subtopics and concepts
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

    // Check if topic is already completed
    if (topic.status === 'COMPLETED') {
      return NextResponse.json({
        success: false,
        error: 'Topic already completed',
        message: "Hohoho! You've already mastered this topic. Ready for a review?",
      });
    }

    // Check if there's an active session for this topic
    let learningSession = await getActiveSession(topicId);

    // If no active session, create one
    if (!learningSession) {
      // Find first unlocked subtopic and concept
      const subtopics = await prisma.subtopic.findMany({
        where: { topicId, isLocked: false },
        orderBy: { order: 'asc' },
        include: {
          concepts: {
            where: { isMastered: false },
            orderBy: { id: 'asc' },
            take: 1,
          },
        },
      });

      const firstSubtopic = subtopics[0];
      const firstConcept = firstSubtopic?.concepts[0];

      learningSession = await createSession({
        userId: session.userId,
        topicId,
        currentSubtopicId: firstSubtopic?.id,
        currentConceptId: firstConcept?.id,
      });

      // Bug #7 fix: Check active topic limit before activating a QUEUED topic
      if (topic.status === 'QUEUED') {
        const maxActive = session.role === 'visitor' ? MAX_ACTIVE_TOPICS_VISITOR : MAX_ACTIVE_TOPICS_OWNER;
        const activeCount = await countActiveTopics(session.userId);

        if (activeCount >= maxActive) {
          return NextResponse.json({
            success: false,
            error: 'Topic limit reached',
            message: `Hohoho! You already have ${maxActive} active topic${maxActive > 1 ? 's' : ''}. Complete or archive one before starting a new one!`,
            activeCount,
            maxActive,
          }, { status: 400 });
        }

        await updateTopicStatus(topicId, 'ACTIVE');
      }
    }

    // Get the next concept suggestion
    const nextConcept = await suggestNextConcept(topicId, session.userId);

    if (!nextConcept.conceptId) {
      return NextResponse.json({
        success: true,
        sessionId: learningSession.id,
        message: "Hohoho! You've explored all concepts. Time for review!",
        action: 'review',
      });
    }

    // Teach the concept and get first question
    const teachingContent = await teachConcept(nextConcept.conceptId);

    // Get concept details
    const concept = await prisma.concept.findUnique({
      where: { id: nextConcept.conceptId },
      include: {
        subtopic: true,
      },
    });

    return NextResponse.json({
      success: true,
      session: {
        id: learningSession.id,
        topicId,
        topicName: topic.name,
        currentSubtopic: concept?.subtopic.name,
        currentConcept: concept?.name,
      },
      teaching: {
        conceptId: teachingContent.conceptId,
        introduction: teachingContent.introduction,
        contextSetting: teachingContent.contextSetting,
        initialQuestion: teachingContent.initialQuestion,
        suggestion: nextConcept.reason,
      },
    });
  } catch (error) {
    console.error('Error starting topic session:', error);
    return NextResponse.json(
      { error: 'Failed to start learning session' },
      { status: 500 }
    );
  }
}
