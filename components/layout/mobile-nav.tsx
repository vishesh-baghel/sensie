'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  Menu,
  X,
  MessageSquare,
  BookOpen,
  BarChart3,
  RefreshCw,
  Settings,
  LogOut,
  Sun,
  Moon,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Mobile Navigation
 *
 * Hamburger menu for mobile viewports with:
 * - Slide-out navigation drawer
 * - All navigation items from sidebar
 * - Theme toggle
 * - Logout button
 */

const NAV_ITEMS = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/topics', label: 'Topics', icon: BookOpen },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
  { href: '/review', label: 'Review', icon: RefreshCw },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          sensie
        </h1>
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Slide-out Drawer */}
      <nav
        className={cn(
          'md:hidden fixed top-0 right-0 z-50 h-full w-64 bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-[hsl(var(--border))]">
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
            Menu
          </span>
          <button
            onClick={closeMenu}
            className="p-2 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors',
                  isActive
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Footer - Theme & Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-[hsl(var(--border))] space-y-1">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 shrink-0" />
            )}
            <span className="text-sm">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))/0.1] transition-colors"
          >
            {loggingOut ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4 shrink-0" />
            )}
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default MobileNav;
