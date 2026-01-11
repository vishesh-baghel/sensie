import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';

/**
 * Main App Layout
 *
 * Layout for authenticated pages with:
 * - Collapsible sidebar navigation (desktop)
 * - Hamburger menu with slide-out drawer (mobile)
 * - Theme toggle
 * - Logout button
 * - Main content area
 */

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Navigation - visible only on mobile */}
      <MobileNav />

      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
