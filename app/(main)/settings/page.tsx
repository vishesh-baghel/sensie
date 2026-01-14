'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Settings Page
 *
 * User preferences:
 * - Mastery threshold (Bug #9 fix)
 * - Daily review limit (Bug #10 fix)
 * - Change passphrase (Bug #11 fix)
 * - Delete all data
 */

interface Preferences {
  masteryThreshold: number;
  dailyReviewLimit: number;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export default function SettingsPage() {
  const router = useRouter();

  // Preferences state
  const [preferences, setPreferences] = useState<Preferences>({
    masteryThreshold: 80,
    dailyReviewLimit: 20,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Passphrase form state
  const [currentPassphrase, setCurrentPassphrase] = useState('');
  const [newPassphrase, setNewPassphrase] = useState('');
  const [changingPassphrase, setChangingPassphrase] = useState(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Show toast notification
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // Dismiss toast
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch preferences on mount
  useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch('/api/settings/preferences');
        const data = await response.json();

        if (data.success) {
          setPreferences({
            masteryThreshold: data.data.masteryThreshold,
            dailyReviewLimit: data.data.dailyReviewLimit,
          });
        } else {
          showToast(data.error || 'Failed to load preferences', 'error');
        }
      } catch (err) {
        console.error('Error fetching preferences:', err);
        showToast('Failed to load preferences', 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchPreferences();
  }, [showToast]);

  // Update preference helper
  const updatePreference = useCallback(async (key: string, value: number | string) => {
    setSaving(true);

    try {
      const response = await fetch('/api/settings/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      const data = await response.json();

      if (data.success) {
        setPreferences((prev) => ({ ...prev, [key]: value }));
        showToast('Settings saved', 'success');
      } else {
        showToast(data.error || 'Failed to save', 'error');
      }
    } catch (err) {
      console.error('Error updating preference:', err);
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }, [showToast]);

  // Handle mastery threshold change (Bug #9 fix)
  const handleMasteryThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setPreferences((prev) => ({ ...prev, masteryThreshold: value }));
  };

  const handleMasteryThresholdCommit = () => {
    updatePreference('masteryThreshold', preferences.masteryThreshold);
  };

  // Handle daily review limit change (Bug #10 fix)
  const handleDailyReviewLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 5 && value <= 50) {
      setPreferences((prev) => ({ ...prev, dailyReviewLimit: value }));
    }
  };

  const handleDailyReviewLimitCommit = () => {
    updatePreference('dailyReviewLimit', preferences.dailyReviewLimit);
  };

  // Handle passphrase change (Bug #11 fix)
  const handlePassphraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassphrase || !newPassphrase) {
      showToast('Both fields are required', 'error');
      return;
    }

    if (newPassphrase.length < 8) {
      showToast('New passphrase must be at least 8 characters', 'error');
      return;
    }

    setChangingPassphrase(true);

    try {
      const response = await fetch('/api/auth/change-passphrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassphrase, newPassphrase }),
      });

      const data = await response.json();

      if (data.success) {
        showToast('Passphrase changed successfully', 'success');
        setCurrentPassphrase('');
        setNewPassphrase('');
      } else {
        showToast(data.error || 'Failed to change passphrase', 'error');
      }
    } catch (err) {
      console.error('Error changing passphrase:', err);
      showToast('Failed to change passphrase', 'error');
    } finally {
      setChangingPassphrase(false);
    }
  };

  // Handle delete all data
  const handleDeleteAllData = async () => {
    if (deleteConfirmText !== 'DELETE') {
      showToast('Please type DELETE to confirm', 'error');
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch('/api/settings/delete-all', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        showToast('All learning data deleted. You can start fresh!', 'success');
        setShowDeleteConfirm(false);
        setDeleteConfirmText('');
      } else {
        showToast(data.error || 'Failed to delete data', 'error');
      }
    } catch (err) {
      console.error('Error deleting data:', err);
      showToast('Failed to delete data', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-8">Settings</h1>
          <div className="animate-pulse">
            <div className="h-32 bg-muted rounded-lg mb-4" />
            <div className="h-32 bg-muted rounded-lg mb-4" />
            <div className="h-48 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Settings</h1>

        {/* Learning Preferences */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Learning Preferences</h2>
          <div className="space-y-4">
            {/* Mastery Threshold (Bug #9 fix) */}
            <div className="p-4 border rounded-lg">
              <label className="block font-medium mb-2">
                Mastery Threshold
              </label>
              <p className="text-sm text-muted-foreground mb-2">
                Percentage required to consider a topic mastered
              </p>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={preferences.masteryThreshold}
                onChange={handleMasteryThresholdChange}
                onMouseUp={handleMasteryThresholdCommit}
                onTouchEnd={handleMasteryThresholdCommit}
                className="w-full cursor-pointer"
                disabled={saving}
              />
              <p className="text-sm text-right font-medium">
                {preferences.masteryThreshold}%
              </p>
            </div>

            {/* Daily Review Limit (Bug #10 fix) */}
            <div className="p-4 border rounded-lg">
              <label className="block font-medium mb-2">
                Daily Review Limit
              </label>
              <p className="text-sm text-muted-foreground mb-2">
                Maximum reviews per day (prevents fatigue)
              </p>
              <input
                type="number"
                value={preferences.dailyReviewLimit}
                onChange={handleDailyReviewLimitChange}
                onBlur={handleDailyReviewLimitCommit}
                min="5"
                max="50"
                className="px-4 py-2 border rounded-lg w-24 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={saving}
              />
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Security</h2>
          <div className="p-4 border rounded-lg">
            <label className="block font-medium mb-4">Change Passphrase</label>

            {/* Bug #11 fix: Form with proper submission handler */}
            <form onSubmit={handlePassphraseSubmit} className="space-y-4">
              <input
                type="password"
                placeholder="Current passphrase"
                value={currentPassphrase}
                onChange={(e) => setCurrentPassphrase(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={changingPassphrase}
              />
              <input
                type="password"
                placeholder="New passphrase"
                value={newPassphrase}
                onChange={(e) => setNewPassphrase(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={changingPassphrase}
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-black text-white dark:bg-white dark:text-black font-medium rounded-lg cursor-pointer transition-all duration-200 hover:opacity-80 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 dark:border-transparent"
                disabled={changingPassphrase}
              >
                {changingPassphrase ? 'Updating...' : 'Update Passphrase'}
              </button>
            </form>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-red-500">
            Danger Zone
          </h2>
          <div className="p-4 border border-red-500/30 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">
              This will permanently delete all your learning data including topics, progress, sessions, and learning history.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium text-foreground">Note:</span> Your owner account and preferences will be preserved. You can start learning fresh without re-creating your account.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg cursor-pointer transition-all duration-200 hover:bg-red-700 active:scale-[0.98]"
            >
              Delete Learning Data
            </button>
          </div>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowDeleteConfirm(false);
              setDeleteConfirmText('');
            }}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-zinc-900 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-red-500/30">
            <h3 className="text-lg font-semibold text-red-500 mb-2">
              Delete Learning Data
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              This action is irreversible. All your topics, progress, learning sessions, and history will be permanently deleted.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Your owner account and preferences will be kept so you can start fresh.
            </p>
            <p className="text-sm font-medium mb-2">
              Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-4 py-2 border border-red-500/30 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-red-500/50 mb-4"
              disabled={deleting}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors hover:bg-muted"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllData}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg cursor-pointer transition-all duration-200 hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete Learning Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications - Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-md shadow-xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
              toast.type === 'success'
                ? 'bg-white dark:bg-zinc-900 border-green-500/30 text-green-600 dark:text-green-400'
                : 'bg-white dark:bg-zinc-900 border-red-500/30 text-red-600 dark:text-red-400'
            }`}
            style={{
              animation: 'slideIn 0.2s ease-out',
            }}
          >
            {/* Icon */}
            {toast.type === 'success' ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Toast animation styles */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
