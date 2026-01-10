/**
 * Gap Detector Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('@/lib/db/client', () => ({
  prisma: {
    topic: {
      findUnique: vi.fn(),
    },
    answer: {
      findMany: vi.fn(),
    },
    knowledgeGapRecord: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      gaps: [
        {
          concept: 'Ownership',
          severity: 'critical',
          evidence: 'Multiple incorrect answers',
          misconceptions: ['Confused with references'],
          prerequisites: ['Memory management'],
          suggestedResources: ['Rust book chapter 4'],
        },
      ],
      recommendations: [
        {
          type: 'reteach',
          priority: 'high',
          conceptName: 'Ownership',
          reason: 'Low accuracy',
          estimatedMinutes: 15,
        },
      ],
      overallStrength: 65,
    },
  }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'mock-model'),
}));

import {
  analyzeKnowledgeGaps,
  recordKnowledgeGap,
  resolveGap,
  getUnresolvedGaps,
} from '@/lib/learning/gap-detector';
import { prisma } from '@/lib/db/client';

describe('gap-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeKnowledgeGaps', () => {
    const mockTopic = {
      id: 'topic-1',
      name: 'Rust Programming',
      masteryPercentage: 60,
      subtopics: [
        {
          name: 'Ownership',
          masteryPercentage: 50,
          concepts: [
            { id: 'c1', name: 'Move Semantics', isMastered: false },
            { id: 'c2', name: 'Copy Trait', isMastered: true },
          ],
        },
      ],
    };

    it('should use heuristic analysis with insufficient data', async () => {
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { isCorrect: false, depth: 'NONE', hintsUsed: 0, question: { concept: { name: 'Ownership', subtopic: { name: 'Basics' } } } },
        { isCorrect: true, depth: 'SHALLOW', hintsUsed: 1, question: { concept: { name: 'Borrowing', subtopic: { name: 'Basics' } } } },
      ]);
      (prisma.knowledgeGapRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analysis = await analyzeKnowledgeGaps('user-1', 'topic-1');

      expect(analysis.userId).toBe('user-1');
      expect(analysis.topicId).toBe('topic-1');
      expect(analysis.overallStrength).toBeGreaterThanOrEqual(0);
    });

    it('should use LLM analysis with sufficient data', async () => {
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      // Create enough answers to trigger LLM analysis
      const answers = Array(10).fill(null).map((_, i) => ({
        isCorrect: i % 3 === 0,
        depth: i % 3 === 0 ? 'DEEP' : 'SHALLOW',
        hintsUsed: i % 2,
        createdAt: new Date(),
        text: `Answer ${i}`,
        question: {
          text: `Question ${i}`,
          difficulty: 3,
          concept: {
            name: 'Ownership',
            subtopic: { name: 'Basics' },
          },
        },
      }));

      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(answers);
      (prisma.knowledgeGapRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.knowledgeGapRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.knowledgeGapRecord.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const analysis = await analyzeKnowledgeGaps('user-1', 'topic-1');

      expect(analysis.gaps.length).toBeGreaterThan(0);
      expect(analysis.gaps[0].concept).toBe('Ownership');
      expect(analysis.gaps[0].severity).toBe('critical');
      expect(analysis.recommendedActions.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent topic', async () => {
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(analyzeKnowledgeGaps('user-1', 'invalid-topic'))
        .rejects.toThrow('Topic not found');
    });
  });

  describe('recordKnowledgeGap', () => {
    it('should create new gap record if not exists', async () => {
      (prisma.knowledgeGapRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.knowledgeGapRecord.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'gap-1',
      });

      await recordKnowledgeGap('user-1', 'topic-1', {
        gapType: 'misconception',
        severity: 'moderate',
        description: 'Confusion about ownership',
        evidence: 'Wrong answer about move semantics',
        misconceptions: ['Thinks ownership is like references'],
      });

      expect(prisma.knowledgeGapRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            topicId: 'topic-1',
            severity: 'moderate',
          }),
        })
      );
    });

    it('should increment frequency for existing gap', async () => {
      (prisma.knowledgeGapRecord.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'gap-1',
        frequency: 2,
      });
      (prisma.knowledgeGapRecord.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'gap-1',
        frequency: 3,
      });

      await recordKnowledgeGap('user-1', 'topic-1', {
        gapType: 'misconception',
        severity: 'critical',
        description: 'Confusion about ownership',
        evidence: 'Another wrong answer',
      });

      expect(prisma.knowledgeGapRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'gap-1' },
          data: expect.objectContaining({
            frequency: { increment: 1 },
            severity: 'critical',
          }),
        })
      );
    });
  });

  describe('resolveGap', () => {
    it('should mark gap as resolved', async () => {
      (prisma.knowledgeGapRecord.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'gap-1',
        isResolved: true,
      });

      await resolveGap('gap-1');

      expect(prisma.knowledgeGapRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'gap-1' },
          data: expect.objectContaining({
            isResolved: true,
          }),
        })
      );
    });
  });

  describe('getUnresolvedGaps', () => {
    it('should return unresolved gaps for user', async () => {
      (prisma.knowledgeGapRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          description: 'Gap 1',
          severity: 'critical',
          evidence: 'Evidence 1',
          frequency: 3,
          lastOccurrence: new Date(),
          relatedMisconceptions: ['misconception1'],
          suggestedResources: ['resource1'],
        },
        {
          description: 'Gap 2',
          severity: 'minor',
          evidence: 'Evidence 2',
          frequency: 1,
          lastOccurrence: new Date(),
          relatedMisconceptions: [],
          suggestedResources: [],
        },
      ]);

      const gaps = await getUnresolvedGaps('user-1');

      expect(gaps).toHaveLength(2);
      expect(gaps[0].concept).toBe('Gap 1');
      expect(gaps[0].severity).toBe('critical');
      expect(gaps[1].concept).toBe('Gap 2');
    });

    it('should filter by topic when provided', async () => {
      (prisma.knowledgeGapRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          description: 'Topic specific gap',
          severity: 'moderate',
          evidence: 'Evidence',
          frequency: 2,
          lastOccurrence: new Date(),
          relatedMisconceptions: [],
          suggestedResources: [],
        },
      ]);

      const gaps = await getUnresolvedGaps('user-1', 'topic-1');

      expect(prisma.knowledgeGapRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            topicId: 'topic-1',
            isResolved: false,
          }),
        })
      );
    });

    it('should return empty array when no gaps', async () => {
      (prisma.knowledgeGapRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const gaps = await getUnresolvedGaps('user-1');

      expect(gaps).toHaveLength(0);
    });
  });
});
