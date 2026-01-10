import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTopic,
  getTopicsByUser,
  getTopicById,
  getActiveTopics,
  countActiveTopics,
  updateTopicStatus,
  updateTopicMastery,
  startTopic,
  completeTopic,
  archiveTopic,
  deleteTopic,
} from '@/lib/db/topics';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    topic: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('topics db module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTopic', () => {
    it('should create a topic with required fields', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopic = {
        id: 'topic-123',
        userId: 'user-123',
        name: 'Rust',
        description: 'Learn Rust programming',
        status: 'QUEUED',
        masteryPercentage: 0,
      };
      (prisma.topic.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      const result = await createTopic({
        userId: 'user-123',
        name: 'Rust',
        description: 'Learn Rust programming',
      });

      expect(result).toEqual(mockTopic);
      expect(prisma.topic.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          name: 'Rust',
          description: 'Learn Rust programming',
          status: 'QUEUED',
        },
      });
    });

    it('should create a topic without description', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopic = {
        id: 'topic-123',
        userId: 'user-123',
        name: 'Rust',
        status: 'QUEUED',
      };
      (prisma.topic.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      const result = await createTopic({
        userId: 'user-123',
        name: 'Rust',
      });

      expect(result.name).toBe('Rust');
      expect(result.status).toBe('QUEUED');
    });
  });

  describe('getTopicsByUser', () => {
    it('should return all topics for a user', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopics = [
        { id: 'topic-1', name: 'Rust' },
        { id: 'topic-2', name: 'Go' },
      ];
      (prisma.topic.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopics);

      const result = await getTopicsByUser('user-123');

      expect(result).toEqual(mockTopics);
      expect(prisma.topic.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
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
    });

    it('should filter topics by status', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopics = [{ id: 'topic-1', name: 'Rust', status: 'ACTIVE' }];
      (prisma.topic.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopics);

      const result = await getTopicsByUser('user-123', 'ACTIVE');

      expect(result).toEqual(mockTopics);
      expect(prisma.topic.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', status: 'ACTIVE' },
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
    });
  });

  describe('getTopicById', () => {
    it('should return topic by id', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopic = { id: 'topic-123', name: 'Rust' };
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      const result = await getTopicById('topic-123');

      expect(result).toEqual(mockTopic);
      expect(prisma.topic.findUnique).toHaveBeenCalledWith({
        where: { id: 'topic-123' },
        include: undefined,
      });
    });

    it('should include subtopics when requested', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopic = {
        id: 'topic-123',
        name: 'Rust',
        subtopics: [{ id: 'sub-1', name: 'Ownership' }],
      };
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      const result = await getTopicById('topic-123', true);

      expect(result?.subtopics).toBeDefined();
      expect(prisma.topic.findUnique).toHaveBeenCalledWith({
        where: { id: 'topic-123' },
        include: { subtopics: { orderBy: { order: 'asc' } } },
      });
    });

    it('should return null for non-existent topic', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getTopicById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getActiveTopics', () => {
    it('should return only active topics', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopics = [{ id: 'topic-1', status: 'ACTIVE' }];
      (prisma.topic.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopics);

      const result = await getActiveTopics('user-123');

      expect(result).toEqual(mockTopics);
      expect(prisma.topic.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
        take: 3,
      });
    });

    it('should limit to max 3 active topics', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await getActiveTopics('user-123');

      expect(prisma.topic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 })
      );
    });
  });

  describe('countActiveTopics', () => {
    it('should return count of active topics', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await countActiveTopics('user-123');

      expect(result).toBe(2);
      expect(prisma.topic.count).toHaveBeenCalledWith({
        where: { userId: 'user-123', status: 'ACTIVE' },
      });
    });
  });

  describe('updateTopicStatus', () => {
    it('should update topic status', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopic = { id: 'topic-123', status: 'ACTIVE' };
      (prisma.topic.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      const result = await updateTopicStatus('topic-123', 'ACTIVE');

      expect(result.status).toBe('ACTIVE');
      expect(prisma.topic.update).toHaveBeenCalledWith({
        where: { id: 'topic-123' },
        data: { status: 'ACTIVE' },
      });
    });
  });

  describe('updateTopicMastery', () => {
    it('should update mastery percentage', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopic = { id: 'topic-123', masteryPercentage: 75 };
      (prisma.topic.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      const result = await updateTopicMastery('topic-123', 75);

      expect(result.masteryPercentage).toBe(75);
    });

    it('should clamp mastery to 0-100 range', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopic = { id: 'topic-123', masteryPercentage: 100 };
      (prisma.topic.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      await updateTopicMastery('topic-123', 150);

      expect(prisma.topic.update).toHaveBeenCalledWith({
        where: { id: 'topic-123' },
        data: { masteryPercentage: 100 },
      });
    });
  });

  describe('startTopic', () => {
    it('should set status to ACTIVE and startedAt', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopic = { id: 'topic-123', status: 'ACTIVE', startedAt: new Date() };
      (prisma.topic.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      const result = await startTopic('topic-123');

      expect(result.status).toBe('ACTIVE');
      expect(result.startedAt).toBeDefined();
    });
  });

  describe('completeTopic', () => {
    it('should set status to COMPLETED and completedAt', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopic = { id: 'topic-123', status: 'COMPLETED', completedAt: new Date() };
      (prisma.topic.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      const result = await completeTopic('topic-123');

      expect(result.status).toBe('COMPLETED');
      expect(result.completedAt).toBeDefined();
    });
  });

  describe('archiveTopic', () => {
    it('should set status to ARCHIVED', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockTopic = { id: 'topic-123', status: 'ARCHIVED' };
      (prisma.topic.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      const result = await archiveTopic('topic-123');

      expect(result.status).toBe('ARCHIVED');
    });
  });

  describe('deleteTopic', () => {
    it('should delete topic', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await deleteTopic('topic-123');

      expect(prisma.topic.delete).toHaveBeenCalledWith({
        where: { id: 'topic-123' },
      });
    });
  });
});
