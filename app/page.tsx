/**
 * Root Page - Redirect to login
 *
 * Similar to jack-x-agent, the root page redirects to login.
 * Auth check and redirect to main app happens on login page.
 */

import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/login');
}
