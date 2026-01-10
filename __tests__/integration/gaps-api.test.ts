/**
 * Integration tests for Gaps API routes
 *
 * Tests verify that the Knowledge Gap Detection API works correctly
 * including authentication, validation, and response formatting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PATCH } from '@/app/api/gaps/route';
import type { SessionData } from '@/lib/auth/auth';

// Mock authentication modules
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
  isSessionExpired: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/auth/auth', () => ({
  requireAuth: vi.fn().mockReturnValue({ authorized: true }),
}));

// Mock gap detector
vi.mock('@/lib/learning/gap-detector', () => ({
  analyzeKnowledgeGaps: vi.fn(),
  getUnresolvedGaps: vi.fn(),
  resolveGap: vi.fn(),
  recordKnowledgeGap: vi.fn(),
}));

function createMockRequest(path: string, options: RequestInit & { searchParams?: Record<string, string> } = {}): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return new NextRequest(url, {
    method: options.method || 'GET',
    body: options.body,
    headers: options.headers || { 'Content-Type': 'application/json' },
  });
}

const mockSession: SessionData = {
  userId: 'user-123',
  role: 'owner',
  createdAt: Date.now(),
  expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
};

describe('Gaps API Integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import('@/lib/auth/session');
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const { requireAuth } = await import('@/lib/auth/auth');
    (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });
  });

  describe('GET /api/gaps', () => {
    it('should return unresolved gaps', async () => {
      const { getUnresolvedGaps } = await import('@/lib/learning/gap-detector');

      (getUnresolvedGaps as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          concept: 'Ownership',
          severity: 'critical',
          evidence: 'Multiple incorrect answers',
          frequency: 3,
          lastSeen: new Date(),
          misconceptions: ['Confused with references'],
          suggestedResources: ['Rust book chapter 4'],
        },
        {
          concept: 'Borrowing',
          severity: 'moderate',
          evidence: 'Some confusion about mutable borrows',
          frequency: 1,
          lastSeen: new Date(),
          misconceptions: [],
          suggestedResources: [],
        },
      ]);

      const request = createMockRequest('/api/gaps');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.gaps).toHaveLength(2);
      expect(data.count).toBe(2);
      expect(data.criticalCount).toBe(1);
    });

    it('should filter gaps by topicId', async () => {
      const { getUnresolvedGaps } = await import('@/lib/learning/gap-detector');

      (getUnresolvedGaps as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          concept: 'Lifetimes',
          severity: 'critical',
          evidence: 'Struggles with lifetime syntax',
          frequency: 2,
          lastSeen: new Date(),
          misconceptions: ['Thinks lifetimes are runtime'],
          suggestedResources: ['Lifetime RFC'],
        },
      ]);

      const request = createMockRequest('/api/gaps', {
        searchParams: { topicId: 'topic-1' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.gaps).toHaveLength(1);
      expect(getUnresolvedGaps).toHaveBeenCalledWith('user-123', 'topic-1');
    });

    it('should perform fresh analysis when analyze=true', async () => {
      const { analyzeKnowledgeGaps } = await import('@/lib/learning/gap-detector');

      (analyzeKnowledgeGaps as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        topicId: 'topic-1',
        gaps: [
          {
            concept: 'Ownership',
            severity: 'critical',
            evidence: 'Pattern of errors',
            misconceptions: ['Reference confusion'],
            prerequisites: ['Memory basics'],
            suggestedResources: ['Rust book'],
          },
        ],
        recommendedActions: [
          {
            type: 'reteach',
            priority: 'high',
            conceptName: 'Ownership',
            reason: 'Critical gap detected',
            estimatedMinutes: 15,
          },
        ],
        overallStrength: 65,
        criticalGapsCount: 1,
      });

      const request = createMockRequest('/api/gaps', {
        searchParams: { topicId: 'topic-1', analyze: 'true' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.analysis).toBeDefined();
      expect(data.analysis.overallStrength).toBe(65);
      expect(analyzeKnowledgeGaps).toHaveBeenCalledWith('user-123', 'topic-1');
    });

    it('should return empty gaps array for new user', async () => {
      const { getUnresolvedGaps } = await import('@/lib/learning/gap-detector');

      (getUnresolvedGaps as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest('/api/gaps');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.gaps).toHaveLength(0);
      expect(data.count).toBe(0);
      expect(data.criticalCount).toBe(0);
    });

    it('should require authentication', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireAuth } = await import('@/lib/auth/auth');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Not authenticated',
      });

      const request = createMockRequest('/api/gaps');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/gaps', () => {
    it('should analyze gaps for a topic', async () => {
      const { analyzeKnowledgeGaps } = await import('@/lib/learning/gap-detector');

      (analyzeKnowledgeGaps as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        topicId: 'topic-1',
        gaps: [
          {
            concept: 'Pattern Matching',
            severity: 'moderate',
            evidence: 'Incomplete match arms',
            misconceptions: [],
            prerequisites: ['Enums'],
            suggestedResources: ['Pattern matching guide'],
          },
        ],
        recommendedActions: [
          {
            type: 'practice',
            priority: 'medium',
            conceptName: 'Pattern Matching',
            reason: 'Needs more practice',
            estimatedMinutes: 10,
          },
        ],
        overallStrength: 75,
        criticalGapsCount: 0,
      });

      const request = createMockRequest('/api/gaps', {
        method: 'POST',
        body: JSON.stringify({ topicId: 'topic-1' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.analysis.gaps).toHaveLength(1);
      expect(data.analysis.overallStrength).toBe(75);
    });

    it('should require topicId', async () => {
      const request = createMockRequest('/api/gaps', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Topic ID');
    });

    it('should handle topic not found error', async () => {
      const { analyzeKnowledgeGaps } = await import('@/lib/learning/gap-detector');

      (analyzeKnowledgeGaps as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Topic not found')
      );

      const request = createMockRequest('/api/gaps', {
        method: 'POST',
        body: JSON.stringify({ topicId: 'invalid-topic' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Topic not found');
    });
  });

  describe('PATCH /api/gaps', () => {
    it('should mark gap as resolved', async () => {
      const { resolveGap } = await import('@/lib/learning/gap-detector');

      (resolveGap as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'gap-1',
        isResolved: true,
        resolvedAt: new Date(),
      });

      const request = createMockRequest('/api/gaps', {
        method: 'PATCH',
        body: JSON.stringify({ gapId: 'gap-1' }),
      });
      const response = await PATCH(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(resolveGap).toHaveBeenCalledWith('gap-1');
    });

    it('should require gapId', async () => {
      const request = createMockRequest('/api/gaps', {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      const response = await PATCH(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Gap ID');
    });

    it('should require authentication', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireAuth } = await import('@/lib/auth/auth');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Not authenticated',
      });

      const request = createMockRequest('/api/gaps', {
        method: 'PATCH',
        body: JSON.stringify({ gapId: 'gap-1' }),
      });
      const response = await PATCH(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Gap Severity Counting', () => {
    it('should correctly count critical gaps', async () => {
      const { getUnresolvedGaps } = await import('@/lib/learning/gap-detector');

      (getUnresolvedGaps as ReturnType<typeof vi.fn>).mockResolvedValue([
        { concept: 'A', severity: 'critical', evidence: '', frequency: 1, lastSeen: new Date(), misconceptions: [], suggestedResources: [] },
        { concept: 'B', severity: 'critical', evidence: '', frequency: 1, lastSeen: new Date(), misconceptions: [], suggestedResources: [] },
        { concept: 'C', severity: 'moderate', evidence: '', frequency: 1, lastSeen: new Date(), misconceptions: [], suggestedResources: [] },
        { concept: 'D', severity: 'minor', evidence: '', frequency: 1, lastSeen: new Date(), misconceptions: [], suggestedResources: [] },
      ]);

      const request = createMockRequest('/api/gaps');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.count).toBe(4);
      expect(data.criticalCount).toBe(2);
    });

    it('should handle all critical gaps', async () => {
      const { getUnresolvedGaps } = await import('@/lib/learning/gap-detector');

      (getUnresolvedGaps as ReturnType<typeof vi.fn>).mockResolvedValue([
        { concept: 'A', severity: 'critical', evidence: '', frequency: 1, lastSeen: new Date(), misconceptions: [], suggestedResources: [] },
        { concept: 'B', severity: 'critical', evidence: '', frequency: 1, lastSeen: new Date(), misconceptions: [], suggestedResources: [] },
      ]);

      const request = createMockRequest('/api/gaps');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.count).toBe(2);
      expect(data.criticalCount).toBe(2);
    });

    it('should handle no critical gaps', async () => {
      const { getUnresolvedGaps } = await import('@/lib/learning/gap-detector');

      (getUnresolvedGaps as ReturnType<typeof vi.fn>).mockResolvedValue([
        { concept: 'A', severity: 'moderate', evidence: '', frequency: 1, lastSeen: new Date(), misconceptions: [], suggestedResources: [] },
        { concept: 'B', severity: 'minor', evidence: '', frequency: 1, lastSeen: new Date(), misconceptions: [], suggestedResources: [] },
      ]);

      const request = createMockRequest('/api/gaps');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.count).toBe(2);
      expect(data.criticalCount).toBe(0);
    });
  });

  describe('Analysis Recommendations', () => {
    it('should return all recommendation types', async () => {
      const { analyzeKnowledgeGaps } = await import('@/lib/learning/gap-detector');

      (analyzeKnowledgeGaps as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        topicId: 'topic-1',
        gaps: [],
        recommendedActions: [
          { type: 'reteach', priority: 'high', conceptName: 'A', reason: 'Critical', estimatedMinutes: 15 },
          { type: 'practice', priority: 'medium', conceptName: 'B', reason: 'Moderate', estimatedMinutes: 10 },
          { type: 'review', priority: 'low', conceptName: 'C', reason: 'Minor', estimatedMinutes: 5 },
        ],
        overallStrength: 70,
        criticalGapsCount: 1,
      });

      const request = createMockRequest('/api/gaps', {
        method: 'POST',
        body: JSON.stringify({ topicId: 'topic-1' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.analysis.recommendedActions).toHaveLength(3);
      expect(data.analysis.recommendedActions[0].type).toBe('reteach');
      expect(data.analysis.recommendedActions[1].type).toBe('practice');
      expect(data.analysis.recommendedActions[2].type).toBe('review');
    });
  });
});
