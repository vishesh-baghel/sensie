'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Loader2, User, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Login Page
 *
 * Handles:
 * - First-time setup (create owner account)
 * - Owner login (passphrase)
 * - Visitor mode (limited access)
 */

type AuthMode = 'setup' | 'login' | 'visitor';

export default function LoginPage() {
  const router = useRouter();

  // State
  const [mode, setMode] = useState<AuthMode>('login');
  const [ownerExists, setOwnerExists] = useState<boolean | null>(null);
  const [isCheckingOwner, setIsCheckingOwner] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [username, setUsername] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);

  // Check if owner exists on mount
  useEffect(() => {
    async function checkOwner() {
      try {
        const response = await fetch('/api/auth/setup');
        const data = await response.json();
        setOwnerExists(data.ownerExists);
        // If no owner, default to setup mode
        if (!data.ownerExists) {
          setMode('setup');
        }
      } catch (err) {
        console.error('Failed to check owner status:', err);
        setError('Failed to connect to server');
      } finally {
        setIsCheckingOwner(false);
      }
    }

    checkOwner();
  }, []);

  // Handle owner account setup
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase, username: username || 'owner' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Setup failed');
        return;
      }

      // Setup auto-logs in, redirect to topics
      router.push('/topics');
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('Setup error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle owner login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'owner', passphrase }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }

      router.push('/topics');
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle visitor mode
  const handleVisitorStart = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'visitor' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to start visitor session');
        return;
      }

      router.push('/topics');
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('Visitor login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while checking owner
  if (isCheckingOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[hsl(var(--background))]">
        <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[hsl(var(--background))]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-medium text-[hsl(var(--foreground))]">
            sensie
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            master any topic through questions
          </p>
        </div>

        {/* Card */}
        <div className="border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] overflow-hidden">
          {/* Tabs - only show if owner exists */}
          {ownerExists && (
            <div className="flex border-b border-[hsl(var(--border))]">
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors',
                  mode === 'login'
                    ? 'text-[hsl(var(--foreground))] border-b-2 border-[hsl(var(--foreground))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                )}
              >
                Owner
              </button>
              <button
                onClick={() => {
                  setMode('visitor');
                  setError('');
                }}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors',
                  mode === 'visitor'
                    ? 'text-[hsl(var(--foreground))] border-b-2 border-[hsl(var(--foreground))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                )}
              >
                Visitor
              </button>
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {/* Setup Mode - No owner exists */}
            {mode === 'setup' && !ownerExists && (
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Create your owner account to get started.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                    Username <span className="text-[hsl(var(--muted-foreground))]">(optional)</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="owner"
                      className="w-full pl-12 pr-4 py-3 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--foreground))/0.3]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                    Passphrase
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="min 8 characters"
                      className="w-full pl-12 pr-12 py-3 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--foreground))/0.3]"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    >
                      {showPassphrase ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                    Confirm Passphrase
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      value={confirmPassphrase}
                      onChange={(e) => setConfirmPassphrase(e.target.value)}
                      placeholder="type it again"
                      className="w-full pl-12 pr-4 py-3 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--foreground))/0.3]"
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))/0.1] p-3 rounded-md">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !passphrase.trim()}
                  className="w-full py-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
                  This will be your owner account. Only one owner is allowed.
                </p>
              </form>
            )}

            {/* Login Mode */}
            {mode === 'login' && ownerExists && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                    Passphrase
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Enter your passphrase"
                      className="w-full pl-12 pr-12 py-3 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--foreground))/0.3]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    >
                      {showPassphrase ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))/0.1] p-3 rounded-md">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !passphrase.trim()}
                  className="w-full py-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Enter
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Visitor Mode */}
            {mode === 'visitor' && ownerExists && (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Try sensie without creating an account.
                  </p>
                </div>

                <ul className="text-sm text-[hsl(var(--muted-foreground))] space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Full access to learning features
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Progress saved in session
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Limited to 1 active topic
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Session expires after 24 hours
                  </li>
                </ul>

                {error && (
                  <div className="text-sm text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))/0.1] p-3 rounded-md">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleVisitorStart}
                  disabled={isLoading}
                  className="w-full py-3 border border-[hsl(var(--border))] text-[hsl(var(--foreground))] font-medium rounded-lg hover:bg-[hsl(var(--muted))] transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      Continue as visitor
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
