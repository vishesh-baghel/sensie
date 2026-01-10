import { z } from 'zod';
import type { LearningPath, LearningPathSubtopic, Topic } from '@/lib/types';
import { LearningPathSchema, DomainClassificationSchema } from '@/lib/mastra/schemas';
import { SENSIE_SYSTEM_PROMPT } from '@/lib/mastra/prompts';
import { sensieAgent } from '@/lib/mastra/agents/sensie';
import { prisma } from '@/lib/db/client';
import { learningLogger } from '@/lib/observability/logger';

/**
 * LearningPathGenerator - Creates structured learning paths from topics
 *
 * Uses LLM to generate a curriculum:
 * - Identifies domain (technical, soft-skills, career)
 * - Creates ordered subtopics (8-12 typically)
 * - Defines concepts within each subtopic
 */

/**
 * Constraints for learning paths
 */
export const PATH_CONSTRAINTS = {
  MIN_SUBTOPICS: 3,
  MAX_SUBTOPICS: 12,
  MIN_CONCEPTS_PER_SUBTOPIC: 2,
  MAX_CONCEPTS_PER_SUBTOPIC: 8,
  MIN_QUESTIONS_PER_CONCEPT: 3,
  MAX_QUESTIONS_PER_CONCEPT: 10,
};

/**
 * Generate a learning path for a topic
 */
export async function generatePath(
  topicName: string,
  userGoal?: string
): Promise<LearningPath> {
  learningLogger.info('Starting learning path generation', { topicName, userGoal });

  // First identify the domain
  const domain = await identifyDomain(topicName);
  learningLogger.info('Domain identified', { topicName, domain });

  // Generate subtopics with concepts
  const subtopics = await generateSubtopics(topicName, domain, userGoal);
  learningLogger.info('Subtopics generated', {
    topicName,
    subtopicCount: subtopics.length,
    totalConcepts: subtopics.reduce((sum, st) => sum + st.concepts.length, 0),
  });

  // Calculate estimated hours based on subtopics and concepts
  const estimatedHours = subtopics.reduce((total, st) => {
    // Estimate ~15-20 min per concept
    const conceptMinutes = st.concepts.length * 17;
    return total + conceptMinutes / 60;
  }, 0);

  return {
    topicName,
    domain,
    estimatedHours: Math.round(estimatedHours * 10) / 10, // Round to 1 decimal
    subtopics,
  };
}

/**
 * Create topic and subtopics in database from path
 * @param path - The generated learning path
 * @param userId - The user ID
 * @param shouldQueue - If true, create topic with QUEUED status instead of ACTIVE
 */
export async function createTopicFromPath(
  path: LearningPath,
  userId: string,
  shouldQueue: boolean = false
): Promise<Topic> {
  const status = shouldQueue ? 'QUEUED' : 'ACTIVE';
  learningLogger.info('Creating topic from path', { userId, topicName: path.topicName, status });

  // Create the topic
  const topic = await prisma.topic.create({
    data: {
      userId,
      name: path.topicName,
      description: `Learning path for ${path.topicName} (${path.domain})`,
      status,
      startedAt: shouldQueue ? null : new Date(),
      subtopics: {
        create: path.subtopics.map((subtopic, index) => ({
          name: subtopic.name,
          description: subtopic.description,
          order: index + 1,
          isLocked: index > 0, // First subtopic unlocked, rest locked
          concepts: {
            create: subtopic.concepts.map((concept) => ({
              name: concept.name,
              explanation: '', // Will be generated when teaching
            })),
          },
        })),
      },
    },
    include: {
      subtopics: {
        orderBy: { order: 'asc' },
        include: {
          concepts: true,
        },
      },
    },
  });

  learningLogger.info('Topic created in database', {
    topicId: topic.id,
    topicName: topic.name,
    subtopicCount: topic.subtopics.length,
  });

  return topic as Topic;
}

/**
 * Identify the domain of a topic using sensieAgent
 */
export async function identifyDomain(
  topicName: string
): Promise<'technical' | 'soft-skills' | 'career'> {
  const result = await sensieAgent.generate(
    `Classify this learning topic into a domain:

Topic: "${topicName}"

Domains:
- technical: Programming, software engineering, data science, math, science, engineering topics
- soft-skills: Communication, leadership, emotional intelligence, teamwork, negotiation
- career: Job searching, interviews, career transitions, professional development

Which domain best fits this topic? Consider the primary skills being developed.`,
    { output: DomainClassificationSchema }
  );

  return result.object?.domain || 'technical';
}

/**
 * Estimate learning time for a path
 */
export function estimateLearningTime(path: LearningPath): number {
  // Sum up time from all subtopics and concepts
  const totalConcepts = path.subtopics.reduce(
    (sum, st) => sum + st.concepts.length,
    0
  );

  // Average ~15 minutes per concept with questions
  const minutesPerConcept = 15;
  const totalMinutes = totalConcepts * minutesPerConcept;

  // Add 10% for reviews and breaks
  return Math.round((totalMinutes * 1.1) / 60 * 10) / 10; // Hours, 1 decimal
}

/**
 * Validate a learning path structure
 */
export function validatePath(path: LearningPath): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check subtopic count
  if (path.subtopics.length < PATH_CONSTRAINTS.MIN_SUBTOPICS) {
    errors.push(`Too few subtopics (${path.subtopics.length}). Minimum is ${PATH_CONSTRAINTS.MIN_SUBTOPICS}.`);
  }
  if (path.subtopics.length > PATH_CONSTRAINTS.MAX_SUBTOPICS) {
    errors.push(`Too many subtopics (${path.subtopics.length}). Maximum is ${PATH_CONSTRAINTS.MAX_SUBTOPICS}.`);
  }

  // Check each subtopic
  path.subtopics.forEach((subtopic, index) => {
    const conceptCount = subtopic.concepts.length;

    if (conceptCount < PATH_CONSTRAINTS.MIN_CONCEPTS_PER_SUBTOPIC) {
      errors.push(`Subtopic "${subtopic.name}" has too few concepts (${conceptCount}).`);
    }
    if (conceptCount > PATH_CONSTRAINTS.MAX_CONCEPTS_PER_SUBTOPIC) {
      errors.push(`Subtopic "${subtopic.name}" has too many concepts (${conceptCount}).`);
    }

    // Check order
    if (subtopic.order !== index + 1) {
      errors.push(`Subtopic "${subtopic.name}" has incorrect order.`);
    }
  });

  // Check for duplicate subtopic names
  const subtopicNames = path.subtopics.map(s => s.name.toLowerCase());
  const duplicates = subtopicNames.filter((name, i) => subtopicNames.indexOf(name) !== i);
  if (duplicates.length > 0) {
    errors.push(`Duplicate subtopic names: ${duplicates.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get recommended prerequisites for a topic
 */
export async function getPrerequisites(
  topicName: string
): Promise<string[]> {
  const prerequisitesSchema = z.object({
    prerequisites: z.array(z.string()).describe('List of prerequisite topics'),
    reasoning: z.string().describe('Why these prerequisites are needed'),
  });

  const result = await sensieAgent.generate(
    `What prerequisite knowledge should someone have before learning "${topicName}"?

List 2-5 prerequisite topics that would help them succeed. Consider:
- Foundational concepts they need
- Skills that will make learning easier
- Related topics that provide context

Keep the list focused on truly helpful prerequisites, not an exhaustive list.`,
    { output: prerequisitesSchema }
  );

  return result.object?.prerequisites || [];
}

/**
 * Adjust path based on user's existing knowledge
 */
export async function adjustPathForUser(
  path: LearningPath,
  userId: string
): Promise<LearningPath> {
  // Get user's completed topics and their concepts
  const completedTopics = await prisma.topic.findMany({
    where: {
      userId,
      status: 'COMPLETED',
    },
    include: {
      subtopics: {
        include: {
          concepts: true,
        },
      },
    },
  });

  if (completedTopics.length === 0) {
    // No prior knowledge, return path as-is
    return path;
  }

  // Extract known concepts
  const knownConcepts = completedTopics.flatMap(t =>
    t.subtopics.flatMap(st =>
      st.concepts.map(c => c.name.toLowerCase())
    )
  );

  // Filter out subtopics that cover already-known material
  const adjustedSubtopics = path.subtopics.map(subtopic => {
    const newConcepts = subtopic.concepts.filter(
      c => !knownConcepts.some(kc => kc.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(kc))
    );

    // If most concepts are new, keep the subtopic
    if (newConcepts.length >= subtopic.concepts.length * 0.5) {
      return {
        ...subtopic,
        concepts: newConcepts.length > 0 ? newConcepts : subtopic.concepts,
      };
    }

    // Otherwise mark for potential removal
    return newConcepts.length > 0
      ? { ...subtopic, concepts: newConcepts }
      : null;
  }).filter((st): st is LearningPathSubtopic => st !== null && st.concepts.length >= PATH_CONSTRAINTS.MIN_CONCEPTS_PER_SUBTOPIC);

  // If too few subtopics remain, return original path
  if (adjustedSubtopics.length < PATH_CONSTRAINTS.MIN_SUBTOPICS) {
    return path;
  }

  // Reorder subtopics
  const reorderedSubtopics = adjustedSubtopics.map((st, index) => ({
    ...st,
    order: index + 1,
  }));

  return {
    ...path,
    subtopics: reorderedSubtopics,
    estimatedHours: estimateLearningTime({ ...path, subtopics: reorderedSubtopics }),
  };
}

/**
 * Generate subtopics for a topic using sensieAgent
 */
export async function generateSubtopics(
  topicName: string,
  domain: 'technical' | 'soft-skills' | 'career',
  userGoal?: string
): Promise<LearningPathSubtopic[]> {
  const result = await sensieAgent.generate(
    `Create a comprehensive learning path for this topic:

Topic: "${topicName}"
Domain: ${domain}
${userGoal ? `User's Goal: ${userGoal}` : ''}

Generate ${PATH_CONSTRAINTS.MIN_SUBTOPICS}-${PATH_CONSTRAINTS.MAX_SUBTOPICS} subtopics that:
1. Progress from foundational to advanced
2. Each builds on previous knowledge
3. Cover the topic comprehensively
4. Are appropriately sized (not too broad or narrow)

For each subtopic, include ${PATH_CONSTRAINTS.MIN_CONCEPTS_PER_SUBTOPIC}-${PATH_CONSTRAINTS.MAX_CONCEPTS_PER_SUBTOPIC} specific concepts to learn.

The learning path should enable someone to go from beginner to competent in this topic.`,
    { output: LearningPathSchema }
  );

  if (!result.object?.subtopics) {
    throw new Error('Failed to generate learning path subtopics');
  }

  // Transform to our format
  return result.object.subtopics.map((st, index) => ({
    name: st.name,
    description: `Subtopic ${index + 1}: ${st.name}`,
    order: st.order || index + 1,
    concepts: st.concepts.map(conceptName => ({
      name: conceptName,
      keyPoints: [], // Will be generated when teaching
    })),
  }));
}

/**
 * Generate a quick preview of a topic path without full detail
 */
export async function previewPath(
  topicName: string
): Promise<{
  domain: 'technical' | 'soft-skills' | 'career';
  subtopicCount: number;
  estimatedHours: number;
  subtopicNames: string[];
}> {
  const domain = await identifyDomain(topicName);

  const subtopicsPreviewSchema = z.object({
    subtopics: z.array(z.string()).describe('Subtopic names only'),
  });

  const result = await sensieAgent.generate(
    `List ${PATH_CONSTRAINTS.MIN_SUBTOPICS}-${PATH_CONSTRAINTS.MAX_SUBTOPICS} subtopics for learning "${topicName}".
Just the names, in learning order. Be concise.`,
    { output: subtopicsPreviewSchema }
  );

  const subtopics = result.object?.subtopics || [];
  const subtopicCount = subtopics.length;

  // Rough estimate: 1-1.5 hours per subtopic
  const estimatedHours = Math.round(subtopicCount * 1.25 * 10) / 10;

  return {
    domain,
    subtopicCount,
    estimatedHours,
    subtopicNames: subtopics,
  };
}
