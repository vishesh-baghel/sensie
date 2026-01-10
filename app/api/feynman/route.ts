import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import {
  getActiveFeynmanExercise,
  getFeynmanStats,
  startFeynmanExercise,
  shouldTriggerFeynman,
  getFeynmanPrompt,
} from '@/lib/learning/feynman-engine';
import { prisma } from '@/lib/db/client';

/**
 * GET /api/feynman
 * Get Feynman stats and active exercise
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

    // Get stats
    const stats = await getFeynmanStats(session.userId);

    // Get active exercise if topicId provided
    let activeExercise = null;
    if (topicId) {
      activeExercise = await getActiveFeynmanExercise(session.userId, topicId);
    }

    return NextResponse.json({
      stats,
      activeExercise,
    });
  } catch (error) {
    console.error('[feynman] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get Feynman data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feynman
 * Start a new Feynman exercise
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const { topicId, targetAudience = 'child' } = body;

    if (!topicId) {
      return NextResponse.json(
        { error: 'Topic ID is required' },
        { status: 400 }
      );
    }

    // Validate target audience
    const validAudiences = ['child', 'beginner', 'peer'];
    if (!validAudiences.includes(targetAudience)) {
      return NextResponse.json(
        { error: 'Invalid target audience. Use: child, beginner, or peer' },
        { status: 400 }
      );
    }

    // Check for existing active exercise
    const existing = await getActiveFeynmanExercise(session.userId, topicId);
    if (existing) {
      return NextResponse.json({
        exercise: existing,
        prompt: getFeynmanPrompt(existing.conceptName, existing.targetAudience),
        message: 'You have an active Feynman exercise. Complete it first.',
      });
    }

    // Check if topic exists and is accessible
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        subtopics: {
          include: { concepts: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!topic || topic.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    // Find concept to explain
    const triggerResult = await shouldTriggerFeynman(session.userId, topicId);
    let conceptName = triggerResult.conceptName;
    let conceptId = triggerResult.conceptId;

    if (!conceptName) {
      // Find first available concept
      for (const subtopic of topic.subtopics) {
        if (!subtopic.isLocked && subtopic.concepts.length > 0) {
          conceptName = subtopic.concepts[0].name;
          conceptId = subtopic.concepts[0].id;
          break;
        }
      }
    }

    if (!conceptName) {
      conceptName = topic.name;
    }

    // Start new exercise
    const exercise = await startFeynmanExercise({
      userId: session.userId,
      topicId,
      conceptId,
      conceptName,
      targetAudience: targetAudience as 'child' | 'beginner' | 'peer',
      previousAttempts: [],
    });

    const prompt = getFeynmanPrompt(conceptName, targetAudience);

    return NextResponse.json({
      exercise,
      prompt,
    }, { status: 201 });
  } catch (error) {
    console.error('[feynman] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to start Feynman exercise' },
      { status: 500 }
    );
  }
}
