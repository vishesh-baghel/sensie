'use client';

import { useEffect, useRef } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: UIMessage[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-6"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isLoading && (
        <div className="flex gap-1 items-center text-sm text-[hsl(var(--muted-foreground))]">
          <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
          <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse [animation-delay:300ms]" />
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: UIMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  // Extract text content from parts (AI SDK v6 format)
  const textContent = message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');

  return (
    <div
      className={cn(
        'max-w-[85%]',
        isUser ? 'ml-auto' : 'mr-auto'
      )}
    >
      <div
        className={cn(
          'px-4 py-3 rounded-lg text-[15px] leading-relaxed',
          isUser
            ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
            : 'bg-[hsl(var(--card))] border border-[hsl(var(--border))]'
        )}
      >
        <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
          {textContent}
        </div>
      </div>
      <p className={cn(
        'text-xs text-[hsl(var(--muted-foreground))] mt-1',
        isUser ? 'text-right' : 'text-left'
      )}>
        {isUser ? 'You' : 'Sensie'}
      </p>
    </div>
  );
}

export default MessageList;
