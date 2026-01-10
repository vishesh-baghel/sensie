'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Lock, ArrowRight, Loader2, TrendingUp, Calendar, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Progress Page - Integrated with backend API
 * Shows overall progress or topic-specific progress based on URL params
 */

interface OverallProgress {
  overview: {
    totalXP: number;
    level: number;
    currentStreak: number;
    longestStreak: number;
    reviewsDue: number;
  };
  topics: {
    active: number;
    completed: number;
    total: number;
    averageMastery: number;
  };
  today: {
    questionsAnswered: number;
    questionsCorrect: number;
    conceptsMastered: number;
    timeSpent: number;
    xpEarned: number;
  };
  badges: Array<{
    badgeType: string;
    name: string;
    icon: string;
    earnedAt: string;
  }>;
}

interface TopicProgress {
  mastery: number;
  subtopics: {
    completed: number;
    total: number;
  };
  concepts: {
    mastered: number;
    total: number;
  };
  questions: {
    answered: number;
    correctRate: number;
  };
  reviews: {
    due: number;
    total: number;
    completed: number;
    averageRetention: number;
  };
  nextAction: {
    action: string;
    subtopicId?: string;
    conceptId?: string;
  };
}

interface TopicDetail {
  id: string;
  name: string;
  status: string;
  subtopics?: Array<{
    id: string;
    name: string;
    isLocked: boolean;
    mastery: number;
    conceptCount?: number;
    masteredCount?: number;
  }>;
}

function ProgressPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicId = searchParams.get('topic');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overallProgress, setOverallProgress] = useState<OverallProgress | null>(null);
  const [topicProgress, setTopicProgress] = useState<TopicProgress | null>(null);
  const [topicDetail, setTopicDetail] = useState<TopicDetail | null>(null);

  useEffect(() => {
    async function fetchProgress() {
      try {
        setLoading(true);
        setError(null);

        if (topicId) {
          // Fetch topic-specific progress
          const [progressRes, topicRes] = await Promise.all([
            fetch(`/api/progress/${topicId}`),
            fetch(`/api/topics/${topicId}`),
          ]);

          if (!progressRes.ok || !topicRes.ok) {
            if (progressRes.status === 401 || topicRes.status === 401) {
              router.push('/login');
              return;
            }
            if (progressRes.status === 404 || topicRes.status === 404) {
              throw new Error('Topic not found');
            }
            throw new Error('Failed to load progress');
          }

          const progressData = await progressRes.json();
          const topicData = await topicRes.json();

          setTopicProgress(progressData.progress);
          setTopicDetail(topicData.topic);
        } else {
          // Fetch overall progress
          const response = await fetch('/api/progress');

          if (!response.ok) {
            if (response.status === 401) {
              router.push('/login');
              return;
            }
            throw new Error('Failed to load progress');
          }

          const data = await response.json();
          setOverallProgress(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load progress');
      } finally {
        setLoading(false);
      }
    }

    fetchProgress();
  }, [topicId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="text-center">
            <p className="text-[hsl(var(--destructive))] mb-4">{error}</p>
            <Link
              href="/topics"
              className="text-[hsl(var(--primary))] hover:underline"
            >
              Go to Topics
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (topicId && topicProgress && topicDetail) {
    return (
      <TopicProgressView
        topic={topicDetail}
        progress={topicProgress}
      />
    );
  }

  if (overallProgress) {
    return <OverallProgressView progress={overallProgress} />;
  }

  return null;
}

export default function ProgressPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      }
    >
      <ProgressPageContent />
    </Suspense>
  );
}

interface TopicProgressViewProps {
  topic: TopicDetail;
  progress: TopicProgress;
}

function TopicProgressView({ topic, progress }: TopicProgressViewProps) {
  const getSubtopicStatus = (subtopic: { isLocked: boolean; mastery: number }) => {
    if (subtopic.isLocked) return 'locked';
    if (subtopic.mastery >= 80) return 'completed';
    return 'in_progress';
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--border))]">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link
            href="/progress"
            className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-2 block"
          >
            ← All Progress
          </Link>
          <h1 className="text-lg font-medium text-[hsl(var(--foreground))]">
            {topic.name}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-8">
        {/* Overall progress */}
        <section>
          <div className="flex items-center gap-4 mb-2">
            <span className="text-3xl font-mono font-medium text-[hsl(var(--foreground))]">
              {progress.mastery}%
            </span>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              {progress.mastery >= 80 ? 'Mastered' : progress.mastery >= 50 ? 'Proficient' : 'Learning'}
            </span>
          </div>
          <div className="h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
            <div
              className="h-full bg-[hsl(var(--foreground))] transition-all duration-500"
              style={{ width: `${progress.mastery}%` }}
            />
          </div>
        </section>

        {/* Subtopics */}
        {topic.subtopics && topic.subtopics.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-4">
              Subtopics ({progress.subtopics.completed}/{progress.subtopics.total})
            </h2>
            <div className="space-y-1">
              {topic.subtopics.map((subtopic, index) => {
                const status = getSubtopicStatus(subtopic);
                return (
                  <div
                    key={subtopic.id}
                    className="flex items-center gap-3 py-3 border-b border-[hsl(var(--border))] last:border-0"
                  >
                    {/* Status indicator */}
                    <div className="flex-shrink-0">
                      {status === 'completed' && (
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {status === 'in_progress' && (
                        <div className="w-5 h-5 rounded-full border-2 border-[hsl(var(--foreground))]" />
                      )}
                      {status === 'locked' && (
                        <div className="w-5 h-5 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center">
                          <Lock className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <span
                          className={cn(
                            'text-sm',
                            status === 'locked'
                              ? 'text-[hsl(var(--muted-foreground))]'
                              : 'text-[hsl(var(--foreground))]'
                          )}
                        >
                          {subtopic.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-1 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[hsl(var(--foreground))]"
                              style={{ width: `${subtopic.mastery}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-[hsl(var(--muted-foreground))] w-8 text-right">
                            {Math.round(subtopic.mastery)}%
                          </span>
                        </div>
                      </div>
                      {status === 'locked' ? (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                          Complete previous subtopic to unlock
                        </p>
                      ) : subtopic.conceptCount ? (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                          {subtopic.masteredCount || 0}/{subtopic.conceptCount} concepts mastered
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Statistics */}
        <section>
          <h2 className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-4">
            Statistics
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              value={progress.questions.answered.toString()}
              label="Questions"
            />
            <StatCard
              value={`${progress.questions.correctRate}%`}
              label="Accuracy"
            />
            <StatCard
              value={`${progress.concepts.mastered}/${progress.concepts.total}`}
              label="Concepts"
            />
          </div>
        </section>

        {/* Review schedule */}
        <section>
          <h2 className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-4">
            Review Schedule
          </h2>
          <div className="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[hsl(var(--muted-foreground))]">
                  Reviews due
                </span>
                <span className="text-[hsl(var(--foreground))]">
                  {progress.reviews.due}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(var(--muted-foreground))]">
                  Reviews completed
                </span>
                <span className="text-[hsl(var(--foreground))]">
                  {progress.reviews.completed}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(var(--muted-foreground))]">
                  Average retention
                </span>
                <span className="text-[hsl(var(--foreground))]">
                  {progress.reviews.averageRetention}%
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href={`/chat?topic=${topic.id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Continue learning
            <ArrowRight className="w-4 h-4" />
          </Link>
          {progress.reviews.due > 0 && (
            <Link
              href={`/review?topic=${topic.id}`}
              className="px-4 py-3 border border-[hsl(var(--border))] text-[hsl(var(--foreground))] font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
            >
              Start review ({progress.reviews.due})
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

interface OverallProgressViewProps {
  progress: OverallProgress;
}

function OverallProgressView({ progress }: OverallProgressViewProps) {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--border))]">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-lg font-medium text-[hsl(var(--foreground))]">
            Your Progress
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-8">
        {/* Level & XP */}
        <section className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
            <span className="text-2xl font-bold text-[hsl(var(--primary-foreground))]">
              {progress.overview.level}
            </span>
          </div>
          <div>
            <p className="text-2xl font-mono font-medium text-[hsl(var(--foreground))]">
              {progress.overview.totalXP.toLocaleString()} XP
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Level {progress.overview.level}
            </p>
          </div>
        </section>

        {/* Streak */}
        <section className="flex items-center gap-4 p-4 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))]">
          <Flame className="w-8 h-8 text-orange-500" />
          <div>
            <p className="text-xl font-medium text-[hsl(var(--foreground))]">
              {progress.overview.currentStreak} day streak
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Longest: {progress.overview.longestStreak} days
            </p>
          </div>
        </section>

        {/* Topics Overview */}
        <section>
          <h2 className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-4">
            Topics
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <StatCard value={progress.topics.active.toString()} label="Active" />
            <StatCard value={progress.topics.completed.toString()} label="Completed" />
            <StatCard value={`${progress.topics.averageMastery}%`} label="Avg Mastery" />
          </div>
        </section>

        {/* Today's Activity */}
        <section>
          <h2 className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-4">
            Today&apos;s Activity
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] p-4">
              <p className="text-2xl font-mono font-medium text-[hsl(var(--foreground))]">
                {progress.today.questionsAnswered}
              </p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Questions ({Math.round((progress.today.questionsCorrect / Math.max(1, progress.today.questionsAnswered)) * 100)}% correct)
              </p>
            </div>
            <div className="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] p-4">
              <p className="text-2xl font-mono font-medium text-[hsl(var(--foreground))]">
                +{progress.today.xpEarned}
              </p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                XP earned today
              </p>
            </div>
          </div>
        </section>

        {/* Badges */}
        {progress.badges.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-4">
              Recent Badges
            </h2>
            <div className="flex flex-wrap gap-2">
              {progress.badges.slice(0, 6).map((badge, index) => (
                <div
                  key={index}
                  className="px-3 py-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] flex items-center gap-2"
                >
                  <span className="text-lg">{badge.icon}</span>
                  <span className="text-sm text-[hsl(var(--foreground))]">{badge.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/topics"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            View Topics
            <ArrowRight className="w-4 h-4" />
          </Link>
          {progress.overview.reviewsDue > 0 && (
            <Link
              href="/review"
              className="px-4 py-3 border border-[hsl(var(--border))] text-[hsl(var(--foreground))] font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
            >
              Reviews ({progress.overview.reviewsDue})
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

interface StatCardProps {
  value: string;
  label: string;
}

function StatCard({ value, label }: StatCardProps) {
  return (
    <div className="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] p-4">
      <p className="text-2xl font-mono font-medium text-[hsl(var(--foreground))]">
        {value}
      </p>
      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
        {label}
      </p>
    </div>
  );
}
