import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type {
  SocraticContext,
  SocraticQuestion,
  AnswerEvaluation,
  KnowledgeGap,
  AnswerDepth,
  QuestionType,
} from '@/lib/types';
import {
  SocraticQuestionSchema,
  AnswerEvaluationSchema,
} from '@/lib/mastra/schemas';
import {
  SENSIE_SYSTEM_PROMPT,
  ANSWER_EVALUATION_PROMPT,
  QUESTION_GENERATION_PROMPT,
  FOLLOW_UP_PROMPT,
  GUIDING_QUESTION_PROMPT,
} from '@/lib/mastra/prompts';
import { prisma } from '@/lib/db/client';

/**
 * SocraticEngine - The heart of Sensie's teaching method
 *
 * Implements the Socratic method: teaching through questions rather than direct answers.
 * Uses LLM to generate contextual questions and evaluate user understanding.
 */

// Minimum answer length to be considered
const MIN_ANSWER_LENGTH = 5;
// Gibberish detection patterns
const GIBBERISH_PATTERNS = [
  /^[a-z]{1,3}$/i, // Very short random letters
  /^(.)\1{4,}$/, // Repeated characters
  /^[0-9]+$/, // Just numbers
  /^(asdf|qwerty|test|idk|dunno|whatever)$/i, // Common throwaway answers
];

/**
 * Generate a Socratic question based on context
 */
export async function generateQuestion(
  context: SocraticContext
): Promise<SocraticQuestion> {
  // Get concept details for context
  const concept = await prisma.concept.findUnique({
    where: { id: context.conceptId },
    include: {
      subtopic: {
        include: {
          topic: true,
        },
      },
    },
  });

  if (!concept) {
    throw new Error('Concept not found');
  }

  // Calculate difficulty based on user level and previous answers
  const baseDifficulty = Math.min(5, Math.max(1, Math.ceil(context.userLevel / 2)));
  const adjustedDifficulty = adjustDifficultyFromAnswers(baseDifficulty, context.previousAnswers);

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: SocraticQuestionSchema,
    system: `${SENSIE_SYSTEM_PROMPT}\n\n${QUESTION_GENERATION_PROMPT}`,
    prompt: `Generate a Socratic question for this learning context:

Topic: ${concept.subtopic.topic.name}
Subtopic: ${concept.subtopic.name}
Concept: ${concept.name}
Concept Explanation: ${concept.explanation || 'Not provided'}

Target Difficulty: ${adjustedDifficulty}/5
User Level: ${context.userLevel}
Hints Already Used: ${context.hintsUsed}

Previous answers in this session: ${context.previousAnswers.length}
${context.previousAnswers.slice(-3).map(a => `- "${a.text}" (${a.isCorrect ? 'correct' : 'incorrect'}, ${a.depth})`).join('\n')}

Generate a thought-provoking question that requires understanding, not just recall.`,
  });

  return {
    text: object.text,
    type: object.type as QuestionType,
    difficulty: object.difficulty,
    expectedElements: object.expectedElements,
    hints: object.hints,
    followUpPrompts: object.followUpPrompts,
  };
}

/**
 * Evaluate a user's answer to a question
 * Returns whether correct, the depth of understanding, and feedback
 */
export async function evaluateAnswer(
  answer: string,
  question: SocraticQuestion,
  context: SocraticContext
): Promise<AnswerEvaluation> {
  // Check for gibberish first
  if (isGibberishAnswer(answer)) {
    return {
      isCorrect: false,
      depth: 'SHALLOW' as AnswerDepth,
      feedback: "Hohoho! That's not much of an answer, is it? Take a moment to think and try again. Real learning requires real effort!",
      missingElements: question.expectedElements,
    };
  }

  // Get concept for context
  const concept = await prisma.concept.findUnique({
    where: { id: context.conceptId },
  });

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: AnswerEvaluationSchema,
    system: `${SENSIE_SYSTEM_PROMPT}\n\n${ANSWER_EVALUATION_PROMPT}`,
    prompt: `Evaluate this student answer:

Question: ${question.text}
Question Type: ${question.type}
Expected Elements: ${question.expectedElements.join(', ')}

Student Answer: "${answer}"

Concept Context: ${concept?.name || 'Unknown'} - ${concept?.explanation || ''}

Hints used so far: ${context.hintsUsed}

Evaluate the answer considering:
1. Does it demonstrate correct understanding?
2. How deep is the understanding shown?
3. What elements are missing?
4. What misconceptions are present?

Provide feedback in Master Roshi's voice - encouraging but challenging.`,
  });

  // If correct but shallow, suggest a follow-up
  let followUpQuestion: SocraticQuestion | undefined;
  if (object.isCorrect && object.depth === 'SHALLOW' && object.missingElements.length > 0) {
    followUpQuestion = await generateFollowUpQuestion(
      answer,
      question,
      object.missingElements
    );
  }

  return {
    isCorrect: object.isCorrect,
    depth: object.depth as AnswerDepth,
    feedback: object.feedback,
    missingElements: object.missingElements,
    followUpQuestion,
  };
}

/**
 * Generate a guiding question when user gives incorrect answer
 * Helps lead them toward understanding without giving direct answer
 */
export async function generateGuidingQuestion(
  incorrectAnswer: string,
  originalQuestion: SocraticQuestion,
  gap: string
): Promise<SocraticQuestion> {
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: SocraticQuestionSchema,
    system: `${SENSIE_SYSTEM_PROMPT}\n\n${GUIDING_QUESTION_PROMPT}`,
    prompt: `The student needs guidance to understand correctly.

Original Question: ${originalQuestion.text}
Expected Elements: ${originalQuestion.expectedElements.join(', ')}

Student's Incorrect Answer: "${incorrectAnswer}"
Knowledge Gap: ${gap}

Generate a guiding question that:
1. Does NOT reveal the answer
2. Points them toward the correct direction
3. Builds on what they might understand
4. Is simpler than the original question
5. Maintains encouraging tone`,
  });

  return {
    text: object.text,
    type: object.type as QuestionType,
    difficulty: Math.max(1, originalQuestion.difficulty - 1), // Slightly easier
    expectedElements: object.expectedElements,
    hints: object.hints,
    followUpPrompts: object.followUpPrompts,
  };
}

/**
 * Provide a hint for a question (progressive: 3 levels)
 * Level 1: Related concept reminder
 * Level 2: Partial answer structure
 * Level 3: Key insight
 */
export async function provideHint(
  question: SocraticQuestion,
  hintNumber: number
): Promise<string> {
  // Clamp hint number to valid range
  const hintIndex = Math.min(Math.max(0, hintNumber - 1), question.hints.length - 1);

  // If we have pre-generated hints, use them
  if (question.hints && question.hints.length > hintIndex) {
    return question.hints[hintIndex];
  }

  // Otherwise generate a hint dynamically
  const hintPrompts = [
    'Give a very subtle hint that reminds them of a related concept without revealing the answer.',
    'Give a moderate hint that suggests the structure of a good answer without giving it away.',
    'Give a stronger hint that provides a key insight, but still requires them to connect the dots.',
  ];

  const hintSchema = z.object({
    hint: z.string().describe('The hint text'),
  });

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: hintSchema,
    system: SENSIE_SYSTEM_PROMPT,
    prompt: `Question: ${question.text}
Expected elements: ${question.expectedElements.join(', ')}

${hintPrompts[hintIndex]}

Keep it brief (1-2 sentences). Use Master Roshi's voice.`,
  });

  return object.hint;
}

/**
 * Check if an answer is gibberish or too short
 */
export function isGibberishAnswer(answer: string): boolean {
  const trimmed = answer.trim();

  // Too short
  if (trimmed.length < MIN_ANSWER_LENGTH) {
    return true;
  }

  // Matches gibberish patterns
  if (GIBBERISH_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return true;
  }

  // Check for meaningful words (at least 2)
  const words = trimmed.split(/\s+/).filter(w => w.length > 2);
  if (words.length < 2) {
    return true;
  }

  return false;
}

/**
 * Detect knowledge gaps from a series of incorrect answers
 */
export async function detectKnowledgeGaps(
  incorrectAnswers: Array<{ question: SocraticQuestion; answer: string }>,
  conceptContext: string
): Promise<KnowledgeGap[]> {
  if (incorrectAnswers.length === 0) {
    return [];
  }

  const gapsSchema = z.object({
    gaps: z.array(z.object({
      gap: z.string().describe('Description of the knowledge gap'),
      severity: z.enum(['minor', 'moderate', 'critical']).describe('How serious is this gap'),
      relatedConcepts: z.array(z.string()).describe('Concepts to revisit'),
      suggestedAction: z.string().describe('What to do about it'),
    })).describe('Identified knowledge gaps'),
  });

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: gapsSchema,
    system: SENSIE_SYSTEM_PROMPT,
    prompt: `Analyze these incorrect answers to detect knowledge gaps:

Concept Context: ${conceptContext}

Incorrect Answers:
${incorrectAnswers.map((ia, i) => `
${i + 1}. Question: ${ia.question.text}
   Expected: ${ia.question.expectedElements.join(', ')}
   Answer: "${ia.answer}"
`).join('\n')}

Identify the underlying knowledge gaps. For each gap:
1. What concept is missing?
2. How severe is this gap?
3. What prerequisites might they need?`,
  });

  return object.gaps.map(g => ({
    concept: g.gap,
    severity: g.severity,
    evidence: g.suggestedAction,
    prerequisitesNeeded: g.relatedConcepts,
  }));
}

/**
 * Generate a follow-up question for shallow answers
 * Pushes user to demonstrate deeper understanding
 */
export async function generateFollowUpQuestion(
  shallowAnswer: string,
  originalQuestion: SocraticQuestion,
  missingElements: string[]
): Promise<SocraticQuestion> {
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: SocraticQuestionSchema,
    system: `${SENSIE_SYSTEM_PROMPT}\n\n${FOLLOW_UP_PROMPT}`,
    prompt: `The student gave a correct but shallow answer. Push them deeper.

Original Question: ${originalQuestion.text}
Student's Answer: "${shallowAnswer}"
Missing Elements: ${missingElements.join(', ')}

Generate a follow-up question that:
1. Acknowledges they're on the right track
2. Probes into the missing elements
3. Requires deeper explanation
4. Maintains the same difficulty level`,
  });

  return {
    text: object.text,
    type: object.type as QuestionType,
    difficulty: originalQuestion.difficulty,
    expectedElements: object.expectedElements,
    hints: object.hints,
    followUpPrompts: object.followUpPrompts,
  };
}

/**
 * Determine if user should proceed to next concept
 * Based on answer quality and number of correct answers
 */
export function shouldProceedToNextConcept(
  correctAnswers: number,
  totalQuestions: number,
  deepAnswers: number
): boolean {
  // Need at least 3 questions answered
  if (totalQuestions < 3) {
    return false;
  }

  // Need at least 60% correct
  const correctRate = correctAnswers / totalQuestions;
  if (correctRate < 0.6) {
    return false;
  }

  // Need at least 1 deep answer if 80%+ correct, or 2 deep answers otherwise
  if (correctRate >= 0.8) {
    return deepAnswers >= 1;
  }

  return deepAnswers >= 2;
}

/**
 * Adjust difficulty based on recent answer performance
 */
function adjustDifficultyFromAnswers(
  baseDifficulty: number,
  answers: Array<{ isCorrect: boolean; depth: string }>
): number {
  if (answers.length < 3) {
    return baseDifficulty;
  }

  const recent = answers.slice(-5);
  const correctRate = recent.filter(a => a.isCorrect).length / recent.length;
  const deepRate = recent.filter(a => a.depth === 'DEEP').length / recent.length;

  if (correctRate >= 0.8 && deepRate >= 0.4) {
    return Math.min(5, baseDifficulty + 1);
  } else if (correctRate < 0.4) {
    return Math.max(1, baseDifficulty - 1);
  }

  return baseDifficulty;
}
