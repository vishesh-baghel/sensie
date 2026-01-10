'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InputAreaProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const COMMANDS = [
  { cmd: '/hint', description: 'Get a hint for the current question' },
  { cmd: '/skip', description: 'Skip this question (limited)' },
  { cmd: '/progress', description: 'Show detailed progress' },
  { cmd: '/topics', description: 'Manage learning topics' },
  { cmd: '/review', description: 'Start spaced repetition' },
  { cmd: '/quiz', description: 'Start a quiz on current topic' },
  { cmd: '/break', description: 'Save and take a break' },
  { cmd: '/continue', description: 'Continue last studied topic' },
  { cmd: '/feynman', description: 'Explain a concept (Feynman technique)' },
  { cmd: '/analytics', description: 'View learning statistics' },
  { cmd: '/gaps', description: 'Analyze knowledge gaps' },
];

export function InputArea({ onSend, disabled, placeholder }: InputAreaProps) {
  const [input, setInput] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredCommands = input.startsWith('/')
    ? COMMANDS.filter((c) => c.cmd.startsWith(input.toLowerCase()))
    : COMMANDS;

  useEffect(() => {
    setShowCommands(input.startsWith('/') && input.length > 0);
    setSelectedIndex(0);
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput('');
    setShowCommands(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          // Auto-send the command when selected
          sendCommand(filteredCommands[selectedIndex].cmd);
        }
      } else if (e.key === 'Escape') {
        setShowCommands(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const sendCommand = (cmd: string) => {
    onSend(cmd);
    setInput('');
    setShowCommands(false);
  };

  const selectCommand = (cmd: string) => {
    // Auto-send the command when clicked
    sendCommand(cmd);
  };

  return (
    <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      <div className="max-w-3xl mx-auto p-4">
        {/* Command palette */}
        {showCommands && filteredCommands.length > 0 && (
          <div className="mb-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] overflow-hidden">
            {filteredCommands.map((command, index) => (
              <button
                key={command.cmd}
                onClick={() => selectCommand(command.cmd)}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors',
                  index === selectedIndex
                    ? 'bg-[hsl(var(--muted))]'
                    : 'hover:bg-[hsl(var(--muted))]'
                )}
              >
                <span className="font-mono text-[hsl(var(--foreground))]">
                  {command.cmd}
                </span>
                <span className="text-[hsl(var(--muted-foreground))]">
                  {command.description}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Type your answer...'}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none px-4 py-3 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg text-[15px] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--foreground))/0.2] transition-colors disabled:opacity-50"
            style={{
              minHeight: '48px',
              maxHeight: '200px',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className="p-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg disabled:opacity-40 transition-opacity"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>

        {/* Command hints */}
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
          Type <span className="font-mono">/</span> for commands
        </p>
      </div>
    </div>
  );
}

export default InputArea;
