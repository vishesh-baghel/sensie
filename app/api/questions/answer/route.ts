import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getQuestionById } from '@/lib/db/questions';
import { createAnswer } from '@/lib/db/answers';
import { getSessionById, updateSessionState } from '@/lib/db/sessions';
import { evaluateAnswer } from '@/lib/mastra/agents/sensie';
import { updateMastery } from '@/lib/learning/progress-tracker';
import { updateTodayAnalytics } from '@/lib/db/progress';
import { awardXP, updateStreak } from '@/lib/learning/analytics-engine';
import type { SocraticContext, SocraticQuestion, QuestionType } from '@/lib/types';

// XP constants for answer submissions
const XP_CORRECT_DEEP = 20;    // Correct answer with deep understanding
const XP_CORRECT_SHALLOW = 10; // Correct answer with shallow understanding
const XP_INCORRECT = 2;        // Attempted but incorrect (encouragement XP)

/**
 * POST /api/questions/answer
 * Submit an answer to a Socratic question
 *
 * Request body:
 * - sessionId: string - The learning session ID
 * - questionId: string - The question being answered
 * - answer: string - User's answer text
 * - timeToAnswer?: number - Time taken to answer (ms)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const auth = requireAuth(session);
    if (!auth.authorized || !session) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, questionId, answer, timeToAnswer } = body;

    // Validate required fields
    if (!sessionId || !questionId || !answer) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, questionId, answer' },
        { status: 400 }
      );
    }

    // Validate answer is not empty
    if (typeof answer !== 'string' || answer.trim().length === 0) {
      return NextResponse.json(
        { error: 'Answer cannot be empty' },
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

    // Get the question
    const question = await getQuestionById(questionId);
    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Build Socratic context for evaluation
    const socraticContext: SocraticContext = {
      topicId: learningSession.topicId,
      subtopicId: learningSession.currentSubtopicId || '',
      conceptId: question.conceptId,
      userLevel: 5, // Default level, can be enhanced later
      previousAnswers: [],
      hintsUsed: learningSession.hintsUsed,
    };

    // Build question object for evaluation
    const socraticQuestion: SocraticQuestion = {
      text: question.text,
      type: question.type as QuestionType,
      difficulty: question.difficulty,
      expectedElements: question.expectedElements,
      hints: question.hints,
      followUpPrompts: question.followUpPrompts,
    };

    // Evaluate the answer using the Sensie agent
    const evaluationResult = await evaluateAnswer(
      answer.trim(),
      socraticQuestion,
      socraticContext
    );

    // Store the answer
    const storedAnswer = await createAnswer({
      questionId,
      userId: session.userId,
      sessionId,
      text: answer.trim(),
      isCorrect: evaluationResult.evaluation.isCorrect,
      depth: evaluationResult.evaluation.depth,
      hintsUsed: learningSession.hintsUsed,
      timeToAnswer,
      attemptNumber: (learningSession.currentAttempts || 0) + 1,
    });

    // Update session state
    await updateSessionState(sessionId, {
      currentAttempts: evaluationResult.evaluation.isCorrect ? 0 : (learningSession.currentAttempts || 0) + 1,
      hintsUsed: 0, // Reset hints for next question
    });

    // Update mastery for the topic
    if (learningSession.topicId) {
      await updateMastery(learningSession.topicId, session.userId);
    }

    // Update daily analytics
    await updateTodayAnalytics(session.userId, {
      questionsAnswered: 1,
      questionsCorrect: evaluationResult.evaluation.isCorrect ? 1 : 0,
    });

    // Award XP based on answer quality (Bug #6 fix)
    let xpAmount = XP_INCORRECT;
    if (evaluationResult.evaluation.isCorrect) {
      xpAmount = evaluationResult.evaluation.depth === 'DEEP'
        ? XP_CORRECT_DEEP
        : XP_CORRECT_SHALLOW;
    }
    await awardXP(session.userId, xpAmount, 'answer_submission');

    // Update user streak (Bug #6 fix)
    await updateStreak(session.userId);

    return NextResponse.json({
      success: true,
      answerId: storedAnswer.id,
      evaluation: {
        isCorrect: evaluationResult.evaluation.isCorrect,
        depth: evaluationResult.evaluation.depth,
        feedback: evaluationResult.feedback,
        missingElements: evaluationResult.evaluation.missingElements,
      },
      nextAction: evaluationResult.nextAction,
      guidingQuestion: evaluationResult.guidingQuestion,
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    return NextResponse.json(
      { error: 'Failed to submit answer' },
      { status: 500 }
    );
  }
}
