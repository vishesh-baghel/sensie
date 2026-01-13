import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getTopicById } from '@/lib/db/topics';
import { updateTodayAnalytics } from '@/lib/db/progress';
import { updateMastery } from '@/lib/learning/progress-tracker';
import { awardXP, updateStreak } from '@/lib/learning/analytics-engine';
import { sensieAgent } from '@/lib/mastra/agents/sensie';
import { z } from 'zod';

// XP constants for quiz completion
const XP_PER_CORRECT_ANSWER = 15;  // Base XP per correct answer
const XP_PERFECT_BONUS = 50;       // Bonus for 100% score
const XP_PASSING_BONUS = 20;       // Bonus for passing (>=70%)

const EvaluationSchema = z.object({
  isCorrect: z.boolean(),
  score: z.number().min(0).max(10),
  feedback: z.string(),
  keyMissingPoints: z.array(z.string()).optional(),
});

interface QuizAnswer {
  questionId: string;
  answer: string;
}

interface QuizQuestion {
  question: string;
  type: string;
  difficulty: number;
  expectedAnswer: string;
  scoringCriteria: string[];
}

/**
 * POST /api/quiz/submit
 * Submit quiz answers and get results
 *
 * Request body:
 * - topicId: string - The topic being quizzed
 * - answers: Array<{ questionId: string, answer: string }>
 * - quizData: { questions: QuizQuestion[] } - Original quiz data for validation
 * - timeTaken?: number - Time taken to complete quiz (seconds)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    const auth = requireAuth(session);
    if (!auth.authorized || !session) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { topicId, answers, quizData, timeTaken } = body;

    // Validate required fields
    if (!topicId || !answers || !quizData) {
      return NextResponse.json(
        { error: 'Missing required fields: topicId, answers, quizData' },
        { status: 400 }
      );
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: 'Answers must be a non-empty array' },
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

    const questions: QuizQuestion[] = quizData.questions;

    // Evaluate each answer
    const evaluations = await Promise.all(
      answers.map(async (answer: QuizAnswer, index: number) => {
        const question = questions[index];
        if (!question) {
          return {
            questionId: answer.questionId,
            isCorrect: false,
            score: 0,
            feedback: 'Question not found',
          };
        }

        // Use Sensie agent to evaluate the answer
        const prompt = `Evaluate this quiz answer:

Question: ${question.question}
Question Type: ${question.type}
Expected Answer: ${question.expectedAnswer}
Scoring Criteria: ${question.scoringCriteria.join(', ')}

Student's Answer: "${answer.answer}"

Evaluate whether the answer demonstrates understanding.
- isCorrect: true if the answer shows correct understanding
- score: 0-10 based on completeness and accuracy
- feedback: Brief feedback in Master Roshi's voice
- keyMissingPoints: Any important points not covered`;

        try {
          const result = await sensieAgent.generate(prompt, {
            output: EvaluationSchema,
          });

          return {
            questionId: answer.questionId,
            isCorrect: result.object?.isCorrect || false,
            score: result.object?.score || 0,
            feedback: result.object?.feedback || 'Unable to evaluate',
            keyMissingPoints: result.object?.keyMissingPoints || [],
          };
        } catch {
          // Fallback to simple string matching if AI fails
          const isCorrect = answer.answer
            .toLowerCase()
            .includes(question.expectedAnswer.toLowerCase().substring(0, 20));
          return {
            questionId: answer.questionId,
            isCorrect,
            score: isCorrect ? 5 : 0,
            feedback: isCorrect
              ? "Good attempt!"
              : "Let's review this concept.",
          };
        }
      })
    );

    // Calculate total score
    const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0);
    const maxScore = evaluations.length * 10;
    const percentage = Math.round((totalScore / maxScore) * 100);
    const correctCount = evaluations.filter(e => e.isCorrect).length;

    // Determine pass/fail
    const passingPercentage = 70;
    const passed = percentage >= passingPercentage;

    // Update analytics
    await updateTodayAnalytics(session.userId, {
      questionsAnswered: evaluations.length,
      questionsCorrect: correctCount,
    });

    // Update topic mastery
    await updateMastery(topicId, session.userId);

    // Award XP based on quiz performance (Bug #6 fix)
    let xpAmount = correctCount * XP_PER_CORRECT_ANSWER;
    if (percentage === 100) {
      xpAmount += XP_PERFECT_BONUS;
    } else if (passed) {
      xpAmount += XP_PASSING_BONUS;
    }
    await awardXP(session.userId, xpAmount, 'quiz_completion');

    // Update user streak (Bug #6 fix)
    await updateStreak(session.userId);

    // Generate overall feedback
    let overallFeedback: string;
    if (percentage >= 90) {
      overallFeedback = "Hohoho! Excellent work, young warrior! You've shown true mastery!";
    } else if (percentage >= 70) {
      overallFeedback = "Well done! You've passed, but there's still room to grow. Keep training!";
    } else if (percentage >= 50) {
      overallFeedback = "Not bad, but not good enough either. The path to mastery requires more practice!";
    } else {
      overallFeedback = "Hohoho... looks like we need to revisit some concepts. Don't worry - every master was once a student!";
    }

    return NextResponse.json({
      success: true,
      results: {
        passed,
        totalScore,
        maxScore,
        percentage,
        correctCount,
        totalQuestions: evaluations.length,
        timeTaken,
        evaluations: evaluations.map((e, index) => ({
          ...e,
          question: questions[index]?.question,
        })),
        overallFeedback,
      },
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    return NextResponse.json(
      { error: 'Failed to submit quiz' },
      { status: 500 }
    );
  }
}
