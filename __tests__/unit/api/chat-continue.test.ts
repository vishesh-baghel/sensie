/**
 * Unit tests for /api/chat/continue endpoint
 *
 * This endpoint returns the topic to continue learning without creating messages.
 * It's used by the frontend to navigate directly to the appropriate topic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as continueHandler } from '@/app/api/chat/continue/route';
import type { SessionData } from '@/lib/auth/auth';

// Mock authentication modules
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
  isSessionExpired: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/auth/auth', () => ({
  requireAuth: vi.fn().mockReturnValue({ authorized: true }),
}));

// Mock database modules
vi.mock('@/lib/db/sessions', () => ({
  getActiveSessionsByUser: vi.fn(),
  getSessionMessages: vi.fn(),
}));

vi.mock('@/lib/db/topics', () => ({
  getTopicById: vi.fn(),
  getActiveTopics: vi.fn(),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat/continue', {
    method: 'GET',
  });
}

const mockSession: SessionData = {
  userId: 'user-123',
  role: 'owner',
  createdAt: Date.now(),
  expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
};

describe('/api/chat/continue endpoint', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import('@/lib/auth/session');
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const { requireAuth } = await import('@/lib/auth/auth');
    (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });
  });

  describe('Authentication', () => {
    it('should return 401 if not authenticated', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireAuth } = await import('@/lib/auth/auth');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Not authenticated',
      });

      const request = createMockRequest();
      const response = await continueHandler(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Not authenticated');
    });

    it('should return 401 for expired session', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireAuth } = await import('@/lib/auth/auth');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Session expired',
      });

      const request = createMockRequest();
      const response = await continueHandler(request);

      expect(response.status).toBe(401);
    });
  });

  describe('With Active Session', () => {
    it('should return topic from active session', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
      const { getTopicById } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'session-123', topicId: 'topic-123', currentSubtopicId: null },
      ]);

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        name: 'Rust Programming',
        masteryPercentage: 65,
      });

      const request = createMockRequest();
      const response = await continueHandler(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.topicId).toBe('topic-123');
      expect(data.topicName).toBe('Rust Programming');
      expect(data.sessionId).toBe('session-123');
      expect(data.mastery).toBe(65);
    });

    it('should return most recent session when multiple exist', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
      const { getTopicById } = await import('@/lib/db/topics');

      // First session in array is most recent
      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'session-new', topicId: 'topic-new', currentSubtopicId: null },
        { id: 'session-old', topicId: 'topic-old', currentSubtopicId: null },
      ]);

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-new',
        name: 'Latest Topic',
        masteryPercentage: 30,
      });

      const request = createMockRequest();
      const response = await continueHandler(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.topicId).toBe('topic-new');
      expect(data.topicName).toBe('Latest Topic');
    });

    it('should handle session with deleted topic by falling back to active topics', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
      const { getTopicById, getActiveTopics } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'session-123', topicId: 'deleted-topic', currentSubtopicId: null },
      ]);

      // Topic was deleted
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      // But user has other active topics
      (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'topic-456', name: 'Backup Topic', masteryPercentage: 20 },
      ]);

      const request = createMockRequest();
      const response = await continueHandler(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.topicId).toBe('topic-456');
      expect(data.topicName).toBe('Backup Topic');
    });
  });

  describe('Without Active Session', () => {
    it('should fall back to active topics when no sessions exist', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
      const { getActiveTopics } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'topic-789', name: 'Go Basics', masteryPercentage: 45 },
      ]);

      const request = createMockRequest();
      const response = await continueHandler(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.topicId).toBe('topic-789');
      expect(data.topicName).toBe('Go Basics');
      expect(data.mastery).toBe(45);
      // No sessionId when falling back to topic
      expect(data.sessionId).toBeUndefined();
    });

    it('should return first active topic when multiple exist', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
      const { getActiveTopics } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'topic-1', name: 'First Topic', masteryPercentage: 50 },
        { id: 'topic-2', name: 'Second Topic', masteryPercentage: 30 },
      ]);

      const request = createMockRequest();
      const response = await continueHandler(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.topicId).toBe('topic-1');
      expect(data.topicName).toBe('First Topic');
    });
  });

  describe('No Active Topics', () => {
    it('should return failure with navigation to topics page', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
      const { getActiveTopics } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest();
      const response = await continueHandler(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('No active topics to continue');
      expect(data.navigateTo).toBe('/topics');
    });

    it('should return failure when session topic deleted and no active topics', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
      const { getTopicById, getActiveTopics } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'session-123', topicId: 'deleted-topic', currentSubtopicId: null },
      ]);

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest();
      const response = await continueHandler(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.navigateTo).toBe('/topics');
    });
  });

  describe('Response Structure', () => {
    it('should return consistent success response structure', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
      const { getTopicById } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'session-123', topicId: 'topic-123', currentSubtopicId: null },
      ]);

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        name: 'Test Topic',
        masteryPercentage: 50,
      });

      const request = createMockRequest();
      const response = await continueHandler(request);

      const data = await response.json();

      // Check all expected fields are present
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('topicId');
      expect(data).toHaveProperty('topicName');
      expect(data).toHaveProperty('mastery');
      expect(typeof data.topicId).toBe('string');
      expect(typeof data.topicName).toBe('string');
      expect(typeof data.mastery).toBe('number');
    });

    it('should return consistent failure response structure', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
      const { getActiveTopics } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest();
      const response = await continueHandler(request);

      const data = await response.json();

      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('navigateTo');
      expect(typeof data.error).toBe('string');
      expect(typeof data.navigateTo).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createMockRequest();
      const response = await continueHandler(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to get continue target');
    });

    it('should handle topic fetch errors gracefully', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
      const { getTopicById } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'session-123', topicId: 'topic-123', currentSubtopicId: null },
      ]);

      (getTopicById as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Topic fetch failed')
      );

      const request = createMockRequest();
      const response = await continueHandler(request);

      expect(response.status).toBe(500);
    });
  });

  describe('User Isolation', () => {
    it('should only return sessions for authenticated user', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
      const { getTopicById } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'session-123', topicId: 'topic-123', currentSubtopicId: null },
      ]);

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        name: 'User Topic',
        masteryPercentage: 50,
      });

      const request = createMockRequest();
      await continueHandler(request);

      // Verify getActiveSessionsByUser was called with correct userId
      expect(getActiveSessionsByUser).toHaveBeenCalledWith('user-123');
    });

    it('should only return active topics for authenticated user', async () => {
      const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
      const { getActiveTopics } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest();
      await continueHandler(request);

      // Verify getActiveTopics was called with correct userId
      expect(getActiveTopics).toHaveBeenCalledWith('user-123');
    });
  });
});
