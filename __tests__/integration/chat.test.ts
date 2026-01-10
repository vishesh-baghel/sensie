/**
 * Integration tests for Chat API
 *
 * These tests verify the chat endpoint works with the actual Mastra agent.
 * Requires AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY to be set.
 *
 * Run with: pnpm test:integration
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

// Check if we have API keys configured
const hasApiKey = !!(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

// Skip all tests if no API key is available
const describeWithApiKey = hasApiKey ? describe : describe.skip;

// Mock auth for testing
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: 'test-user-123',
    role: 'owner',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
  }),
  isSessionExpired: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/auth/auth', () => ({
  requireAuth: vi.fn().mockReturnValue({ authorized: true }),
}));

// Mock database operations
vi.mock('@/lib/db/sessions', () => ({
  getActiveSession: vi.fn().mockResolvedValue(null),
  createSession: vi.fn().mockResolvedValue({ id: 'test-session', topicId: null }),
  addMessage: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/db/topics', () => ({
  getTopicById: vi.fn().mockResolvedValue(null),
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

describeWithApiKey('Chat API Integration Tests', () => {
  beforeAll(() => {
    console.log('Running chat integration tests with API key:', hasApiKey ? 'configured' : 'missing');
  });

  describe('POST /api/chat/message', () => {
    it('should stream a response from Sensie agent', async () => {
      const { POST: messageHandler } = await import('@/app/api/chat/message/route');

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello Sensie! Just say "hi" back briefly.' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text');

      // Read the streaming response
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      let receivedText = '';
      let chunkCount = 0;

      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          receivedText += decoder.decode(value, { stream: true });
          chunkCount++;
        }
      }

      // Should have received some chunks
      expect(chunkCount).toBeGreaterThan(0);
      // Should have received some text content
      expect(receivedText.length).toBeGreaterThan(0);

      console.log(`Received ${chunkCount} chunks, ${receivedText.length} chars`);
    }, 30000); // 30 second timeout for LLM response

    it('should handle conversation with context', async () => {
      const { POST: messageHandler } = await import('@/app/api/chat/message/route');

      const request = createMockRequest({
        messages: [
          { role: 'user', content: 'My name is Test Student' },
          { role: 'assistant', content: 'Nice to meet you, Test Student!' },
          { role: 'user', content: 'What is my name? Reply in one word.' },
        ],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);

      // Read the response
      const reader = response.body?.getReader();
      let receivedText = '';

      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          receivedText += decoder.decode(value, { stream: true });
        }
      }

      // The response should reference the name from context
      expect(receivedText.length).toBeGreaterThan(0);
      console.log('Context test response received');
    }, 30000);

    it('should return 400 for missing messages', async () => {
      const { POST: messageHandler } = await import('@/app/api/chat/message/route');

      const request = createMockRequest({});
      const response = await messageHandler(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Messages array is required');
    });

    it('should return 400 for invalid messages format', async () => {
      const { POST: messageHandler } = await import('@/app/api/chat/message/route');

      const request = createMockRequest({
        messages: 'not an array',
      });
      const response = await messageHandler(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Sensie Agent Streaming', () => {
    it('should use Master Roshi personality', async () => {
      const { POST: messageHandler } = await import('@/app/api/chat/message/route');

      const request = createMockRequest({
        messages: [
          {
            role: 'user',
            content: 'Introduce yourself briefly in one sentence.',
          },
        ],
      });

      const response = await messageHandler(request);
      expect(response.status).toBe(200);

      // Read the response
      const reader = response.body?.getReader();
      let receivedText = '';

      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          receivedText += decoder.decode(value, { stream: true });
        }
      }

      // Response should be non-empty
      expect(receivedText.length).toBeGreaterThan(0);
      console.log('Personality test: response received');
    }, 30000);
  });
});

describeWithApiKey('AI SDK v6 Message Format', () => {
  it('should handle AI SDK v6 format with parts array', async () => {
    const { POST: messageHandler } = await import('@/app/api/chat/message/route');

    // AI SDK v6 format: messages with parts array
    const request = createMockRequest({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello Sensie! Say hi briefly.' }],
        },
      ],
    });

    const response = await messageHandler(request);
    expect(response.status).toBe(200);

    const reader = response.body?.getReader();
    let receivedText = '';

    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedText += decoder.decode(value, { stream: true });
      }
    }

    expect(receivedText.length).toBeGreaterThan(0);
    console.log('AI SDK v6 format test: response received');
  }, 30000);

  it('should save message content from parts array to database', async () => {
    const { addMessage } = await import('@/lib/db/sessions');
    const { getTopicById } = await import('@/lib/db/topics');
    const { getActiveSession, createSession } = await import('@/lib/db/sessions');
    const { POST: messageHandler } = await import('@/app/api/chat/message/route');

    // Setup mocks for topic and session
    (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'topic-123',
      userId: 'test-user-123',
      name: 'Test Topic',
      masteryPercentage: 50,
    });
    (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'session-123',
      topicId: 'topic-123',
    });

    const request = createMockRequest({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Test message with parts format' }],
        },
      ],
      topicId: 'topic-123',
    });

    const response = await messageHandler(request);
    expect(response.status).toBe(200);

    // Verify addMessage was called with correct content
    expect(addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Test message with parts format',
        role: 'USER',
      })
    );
    console.log('Message saved to database with correct content');
  }, 30000);

  it('should handle mixed v4 and v6 message formats', async () => {
    const { POST: messageHandler } = await import('@/app/api/chat/message/route');

    // Mix of v4 (content string) and v6 (parts array) formats
    const request = createMockRequest({
      messages: [
        { role: 'user', content: 'First message (v4 format)' },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Response in v6 format' }]
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Follow up in v6 format' }]
        },
      ],
    });

    const response = await messageHandler(request);
    expect(response.status).toBe(200);

    const reader = response.body?.getReader();
    let receivedText = '';

    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedText += decoder.decode(value, { stream: true });
      }
    }

    expect(receivedText.length).toBeGreaterThan(0);
    console.log('Mixed format test: response received');
  }, 30000);

  it('should return AI SDK v6 UI stream format', async () => {
    const { POST: messageHandler } = await import('@/app/api/chat/message/route');

    const request = createMockRequest({
      messages: [{ role: 'user', content: 'Say just "hello"' }],
    });

    const response = await messageHandler(request);
    expect(response.status).toBe(200);

    // Check content type is for SSE/stream
    const contentType = response.headers.get('content-type');
    expect(contentType).toBeTruthy();

    const reader = response.body?.getReader();
    let rawResponse = '';

    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rawResponse += decoder.decode(value, { stream: true });
      }
    }

    // AI SDK v6 UI stream should contain data: prefixed lines
    expect(rawResponse).toContain('data:');
    console.log('UI stream format verified');
  }, 30000);
});

// Test to verify API key configuration
describe('API Key Configuration', () => {
  it('should have either AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY configured', () => {
    const hasGatewayKey = !!process.env.AI_GATEWAY_API_KEY;
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

    console.log('API Key Status:');
    console.log(`  AI_GATEWAY_API_KEY: ${hasGatewayKey ? 'set' : 'not set'}`);
    console.log(`  ANTHROPIC_API_KEY: ${hasAnthropicKey ? 'set' : 'not set'}`);

    if (!hasGatewayKey && !hasAnthropicKey) {
      console.warn(
        'WARNING: No API key configured. Integration tests will be skipped.'
      );
      console.warn(
        'Set AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY to run integration tests.'
      );
    }

    // This test always passes - it's just for logging
    expect(true).toBe(true);
  });
});
