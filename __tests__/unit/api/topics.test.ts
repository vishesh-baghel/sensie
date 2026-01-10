import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getTopics, POST as createTopic } from '@/app/api/topics/route';
import {
  GET as getTopic,
  PUT as updateTopic,
  DELETE as deleteTopic,
} from '@/app/api/topics/[id]/route';
import { POST as startTopic } from '@/app/api/topics/[id]/start/route';
import type { SessionData } from '@/lib/auth/auth';

// Mock session module
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
  isSessionExpired: vi.fn().mockReturnValue(false),
}));

// Mock auth module
vi.mock('@/lib/auth/auth', () => ({
  requireAuth: vi.fn().mockReturnValue({ authorized: true }),
}));

// Mock db/topics module
vi.mock('@/lib/db/topics', () => ({
  getTopicsByUser: vi.fn(),
  createTopic: vi.fn(),
  countActiveTopics: vi.fn(),
  getTopicById: vi.fn(),
  updateTopicStatus: vi.fn(),
  archiveTopic: vi.fn(),
}));

// Mock db/sessions module
vi.mock('@/lib/db/sessions', () => ({
  createSession: vi.fn(),
  getActiveSession: vi.fn(),
}));

// Mock learning path generator
vi.mock('@/lib/learning/learning-path-generator', () => ({
  generatePath: vi.fn(),
  createTopicFromPath: vi.fn(),
}));

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    subtopic: {
      findMany: vi.fn(),
    },
    concept: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock Sensie agent
vi.mock('@/lib/mastra/agents/sensie', () => ({
  teachConcept: vi.fn(),
  suggestNextConcept: vi.fn(),
}));

function createMockRequest(
  url: string,
  options?: { method?: string; body?: object }
): NextRequest {
  return new NextRequest(url, {
    method: options?.method || 'GET',
    body: options?.body ? JSON.stringify(options.body) : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

const mockSession: SessionData = {
  userId: 'user-123',
  role: 'owner',
  createdAt: Date.now(),
  expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
};

describe('topics API routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mocks to default return values
    const { getSession } = await import('@/lib/auth/session');
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const { requireAuth } = await import('@/lib/auth/auth');
    (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });
  });

  describe('GET /api/topics', () => {
    it('should return user topics', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      const mockTopics = [
        { id: 't1', name: 'Rust', status: 'ACTIVE' },
        { id: 't2', name: 'TypeScript', status: 'COMPLETED' },
      ];
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopics);

      const request = createMockRequest('http://localhost:3000/api/topics');
      const response = await getTopics(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topics).toEqual(mockTopics);
    });

    it('should filter by status', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      const mockTopics = [{ id: 't1', name: 'Rust', status: 'ACTIVE' }];
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopics);

      const request = createMockRequest(
        'http://localhost:3000/api/topics?status=ACTIVE'
      );
      const response = await getTopics(request);

      expect(response.status).toBe(200);
      expect(getTopicsByUser).toHaveBeenCalledWith('user-123', 'ACTIVE');
    });

    it('should return 401 if not authenticated', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireAuth } = await import('@/lib/auth/auth');
      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Not authenticated',
      });

      const request = createMockRequest('http://localhost:3000/api/topics');
      const response = await getTopics(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/topics', () => {
    it('should create topic with auto-generated subtopics', async () => {
      const { countActiveTopics } = await import('@/lib/db/topics');
      const { generatePath, createTopicFromPath } = await import('@/lib/learning/learning-path-generator');

      (countActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const mockPath = {
        topicName: 'Rust Programming',
        domain: 'technical',
        estimatedHours: 10,
        subtopics: [
          { name: 'Basics', order: 1, concepts: [{ name: 'Variables' }] },
        ],
      };
      (generatePath as ReturnType<typeof vi.fn>).mockResolvedValue(mockPath);

      const mockTopic = {
        id: 't1',
        name: 'Rust Programming',
        status: 'ACTIVE',
        subtopics: [
          { id: 's1', name: 'Basics', isLocked: false, masteryPercentage: 0 },
        ],
      };
      (createTopicFromPath as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      const request = createMockRequest('http://localhost:3000/api/topics', {
        method: 'POST',
        body: { name: 'Rust Programming', goal: 'Build CLI tools' },
      });
      const response = await createTopic(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.topic.name).toBe('Rust Programming');
      expect(data.topic.subtopics).toHaveLength(1);
      expect(generatePath).toHaveBeenCalledWith('Rust Programming', 'Build CLI tools');
    });

    it('should queue topic when max active topics reached', async () => {
      const { countActiveTopics } = await import('@/lib/db/topics');
      const { generatePath, createTopicFromPath } = await import('@/lib/learning/learning-path-generator');
      (countActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      const mockPath = {
        topicName: 'Another Topic',
        domain: 'technical',
        estimatedHours: 5,
        subtopics: [{ name: 'Sub1', description: 'Desc', order: 1, concepts: [] }],
      };
      (generatePath as ReturnType<typeof vi.fn>).mockResolvedValue(mockPath);

      const mockQueuedTopic = {
        id: 't2',
        name: 'Another Topic',
        status: 'QUEUED',
        subtopics: [],
      };
      (createTopicFromPath as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueuedTopic);

      const request = createMockRequest('http://localhost:3000/api/topics', {
        method: 'POST',
        body: { name: 'Another Topic' },
      });
      const response = await createTopic(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.topic.status).toBe('QUEUED');
      // Verify createTopicFromPath was called with shouldQueue=true
      expect(createTopicFromPath).toHaveBeenCalledWith(mockPath, 'user-123', true);
    });

    it('should reject empty topic name', async () => {
      const { countActiveTopics } = await import('@/lib/db/topics');
      (countActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/topics', {
        method: 'POST',
        body: { name: '' },
      });
      const response = await createTopic(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/topics/[id]', () => {
    it('should return topic with subtopics', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const mockTopic = {
        id: 'topic-123',
        userId: 'user-123', // Must match session userId
        name: 'Rust',
        subtopics: [{ id: 's1', name: 'Ownership' }],
      };
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(mockTopic);

      const request = createMockRequest(
        'http://localhost:3000/api/topics/topic-123'
      );
      const params = Promise.resolve({ id: 'topic-123' });
      const response = await getTopic(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topic).toEqual(mockTopic);
    });

    it('should return 404 for non-existent topic', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/topics/non-existent'
      );
      const params = Promise.resolve({ id: 'non-existent' });
      const response = await getTopic(request, { params });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/topics/[id]', () => {
    it('should update topic status', async () => {
      const { getTopicById, updateTopicStatus } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        status: 'ACTIVE',
      });
      (updateTopicStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        status: 'COMPLETED',
      });

      const request = createMockRequest(
        'http://localhost:3000/api/topics/topic-123',
        {
          method: 'PUT',
          body: { status: 'COMPLETED' },
        }
      );
      const params = Promise.resolve({ id: 'topic-123' });
      const response = await updateTopic(request, { params });

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent topic', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/topics/topic-123',
        {
          method: 'PUT',
          body: { status: 'COMPLETED' },
        }
      );
      const params = Promise.resolve({ id: 'topic-123' });
      const response = await updateTopic(request, { params });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/topics/[id]', () => {
    it('should archive topic', async () => {
      const { getTopicById, archiveTopic } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        status: 'ACTIVE',
      });
      (archiveTopic as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        status: 'ARCHIVED',
      });

      const request = createMockRequest(
        'http://localhost:3000/api/topics/topic-123',
        { method: 'DELETE' }
      );
      const params = Promise.resolve({ id: 'topic-123' });
      const response = await deleteTopic(request, { params });

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent topic', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/topics/topic-123',
        { method: 'DELETE' }
      );
      const params = Promise.resolve({ id: 'topic-123' });
      const response = await deleteTopic(request, { params });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/topics/[id]/start', () => {
    it('should start learning session', async () => {
      const { getTopicById, updateTopicStatus } = await import('@/lib/db/topics');
      const { createSession: createLearningSession, getActiveSession } = await import('@/lib/db/sessions');
      const { teachConcept, suggestNextConcept } = await import('@/lib/mastra/agents/sensie');
      const { prisma } = await import('@/lib/db/client');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        name: 'Test Topic',
        status: 'QUEUED',
      });
      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.subtopic.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'subtopic-123',
          concepts: [{ id: 'concept-123', name: 'Test Concept' }],
        },
      ]);
      (createLearningSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'session-123',
        topicId: 'topic-123',
      });
      (updateTopicStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        status: 'ACTIVE',
      });
      (suggestNextConcept as ReturnType<typeof vi.fn>).mockResolvedValue({
        conceptId: 'concept-123',
        reason: 'Start with the basics',
        confidence: 0.9,
      });
      (teachConcept as ReturnType<typeof vi.fn>).mockResolvedValue({
        conceptId: 'concept-123',
        introduction: 'Welcome to learning!',
        contextSetting: 'Let us begin...',
        initialQuestion: {
          text: 'What is your understanding?',
          type: 'UNDERSTANDING',
          difficulty: 2,
          expectedElements: ['key concept'],
          hints: ['Think about...'],
          followUpPrompts: [],
        },
      });
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'concept-123',
        name: 'Test Concept',
        subtopic: { name: 'Subtopic Name' },
      });

      const request = createMockRequest(
        'http://localhost:3000/api/topics/topic-123/start',
        { method: 'POST' }
      );
      const params = Promise.resolve({ id: 'topic-123' });
      const response = await startTopic(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.id).toBe('session-123');
      expect(data.teaching.introduction).toBeDefined();
    });

    it('should return 404 for non-existent topic', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/topics/topic-123/start',
        { method: 'POST' }
      );
      const params = Promise.resolve({ id: 'topic-123' });
      const response = await startTopic(request, { params });

      expect(response.status).toBe(404);
    });

    it('should return error for completed topic', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        name: 'Test Topic',
        status: 'COMPLETED',
      });

      const request = createMockRequest(
        'http://localhost:3000/api/topics/topic-123/start',
        { method: 'POST' }
      );
      const params = Promise.resolve({ id: 'topic-123' });
      const response = await startTopic(request, { params });
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Topic already completed');
    });
  });
});
