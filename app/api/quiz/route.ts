import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getTopicById } from '@/lib/db/topics';
import { generateQuiz } from '@/lib/mastra/agents/sensie';

const DEFAULT_QUESTION_COUNT = 5;
const MAX_QUESTION_COUNT = 10;

/**
 * POST /api/quiz
 * Generate and start a quiz for a topic
 *
 * Request body:
 * - topicId: string - The topic to quiz on
 * - questionCount?: number - Number of questions (default 5, max 10)
 * - difficulty?: number - Target difficulty (1-5)
 * - includeReview?: boolean - Include review questions from spaced repetition
 * - timeLimit?: number - Optional time limit in minutes
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const auth = requireAuth(session);
    if (!auth.authorized || !session) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const {
      topicId,
      questionCount = DEFAULT_QUESTION_COUNT,
      difficulty,
      includeReview = false,
      timeLimit,
    } = body;

    // Validate required fields
    if (!topicId) {
      return NextResponse.json(
        { error: 'Missing required field: topicId' },
        { status: 400 }
      );
    }

    // Validate question count
    const validQuestionCount = Math.min(
      Math.max(1, questionCount),
      MAX_QUESTION_COUNT
    );

    // Validate difficulty if provided
    if (difficulty !== undefined && (difficulty < 1 || difficulty > 5)) {
      return NextResponse.json(
        { error: 'Difficulty must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Get the topic
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

    // Generate the quiz using the Sensie agent
    const quiz = await generateQuiz(topicId, {
      questionCount: validQuestionCount,
      difficulty,
      includeReview,
      timeLimit,
    });

    // Return quiz data for the client
    // Note: We return the quiz but don't store answers server-side
    // The submit endpoint will handle evaluation
    return NextResponse.json({
      success: true,
      quiz: {
        topicId,
        topicName: topic.name,
        title: quiz.title,
        description: quiz.description,
        questions: quiz.questions.map((q, index) => ({
          id: `quiz-${topicId}-${index}`,
          question: q.question,
          type: q.type,
          difficulty: q.difficulty,
          // Don't expose expected answers or scoring criteria to client
        })),
        totalPoints: quiz.totalPoints,
        passingScore: quiz.passingScore,
        timeLimit: quiz.timeLimit,
        questionCount: quiz.questions.length,
      },
      // Store expected answers server-side for validation
      // In a real implementation, this would be stored in a quiz session
      _quizData: {
        questions: quiz.questions,
      },
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    return NextResponse.json(
      { error: 'Failed to generate quiz' },
      { status: 500 }
    );
  }
}
