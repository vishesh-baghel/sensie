import { Sidebar } from '@/components/layout/sidebar';

/**
 * Main App Layout
 *
 * Layout for authenticated pages with:
 * - Collapsible sidebar navigation
 * - Theme toggle
 * - Logout button
 * - Main content area
 */

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex">
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
