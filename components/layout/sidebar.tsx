'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  MessageSquare,
  BookOpen,
  BarChart3,
  RefreshCw,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Collapsible Sidebar with navigation, theme toggle, and logout
 */

interface SidebarProps {
  defaultCollapsed?: boolean;
}

const NAV_ITEMS = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/topics', label: 'Topics', icon: BookOpen },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
  { href: '/review', label: 'Review', icon: RefreshCw },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ defaultCollapsed = false }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
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

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-300 flex flex-col',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
        {!collapsed && (
          <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            sensie
          </h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors',
            collapsed && 'mx-auto'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                isActive
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer - Theme & Logout */}
      <div className="p-2 border-t border-[hsl(var(--border))] space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Toggle theme' : undefined}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 shrink-0" />
          ) : (
            <Moon className="w-4 h-4 shrink-0" />
          )}
          {!collapsed && (
            <span className="text-sm">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))/0.1] transition-colors cursor-pointer disabled:cursor-not-allowed',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          {loggingOut ? (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4 shrink-0" />
          )}
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
