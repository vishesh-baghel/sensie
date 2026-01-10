/**
 * Advanced Gap Detection Engine
 *
 * Analyzes user learning patterns to detect knowledge gaps:
 * - Misconceptions from incorrect answers
 * - Missing prerequisites
 * - Shallow understanding (correct but not deep)
 *
 * Uses LLM to provide deeper analysis and actionable recommendations.
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type {
  KnowledgeGapAnalysis,
  DetailedKnowledgeGap,
  GapRecommendation,
} from '@/lib/types';
import { prisma } from '@/lib/db/client';
import { SENSIE_SYSTEM_PROMPT } from '@/lib/mastra/prompts';

// Minimum answers needed for gap analysis
const MIN_ANSWERS_FOR_ANALYSIS = 5;

// Zod schema for LLM gap analysis
const GapAnalysisSchema = z.object({
  gaps: z.array(z.object({
    concept: z.string().describe('The concept or skill with a gap'),
    severity: z.enum(['minor', 'moderate', 'critical']).describe('How serious is this gap'),
    evidence: z.string().describe('Evidence from answers that shows this gap'),
    misconceptions: z.array(z.string()).describe('Common misconceptions detected'),
    prerequisites: z.array(z.string()).describe('Missing prerequisites'),
    suggestedResources: z.array(z.string()).describe('Types of resources that would help'),
  })).describe('Detected knowledge gaps'),
  recommendations: z.array(z.object({
    type: z.enum(['reteach', 'practice', 'review', 'prerequisite']).describe('Type of action'),
    priority: z.enum(['high', 'medium', 'low']).describe('Priority level'),
    conceptName: z.string().describe('Target concept name'),
    reason: z.string().describe('Why this is recommended'),
    estimatedMinutes: z.number().describe('Estimated time to address'),
  })).describe('Recommended actions'),
  overallStrength: z.number().min(0).max(100).describe('Overall understanding strength 0-100'),
});

/**
 * Analyze knowledge gaps for a user on a topic
 */
export async function analyzeKnowledgeGaps(
  userId: string,
  topicId: string
): Promise<KnowledgeGapAnalysis> {
  // Get topic details
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

  if (!topic) {
    throw new Error('Topic not found');
  }

  // Get user's answers for this topic
  const answers = await prisma.answer.findMany({
    where: {
      userId,
      question: {
        concept: {
          subtopic: {
            topicId,
          },
        },
      },
    },
    include: {
      question: {
        include: {
          concept: {
            include: {
              subtopic: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100, // Analyze recent 100 answers
  });

  // Check existing gap records
  const existingGaps = await prisma.knowledgeGapRecord.findMany({
    where: {
      userId,
      topicId,
      isResolved: false,
    },
  });

  // If not enough data, use heuristic analysis
  if (answers.length < MIN_ANSWERS_FOR_ANALYSIS) {
    return heuristicGapAnalysis(userId, topicId, topic, answers, existingGaps);
  }

  // Prepare answer data for LLM analysis
  const answerSummaries = answers.slice(0, 50).map(a => ({
    question: a.question.text,
    answer: a.text.substring(0, 200), // Truncate for context
    isCorrect: a.isCorrect,
    depth: a.depth,
    concept: a.question.concept.name,
    subtopic: a.question.concept.subtopic.name,
    difficulty: a.question.difficulty,
    hintsUsed: a.hintsUsed,
  }));

  // Analyze incorrect and shallow answers
  const incorrectAnswers = answerSummaries.filter(a => !a.isCorrect);
  const shallowAnswers = answerSummaries.filter(a => a.depth === 'SHALLOW');

  // Use LLM for deep analysis
  try {
    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: GapAnalysisSchema,
      system: `${SENSIE_SYSTEM_PROMPT}

You are analyzing a student's learning gaps. Look for patterns in their answers to identify:
1. Persistent misconceptions (same type of error repeated)
2. Missing prerequisites (struggling with foundational concepts)
3. Shallow understanding (correct but unable to explain why)
4. Topics that need more practice`,
      prompt: `Analyze these learning outcomes for topic "${topic.name}":

**Topic Structure:**
${topic.subtopics.map(s => `- ${s.name}: ${s.concepts.map(c => c.name).join(', ')}`).join('\n')}

**Incorrect Answers (${incorrectAnswers.length}):**
${incorrectAnswers.slice(0, 20).map(a => `
- Question on ${a.concept}: "${a.question}"
  Answer: "${a.answer}"
  Hints used: ${a.hintsUsed}
`).join('')}

**Shallow Answers (${shallowAnswers.length}):**
${shallowAnswers.slice(0, 10).map(a => `
- Concept: ${a.concept}
  Question: "${a.question}"
`).join('')}

**Overall Stats:**
- Total answers: ${answers.length}
- Correct: ${answers.filter(a => a.isCorrect).length}
- Accuracy: ${Math.round((answers.filter(a => a.isCorrect).length / answers.length) * 100)}%

Provide a thorough gap analysis with specific, actionable recommendations.`,
    });

    // Build detailed gaps
    const detailedGaps: DetailedKnowledgeGap[] = object.gaps.map(gap => ({
      concept: gap.concept,
      severity: gap.severity,
      evidence: gap.evidence,
      prerequisitesNeeded: gap.prerequisites,
      frequency: countOccurrences(incorrectAnswers, gap.concept),
      lastOccurrence: getLastOccurrence(answers, gap.concept),
      relatedMisconceptions: gap.misconceptions,
      suggestedResources: gap.suggestedResources,
    }));

    // Build recommendations
    const recommendations: GapRecommendation[] = object.recommendations.map(rec => ({
      type: rec.type,
      priority: rec.priority,
      targetConceptName: rec.conceptName,
      reason: rec.reason,
      estimatedTime: rec.estimatedMinutes,
    }));

    // Save gaps to database
    await saveGapRecords(userId, topicId, detailedGaps);

    return {
      userId,
      topicId,
      analyzedAt: new Date(),
      gaps: detailedGaps,
      recommendedActions: recommendations,
      overallStrength: object.overallStrength,
      criticalGapsCount: detailedGaps.filter(g => g.severity === 'critical').length,
    };
  } catch (error) {
    console.error('[gap-detector] LLM analysis failed:', error);
    // Fall back to heuristic analysis
    return heuristicGapAnalysis(userId, topicId, topic, answers, existingGaps);
  }
}

/**
 * Heuristic-based gap analysis (fallback when not enough data or LLM fails)
 */
function heuristicGapAnalysis(
  userId: string,
  topicId: string,
  topic: {
    name: string;
    masteryPercentage: number;
    subtopics: Array<{
      name: string;
      masteryPercentage: number;
      concepts: Array<{ id: string; name: string; isMastered: boolean }>;
    }>;
  },
  answers: Array<{
    isCorrect: boolean;
    depth: string;
    hintsUsed: number;
    question: { concept: { name: string; subtopic: { name: string } } };
  }>,
  existingGaps: Array<{
    description: string;
    severity: string;
    evidence: string;
  }>
): KnowledgeGapAnalysis {
  const gaps: DetailedKnowledgeGap[] = [];
  const recommendations: GapRecommendation[] = [];

  // Analyze by concept performance
  const conceptStats = new Map<string, { correct: number; total: number; hints: number }>();

  for (const answer of answers) {
    const conceptName = answer.question.concept.name;
    const stats = conceptStats.get(conceptName) || { correct: 0, total: 0, hints: 0 };
    stats.total++;
    if (answer.isCorrect) stats.correct++;
    stats.hints += answer.hintsUsed;
    conceptStats.set(conceptName, stats);
  }

  // Find concepts with low accuracy
  for (const [conceptName, stats] of conceptStats) {
    if (stats.total < 2) continue; // Need at least 2 answers

    const accuracy = stats.correct / stats.total;
    const avgHints = stats.hints / stats.total;

    if (accuracy < 0.4) {
      // Critical gap
      gaps.push({
        concept: conceptName,
        severity: 'critical',
        evidence: `Accuracy: ${Math.round(accuracy * 100)}% (${stats.correct}/${stats.total})`,
        prerequisitesNeeded: [],
        frequency: stats.total - stats.correct,
        lastOccurrence: new Date(),
        relatedMisconceptions: [],
        suggestedResources: ['Re-read explanation', 'Practice with examples'],
      });

      recommendations.push({
        type: 'reteach',
        priority: 'high',
        targetConceptName: conceptName,
        reason: `Only ${Math.round(accuracy * 100)}% accuracy`,
        estimatedTime: 15,
      });
    } else if (accuracy < 0.7 || avgHints > 1.5) {
      // Moderate gap
      gaps.push({
        concept: conceptName,
        severity: 'moderate',
        evidence: `Accuracy: ${Math.round(accuracy * 100)}%, Avg hints: ${avgHints.toFixed(1)}`,
        prerequisitesNeeded: [],
        frequency: stats.total - stats.correct,
        lastOccurrence: new Date(),
        relatedMisconceptions: [],
        suggestedResources: ['Practice more questions'],
      });

      recommendations.push({
        type: 'practice',
        priority: 'medium',
        targetConceptName: conceptName,
        reason: `Needs reinforcement (${Math.round(accuracy * 100)}% accuracy)`,
        estimatedTime: 10,
      });
    }
  }

  // Find subtopics with low mastery
  for (const subtopic of topic.subtopics) {
    if (subtopic.masteryPercentage < 50) {
      const unmasteredConcepts = subtopic.concepts.filter(c => !c.isMastered);
      if (unmasteredConcepts.length > 0) {
        gaps.push({
          concept: subtopic.name,
          severity: subtopic.masteryPercentage < 30 ? 'critical' : 'moderate',
          evidence: `Subtopic mastery: ${subtopic.masteryPercentage}%`,
          prerequisitesNeeded: [],
          frequency: 1,
          lastOccurrence: new Date(),
          relatedMisconceptions: [],
          suggestedResources: ['Complete remaining concepts'],
        });
      }
    }
  }

  // Include existing unresolved gaps
  for (const existingGap of existingGaps) {
    if (!gaps.some(g => g.concept === existingGap.description)) {
      gaps.push({
        concept: existingGap.description,
        severity: existingGap.severity as 'minor' | 'moderate' | 'critical',
        evidence: existingGap.evidence,
        prerequisitesNeeded: [],
        frequency: 1,
        lastOccurrence: new Date(),
        relatedMisconceptions: [],
        suggestedResources: [],
      });
    }
  }

  // Calculate overall strength
  const totalCorrect = answers.filter(a => a.isCorrect).length;
  const overallStrength = answers.length > 0
    ? Math.round((totalCorrect / answers.length) * 100)
    : Math.round(topic.masteryPercentage);

  return {
    userId,
    topicId,
    analyzedAt: new Date(),
    gaps,
    recommendedActions: recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    overallStrength,
    criticalGapsCount: gaps.filter(g => g.severity === 'critical').length,
  };
}

/**
 * Record a knowledge gap from an incorrect answer
 */
export async function recordKnowledgeGap(
  userId: string,
  topicId: string,
  data: {
    conceptId?: string;
    subtopicId?: string;
    gapType: string;
    severity: string;
    description: string;
    evidence: string;
    misconceptions?: string[];
  }
): Promise<void> {
  // Check if this gap already exists
  const existing = await prisma.knowledgeGapRecord.findFirst({
    where: {
      userId,
      topicId,
      description: data.description,
      isResolved: false,
    },
  });

  if (existing) {
    // Update frequency
    await prisma.knowledgeGapRecord.update({
      where: { id: existing.id },
      data: {
        frequency: { increment: 1 },
        lastOccurrence: new Date(),
        severity: data.severity, // Update severity if changed
      },
    });
  } else {
    // Create new record
    await prisma.knowledgeGapRecord.create({
      data: {
        userId,
        topicId,
        conceptId: data.conceptId,
        subtopicId: data.subtopicId,
        gapType: data.gapType,
        severity: data.severity,
        description: data.description,
        evidence: data.evidence,
        relatedMisconceptions: data.misconceptions || [],
        suggestedResources: [],
      },
    });
  }
}

/**
 * Mark a gap as resolved
 */
export async function resolveGap(gapId: string): Promise<void> {
  await prisma.knowledgeGapRecord.update({
    where: { id: gapId },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
    },
  });
}

/**
 * Get unresolved gaps for a user
 */
export async function getUnresolvedGaps(
  userId: string,
  topicId?: string
): Promise<DetailedKnowledgeGap[]> {
  const where: Record<string, unknown> = {
    userId,
    isResolved: false,
  };

  if (topicId) {
    where.topicId = topicId;
  }

  const gaps = await prisma.knowledgeGapRecord.findMany({
    where,
    orderBy: [
      { severity: 'desc' },
      { frequency: 'desc' },
    ],
  });

  return gaps.map(g => ({
    concept: g.description,
    severity: g.severity as 'minor' | 'moderate' | 'critical',
    evidence: g.evidence,
    prerequisitesNeeded: [],
    conceptId: g.conceptId || undefined,
    subtopicId: g.subtopicId || undefined,
    frequency: g.frequency,
    lastOccurrence: g.lastOccurrence,
    relatedMisconceptions: g.relatedMisconceptions,
    suggestedResources: g.suggestedResources,
  }));
}

// Helper functions

function countOccurrences(
  answers: Array<{ concept: string }>,
  conceptName: string
): number {
  return answers.filter(a =>
    a.concept.toLowerCase().includes(conceptName.toLowerCase())
  ).length;
}

function getLastOccurrence(
  answers: Array<{ createdAt?: Date; question: { concept: { name: string } } }>,
  conceptName: string
): Date {
  for (const answer of answers) {
    if (answer.question.concept.name.toLowerCase().includes(conceptName.toLowerCase())) {
      return answer.createdAt || new Date();
    }
  }
  return new Date();
}

async function saveGapRecords(
  userId: string,
  topicId: string,
  gaps: DetailedKnowledgeGap[]
): Promise<void> {
  for (const gap of gaps) {
    await recordKnowledgeGap(userId, topicId, {
      conceptId: gap.conceptId,
      subtopicId: gap.subtopicId,
      gapType: 'llm_detected',
      severity: gap.severity,
      description: gap.concept,
      evidence: gap.evidence,
      misconceptions: gap.relatedMisconceptions,
    });
  }
}
