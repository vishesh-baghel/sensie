import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as messageHandler } from '@/app/api/chat/message/route';
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

// Mock db/sessions module
vi.mock('@/lib/db/sessions', () => ({
  getActiveSession: vi.fn(),
  createSession: vi.fn(),
  addMessage: vi.fn(),
}));

// Mock db/topics module
vi.mock('@/lib/db/topics', () => ({
  getTopicById: vi.fn(),
}));

// Mock prompts module
vi.mock('@/lib/mastra/prompts', () => ({
  SENSIE_SYSTEM_PROMPT: 'You are Sensie, a wise teacher...',
}));

// Mock sensieAgent - inline mock to avoid hoisting issues
// Creates a mock that returns AI SDK v6 compatible response
vi.mock('@/lib/mastra/agents/sensie', () => ({
  sensieAgent: {
    stream: vi.fn().mockImplementation(() =>
      Promise.resolve({
        toUIMessageStreamResponse: vi.fn().mockReturnValue(
          new Response('data: {"type":"text-delta","delta":"Hello from Sensie!"}\n\ndata: [DONE]\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          })
        ),
      })
    ),
  },
}));

function createMockRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat/message', {
    method: 'POST',
    body: JSON.stringify(body),
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

describe('chat API routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import('@/lib/auth/session');
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const { requireAuth } = await import('@/lib/auth/auth');
    (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });
  });

  describe('POST /api/chat/message', () => {
    it('should handle regular message', async () => {
      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello Sensie!' }],
      });
      const response = await messageHandler(request);

      expect(response.status).toBe(200);
    });

    it('should handle message with topic context', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession, createSession, addMessage } = await import('@/lib/db/sessions');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        name: 'Rust Programming',
        masteryPercentage: 50,
      });
      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'session-123',
        topicId: 'topic-123',
      });
      (addMessage as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Teach me about ownership' }],
        topicId: 'topic-123',
      });
      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      expect(addMessage).toHaveBeenCalled();
    });

    it('should create session if none active', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession, createSession, addMessage } = await import('@/lib/db/sessions');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        name: 'Rust',
      });
      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (createSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'new-session',
        topicId: 'topic-123',
      });
      (addMessage as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Start learning' }],
        topicId: 'topic-123',
      });
      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      expect(createSession).toHaveBeenCalled();
    });

    it('should return 401 if not authenticated', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireAuth } = await import('@/lib/auth/auth');
      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Not authenticated',
      });

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      const response = await messageHandler(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 if messages not provided', async () => {
      const request = createMockRequest({});
      const response = await messageHandler(request);

      expect(response.status).toBe(400);
    });

    it('should return 404 if topic not found', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        topicId: 'non-existent',
      });
      const response = await messageHandler(request);

      expect(response.status).toBe(404);
    });

    it('should return 404 if topic belongs to different user', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'different-user',
        name: 'Rust',
      });

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello' }],
        topicId: 'topic-123',
      });
      const response = await messageHandler(request);

      expect(response.status).toBe(404);
    });
  });
});
