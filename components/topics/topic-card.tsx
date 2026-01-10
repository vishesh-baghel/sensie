'use client';

import { MasteryGauge } from '../progress/mastery-gauge';

/**
 * TopicCard - Display card for a topic
 *
 * Shows:
 * - Topic name and status
 * - Mastery percentage
 * - Action buttons
 */

export interface TopicCardProps {
  id: string;
  name: string;
  status: 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  mastery: number;
  subtopicCount: number;
  completedSubtopics: number;
  onStart?: () => void;
  onContinue?: () => void;
  onArchive?: () => void;
}

export function TopicCard({
  id,
  name,
  status,
  mastery,
  subtopicCount,
  completedSubtopics,
  onStart,
  onContinue,
  onArchive,
}: TopicCardProps) {
  const statusColors = {
    QUEUED: 'bg-muted text-muted-foreground',
    ACTIVE: 'bg-primary/10 text-primary',
    COMPLETED: 'bg-green-500/10 text-green-500',
    ARCHIVED: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="p-6 border rounded-lg hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">{name}</h3>
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${statusColors[status]}`}
          >
            {status}
          </span>
        </div>
        <MasteryGauge value={mastery} size="sm" />
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        {completedSubtopics}/{subtopicCount} subtopics completed
      </div>

      <div className="flex gap-2">
        {status === 'QUEUED' && (
          <button
            onClick={onStart}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
          >
            Start Learning
          </button>
        )}
        {status === 'ACTIVE' && (
          <button
            onClick={onContinue}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
          >
            Continue
          </button>
        )}
        {status !== 'ARCHIVED' && (
          <button
            onClick={onArchive}
            className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
          >
            Archive
          </button>
        )}
      </div>
    </div>
  );
}

export default TopicCard;
