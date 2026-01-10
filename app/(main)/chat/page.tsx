'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ChatInterface } from '@/components/chat/chat-interface';
import type { UIMessage } from '@ai-sdk/react';

/**
 * Chat Page - Main learning interface
 *
 * The heart of Sensie - where learning happens through
 * Socratic dialogue with the wise master.
 */

interface Topic {
  id: string;
  name: string;
  goal?: string;
  masteryPercentage: number;
  status: string;
  subtopics?: Array<{
    id: string;
    name: string;
    isLocked: boolean;
    mastery: number;
  }>;
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicId = searchParams.get('topic');

  const [loading, setLoading] = useState(!!topicId);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTopicAndMessages() {
      if (!topicId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch topic and messages in parallel
        const [topicResponse, messagesResponse] = await Promise.all([
          fetch(`/api/topics/${topicId}`),
          fetch(`/api/chat/messages?topicId=${topicId}`),
        ]);

        if (!topicResponse.ok) {
          if (topicResponse.status === 401) {
            router.push('/login');
            return;
          }
          if (topicResponse.status === 404) {
            throw new Error('Topic not found');
          }
          if (topicResponse.status === 403) {
            throw new Error('Access denied');
          }
          throw new Error('Failed to load topic');
        }

        const topicData = await topicResponse.json();
        setTopic(topicData.topic);

        // Load messages if available
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          if (messagesData.messages && messagesData.messages.length > 0) {
            setInitialMessages(messagesData.messages);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load topic');
      } finally {
        setLoading(false);
      }
    }

    fetchTopicAndMessages();
  }, [topicId, router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="text-center">
          <p className="text-[hsl(var(--destructive))] mb-4">{error}</p>
          <button
            onClick={() => router.push('/topics')}
            className="text-[hsl(var(--primary))] hover:underline"
          >
            Go to Topics
          </button>
        </div>
      </div>
    );
  }

  // Get current subtopic if topic has subtopics
  const currentSubtopic = topic?.subtopics?.find(
    (st) => !st.isLocked && st.mastery < 80
  );

  return (
    <div className="h-screen">
      <ChatInterface
        topicId={topic?.id}
        topicName={topic?.name}
        subtopicName={currentSubtopic?.name}
        mastery={topic?.masteryPercentage}
        initialMessages={initialMessages}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-[hsl(var(--background))]">
          <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
