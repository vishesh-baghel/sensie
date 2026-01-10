import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSession,
  getSessionById,
  getActiveSession,
  updateSessionState,
  useSkip,
  endSession,
  addMessage,
  getSessionMessages,
  resetSkips,
} from '@/lib/db/sessions';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    learningSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('sessions db module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new learning session', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        topicId: 'topic-123',
        isActive: true,
      };
      (prisma.learningSession.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const result = await createSession({
        userId: 'user-123',
        topicId: 'topic-123',
      });

      expect(result).toEqual(mockSession);
      expect(prisma.learningSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          topicId: 'topic-123',
          currentSubtopicId: undefined,
          currentConceptId: undefined,
          isActive: true,
        },
      });
    });
  });

  describe('getSessionById', () => {
    it('should return session by id', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockSession = { id: 'session-123', isActive: true };
      (prisma.learningSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const result = await getSessionById('session-123');

      expect(result).toEqual(mockSession);
      expect(prisma.learningSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        include: undefined,
      });
    });

    it('should include messages when requested', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockSession = {
        id: 'session-123',
        messages: [{ id: 'msg-1', content: 'Hello' }],
      };
      (prisma.learningSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const result = await getSessionById('session-123', true);

      expect(result?.messages).toBeDefined();
      expect(prisma.learningSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    });
  });

  describe('getActiveSession', () => {
    it('should return active session for topic', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockSession = { id: 'session-123', topicId: 'topic-123', isActive: true };
      (prisma.learningSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const result = await getActiveSession('topic-123');

      expect(result).toEqual(mockSession);
      expect(prisma.learningSession.findUnique).toHaveBeenCalledWith({
        where: { topicId: 'topic-123' },
      });
    });

    it('should return null if no active session', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.learningSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getActiveSession('topic-123');

      expect(result).toBeNull();
    });
  });

  describe('updateSessionState', () => {
    it('should update current concept', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockSession = {
        id: 'session-123',
        currentConceptId: 'concept-456',
        lastActivity: new Date(),
      };
      (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const result = await updateSessionState('session-123', {
        currentConceptId: 'concept-456',
      });

      expect(result.currentConceptId).toBe('concept-456');
    });

    it('should update hints used', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockSession = { id: 'session-123', hintsUsed: 2 };
      (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const result = await updateSessionState('session-123', { hintsUsed: 2 });

      expect(result.hintsUsed).toBe(2);
    });
  });

  describe('useSkip', () => {
    it('should increment skips and add question to skipped list', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.learningSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'session-123',
        skipsUsed: 1,
        skippedQuestionIds: ['q-1'],
      });
      const mockSession = {
        id: 'session-123',
        skipsUsed: 2,
        skippedQuestionIds: ['q-1', 'q-2'],
      };
      (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const result = await useSkip('session-123', 'q-2');

      expect(result.skipsUsed).toBe(2);
      expect(result.skippedQuestionIds).toContain('q-2');
    });

    it('should not allow more than 3 skips', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.learningSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'session-123',
        skipsUsed: 3,
        skippedQuestionIds: ['q-1', 'q-2', 'q-3'],
      });

      await expect(useSkip('session-123', 'q-4')).rejects.toThrow('No skips remaining');
    });

    it('should throw error for non-existent session', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.learningSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(useSkip('nonexistent', 'q-1')).rejects.toThrow('Session not found');
    });
  });

  describe('endSession', () => {
    it('should set isActive to false and endedAt', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockSession = {
        id: 'session-123',
        isActive: false,
        endedAt: new Date(),
      };
      (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const result = await endSession('session-123');

      expect(result.isActive).toBe(false);
      expect(result.endedAt).toBeDefined();
    });
  });

  describe('addMessage', () => {
    it('should add a sensie message', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockMessage = {
        id: 'msg-123',
        sessionId: 'session-123',
        role: 'SENSIE',
        content: 'Hello!',
      };
      (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockMessage);

      const result = await addMessage({
        sessionId: 'session-123',
        role: 'SENSIE',
        content: 'Hello!',
      });

      expect(result.role).toBe('SENSIE');
      expect(result.content).toBe('Hello!');
    });

    it('should add a user message', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockMessage = {
        id: 'msg-123',
        sessionId: 'session-123',
        role: 'USER',
        content: 'My answer',
      };
      (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockMessage);

      const result = await addMessage({
        sessionId: 'session-123',
        role: 'USER',
        content: 'My answer',
      });

      expect(result.role).toBe('USER');
    });

    it('should add metadata to message', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockMessage = {
        id: 'msg-123',
        sessionId: 'session-123',
        role: 'SENSIE',
        content: 'Great!',
        metadata: { questionId: 'q-123' },
      };
      (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockMessage);

      const result = await addMessage({
        sessionId: 'session-123',
        role: 'SENSIE',
        content: 'Great!',
        metadata: { questionId: 'q-123' },
      });

      expect(result.metadata).toEqual({ questionId: 'q-123' });
    });
  });

  describe('getSessionMessages', () => {
    it('should return messages ordered by createdAt', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockMessages = [
        { id: 'msg-1', content: 'First' },
        { id: 'msg-2', content: 'Second' },
      ];
      (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockMessages);

      const result = await getSessionMessages('session-123');

      expect(result).toEqual(mockMessages);
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
        orderBy: { createdAt: 'asc' },
        take: undefined,
      });
    });

    it('should limit messages when specified', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await getSessionMessages('session-123', 10);

      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-123' },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });
    });
  });

  describe('resetSkips', () => {
    it('should reset skip count to 0', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockSession = {
        id: 'session-123',
        skipsUsed: 0,
        skippedQuestionIds: [],
      };
      (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const result = await resetSkips('session-123');

      expect(result.skipsUsed).toBe(0);
      expect(result.skippedQuestionIds).toEqual([]);
    });
  });
});
