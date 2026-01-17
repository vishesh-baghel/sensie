import { prisma } from './client';
import type { Question, QuestionType } from '.prisma/client-sensie';

/**
 * Create a question for a concept
 */
export async function createQuestion(data: {
  conceptId: string;
  text: string;
  type: QuestionType;
  difficulty?: number;
  expectedElements?: string[];
  hints?: string[];
  followUpPrompts?: string[];
}): Promise<Question> {
  return prisma.question.create({
    data: {
      conceptId: data.conceptId,
      text: data.text,
      type: data.type,
      difficulty: data.difficulty || 2,
      expectedElements: data.expectedElements || [],
      hints: data.hints || [],
      followUpPrompts: data.followUpPrompts || [],
    },
  });
}

/**
 * Create multiple questions for a concept (batch)
 */
export async function createQuestions(
  conceptId: string,
  questions: Array<{
    text: string;
    type: QuestionType;
    difficulty?: number;
    expectedElements?: string[];
    hints?: string[];
    followUpPrompts?: string[];
  }>
): Promise<Question[]> {
  const created = await prisma.$transaction(
    questions.map((q) =>
      prisma.question.create({
        data: {
          conceptId,
          text: q.text,
          type: q.type,
          difficulty: q.difficulty || 2,
          expectedElements: q.expectedElements || [],
          hints: q.hints || [],
          followUpPrompts: q.followUpPrompts || [],
        },
      })
    )
  );
  return created;
}

/**
 * Get all questions for a concept
 */
export async function getQuestionsByConcept(
  conceptId: string,
  difficulty?: number
): Promise<Question[]> {
  return prisma.question.findMany({
    where: {
      conceptId,
      ...(difficulty !== undefined && { difficulty }),
    },
    orderBy: { difficulty: 'asc' },
  });
}

/**
 * Get question by ID
 */
export async function getQuestionById(
  questionId: string
): Promise<Question | null> {
  return prisma.question.findUnique({
    where: { id: questionId },
  });
}

/**
 * Get a random question for a concept at given difficulty
 */
export async function getRandomQuestion(
  conceptId: string,
  difficulty: number
): Promise<Question | null> {
  // Get questions at or near the target difficulty
  const questions = await prisma.question.findMany({
    where: {
      conceptId,
      difficulty: {
        gte: difficulty - 1,
        lte: difficulty + 1,
      },
    },
  });

  if (questions.length === 0) return null;

  // Return random question
  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
}

/**
 * Get questions for a quiz (random selection)
 */
export async function getQuestionsForQuiz(
  conceptIds: string[],
  count: number
): Promise<Question[]> {
  const questions = await prisma.question.findMany({
    where: {
      conceptId: { in: conceptIds },
    },
  });

  // Shuffle and take requested count
  const shuffled = questions.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get question with its hints
 */
export async function getQuestionWithHints(
  questionId: string
): Promise<Question | null> {
  return prisma.question.findUnique({
    where: { id: questionId },
  });
}
