import { prisma } from './client';
import type { Subtopic } from '@prisma/client';

/**
 * Create subtopics for a topic (batch create)
 */
export async function createSubtopics(
  topicId: string,
  subtopics: Array<{
    name: string;
    description?: string;
    order: number;
    isLocked?: boolean;
  }>
): Promise<Subtopic[]> {
  const created = await prisma.$transaction(
    subtopics.map((subtopic) =>
      prisma.subtopic.create({
        data: {
          topicId,
          name: subtopic.name,
          description: subtopic.description,
          order: subtopic.order,
          isLocked: subtopic.isLocked ?? subtopic.order > 0, // First subtopic unlocked by default
        },
      })
    )
  );
  return created;
}

/**
 * Get all subtopics for a topic (ordered)
 */
export async function getSubtopicsByTopic(topicId: string): Promise<Subtopic[]> {
  return prisma.subtopic.findMany({
    where: { topicId },
    orderBy: { order: 'asc' },
  });
}

/**
 * Get subtopic by ID with optional concepts
 */
export async function getSubtopicById(
  subtopicId: string,
  includeConcepts: boolean = false
): Promise<Subtopic | null> {
  return prisma.subtopic.findUnique({
    where: { id: subtopicId },
    include: includeConcepts ? { concepts: true } : undefined,
  });
}

/**
 * Get the next locked subtopic for a topic
 */
export async function getNextLockedSubtopic(
  topicId: string
): Promise<Subtopic | null> {
  return prisma.subtopic.findFirst({
    where: {
      topicId,
      isLocked: true,
    },
    orderBy: { order: 'asc' },
  });
}

/**
 * Unlock a subtopic
 */
export async function unlockSubtopic(subtopicId: string): Promise<Subtopic> {
  return prisma.subtopic.update({
    where: { id: subtopicId },
    data: { isLocked: false },
  });
}

/**
 * Update subtopic mastery percentage
 */
export async function updateSubtopicMastery(
  subtopicId: string,
  masteryPercentage: number
): Promise<Subtopic> {
  return prisma.subtopic.update({
    where: { id: subtopicId },
    data: { masteryPercentage: Math.min(100, Math.max(0, masteryPercentage)) },
  });
}

/**
 * Complete a subtopic
 */
export async function completeSubtopic(subtopicId: string): Promise<Subtopic> {
  return prisma.subtopic.update({
    where: { id: subtopicId },
    data: {
      masteryPercentage: 100,
      completedAt: new Date(),
    },
  });
}

/**
 * Calculate subtopic mastery from concepts
 */
export async function calculateSubtopicMastery(
  subtopicId: string
): Promise<number> {
  const concepts = await prisma.concept.findMany({
    where: { subtopicId },
    select: { isMastered: true },
  });

  if (concepts.length === 0) return 0;

  const masteredCount = concepts.filter((c) => c.isMastered).length;
  return Math.round((masteredCount / concepts.length) * 100);
}
