import { prisma } from './client';
import type { Topic, TopicStatus } from '@prisma/client';

const MAX_ACTIVE_TOPICS = 3;

/**
 * Create a new topic for a user
 */
export async function createTopic(data: {
  userId: string;
  name: string;
  description?: string;
}): Promise<Topic> {
  return prisma.topic.create({
    data: {
      userId: data.userId,
      name: data.name,
      description: data.description,
      status: 'QUEUED',
    },
  });
}

/**
 * Get all topics for a user with subtopics
 */
export async function getTopicsByUser(
  userId: string,
  status?: TopicStatus
) {
  return prisma.topic.findMany({
    where: {
      userId,
      ...(status && { status }),
    },
    include: {
      subtopics: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          isLocked: true,
          masteryPercentage: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Get topic by ID with optional subtopics
 */
export async function getTopicById(
  topicId: string,
  includeSubtopics: boolean = false
): Promise<Topic | null> {
  return prisma.topic.findUnique({
    where: { id: topicId },
    include: includeSubtopics ? { subtopics: { orderBy: { order: 'asc' } } } : undefined,
  });
}

/**
 * Get active topics for a user (max 3)
 */
export async function getActiveTopics(userId: string): Promise<Topic[]> {
  return prisma.topic.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    orderBy: { updatedAt: 'desc' },
    take: MAX_ACTIVE_TOPICS,
  });
}

/**
 * Count active topics for a user
 */
export async function countActiveTopics(userId: string): Promise<number> {
  return prisma.topic.count({
    where: {
      userId,
      status: 'ACTIVE',
    },
  });
}

/**
 * Update topic status
 */
export async function updateTopicStatus(
  topicId: string,
  status: TopicStatus
): Promise<Topic> {
  return prisma.topic.update({
    where: { id: topicId },
    data: { status },
  });
}

/**
 * Update topic mastery percentage
 */
export async function updateTopicMastery(
  topicId: string,
  masteryPercentage: number
): Promise<Topic> {
  return prisma.topic.update({
    where: { id: topicId },
    data: { masteryPercentage: Math.min(100, Math.max(0, masteryPercentage)) },
  });
}

/**
 * Start a topic (set status to ACTIVE, set startedAt)
 */
export async function startTopic(topicId: string): Promise<Topic> {
  return prisma.topic.update({
    where: { id: topicId },
    data: {
      status: 'ACTIVE',
      startedAt: new Date(),
    },
  });
}

/**
 * Complete a topic (set status to COMPLETED, set completedAt)
 */
export async function completeTopic(topicId: string): Promise<Topic> {
  return prisma.topic.update({
    where: { id: topicId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });
}

/**
 * Archive a topic
 */
export async function archiveTopic(topicId: string): Promise<Topic> {
  return prisma.topic.update({
    where: { id: topicId },
    data: { status: 'ARCHIVED' },
  });
}

/**
 * Delete a topic and all related data
 */
export async function deleteTopic(topicId: string): Promise<void> {
  await prisma.topic.delete({
    where: { id: topicId },
  });
}
