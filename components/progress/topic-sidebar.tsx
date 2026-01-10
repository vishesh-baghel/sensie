'use client';

import { MasteryGauge } from './mastery-gauge';

/**
 * TopicSidebar - Sidebar showing topics and progress
 *
 * Shows:
 * - Active topics with mastery
 * - Current subtopic/concept
 * - Quick navigation
 */

export interface TopicItem {
  id: string;
  name: string;
  status: 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  mastery: number;
  subtopics?: SubtopicItem[];
}

export interface SubtopicItem {
  id: string;
  name: string;
  mastery: number;
  isLocked: boolean;
  isCurrent?: boolean;
}

export interface TopicSidebarProps {
  topics: TopicItem[];
  currentTopicId?: string;
  currentSubtopicId?: string;
  onSelectTopic?: (topicId: string) => void;
  onSelectSubtopic?: (subtopicId: string) => void;
}

export function TopicSidebar({
  topics,
  currentTopicId,
  currentSubtopicId,
  onSelectTopic,
  onSelectSubtopic,
}: TopicSidebarProps) {
  const activeTopics = topics.filter((t) => t.status === 'ACTIVE');

  if (activeTopics.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>No active topics</p>
        <a href="/topics" className="text-primary hover:underline text-sm">
          Start learning
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
        Active Topics
      </h3>

      {activeTopics.map((topic) => (
        <div
          key={topic.id}
          className={`p-3 rounded-lg border ${
            topic.id === currentTopicId ? 'border-primary bg-primary/5' : ''
          }`}
        >
          <button
            onClick={() => onSelectTopic?.(topic.id)}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium truncate">{topic.name}</span>
              <MasteryGauge value={topic.mastery} size="sm" />
            </div>
          </button>

          {/* Subtopics */}
          {topic.subtopics && topic.id === currentTopicId && (
            <div className="mt-2 space-y-1">
              {topic.subtopics.map((subtopic) => (
                <button
                  key={subtopic.id}
                  onClick={() =>
                    !subtopic.isLocked && onSelectSubtopic?.(subtopic.id)
                  }
                  disabled={subtopic.isLocked}
                  className={`w-full text-left text-sm px-2 py-1 rounded ${
                    subtopic.id === currentSubtopicId
                      ? 'bg-primary/10 text-primary'
                      : subtopic.isLocked
                      ? 'text-muted-foreground opacity-50'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {subtopic.isLocked && '🔒'}
                    {subtopic.name}
                    {subtopic.mastery >= 80 && '✓'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default TopicSidebar;
