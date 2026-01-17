'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Plus, ChevronRight, Check, Lock, MoreHorizontal, Archive, ArchiveRestore, Loader2, RefreshCw, Trash2, PlayCircle, CheckCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { fetcher } from '@/lib/swr/config';

/**
 * Topics Page - Refactored with SWR for better caching and performance
 */

type TopicStatus = 'ACTIVE' | 'COMPLETED' | 'QUEUED' | 'ARCHIVED';
type SubtopicStatus = 'completed' | 'in_progress' | 'locked';

interface Subtopic {
  id: string;
  name: string;
  isLocked: boolean;
  mastery: number;
}

interface Topic {
  id: string;
  name: string;
  goal?: string;
  masteryPercentage: number;
  status: TopicStatus;
  subtopics?: Subtopic[];
  updatedAt: string;
}

type FilterType = 'ACTIVE' | 'COMPLETED' | 'QUEUED' | 'ARCHIVED';

export default function TopicsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('ACTIVE');
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicGoal, setNewTopicGoal] = useState('');
  const [creating, setCreating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Use SWR for automatic caching, revalidation, and deduplication
  const { data, error, isLoading, mutate } = useSWR<{ topics: Topic[] }>(
    `/api/topics?status=${filter}`,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  const topics = data?.topics || [];
  const displayError = localError || (error ? 'Failed to load topics' : null);

  const handleCreateTopic = async () => {
    if (!newTopicName.trim()) return;

    try {
      setCreating(true);
      setLocalError(null);

      const response = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTopicName.trim(),
          goal: newTopicGoal.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403) {
          throw new Error(errorData.error || 'Maximum 3 active topics allowed. Complete or archive one first.');
        }
        throw new Error(errorData.error || 'Failed to create topic');
      }

      const { topic: newTopic } = await response.json();

      // Optimistically update cache
      if (newTopic.status === filter) {
        mutate(
          (current) => ({
            topics: [newTopic, ...(current?.topics || [])],
          }),
          { revalidate: false }
        );
      } else if (newTopic.status === 'QUEUED' && filter === 'ACTIVE') {
        // Switch to QUEUED tab - SWR will auto-fetch
        setFilter('QUEUED');
      } else {
        // Revalidate to get correct list
        mutate();
      }

      setNewTopicName('');
      setNewTopicGoal('');
      setShowNewTopic(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create topic');
    } finally {
      setCreating(false);
    }
  };

  const handleArchiveTopic = async (topicId: string) => {
    try {
      setLocalError(null);
      const response = await fetch(`/api/topics/${topicId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to archive topic');
      }

      // Optimistically update cache (functional update)
      mutate(
        (current) => ({
          topics: (current?.topics || []).filter(t => t.id !== topicId),
        }),
        { revalidate: false }
      );
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to archive topic');
      // Revalidate on error to restore correct state
      mutate();
    }
  };

  const handleUnarchiveTopic = async (topicId: string) => {
    try {
      setLocalError(null);
      const response = await fetch(`/api/topics/${topicId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'QUEUED' }),
      });

      if (!response.ok) {
        throw new Error('Failed to unarchive topic');
      }

      // Optimistically remove from archived list (functional update)
      mutate(
        (current) => ({
          topics: (current?.topics || []).filter(t => t.id !== topicId),
        }),
        { revalidate: false }
      );
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to unarchive topic');
      mutate();
    }
  };

  const handleMarkCompleted = async (topicId: string) => {
    try {
      setLocalError(null);
      const response = await fetch(`/api/topics/${topicId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark topic as completed');
      }

      // Optimistically update topic status (functional update)
      mutate(
        (current) => ({
          topics: (current?.topics || []).map(t =>
            t.id === topicId ? { ...t, status: 'COMPLETED' as TopicStatus } : t
          ),
        }),
        { revalidate: false }
      );
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update topic');
      mutate();
    }
  };

  const handleStartTopic = async (topicId: string) => {
    try {
      setLocalError(null);
      const response = await fetch(`/api/topics/${topicId}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start topic');
      }

      router.push(`/chat?topic=${topicId}`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to start learning');
    }
  };

  const getSubtopicStatus = (subtopic: Subtopic): SubtopicStatus => {
    if (subtopic.isLocked) return 'locked';
    if (subtopic.mastery >= 80) return 'completed';
    return 'in_progress';
  };

  const formatLastActive = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--border))]">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-medium text-[hsl(var(--foreground))]">
              Topics
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => mutate()}
                disabled={isLoading}
                className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] rounded-md"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </button>
              <button
                onClick={() => setShowNewTopic(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                New topic
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6">
        {/* Error message */}
        {displayError && (
          <div className="mb-6 p-4 border border-[hsl(var(--destructive))/0.3] rounded-lg bg-[hsl(var(--destructive))/0.1] text-[hsl(var(--destructive))]">
            <p className="text-sm">{displayError}</p>
            <button
              onClick={() => setLocalError(null)}
              className="text-xs underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[hsl(var(--border))] pb-3">
          {(['ACTIVE', 'QUEUED', 'COMPLETED', 'ARCHIVED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize',
                filter === f
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
              )}
            >
              {f.toLowerCase()}
            </button>
          ))}
        </div>

        {/* New topic input */}
        {showNewTopic && (
          <div className="mb-6 p-4 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))]">
            <input
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="What do you want to learn? (e.g., Rust Programming)"
              className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md focus:outline-none focus:border-[hsl(var(--foreground))/0.2]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCreateTopic();
                }
                if (e.key === 'Escape') setShowNewTopic(false);
              }}
            />
            <input
              type="text"
              value={newTopicGoal}
              onChange={(e) => setNewTopicGoal(e.target.value)}
              placeholder="Learning goal (optional, e.g., Build a CLI tool)"
              className="w-full mt-2 px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md focus:outline-none focus:border-[hsl(var(--foreground))/0.2]"
            />
            {creating ? (
              <div className="mt-4 p-3 bg-[hsl(var(--muted))] rounded-md">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--foreground))]" />
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      Generating your skill tree...
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                      This takes about 20-30 seconds. You can wait or come back shortly.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => {
                    setShowNewTopic(false);
                    setNewTopicName('');
                    setNewTopicGoal('');
                  }}
                  className="px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTopic}
                  disabled={!newTopicName.trim()}
                  className="px-3 py-1.5 text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md disabled:opacity-40"
                >
                  Create
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading state */}
        {isLoading && topics.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        )}

        {/* Topics list */}
        {!isLoading && (
          <div className="space-y-3">
            {topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                getSubtopicStatus={getSubtopicStatus}
                formatLastActive={formatLastActive}
                onArchive={() => handleArchiveTopic(topic.id)}
                onUnarchive={() => handleUnarchiveTopic(topic.id)}
                onStart={() => handleStartTopic(topic.id)}
                onMarkCompleted={() => handleMarkCompleted(topic.id)}
              />
            ))}
          </div>
        )}

        {!isLoading && topics.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[hsl(var(--muted-foreground))]">
              No {filter.toLowerCase()} topics.
              {filter === 'ACTIVE' && " Create one to start learning!"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

interface TopicCardProps {
  topic: Topic;
  getSubtopicStatus: (subtopic: Subtopic) => SubtopicStatus;
  formatLastActive: (dateStr: string) => string;
  onArchive: () => void;
  onUnarchive: () => void;
  onStart: () => void;
  onMarkCompleted: () => void;
}

function TopicCard({ topic, getSubtopicStatus, formatLastActive, onArchive, onUnarchive, onStart, onMarkCompleted }: TopicCardProps) {
  const completedSubtopics = topic.subtopics?.filter(
    (s) => !s.isLocked && s.mastery >= 80
  ).length || 0;
  const totalSubtopics = topic.subtopics?.length || 0;

  return (
    <div className="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] hover:border-[hsl(var(--muted-foreground))/0.3] transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-[hsl(var(--foreground))]">
              {topic.name}
            </h3>
            {topic.goal && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1">
                Goal: {topic.goal}
              </p>
            )}
            {totalSubtopics > 0 && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                {completedSubtopics}/{totalSubtopics} subtopics
                {topic.updatedAt && ` · ${formatLastActive(topic.updatedAt)}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-20 h-1 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[hsl(var(--foreground))]"
                  style={{ width: `${topic.masteryPercentage}%` }}
                />
              </div>
              <span className="text-sm font-mono text-[hsl(var(--muted-foreground))]">
                {topic.masteryPercentage}%
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded-md">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {topic.status === 'QUEUED' && (
                  <DropdownMenuItem onClick={onStart}>
                    <PlayCircle className="w-4 h-4" />
                    Start learning
                  </DropdownMenuItem>
                )}
                {topic.status === 'ACTIVE' && (
                  <>
                    <DropdownMenuItem onClick={onStart}>
                      <PlayCircle className="w-4 h-4" />
                      Continue learning
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onMarkCompleted}>
                      <CheckCircle className="w-4 h-4" />
                      Mark as completed
                    </DropdownMenuItem>
                  </>
                )}
                {topic.status === 'COMPLETED' && (
                  <DropdownMenuItem onClick={onStart}>
                    <RefreshCw className="w-4 h-4" />
                    Review topic
                  </DropdownMenuItem>
                )}
                {topic.status === 'ARCHIVED' && (
                  <DropdownMenuItem onClick={onUnarchive}>
                    <ArchiveRestore className="w-4 h-4" />
                    Unarchive topic
                  </DropdownMenuItem>
                )}
                {topic.status !== 'ARCHIVED' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onArchive} variant="destructive">
                      <Archive className="w-4 h-4" />
                      Archive topic
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Subtopics */}
        {topic.subtopics && topic.subtopics.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
            <div className="space-y-2">
              {topic.subtopics.slice(0, 5).map((subtopic) => {
                const status = getSubtopicStatus(subtopic);
                return (
                  <div
                    key={subtopic.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    {status === 'completed' && (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                    {status === 'in_progress' && (
                      <div className="w-4 h-4 border-2 border-[hsl(var(--foreground))] rounded-full" />
                    )}
                    {status === 'locked' && (
                      <Lock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    )}
                    <span
                      className={cn(
                        status === 'locked'
                          ? 'text-[hsl(var(--muted-foreground))]'
                          : 'text-[hsl(var(--foreground))]'
                      )}
                    >
                      {subtopic.name}
                    </span>
                    {status !== 'locked' && (
                      <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">
                        {Math.round(subtopic.mastery)}%
                      </span>
                    )}
                  </div>
                );
              })}
              {topic.subtopics.length > 5 && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  +{topic.subtopics.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-[hsl(var(--muted))/0.3] border-t border-[hsl(var(--border))] rounded-b-lg flex items-center justify-between">
        {topic.status === 'COMPLETED' ? (
          <>
            <button
              onClick={onArchive}
              className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] flex items-center gap-1"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
            <Link
              href={`/review?topic=${topic.id}`}
              className="text-sm font-medium text-[hsl(var(--foreground))] hover:underline flex items-center gap-1"
            >
              Review
              <ChevronRight className="w-4 h-4" />
            </Link>
          </>
        ) : topic.status === 'QUEUED' ? (
          <button
            onClick={onStart}
            className="ml-auto text-sm font-medium text-[hsl(var(--foreground))] hover:underline flex items-center gap-1"
          >
            Start learning
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <Link
            href={`/chat?topic=${topic.id}`}
            className="ml-auto text-sm font-medium text-[hsl(var(--foreground))] hover:underline flex items-center gap-1"
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
