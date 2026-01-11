/**
 * Unit tests for MobileNav component
 *
 * Tests mobile navigation behavior including:
 * - Hamburger menu toggle
 * - Slide-out drawer navigation
 * - Active route highlighting
 * - Theme toggle
 * - Logout functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = '/topics';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
}));

// Mock fetch for logout
global.fetch = vi.fn();

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Menu: () => <span data-testid="menu-icon">☰</span>,
  X: () => <span data-testid="close-icon">✕</span>,
  MessageSquare: () => <span data-testid="chat-icon">💬</span>,
  BookOpen: () => <span data-testid="topics-icon">📚</span>,
  BarChart3: () => <span data-testid="progress-icon">📊</span>,
  RefreshCw: () => <span data-testid="review-icon">🔄</span>,
  Settings: () => <span data-testid="settings-icon">⚙️</span>,
  LogOut: () => <span data-testid="logout-icon">🚪</span>,
  Sun: () => <span data-testid="sun-icon">☀️</span>,
  Moon: () => <span data-testid="moon-icon">🌙</span>,
  Loader2: () => <span data-testid="loader-icon">⏳</span>,
}));

// Import after mocks are set up
import { MobileNav } from '@/components/layout/mobile-nav';

describe('MobileNav Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
    });
  });

  describe('Basic Rendering', () => {
    it('should render mobile header with logo and hamburger menu', () => {
      render(<MobileNav />);

      expect(screen.getByText('sensie')).toBeInTheDocument();
      expect(screen.getByTestId('menu-icon')).toBeInTheDocument();
      expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
    });

    it('should initially have drawer closed', () => {
      render(<MobileNav />);

      // Drawer should be translated off-screen (translate-x-full)
      const drawer = document.querySelector('nav');
      expect(drawer).toHaveClass('translate-x-full');
    });

    it('should render with md:hidden class on header', () => {
      render(<MobileNav />);

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('md:hidden');
    });
  });

  describe('Drawer Toggle', () => {
    it('should open drawer when hamburger menu is clicked', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Drawer should be visible (translate-x-0)
      const drawer = document.querySelector('nav');
      expect(drawer).toHaveClass('translate-x-0');
    });

    it('should close drawer when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer first
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Close drawer
      const closeButton = screen.getByLabelText('Close navigation menu');
      await user.click(closeButton);

      // Drawer should be hidden
      const drawer = document.querySelector('nav');
      expect(drawer).toHaveClass('translate-x-full');
    });

    it('should close drawer when backdrop is clicked', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Click backdrop
      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();
      await user.click(backdrop!);

      // Drawer should be hidden
      const drawer = document.querySelector('nav');
      expect(drawer).toHaveClass('translate-x-full');
    });

    it('should show backdrop only when drawer is open', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      // Initially no backdrop
      expect(document.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Backdrop should appear
      expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    });
  });

  describe('Navigation Items', () => {
    it('should render all navigation items', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Check all nav items
      expect(screen.getByText('Chat')).toBeInTheDocument();
      expect(screen.getByText('Topics')).toBeInTheDocument();
      expect(screen.getByText('Progress')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should have correct href for each navigation item', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Check hrefs
      expect(screen.getByText('Chat').closest('a')).toHaveAttribute('href', '/chat');
      expect(screen.getByText('Topics').closest('a')).toHaveAttribute('href', '/topics');
      expect(screen.getByText('Progress').closest('a')).toHaveAttribute('href', '/progress');
      expect(screen.getByText('Review').closest('a')).toHaveAttribute('href', '/review');
      expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings');
    });

    it('should close drawer when navigation item is clicked', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Click a nav item
      const chatLink = screen.getByText('Chat').closest('a');
      await user.click(chatLink!);

      // Drawer should close
      const drawer = document.querySelector('nav');
      expect(drawer).toHaveClass('translate-x-full');
    });
  });

  describe('Active Route Highlighting', () => {
    it('should highlight active route', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Topics should be active (based on mockPathname = '/topics')
      const topicsLink = screen.getByText('Topics').closest('a');
      expect(topicsLink).toHaveClass('bg-[hsl(var(--primary))]');
    });

    it('should not highlight inactive routes', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Chat should not be active
      const chatLink = screen.getByText('Chat').closest('a');
      expect(chatLink).not.toHaveClass('bg-[hsl(var(--primary))]');
    });
  });

  describe('Theme Toggle', () => {
    it('should render theme toggle button', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Theme button should be visible
      expect(screen.getByText('Dark mode')).toBeInTheDocument();
    });

    it('should toggle theme when clicked', async () => {
      const mockSetTheme = vi.fn();
      vi.doMock('next-themes', () => ({
        useTheme: () => ({
          theme: 'light',
          setTheme: mockSetTheme,
        }),
      }));

      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Click theme button
      const themeButton = screen.getByText('Dark mode').closest('button');
      expect(themeButton).toBeInTheDocument();
    });
  });

  describe('Logout', () => {
    it('should render logout button', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('should call logout API and redirect when clicked', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Click logout
      const logoutButton = screen.getByText('Logout').closest('button');
      await user.click(logoutButton!);

      // Should call logout API
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });

      // Should redirect to login
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    it('should show loading state during logout', async () => {
      // Make fetch take longer
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 100))
      );

      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Click logout
      const logoutButton = screen.getByText('Logout').closest('button');
      await user.click(logoutButton!);

      // Should show loading state
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    it('should handle logout error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      // Click logout
      const logoutButton = screen.getByText('Logout').closest('button');
      await user.click(logoutButton!);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Logout failed:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      expect(screen.getByLabelText('Close navigation menu')).toBeInTheDocument();
    });

    it('should mark backdrop as aria-hidden', async () => {
      const user = userEvent.setup();
      render(<MobileNav />);

      // Open drawer
      const hamburgerButton = screen.getByLabelText('Open navigation menu');
      await user.click(hamburgerButton);

      const backdrop = document.querySelector('[aria-hidden="true"]');
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
