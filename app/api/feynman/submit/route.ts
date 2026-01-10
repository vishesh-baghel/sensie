import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import {
  submitFeynmanExplanation,
  getActiveFeynmanExercise,
  formatFeynmanFeedback,
} from '@/lib/learning/feynman-engine';

/**
 * POST /api/feynman/submit
 * Submit a Feynman explanation for evaluation
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const { exerciseId, explanation, topicId } = body;

    // Validate input
    if (!explanation || typeof explanation !== 'string' || explanation.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide a more detailed explanation (at least 10 characters)' },
        { status: 400 }
      );
    }

    // Get exercise - either by ID or find active one for topic
    let targetExerciseId = exerciseId;

    if (!targetExerciseId && topicId) {
      const activeExercise = await getActiveFeynmanExercise(session.userId, topicId);
      if (activeExercise) {
        targetExerciseId = activeExercise.id;
      }
    }

    if (!targetExerciseId) {
      return NextResponse.json(
        { error: 'No active Feynman exercise found. Use /feynman to start one.' },
        { status: 400 }
      );
    }

    // Submit and evaluate
    const { exercise, evaluation } = await submitFeynmanExplanation(
      targetExerciseId,
      explanation.trim()
    );

    // Format feedback for display
    const feedback = formatFeynmanFeedback(evaluation);

    return NextResponse.json({
      exercise,
      evaluation,
      feedback,
      isApproved: evaluation.isApproved,
    });
  } catch (error) {
    console.error('[feynman] Submit error:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit explanation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
