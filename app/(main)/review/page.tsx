'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Review Page - Spaced repetition session (integrated with backend)
 */

interface ReviewItem {
  reviewId: string;
  question: {
    text: string;
    type: string;
    difficulty: number;
    expectedElements: string[];
    hints: string[];
  };
  context: {
    topicName: string;
    subtopicName: string;
    conceptName: string;
  };
  status: string;
  stability: number;
  difficulty: number;
  lastReviewed: string | null;
}

interface ReviewSession {
  totalDue: number;
  items: ReviewItem[];
  stats: {
    totalReviews: number;
    dueToday: number;
    completed: number;
    averageRetention: number;
  };
}

type ReviewState = 'loading' | 'idle' | 'reviewing' | 'complete';
type Rating = 1 | 2 | 3 | 4;

const RATINGS: { id: Rating; label: string; color: string }[] = [
  { id: 1, label: 'Again', color: 'text-red-500' },
  { id: 2, label: 'Hard', color: 'text-orange-500' },
  { id: 3, label: 'Good', color: 'text-green-500' },
  { id: 4, label: 'Easy', color: 'text-blue-500' },
];

function ReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicId = searchParams.get('topic');

  const [state, setState] = useState<ReviewState>('loading');
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState<Array<{ reviewId: string; rating: Rating }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch reviews on mount
  useEffect(() => {
    fetchReviews();
  }, [topicId]);

  async function fetchReviews() {
    try {
      setState('loading');
      setError(null);

      const url = topicId ? `/api/review/due?topicId=${topicId}` : '/api/review/due';
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch reviews');
      }

      const data = await response.json();

      // Create a session-like structure from due reviews
      setSession({
        totalDue: data.totalDue,
        items: data.reviews?.map((r: Record<string, unknown>) => ({
          reviewId: r.id,
          question: {
            text: `Review this concept: What do you remember about this topic?`,
            type: 'RECALL',
            difficulty: 3,
            expectedElements: [],
            hints: [],
          },
          context: {
            topicName: (r as { topic?: { name?: string } }).topic?.name || 'Unknown Topic',
            subtopicName: 'Review',
            conceptName: 'Concept',
          },
          status: r.status,
          stability: r.stability,
          difficulty: r.difficulty,
          lastReviewed: r.lastReviewed,
        })) || [],
        stats: {
          totalReviews: data.totalDue,
          dueToday: data.totalDue,
          completed: 0,
          averageRetention: 0,
        },
      });

      setState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
      setState('idle');
    }
  }

  async function startReview() {
    try {
      setState('loading');
      setError(null);

      const body = topicId ? { topicId } : {};
      const response = await fetch('/api/review/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to start review');
      }

      const data = await response.json();

      if (data.reviewSession.totalDue === 0) {
        setSession({
          totalDue: 0,
          items: [],
          stats: data.reviewSession.stats,
        });
        setState('idle');
        return;
      }

      setSession(data.reviewSession);
      setCurrentIndex(0);
      setShowAnswer(false);
      setResults([]);
      setState('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start review');
      setState('idle');
    }
  }

  async function rateCard(rating: Rating) {
    if (!session || !session.items[currentIndex]) return;

    const currentItem = session.items[currentIndex];

    try {
      setSubmitting(true);

      // Record the review
      const response = await fetch('/api/review/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId: currentItem.reviewId,
          rating,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to record review');
      }

      // Add to results
      setResults([...results, { reviewId: currentItem.reviewId, rating }]);

      // Move to next card or complete
      if (currentIndex < session.items.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      } else {
        setState('complete');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record review');
    } finally {
      setSubmitting(false);
    }
  }

  const formatLastReviewed = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const currentCard = session?.items[currentIndex];
  const dueCount = session?.totalDue || 0;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--border))]">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-lg font-medium text-[hsl(var(--foreground))]">
            Review
            {topicId && session?.items[0] && (
              <span className="text-[hsl(var(--muted-foreground))] font-normal">
                {' '}– {session.items[0].context.topicName}
              </span>
            )}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 border border-[hsl(var(--destructive))/0.3] rounded-lg bg-[hsl(var(--destructive))/0.1] text-[hsl(var(--destructive))]">
            <p className="text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading State */}
        {state === 'loading' && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        )}

        {/* Idle State */}
        {state === 'idle' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] p-6 text-center">
                <p className="text-3xl font-mono font-medium text-[hsl(var(--foreground))]">
                  {dueCount}
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                  Due today
                </p>
              </div>
              <div className="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] p-6 text-center">
                <p className="text-3xl font-mono font-medium text-[hsl(var(--foreground))]">
                  {session?.stats.completed || 0}
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                  Completed
                </p>
              </div>
            </div>

            {dueCount > 0 ? (
              <div className="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] p-6 text-center">
                <p className="text-[hsl(var(--foreground))] mb-4">
                  You have {dueCount} items ready for review.
                </p>
                <button
                  onClick={startReview}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  Start review
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] p-6 text-center">
                <p className="text-[hsl(var(--muted-foreground))] mb-4">
                  No reviews due. Great job keeping up!
                </p>
                <Link
                  href={topicId ? `/chat?topic=${topicId}` : '/chat'}
                  className="inline-flex items-center gap-2 text-sm text-[hsl(var(--foreground))] hover:underline"
                >
                  Continue learning
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Reviewing State */}
        {state === 'reviewing' && currentCard && (
          <div className="space-y-6">
            {/* Progress */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-1 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[hsl(var(--foreground))] transition-all"
                  style={{
                    width: `${((currentIndex + 1) / session!.items.length) * 100}%`,
                  }}
                />
              </div>
              <span className="text-sm font-mono text-[hsl(var(--muted-foreground))]">
                {currentIndex + 1}/{session!.items.length}
              </span>
            </div>

            {/* Card */}
            <div className="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] overflow-hidden">
              <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/0.3]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">
                    {currentCard.context.topicName} / {currentCard.context.subtopicName}
                  </span>
                  <span className="text-[hsl(var(--muted-foreground))]">
                    Last: {formatLastReviewed(currentCard.lastReviewed)}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <p className="text-lg text-[hsl(var(--foreground))] text-center leading-relaxed">
                  {currentCard.question.text}
                </p>
                {currentCard.context.conceptName && (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] text-center mt-4">
                    Concept: {currentCard.context.conceptName}
                  </p>
                )}
              </div>

              <div className="px-6 pb-6">
                {!showAnswer ? (
                  <button
                    onClick={() => setShowAnswer(true)}
                    className="w-full py-3 border border-[hsl(var(--border))] text-[hsl(var(--foreground))] font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    Show answer
                  </button>
                ) : (
                  <div className="space-y-4">
                    <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
                      How well did you recall this?
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {RATINGS.map(({ id, label, color }) => (
                        <button
                          key={id}
                          onClick={() => rateCard(id)}
                          disabled={submitting}
                          className={cn(
                            'py-3 rounded-lg font-medium text-sm transition-colors',
                            'border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]',
                            submitting && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <span className={cn('block', color)}>
                            {label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Complete State */}
        {state === 'complete' && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-medium text-[hsl(var(--foreground))] mb-2">
              Review complete!
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] mb-8">
              You reviewed {results.length} items.
            </p>

            {/* Results breakdown */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {RATINGS.map(({ id, label, color }) => {
                const count = results.filter((r) => r.rating === id).length;
                return (
                  <div
                    key={id}
                    className="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] p-4"
                  >
                    <p className={cn("text-2xl font-mono font-medium", color)}>
                      {count}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={startReview}
                className="px-6 py-2.5 border border-[hsl(var(--border))] text-[hsl(var(--foreground))] font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
              >
                Review more
              </button>
              <Link
                href={topicId ? `/chat?topic=${topicId}` : '/chat'}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Continue learning
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      }
    >
      <ReviewPageContent />
    </Suspense>
  );
}
