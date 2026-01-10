import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getQuestionById } from '@/lib/db/questions';
import { getSessionById, updateSessionState } from '@/lib/db/sessions';
import { prisma } from '@/lib/db/client';
import { generateHints } from '@/lib/mastra/agents/sensie';
import type { SocraticQuestion, QuestionType, Concept } from '@/lib/types';

const MAX_HINTS = 3;

/**
 * POST /api/questions/hint
 * Get a hint for the current question
 *
 * Request body:
 * - sessionId: string - The learning session ID
 * - questionId: string - The question to get hint for
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const auth = requireAuth(session);
    if (!auth.authorized || !session) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, questionId } = body;

    // Validate required fields
    if (!sessionId || !questionId) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, questionId' },
        { status: 400 }
      );
    }

    // Get the learning session
    const learningSession = await getSessionById(sessionId);
    if (!learningSession) {
      return NextResponse.json(
        { error: 'Learning session not found' },
        { status: 404 }
      );
    }

    // Verify session belongs to user
    if (learningSession.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Not authorized to access this session' },
        { status: 403 }
      );
    }

    // Check if user has hints remaining
    if (learningSession.hintsUsed >= MAX_HINTS) {
      return NextResponse.json({
        success: false,
        error: 'No hints remaining for this question',
        hintsUsed: learningSession.hintsUsed,
        maxHints: MAX_HINTS,
        message: "Hohoho! You've used all your hints. Trust your training, young one!",
      });
    }

    // Get the question
    const question = await getQuestionById(questionId);
    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Get the concept for this question
    const concept = await prisma.concept.findUnique({
      where: { id: question.conceptId },
    });

    if (!concept) {
      return NextResponse.json(
        { error: 'Concept not found' },
        { status: 404 }
      );
    }

    // Build question object
    const socraticQuestion: SocraticQuestion = {
      text: question.text,
      type: question.type as QuestionType,
      difficulty: question.difficulty,
      expectedElements: question.expectedElements,
      hints: question.hints,
      followUpPrompts: question.followUpPrompts,
    };

    // Build concept object - use the concept directly since it's already the right type
    const conceptForHint: Concept = concept;

    // Generate hints if not already in the question
    let hints: string[];
    if (question.hints && question.hints.length >= MAX_HINTS) {
      hints = question.hints;
    } else {
      hints = await generateHints(socraticQuestion, conceptForHint);
    }

    // Get the current hint based on how many have been used
    const hintIndex = learningSession.hintsUsed;
    const currentHint = hints[hintIndex] || hints[hints.length - 1];

    // Update session to track hint usage
    await updateSessionState(sessionId, {
      hintsUsed: learningSession.hintsUsed + 1,
    });

    return NextResponse.json({
      success: true,
      hint: currentHint,
      hintNumber: hintIndex + 1,
      hintsUsed: learningSession.hintsUsed + 1,
      hintsRemaining: MAX_HINTS - (learningSession.hintsUsed + 1),
      maxHints: MAX_HINTS,
    });
  } catch (error) {
    console.error('Error getting hint:', error);
    return NextResponse.json(
      { error: 'Failed to get hint' },
      { status: 500 }
    );
  }
}
