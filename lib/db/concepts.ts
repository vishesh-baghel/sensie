import { prisma } from './client';
import type { Concept } from '.prisma/client-sensie';

/**
 * Create a concept for a subtopic
 */
export async function createConcept(data: {
  subtopicId: string;
  name: string;
  explanation: string;
  codeExamples?: string[];
  analogies?: string[];
}): Promise<Concept> {
  return prisma.concept.create({
    data: {
      subtopicId: data.subtopicId,
      name: data.name,
      explanation: data.explanation,
      codeExamples: data.codeExamples || [],
      analogies: data.analogies || [],
    },
  });
}

/**
 * Create multiple concepts for a subtopic (batch)
 */
export async function createConcepts(
  subtopicId: string,
  concepts: Array<{
    name: string;
    explanation: string;
    codeExamples?: string[];
    analogies?: string[];
  }>
): Promise<Concept[]> {
  const created = await prisma.$transaction(
    concepts.map((concept) =>
      prisma.concept.create({
        data: {
          subtopicId,
          name: concept.name,
          explanation: concept.explanation,
          codeExamples: concept.codeExamples || [],
          analogies: concept.analogies || [],
        },
      })
    )
  );
  return created;
}

/**
 * Get all concepts for a subtopic
 */
export async function getConceptsBySubtopic(
  subtopicId: string
): Promise<Concept[]> {
  return prisma.concept.findMany({
    where: { subtopicId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get concept by ID with optional questions
 */
export async function getConceptById(
  conceptId: string,
  includeQuestions: boolean = false
): Promise<Concept | null> {
  return prisma.concept.findUnique({
    where: { id: conceptId },
    include: includeQuestions ? { questions: true } : undefined,
  });
}

/**
 * Get the next unmastered concept for a subtopic
 */
export async function getNextUnmasteredConcept(
  subtopicId: string
): Promise<Concept | null> {
  return prisma.concept.findFirst({
    where: {
      subtopicId,
      isMastered: false,
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Mark concept as mastered
 */
export async function markConceptMastered(conceptId: string): Promise<Concept> {
  return prisma.concept.update({
    where: { id: conceptId },
    data: {
      isMastered: true,
      masteredAt: new Date(),
    },
  });
}

/**
 * Update concept explanation
 */
export async function updateConceptExplanation(
  conceptId: string,
  explanation: string
): Promise<Concept> {
  return prisma.concept.update({
    where: { id: conceptId },
    data: { explanation },
  });
}

/**
 * Count mastered concepts for a subtopic
 */
export async function countMasteredConcepts(subtopicId: string): Promise<number> {
  return prisma.concept.count({
    where: {
      subtopicId,
      isMastered: true,
    },
  });
}

/**
 * Count total concepts for a subtopic
 */
export async function countConcepts(subtopicId: string): Promise<number> {
  return prisma.concept.count({
    where: { subtopicId },
  });
}
