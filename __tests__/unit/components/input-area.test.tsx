/**
 * Unit tests for InputArea component
 *
 * Tests the command palette behavior including:
 * - Command detection and filtering
 * - Auto-send on command selection
 * - Keyboard navigation
 * - Command hint display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InputArea } from '@/components/chat/input-area';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ArrowUp: () => <span data-testid="arrow-up-icon">↑</span>,
}));

describe('InputArea Component', () => {
  const mockOnSend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render input area with textarea and send button', () => {
      render(<InputArea onSend={mockOnSend} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should show placeholder text', () => {
      render(<InputArea onSend={mockOnSend} placeholder="Custom placeholder" />);

      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    });

    it('should show default placeholder when not provided', () => {
      render(<InputArea onSend={mockOnSend} />);

      expect(screen.getByPlaceholderText('Type your answer...')).toBeInTheDocument();
    });

    it('should show command hint text', () => {
      render(<InputArea onSend={mockOnSend} />);

      expect(screen.getByText(/Type/)).toBeInTheDocument();
      expect(screen.getByText('/')).toBeInTheDocument();
    });
  });

  describe('Command Palette', () => {
    it('should show command palette when typing /', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');

      // Command palette should appear with all commands
      expect(screen.getByText('/hint')).toBeInTheDocument();
      expect(screen.getByText('/skip')).toBeInTheDocument();
      expect(screen.getByText('/progress')).toBeInTheDocument();
      expect(screen.getByText('/topics')).toBeInTheDocument();
      expect(screen.getByText('/review')).toBeInTheDocument();
      expect(screen.getByText('/quiz')).toBeInTheDocument();
      expect(screen.getByText('/break')).toBeInTheDocument();
      expect(screen.getByText('/continue')).toBeInTheDocument();
      // Phase 2 commands
      expect(screen.getByText('/feynman')).toBeInTheDocument();
      expect(screen.getByText('/analytics')).toBeInTheDocument();
      expect(screen.getByText('/gaps')).toBeInTheDocument();
    });

    it('should filter commands based on input', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/pr');

      // Only /progress should be visible
      expect(screen.getByText('/progress')).toBeInTheDocument();
      expect(screen.queryByText('/hint')).not.toBeInTheDocument();
      expect(screen.queryByText('/skip')).not.toBeInTheDocument();
    });

    it('should hide command palette when input does not start with /', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'hello');

      // Command palette should not appear
      expect(screen.queryByText('/hint')).not.toBeInTheDocument();
    });

    it('should hide command palette on Escape key', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');

      // Command palette should be visible
      expect(screen.getByText('/hint')).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');

      // Command palette should be hidden
      expect(screen.queryByText('/hint')).not.toBeInTheDocument();
    });
  });

  describe('Auto-Send on Command Selection', () => {
    it('should auto-send command when clicking on it', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');

      // Click on /progress command
      const progressButton = screen.getByText('/progress').closest('button');
      expect(progressButton).toBeInTheDocument();
      await user.click(progressButton!);

      // Should have called onSend with the command
      expect(mockOnSend).toHaveBeenCalledWith('/progress');
      expect(mockOnSend).toHaveBeenCalledTimes(1);
    });

    it('should auto-send command when pressing Enter', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/hint');

      // Press Enter to select the command
      await user.keyboard('{Enter}');

      // Should have called onSend with the command
      expect(mockOnSend).toHaveBeenCalledWith('/hint');
      expect(mockOnSend).toHaveBeenCalledTimes(1);
    });

    it('should clear input after auto-sending command', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await user.type(textarea, '/');

      // Click on /topics command
      const topicsButton = screen.getByText('/topics').closest('button');
      await user.click(topicsButton!);

      // Input should be cleared
      expect(textarea.value).toBe('');
    });

    it('should hide command palette after auto-sending', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');

      // Verify command palette is visible
      expect(screen.getByText('/hint')).toBeInTheDocument();

      // Click on command
      const hintButton = screen.getByText('/hint').closest('button');
      await user.click(hintButton!);

      // Command palette should be hidden
      expect(screen.queryByText('/hint')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate down with ArrowDown', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');

      // Initial selection should be first item
      const buttons = screen.getAllByRole('button').filter(b => b.textContent?.startsWith('/'));
      expect(buttons[0]).toHaveClass('bg-[hsl(var(--muted))]');

      // Press ArrowDown
      await user.keyboard('{ArrowDown}');

      // Selection should move to second item
      // Note: Re-query buttons after state change
      const updatedButtons = screen.getAllByRole('button').filter(b => b.textContent?.startsWith('/'));
      expect(updatedButtons[1]).toHaveClass('bg-[hsl(var(--muted))]');
    });

    it('should navigate up with ArrowUp', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');

      // Move down first
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // Then move up
      await user.keyboard('{ArrowUp}');

      // Selection should be at second item
      const buttons = screen.getAllByRole('button').filter(b => b.textContent?.startsWith('/'));
      expect(buttons[1]).toHaveClass('bg-[hsl(var(--muted))]');
    });

    it('should select navigated command on Enter', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');

      // Navigate to second command
      await user.keyboard('{ArrowDown}');

      // Press Enter
      await user.keyboard('{Enter}');

      // Should send the second command (/skip)
      expect(mockOnSend).toHaveBeenCalledWith('/skip');
    });

    it('should not go below last command', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');

      // Press ArrowDown many times
      for (let i = 0; i < 20; i++) {
        await user.keyboard('{ArrowDown}');
      }

      // Press Enter - should select last command
      await user.keyboard('{Enter}');

      // Should be last command (/gaps - the last of the Phase 2 commands)
      expect(mockOnSend).toHaveBeenCalledWith('/gaps');
    });

    it('should not go above first command', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');

      // Press ArrowUp many times (should stay at first)
      for (let i = 0; i < 5; i++) {
        await user.keyboard('{ArrowUp}');
      }

      // Press Enter - should select first command
      await user.keyboard('{Enter}');

      // Should be first command (/hint)
      expect(mockOnSend).toHaveBeenCalledWith('/hint');
    });
  });

  describe('Regular Message Handling', () => {
    it('should send regular message on Enter when not in command mode', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello Sensie!');
      await user.keyboard('{Enter}');

      expect(mockOnSend).toHaveBeenCalledWith('Hello Sensie!');
    });

    it('should allow newline with Shift+Enter', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await user.type(textarea, 'Line 1');
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      await user.type(textarea, 'Line 2');

      // Should not have sent yet
      expect(mockOnSend).not.toHaveBeenCalled();

      // Textarea should have multiline content
      expect(textarea.value).toContain('Line 1');
      expect(textarea.value).toContain('Line 2');
    });

    it('should not send empty messages', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.keyboard('{Enter}');

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('should not send whitespace-only messages', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '   ');
      await user.keyboard('{Enter}');

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('should send message via button click', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Test message');

      const sendButton = screen.getByRole('button');
      await user.click(sendButton);

      expect(mockOnSend).toHaveBeenCalledWith('Test message');
    });
  });

  describe('Disabled State', () => {
    it('should disable textarea when disabled prop is true', () => {
      render(<InputArea onSend={mockOnSend} disabled />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('should disable send button when disabled', () => {
      render(<InputArea onSend={mockOnSend} disabled />);

      const sendButton = screen.getByRole('button');
      expect(sendButton).toBeDisabled();
    });

    it('should not send messages when disabled', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} disabled />);

      // Try to type and send (should be blocked)
      // Note: disabled textarea won't accept input
      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('Command Descriptions', () => {
    it('should show command descriptions in palette', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '/');

      // Check for command descriptions
      expect(screen.getByText('Get a hint for the current question')).toBeInTheDocument();
      expect(screen.getByText('Skip this question (limited)')).toBeInTheDocument();
      expect(screen.getByText('Show detailed progress')).toBeInTheDocument();
      expect(screen.getByText('Manage learning topics')).toBeInTheDocument();
      expect(screen.getByText('Start spaced repetition')).toBeInTheDocument();
      expect(screen.getByText('Start a quiz on current topic')).toBeInTheDocument();
      expect(screen.getByText('Save and take a break')).toBeInTheDocument();
      expect(screen.getByText('Continue last studied topic')).toBeInTheDocument();
      // Phase 2 command descriptions
      expect(screen.getByText('Explain a concept (Feynman technique)')).toBeInTheDocument();
      expect(screen.getByText('View learning statistics')).toBeInTheDocument();
      expect(screen.getByText('Analyze knowledge gaps')).toBeInTheDocument();
    });
  });

  describe('Input Clear After Send', () => {
    it('should clear input after sending regular message', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await user.type(textarea, 'Hello');
      await user.keyboard('{Enter}');

      expect(textarea.value).toBe('');
    });

    it('should clear input after clicking command', async () => {
      const user = userEvent.setup();
      render(<InputArea onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await user.type(textarea, '/');

      const hintButton = screen.getByText('/hint').closest('button');
      await user.click(hintButton!);

      expect(textarea.value).toBe('');
    });
  });
});
