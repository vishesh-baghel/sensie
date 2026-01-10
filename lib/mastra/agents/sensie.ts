/**
 * Sensie Mastra Agent
 *
 * Main teaching agent with Master Roshi personality.
 * Uses Socratic method - teaches through questions, not answers.
 */

import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import type {
  SocraticContext,
  SocraticQuestion,
  AnswerEvaluation,
  QuestionType,
  Quiz,
  QuizQuestion,
  Concept,
} from '@/lib/types';
import { prisma } from '@/lib/db/client';
import {
  SENSIE_SYSTEM_PROMPT,
  ANSWER_EVALUATION_PROMPT,
  CONCEPT_CONTEXT_PROMPT,
  QUESTION_GENERATION_PROMPT,
  FOLLOW_UP_PROMPT,
  GUIDING_QUESTION_PROMPT,
  QUIZ_GENERATION_PROMPT,
} from '../prompts';
import {
  SocraticQuestionSchema,
  AnswerEvaluationSchema,
  EncouragementSchema,
  ProgressSummarySchema,
  QuizSchema,
} from '../schemas';
import {
  getPerformanceSummary,
  getTopicCompletionContext,
  getStreakContext,
} from '../context';
import { ENCOURAGEMENT, BREAK_MESSAGES } from '@/lib/personality/constants';

/**
 * Sensie Agent Definition
 *
 * Using Mastra's model router with Anthropic.
 * Uses Vercel AI Gateway if configured, otherwise direct provider.
 */
export const sensieAgent = new Agent({
  name: 'sensie',
  instructions: SENSIE_SYSTEM_PROMPT,
  // Use Vercel AI Gateway if configured, otherwise fallback to direct Anthropic
  model: process.env.AI_GATEWAY_API_KEY
    ? 'vercel/anthropic/claude-sonnet-4-20250514'
    : 'anthropic/claude-sonnet-4-20250514',
});

// ============================================================================
// Types
// ============================================================================

export interface TeachingContent {
  conceptId: string;
  introduction: string;
  contextSetting: string;
  initialQuestion: SocraticQuestion;
}

export interface SocraticResponse {
  question: SocraticQuestion;
  encouragement?: string;
  conceptContext?: string;
}

export interface EvaluationResult {
  evaluation: AnswerEvaluation;
  feedback: string;
  nextAction: 'next_concept' | 'follow_up' | 'guide' | 'hint';
  guidingQuestion?: SocraticQuestion;
}

export interface NextConceptSuggestion {
  conceptId: string;
  reason: string;
  confidence: number;
}

export interface QuestionGenerationOptions {
  difficulty: number;
  type?: QuestionType;
  focusElements?: string[];
  avoidElements?: string[];
}

export interface QuizOptions {
  questionCount: number;
  difficulty?: number;
  includeReview?: boolean;
  timeLimit?: number;
}

// ============================================================================
// Teaching Functions
// ============================================================================

/**
 * Teach a concept - introduces context and asks first question
 */
export async function teachConcept(conceptId: string): Promise<TeachingContent> {
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
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

  // Generate context-setting introduction
  const contextSchema = z.object({
    introduction: z.string().describe('Brief hook to engage the student (1-2 sentences)'),
    contextSetting: z.string().describe('Set the stage for the concept (2-3 sentences)'),
  });

  const contextPrompt = `${CONCEPT_CONTEXT_PROMPT}

Introduce this concept to a student:

Topic: ${concept.subtopic.topic.name}
Subtopic: ${concept.subtopic.name}
Concept: ${concept.name}
${concept.explanation ? `Explanation: ${concept.explanation}` : ''}

Create an engaging introduction that:
1. Hooks their interest
2. Sets context without explaining
3. Makes them curious to learn more
4. Uses Master Roshi's voice`;

  const contextResult = await sensieAgent.generate(contextPrompt, {
    output: contextSchema,
  });

  // Generate initial Socratic question
  const questionPrompt = `${QUESTION_GENERATION_PROMPT}

Generate a Socratic question for this learning context:

Topic: ${concept.subtopic.topic.name}
Subtopic: ${concept.subtopic.name}
Concept: ${concept.name}
Concept Explanation: ${concept.explanation || 'Not provided'}

Target Difficulty: 2/5 (introductory)
This is the first question for this concept.

Generate a thought-provoking question that requires understanding, not just recall.`;

  const questionResult = await sensieAgent.generate(questionPrompt, {
    output: SocraticQuestionSchema,
  });

  const question = questionResult.object;

  return {
    conceptId,
    introduction: contextResult.object?.introduction || '',
    contextSetting: contextResult.object?.contextSetting || '',
    initialQuestion: {
      text: question?.text || '',
      type: (question?.type as QuestionType) || 'UNDERSTANDING',
      difficulty: question?.difficulty || 2,
      expectedElements: question?.expectedElements || [],
      hints: question?.hints || [],
      followUpPrompts: question?.followUpPrompts || [],
    },
  };
}

/**
 * Generate a Socratic question based on context
 */
export async function generateQuestion(
  context: SocraticContext
): Promise<SocraticQuestion> {
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

  const baseDifficulty = Math.min(5, Math.max(1, Math.ceil(context.userLevel / 2)));
  const adjustedDifficulty = adjustDifficultyFromAnswers(baseDifficulty, context.previousAnswers);

  const prompt = `${QUESTION_GENERATION_PROMPT}

Generate a Socratic question for this learning context:

Topic: ${concept.subtopic.topic.name}
Subtopic: ${concept.subtopic.name}
Concept: ${concept.name}
Concept Explanation: ${concept.explanation || 'Not provided'}

Target Difficulty: ${adjustedDifficulty}/5
User Level: ${context.userLevel}
Hints Already Used: ${context.hintsUsed}

Previous answers in this session: ${context.previousAnswers.length}
${context.previousAnswers.slice(-3).map(a => `- "${a.text}" (${a.isCorrect ? 'correct' : 'incorrect'}, ${a.depth})`).join('\n')}

Generate a thought-provoking question that requires understanding, not just recall.`;

  const result = await sensieAgent.generate(prompt, {
    output: SocraticQuestionSchema,
  });

  const q = result.object;
  return {
    text: q?.text || '',
    type: (q?.type as QuestionType) || 'UNDERSTANDING',
    difficulty: q?.difficulty || adjustedDifficulty,
    expectedElements: q?.expectedElements || [],
    hints: q?.hints || [],
    followUpPrompts: q?.followUpPrompts || [],
  };
}

/**
 * Ask a Socratic question within context
 */
export async function askSocraticQuestion(
  context: SocraticContext
): Promise<SocraticResponse> {
  const question = await generateQuestion(context);

  let encouragement: string | undefined;
  if (context.previousAnswers.length > 0) {
    const lastAnswer = context.previousAnswers[context.previousAnswers.length - 1];
    if (lastAnswer.isCorrect) {
      encouragement = await generateEncouragement('correct');
    }
  }

  const concept = await prisma.concept.findUnique({
    where: { id: context.conceptId },
    select: { name: true },
  });

  return {
    question,
    encouragement,
    conceptContext: concept?.name,
  };
}

// ============================================================================
// Answer Evaluation Functions
// ============================================================================

/**
 * Evaluate a user's answer to a question
 */
export async function evaluateAnswer(
  answer: string,
  question: SocraticQuestion,
  context: SocraticContext
): Promise<EvaluationResult> {
  // Check for gibberish
  if (isGibberishAnswer(answer)) {
    return {
      evaluation: {
        isCorrect: false,
        depth: 'SHALLOW',
        feedback: "Hohoho! That's not much of an answer, is it? Take a moment to think and try again. Real learning requires real effort!",
        missingElements: question.expectedElements,
      },
      feedback: "Hohoho! That's not much of an answer, is it? Take a moment to think and try again.",
      nextAction: 'guide',
    };
  }

  const concept = await prisma.concept.findUnique({
    where: { id: context.conceptId },
  });

  const prompt = `${ANSWER_EVALUATION_PROMPT}

Evaluate this student answer:

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

Provide feedback in Master Roshi's voice - encouraging but challenging.`;

  const result = await sensieAgent.generate(prompt, {
    output: AnswerEvaluationSchema,
  });

  const evalResult = result.object;
  const evaluation: AnswerEvaluation = {
    isCorrect: evalResult?.isCorrect || false,
    depth: (evalResult?.depth as 'NONE' | 'SHALLOW' | 'DEEP') || 'NONE',
    feedback: evalResult?.feedback || '',
    missingElements: evalResult?.missingElements || [],
  };

  // Determine next action
  let nextAction: 'next_concept' | 'follow_up' | 'guide' | 'hint';
  let guidingQuestion: SocraticQuestion | undefined;

  if (!evaluation.isCorrect) {
    nextAction = 'guide';
    if (evaluation.missingElements.length > 0) {
      guidingQuestion = await generateGuidingQuestion(
        answer,
        question,
        evaluation.missingElements[0]
      );
    }
  } else if (evaluation.depth === 'SHALLOW') {
    nextAction = 'follow_up';
    guidingQuestion = await generateFollowUp(
      question,
      answer,
      evaluation.missingElements
    );
  } else {
    nextAction = 'next_concept';
  }

  return {
    evaluation,
    feedback: evaluation.feedback,
    nextAction,
    guidingQuestion,
  };
}

/**
 * Check if an answer is gibberish or too short
 */
export function isGibberishAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  const MIN_ANSWER_LENGTH = 5;
  const GIBBERISH_PATTERNS = [
    /^[a-z]{1,3}$/i,
    /^(.)(\1){4,}$/,
    /^[0-9]+$/,
    /^(asdf|qwerty|test|idk|dunno|whatever)$/i,
  ];

  if (trimmed.length < MIN_ANSWER_LENGTH) return true;
  if (GIBBERISH_PATTERNS.some(pattern => pattern.test(trimmed))) return true;

  const words = trimmed.split(/\s+/).filter(w => w.length > 2);
  if (words.length < 2) return true;

  return false;
}

// ============================================================================
// Question Generation Functions
// ============================================================================

/**
 * Generate questions for a concept
 */
export async function generateQuestions(
  concept: Concept,
  options: QuestionGenerationOptions
): Promise<SocraticQuestion[]> {
  const questionsSchema = z.object({
    questions: z.array(SocraticQuestionSchema).min(1).max(5),
  });

  const prompt = `${QUESTION_GENERATION_PROMPT}

Generate 3 Socratic questions for this concept:

Concept: ${concept.name}
${concept.explanation ? `Explanation: ${concept.explanation}` : ''}

Requirements:
- Target difficulty: ${options.difficulty}/5
${options.type ? `- Question type: ${options.type}` : '- Vary question types'}
${options.focusElements?.length ? `- Focus on: ${options.focusElements.join(', ')}` : ''}
${options.avoidElements?.length ? `- Avoid: ${options.avoidElements.join(', ')}` : ''}

Generate questions that require THINKING, not just recall.`;

  const result = await sensieAgent.generate(prompt, {
    output: questionsSchema,
  });

  return (result.object?.questions || []).map(q => ({
    text: q.text,
    type: q.type as QuestionType,
    difficulty: q.difficulty,
    expectedElements: q.expectedElements,
    hints: q.hints,
    followUpPrompts: q.followUpPrompts,
  }));
}

/**
 * Generate a follow-up question based on user's answer
 */
export async function generateFollowUp(
  originalQuestion: SocraticQuestion,
  userAnswer: string,
  missingElements: string[]
): Promise<SocraticQuestion> {
  const prompt = `${FOLLOW_UP_PROMPT}

Generate a follow-up question to push deeper understanding.

Original Question: ${originalQuestion.text}
Student's Answer: "${userAnswer}"
Missing Elements: ${missingElements.join(', ')}

The follow-up should:
1. Acknowledge their correct understanding
2. Probe into the missing elements
3. Connect to broader implications
4. Maintain the same difficulty level (${originalQuestion.difficulty}/5)`;

  const result = await sensieAgent.generate(prompt, {
    output: SocraticQuestionSchema,
  });

  const q = result.object;
  return {
    text: q?.text || '',
    type: (q?.type as QuestionType) || originalQuestion.type,
    difficulty: originalQuestion.difficulty,
    expectedElements: q?.expectedElements || [],
    hints: q?.hints || [],
    followUpPrompts: q?.followUpPrompts || [],
  };
}

/**
 * Generate guiding question for incorrect answer
 */
export async function generateGuidingQuestion(
  incorrectAnswer: string,
  originalQuestion: SocraticQuestion,
  knowledgeGap: string
): Promise<SocraticQuestion> {
  const prompt = `${GUIDING_QUESTION_PROMPT}

Generate a guiding question to help the student understand.

Original Question: ${originalQuestion.text}
Student's Incorrect Answer: "${incorrectAnswer}"
Knowledge Gap: ${knowledgeGap}

The guiding question should:
1. NOT reveal the correct answer
2. Point them toward the right direction
3. Break down the problem into smaller parts
4. Build on what they DO understand
5. Be simpler than the original (difficulty: ${Math.max(1, originalQuestion.difficulty - 1)}/5)`;

  const result = await sensieAgent.generate(prompt, {
    output: SocraticQuestionSchema,
  });

  const q = result.object;
  return {
    text: q?.text || '',
    type: (q?.type as QuestionType) || 'UNDERSTANDING',
    difficulty: Math.max(1, originalQuestion.difficulty - 1),
    expectedElements: q?.expectedElements || [],
    hints: q?.hints || [],
    followUpPrompts: q?.followUpPrompts || [],
  };
}

/**
 * Generate hints for a question
 */
export async function generateHints(
  question: SocraticQuestion,
  concept: Concept
): Promise<string[]> {
  if (question.hints && question.hints.length >= 3) {
    return question.hints;
  }

  const hintsSchema = z.object({
    hints: z.array(z.string()).length(3).describe('Three progressive hints'),
  });

  const prompt = `Generate 3 progressive hints for this question about "${concept.name}":

Question: ${question.text}
Expected Elements: ${question.expectedElements.join(', ')}

Hint 1 (subtle): Remind them of a related concept without revealing the answer
Hint 2 (moderate): Suggest the structure of a good answer
Hint 3 (strong): Provide a key insight that still requires connecting the dots

Keep hints brief (1-2 sentences each). Use Master Roshi's voice.`;

  const result = await sensieAgent.generate(prompt, {
    output: hintsSchema,
  });

  return result.object?.hints || [];
}

// ============================================================================
// Quiz Functions
// ============================================================================

/**
 * Generate a quiz for a topic
 */
export async function generateQuiz(
  topicId: string,
  options: QuizOptions
): Promise<Quiz> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      subtopics: {
        where: { isLocked: false },
        include: {
          concepts: {
            where: { isMastered: false },
          },
        },
      },
    },
  });

  if (!topic) {
    throw new Error('Topic not found');
  }

  const conceptNames = topic.subtopics.flatMap(st =>
    st.concepts.map(c => c.name)
  );

  if (conceptNames.length === 0) {
    const allConcepts = await prisma.concept.findMany({
      where: { subtopic: { topicId } },
      select: { name: true },
    });
    conceptNames.push(...allConcepts.map(c => c.name));
  }

  const prompt = `${QUIZ_GENERATION_PROMPT}

Generate a quiz for the topic "${topic.name}".

Concepts to cover: ${conceptNames.join(', ')}

Requirements:
- Number of questions: ${options.questionCount}
${options.difficulty ? `- Target difficulty: ${options.difficulty}/5` : '- Progressive difficulty'}
${options.includeReview ? '- Include review questions' : ''}
${options.timeLimit ? `- Time limit: ${options.timeLimit} minutes` : ''}

Create questions that test understanding, not memorization.`;

  const result = await sensieAgent.generate(prompt, {
    output: QuizSchema,
  });

  const quiz = result.object;
  return {
    title: quiz?.title || `${topic.name} Quiz`,
    description: quiz?.description || '',
    questions: (quiz?.questions || []).map(q => ({
      question: q.question,
      type: q.type as 'UNDERSTANDING' | 'APPLICATION' | 'ANALYSIS',
      difficulty: q.difficulty,
      expectedAnswer: q.expectedAnswer,
      scoringCriteria: q.scoringCriteria,
    })),
    totalPoints: quiz?.totalPoints || options.questionCount * 10,
    passingScore: quiz?.passingScore || Math.ceil(options.questionCount * 7),
    timeLimit: quiz?.timeLimit,
  };
}

/**
 * Validate question quality
 */
export function validateQuestion(question: SocraticQuestion): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const validTypes: QuestionType[] = ['RECALL', 'UNDERSTANDING', 'APPLICATION', 'ANALYSIS', 'SYNTHESIS'];

  if (!question.text || question.text.trim().length < 10) {
    issues.push('Question text is too short or empty');
  }
  if (!question.text.includes('?')) {
    issues.push('Question should end with a question mark');
  }
  if (!validTypes.includes(question.type)) {
    issues.push(`Invalid question type: ${question.type}`);
  }
  if (question.difficulty < 1 || question.difficulty > 5) {
    issues.push(`Difficulty should be 1-5, got ${question.difficulty}`);
  }
  if (!question.expectedElements || question.expectedElements.length < 1) {
    issues.push('Question should have at least 1 expected element');
  }
  if (!question.hints || question.hints.length < 1) {
    issues.push('Question should have at least 1 hint');
  } else if (question.hints.length > 3) {
    issues.push('Question should have at most 3 hints');
  }

  const lowerText = question.text.toLowerCase();
  if (lowerText.includes('the answer is') || lowerText.includes('you should')) {
    issues.push('Question should not contain direct answers');
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Select best question for current context
 */
export function selectBestQuestion(
  questions: SocraticQuestion[],
  userPerformance: { accuracy: number; hintsUsed: number }
): SocraticQuestion {
  if (questions.length === 0) {
    throw new Error('No questions provided');
  }
  if (questions.length === 1) {
    return questions[0];
  }

  let targetDifficulty: number;
  if (userPerformance.accuracy >= 0.8 && userPerformance.hintsUsed < 1) {
    targetDifficulty = 4;
  } else if (userPerformance.accuracy >= 0.6) {
    targetDifficulty = 3;
  } else if (userPerformance.accuracy >= 0.4) {
    targetDifficulty = 2;
  } else {
    targetDifficulty = 1;
  }

  const sorted = [...questions].sort((a, b) => {
    const aDiff = Math.abs(a.difficulty - targetDifficulty);
    const bDiff = Math.abs(b.difficulty - targetDifficulty);
    return aDiff - bDiff;
  });

  return sorted[0];
}

// ============================================================================
// Navigation & Progress Functions
// ============================================================================

/**
 * Suggest the next concept to study
 */
export async function suggestNextConcept(
  topicId: string,
  userId: string
): Promise<NextConceptSuggestion> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      subtopics: {
        orderBy: { order: 'asc' },
        include: {
          concepts: { orderBy: { id: 'asc' } },
        },
      },
    },
  });

  if (!topic) {
    throw new Error('Topic not found');
  }

  for (const subtopic of topic.subtopics) {
    if (subtopic.isLocked) continue;

    for (const concept of subtopic.concepts) {
      if (!concept.isMastered) {
        const answerCount = await prisma.answer.count({
          where: { userId, question: { conceptId: concept.id } },
        });

        return {
          conceptId: concept.id,
          reason: answerCount > 0
            ? `You've worked on "${concept.name}" before - let's continue building that understanding.`
            : `Time to explore "${concept.name}" - an important piece of ${subtopic.name}.`,
          confidence: answerCount > 0 ? 0.9 : 0.7,
        };
      }
    }
  }

  const nextLockedSubtopic = topic.subtopics.find(st => st.isLocked);
  if (nextLockedSubtopic && nextLockedSubtopic.concepts.length > 0) {
    return {
      conceptId: nextLockedSubtopic.concepts[0].id,
      reason: `You've mastered the previous section! Ready to unlock "${nextLockedSubtopic.name}"?`,
      confidence: 0.95,
    };
  }

  const firstConcept = topic.subtopics[0]?.concepts[0];
  return {
    conceptId: firstConcept?.id || '',
    reason: "Hohoho! You've mastered all concepts! Time for review.",
    confidence: 1.0,
  };
}

// ============================================================================
// Encouragement & Messaging Functions
// ============================================================================

/**
 * Generate encouragement in Master Roshi style
 */
export async function generateEncouragement(
  context: 'correct' | 'incorrect' | 'progress' | 'struggle'
): Promise<string> {
  const contextMap: Record<string, keyof typeof ENCOURAGEMENT> = {
    'correct': 'CORRECT_ANSWER',
    'incorrect': 'STRUGGLE',
    'progress': 'PROGRESS',
    'struggle': 'STRUGGLE',
  };

  const key = contextMap[context];
  const phrases = key ? ENCOURAGEMENT[key] : undefined;
  if (phrases && phrases.length > 0) {
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  const prompt = `Generate an encouraging message for a student who just ${
    context === 'correct' ? 'answered correctly' :
    context === 'incorrect' ? 'got an answer wrong' :
    context === 'progress' ? 'made progress' : 'is struggling'
  }.

Keep it brief (1-2 sentences). Use Master Roshi's voice - wise, a bit eccentric, but genuinely supportive.`;

  const result = await sensieAgent.generate(prompt, {
    output: EncouragementSchema,
  });

  return result.object?.message || "Keep training, young one!";
}

/**
 * Handle special commands from user
 */
export async function handleCommand(
  command: string,
  context: SocraticContext
): Promise<string> {
  const cmd = command.toLowerCase().trim();

  switch (cmd) {
    case '/hint':
    case 'hint':
      if (context.hintsUsed >= 3) {
        return "Hohoho! You've used all your hints. Trust your training!";
      }
      return `Hint ${context.hintsUsed + 1}/3 coming up...`;

    case '/skip':
    case 'skip':
      return "Skipping? Fine, but this concept will return later!";

    case '/break':
    case 'break':
      return await generateBreakMessage(30, context.previousAnswers.length);

    case '/progress':
    case 'progress':
      return "Let me check your training progress...";

    case '/topics':
    case 'topics':
      return "Here are your training grounds:";

    case '/review':
    case 'review':
      return "Time for review! Let's see what needs refreshing.";

    case '/quiz':
    case 'quiz':
      return "A quiz? Hohoho! I like that fighting spirit!";

    default:
      return "Hmm? Try /hint, /skip, /break, /progress, /topics, /review, or /quiz.";
  }
}

/**
 * Generate a break message
 */
export async function generateBreakMessage(
  sessionDuration: number,
  questionsAnswered: number
): Promise<string> {
  if (BREAK_MESSAGES && BREAK_MESSAGES.length > 0) {
    const base = BREAK_MESSAGES[Math.floor(Math.random() * BREAK_MESSAGES.length)];
    return `${base} You answered ${questionsAnswered} questions in ${Math.round(sessionDuration)} minutes. Good training!`;
  }

  return `Rest well! You answered ${questionsAnswered} questions. Same time tomorrow?`;
}

/**
 * Generate progress report in Sensie's voice
 */
export async function generateProgressReport(
  topicId: string,
  userId: string
): Promise<string> {
  const [performance, completion, streak] = await Promise.all([
    getPerformanceSummary(userId, topicId),
    getTopicCompletionContext(topicId, userId),
    getStreakContext(userId),
  ]);

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { name: true },
  });

  const prompt = `Generate a progress report for a student studying "${topic?.name || 'this topic'}".

Performance Data:
- Total questions answered: ${performance.totalQuestions}
- Correct answers: ${performance.correctAnswers}
- Hints used: ${performance.hintsUsed}
- Recent accuracy: ${Math.round(performance.recentAccuracy * 100)}%

Topic Completion:
- Completed subtopics: ${completion.completedSubtopics}/${completion.totalSubtopics}
- Mastered concepts: ${completion.masteredConcepts}/${completion.totalConcepts}
- Overall mastery: ${Math.round(completion.overallMastery)}%

Streak:
- Current streak: ${streak.currentStreak} days
- Longest streak: ${streak.longestStreak} days
${streak.isAtRisk ? '- STREAK AT RISK!' : ''}

Generate an encouraging progress report in Master Roshi's voice.`;

  const result = await sensieAgent.generate(prompt, {
    output: ProgressSummarySchema,
  });

  const summary = result.object;
  let report = `**Your Training Progress**\n\n`;
  report += `${summary?.overview || 'Keep training!'}\n\n`;

  if (summary?.strengths && summary.strengths.length > 0) {
    report += `**Strengths:**\n`;
    summary.strengths.forEach(s => report += `- ${s}\n`);
    report += '\n';
  }

  if (summary?.areasToImprove && summary.areasToImprove.length > 0) {
    report += `**Areas to Develop:**\n`;
    summary.areasToImprove.forEach(a => report += `- ${a}\n`);
    report += '\n';
  }

  report += `**Next Steps:** ${summary?.recommendation || 'Keep practicing!'}\n\n`;
  report += `${summary?.motivation || 'You can do it!'}`;

  return report;
}

// ============================================================================
// Helper Functions
// ============================================================================

function adjustDifficultyFromAnswers(
  baseDifficulty: number,
  answers: Array<{ isCorrect: boolean; depth: string }>
): number {
  if (answers.length < 3) return baseDifficulty;

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
