/**
 * Feynman Engine - Implements the Feynman Technique for deep learning
 *
 * The Feynman Technique:
 * 1. Choose a concept to learn
 * 2. Explain it as if teaching to a child (simple language, no jargon)
 * 3. Identify gaps in your explanation
 * 4. Review and simplify further
 *
 * This engine evaluates user explanations and provides feedback.
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type {
  FeynmanContext,
  FeynmanEvaluation,
  FeynmanExercise,
  FeynmanStatus,
} from '@/lib/types';
import { SENSIE_SYSTEM_PROMPT } from '@/lib/mastra/prompts';
import { prisma } from '@/lib/db/client';

// Minimum explanation length
const MIN_EXPLANATION_LENGTH = 50;

// Mastery threshold to trigger Feynman exercise
export const FEYNMAN_TRIGGER_MASTERY = 80;

// XP rewards
export const FEYNMAN_XP_REWARD = 200;

// Zod schema for evaluation
const FeynmanEvaluationSchema = z.object({
  clarity: z.number().min(0).max(10).describe('How clear is the explanation (0-10)'),
  accuracy: z.number().min(0).max(10).describe('How accurate is the explanation (0-10)'),
  simplicity: z.number().min(0).max(10).describe('How simple/jargon-free is it (0-10)'),
  feedback: z.string().describe('Overall feedback in Master Roshi voice'),
  unclearParts: z.array(z.object({
    text: z.string().describe('The unclear part from the explanation'),
    issue: z.string().describe('What makes it unclear'),
    suggestion: z.string().describe('How to make it clearer'),
  })).describe('Parts that need clarification'),
  probingQuestions: z.array(z.string()).describe('Questions to probe deeper understanding'),
  suggestions: z.array(z.string()).describe('Suggestions for improvement'),
  isApproved: z.boolean().describe('Whether the explanation demonstrates mastery'),
});

/**
 * Check if a user should do a Feynman exercise for a topic
 * Triggered at 80%+ mastery
 */
export async function shouldTriggerFeynman(
  userId: string,
  topicId: string
): Promise<{ should: boolean; conceptName?: string; conceptId?: string }> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      subtopics: {
        include: {
          concepts: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!topic || topic.masteryPercentage < FEYNMAN_TRIGGER_MASTERY) {
    return { should: false };
  }

  // Check if there's a pending Feynman exercise
  const existingExercise = await prisma.feynmanExercise.findFirst({
    where: {
      userId,
      topicId,
      status: { in: ['PENDING', 'IN_PROGRESS', 'NEEDS_REFINEMENT'] },
    },
  });

  if (existingExercise) {
    return { should: false }; // Already has a pending exercise
  }

  // Find a concept that hasn't been Feynman'd yet
  const completedConcepts = await prisma.feynmanExercise.findMany({
    where: {
      userId,
      topicId,
      status: 'COMPLETED',
    },
    select: { conceptId: true },
  });

  const completedConceptIds = new Set(completedConcepts.map(c => c.conceptId));

  for (const subtopic of topic.subtopics) {
    for (const concept of subtopic.concepts) {
      if (!completedConceptIds.has(concept.id)) {
        return {
          should: true,
          conceptName: concept.name,
          conceptId: concept.id,
        };
      }
    }
  }

  return { should: false }; // All concepts have been Feynman'd
}

/**
 * Start a new Feynman exercise
 */
export async function startFeynmanExercise(
  context: FeynmanContext
): Promise<FeynmanExercise> {
  const exercise = await prisma.feynmanExercise.create({
    data: {
      userId: context.userId,
      topicId: context.topicId,
      subtopicId: context.subtopicId,
      conceptId: context.conceptId,
      conceptName: context.conceptName,
      targetAudience: context.targetAudience,
      status: 'IN_PROGRESS',
      explanation: '',
      attempts: 0,
    },
  });

  return {
    id: exercise.id,
    userId: exercise.userId,
    topicId: exercise.topicId,
    subtopicId: exercise.subtopicId || undefined,
    conceptId: exercise.conceptId || undefined,
    conceptName: exercise.conceptName,
    status: exercise.status as FeynmanStatus,
    explanation: exercise.explanation,
    targetAudience: exercise.targetAudience as 'child' | 'beginner' | 'peer',
    attempts: exercise.attempts,
    createdAt: exercise.createdAt,
    completedAt: exercise.completedAt || undefined,
  };
}

/**
 * Get the prompt for starting a Feynman exercise
 */
export function getFeynmanPrompt(
  conceptName: string,
  targetAudience: 'child' | 'beginner' | 'peer'
): string {
  const audienceDescriptions = {
    child: "a curious 10-year-old with no technical background",
    beginner: "someone who just started learning programming",
    peer: "a fellow developer who hasn't worked with this concept",
  };

  return `**Feynman Challenge: ${conceptName}**

Hohoho! You've reached ${FEYNMAN_TRIGGER_MASTERY}% mastery on this topic. Impressive!

But true mastery means you can teach it. The great physicist Richard Feynman said: "If you can't explain it simply, you don't understand it well enough."

**Your challenge:** Explain **${conceptName}** as if you're teaching it to ${audienceDescriptions[targetAudience]}.

**Rules:**
- Use simple, everyday language
- No jargon or technical terms without explanation
- Use analogies and examples
- Keep it clear and engaging

Take your time. When you're ready, share your explanation!`;
}

/**
 * Evaluate a user's Feynman explanation
 */
export async function evaluateFeynmanExplanation(
  explanation: string,
  context: FeynmanContext
): Promise<FeynmanEvaluation> {
  // Check for minimum length
  if (explanation.trim().length < MIN_EXPLANATION_LENGTH) {
    return {
      score: 0,
      clarity: 0,
      accuracy: 0,
      simplicity: 0,
      feedback: "Hohoho! That's barely a sentence! A true master can explain concepts thoroughly. Give it another try with more detail.",
      unclearParts: [],
      probingQuestions: [
        "Can you elaborate on what this concept actually does?",
        "What's an everyday example of this?",
      ],
      suggestions: [
        "Start by defining what the concept is in simple terms",
        "Add an analogy to make it relatable",
        "Explain why this concept matters",
      ],
      isApproved: false,
    };
  }

  // Get concept details for context
  let conceptExplanation = context.conceptExplanation || '';
  if (context.conceptId && !conceptExplanation) {
    const concept = await prisma.concept.findUnique({
      where: { id: context.conceptId },
    });
    conceptExplanation = concept?.explanation || '';
  }

  const audienceDescriptions = {
    child: "a curious 10-year-old",
    beginner: "a programming beginner",
    peer: "a fellow developer",
  };

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: FeynmanEvaluationSchema,
    system: `${SENSIE_SYSTEM_PROMPT}

You are evaluating a Feynman Technique exercise. The student is trying to explain a concept as if teaching to ${audienceDescriptions[context.targetAudience]}.

The Feynman Technique requires:
1. Simple language (no unexplained jargon)
2. Clear analogies and examples
3. Logical flow of explanation
4. Accuracy of content
5. Appropriate level for the target audience

Be encouraging but rigorous. Point out unclear parts specifically.`,
    prompt: `Evaluate this explanation of "${context.conceptName}":

**Target Audience:** ${audienceDescriptions[context.targetAudience]}

**Student's Explanation:**
"${explanation}"

**Reference (for accuracy check):**
${conceptExplanation || 'Use your knowledge of the concept.'}

**Previous Attempts:** ${context.previousAttempts.length}
${context.previousAttempts.length > 0 ? `Previous explanations:\n${context.previousAttempts.map((a, i) => `${i + 1}. "${a}"`).join('\n')}` : ''}

Evaluate the explanation. Be specific about unclear parts and provide actionable suggestions.
Approve only if the explanation truly demonstrates deep understanding and would be clear to the target audience.`,
  });

  // Calculate overall score
  const score = Math.round(
    (object.clarity + object.accuracy + object.simplicity) / 3 * 10
  );

  return {
    score,
    clarity: object.clarity,
    accuracy: object.accuracy,
    simplicity: object.simplicity,
    feedback: object.feedback,
    unclearParts: object.unclearParts,
    probingQuestions: object.probingQuestions,
    suggestions: object.suggestions,
    isApproved: object.isApproved,
  };
}

/**
 * Submit a Feynman explanation and get evaluation
 */
export async function submitFeynmanExplanation(
  exerciseId: string,
  explanation: string
): Promise<{ exercise: FeynmanExercise; evaluation: FeynmanEvaluation }> {
  // Get the exercise
  const exercise = await prisma.feynmanExercise.findUnique({
    where: { id: exerciseId },
  });

  if (!exercise) {
    throw new Error('Feynman exercise not found');
  }

  // Get previous attempts
  const previousAttempts = exercise.previousAttempts as string[] || [];

  // Build context
  const context: FeynmanContext = {
    userId: exercise.userId,
    topicId: exercise.topicId,
    subtopicId: exercise.subtopicId || undefined,
    conceptId: exercise.conceptId || undefined,
    conceptName: exercise.conceptName,
    targetAudience: exercise.targetAudience as 'child' | 'beginner' | 'peer',
    previousAttempts,
  };

  // Evaluate
  const evaluation = await evaluateFeynmanExplanation(explanation, context);

  // Determine new status
  const newStatus: FeynmanStatus = evaluation.isApproved
    ? 'COMPLETED'
    : 'NEEDS_REFINEMENT';

  // Update exercise
  const updatedExercise = await prisma.feynmanExercise.update({
    where: { id: exerciseId },
    data: {
      explanation,
      status: newStatus,
      attempts: exercise.attempts + 1,
      evaluation: JSON.parse(JSON.stringify(evaluation)),
      previousAttempts: [...previousAttempts, explanation],
      completedAt: evaluation.isApproved ? new Date() : null,
    },
  });

  // Award XP if completed
  if (evaluation.isApproved) {
    await prisma.userProgress.updateMany({
      where: { userId: exercise.userId },
      data: {
        totalXP: { increment: FEYNMAN_XP_REWARD },
      },
    });

    // Update daily analytics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.learningAnalytics.upsert({
      where: {
        userId_date: {
          userId: exercise.userId,
          date: today,
        },
      },
      update: {
        xpEarned: { increment: FEYNMAN_XP_REWARD },
      },
      create: {
        userId: exercise.userId,
        date: today,
        xpEarned: FEYNMAN_XP_REWARD,
      },
    });
  }

  return {
    exercise: {
      id: updatedExercise.id,
      userId: updatedExercise.userId,
      topicId: updatedExercise.topicId,
      subtopicId: updatedExercise.subtopicId || undefined,
      conceptId: updatedExercise.conceptId || undefined,
      conceptName: updatedExercise.conceptName,
      status: updatedExercise.status as FeynmanStatus,
      explanation: updatedExercise.explanation,
      targetAudience: updatedExercise.targetAudience as 'child' | 'beginner' | 'peer',
      evaluation,
      attempts: updatedExercise.attempts,
      createdAt: updatedExercise.createdAt,
      completedAt: updatedExercise.completedAt || undefined,
    },
    evaluation,
  };
}

/**
 * Get active Feynman exercise for a user
 */
export async function getActiveFeynmanExercise(
  userId: string,
  topicId?: string
): Promise<FeynmanExercise | null> {
  const where: Record<string, unknown> = {
    userId,
    status: { in: ['IN_PROGRESS', 'NEEDS_REFINEMENT'] },
  };

  if (topicId) {
    where.topicId = topicId;
  }

  const exercise = await prisma.feynmanExercise.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
  });

  if (!exercise) {
    return null;
  }

  return {
    id: exercise.id,
    userId: exercise.userId,
    topicId: exercise.topicId,
    subtopicId: exercise.subtopicId || undefined,
    conceptId: exercise.conceptId || undefined,
    conceptName: exercise.conceptName,
    status: exercise.status as FeynmanStatus,
    explanation: exercise.explanation,
    targetAudience: exercise.targetAudience as 'child' | 'beginner' | 'peer',
    evaluation: exercise.evaluation as unknown as FeynmanEvaluation | undefined,
    attempts: exercise.attempts,
    createdAt: exercise.createdAt,
    completedAt: exercise.completedAt || undefined,
  };
}

/**
 * Get Feynman exercise statistics for a user
 */
export async function getFeynmanStats(userId: string): Promise<{
  totalCompleted: number;
  totalAttempts: number;
  averageScore: number;
  topicsWithFeynman: number;
}> {
  const exercises = await prisma.feynmanExercise.findMany({
    where: { userId },
  });

  const completed = exercises.filter(e => e.status === 'COMPLETED');
  const scores = completed
    .map(e => (e.evaluation as unknown as FeynmanEvaluation)?.score || 0)
    .filter(s => s > 0);

  const topicIds = new Set(completed.map(e => e.topicId));

  return {
    totalCompleted: completed.length,
    totalAttempts: exercises.reduce((sum, e) => sum + e.attempts, 0),
    averageScore: scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0,
    topicsWithFeynman: topicIds.size,
  };
}

/**
 * Format Feynman evaluation feedback for chat display
 */
export function formatFeynmanFeedback(evaluation: FeynmanEvaluation): string {
  let message = '';

  if (evaluation.isApproved) {
    message = `**Excellent work, apprentice!** Your explanation demonstrates true mastery.\n\n`;
    message += `**Score:** ${evaluation.score}/100\n`;
    message += `- Clarity: ${evaluation.clarity}/10\n`;
    message += `- Accuracy: ${evaluation.accuracy}/10\n`;
    message += `- Simplicity: ${evaluation.simplicity}/10\n\n`;
    message += `${evaluation.feedback}\n\n`;
    message += `You've earned **${FEYNMAN_XP_REWARD} XP** for completing this Feynman exercise!`;
  } else {
    message = `**Good effort, but let's refine it further.**\n\n`;
    message += `**Score:** ${evaluation.score}/100\n`;
    message += `- Clarity: ${evaluation.clarity}/10\n`;
    message += `- Accuracy: ${evaluation.accuracy}/10\n`;
    message += `- Simplicity: ${evaluation.simplicity}/10\n\n`;
    message += `${evaluation.feedback}\n\n`;

    if (evaluation.unclearParts.length > 0) {
      message += `**Parts that need work:**\n`;
      for (const part of evaluation.unclearParts) {
        message += `- "${part.text}" - ${part.issue}\n`;
        message += `  *Suggestion:* ${part.suggestion}\n`;
      }
      message += '\n';
    }

    if (evaluation.probingQuestions.length > 0) {
      message += `**Questions to consider:**\n`;
      for (const q of evaluation.probingQuestions) {
        message += `- ${q}\n`;
      }
      message += '\n';
    }

    if (evaluation.suggestions.length > 0) {
      message += `**Suggestions:**\n`;
      for (const s of evaluation.suggestions) {
        message += `- ${s}\n`;
      }
    }

    message += `\nTake another shot at it! Refine your explanation and submit again.`;
  }

  return message;
}
