'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MessageList } from './message-list';
import { InputArea } from './input-area';

interface ChatInterfaceProps {
  topicId?: string;
  topicName?: string;
  subtopicName?: string;
  mastery?: number;
  initialMessages?: UIMessage[];
}

export function ChatInterface({
  topicId,
  topicName,
  subtopicName,
  mastery,
  initialMessages = [],
}: ChatInterfaceProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  // Create transport with topicId in closure
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat/message',
        prepareSendMessagesRequest({ messages }) {
          return {
            body: {
              messages,
              topicId,
            },
          };
        },
      }),
    [topicId]
  );

  const { messages, status, sendMessage, error } = useChat({
    transport,
    messages: initialMessages,
  });

  const isLoading = status === 'streaming' || status === 'submitted' || isNavigating;

  /**
   * Handle /continue command by fetching the target topic and navigating directly
   * No message is sent to the chat - this provides a smooth transition
   */
  const handleContinueCommand = async (): Promise<boolean> => {
    setIsNavigating(true);
    try {
      const response = await fetch('/api/chat/continue');
      const data = await response.json();

      if (data.success && data.topicId) {
        router.push(`/chat?topic=${data.topicId}`);
        return true;
      } else if (data.navigateTo) {
        router.push(data.navigateTo);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[chat] Failed to handle /continue:', err);
      return false;
    } finally {
      setIsNavigating(false);
    }
  };

  const handleSend = async (content: string) => {
    const trimmed = content.trim().toLowerCase();

    // Intercept /continue command - navigate directly without sending a message
    if (trimmed === '/continue') {
      const handled = await handleContinueCommand();
      if (handled) return;
      // If not handled (no topics), fall through to send as regular message
    }

    sendMessage({ text: content });
  };

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--background))]">
      {/* Header */}
      {topicName && (
        <header className="flex-shrink-0 border-b border-[hsl(var(--border))] px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-sm font-medium text-[hsl(var(--foreground))]">
                {topicName}
                {subtopicName && (
                  <span className="text-[hsl(var(--muted-foreground))]">
                    {' '}/{' '}{subtopicName}
                  </span>
                )}
              </h1>
            </div>
            {typeof mastery === 'number' && (
              <div className="flex items-center gap-3">
                <div className="w-24 h-1 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[hsl(var(--foreground))] transition-all duration-300"
                    style={{ width: `${mastery}%` }}
                  />
                </div>
                <span className="text-sm font-mono text-[hsl(var(--muted-foreground))]">
                  {mastery}%
                </span>
              </div>
            )}
          </div>
        </header>
      )}

      {/* Messages - flex-1 with min-h-0 enables scrolling in flex containers */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="max-w-3xl mx-auto h-full flex flex-col">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <MessageList messages={messages} isLoading={isLoading} />
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-[hsl(var(--destructive))/0.1] border-t border-[hsl(var(--destructive))/0.2]">
          <p className="max-w-3xl mx-auto text-sm text-[hsl(var(--destructive))]">
            Something went wrong. Please try again.
          </p>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0">
        <InputArea onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))] mb-2">
          Welcome, apprentice.
        </h2>
        <p className="text-[hsl(var(--muted-foreground))] text-[15px] leading-relaxed">
          I&apos;m Sensie, your learning guide. I don&apos;t give answers —
          I help you discover them through questions. True mastery comes from
          understanding, not memorization.
        </p>
        <p className="text-[hsl(var(--muted-foreground))] text-[15px] mt-4">
          What would you like to learn?
        </p>
      </div>
    </div>
  );
}

export default ChatInterface;
