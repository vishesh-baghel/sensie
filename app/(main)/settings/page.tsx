'use client';

/**
 * Settings Page
 *
 * User preferences:
 * - Mastery threshold
 * - Daily review limit
 * - Theme
 * - Change passphrase
 */

export default function SettingsPage() {
  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Settings</h1>

        {/* Learning Preferences */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Learning Preferences</h2>
          <div className="space-y-4">
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
                defaultValue="80"
                className="w-full"
              />
              <p className="text-sm text-right">80%</p>
            </div>

            <div className="p-4 border rounded-lg">
              <label className="block font-medium mb-2">
                Daily Review Limit
              </label>
              <p className="text-sm text-muted-foreground mb-2">
                Maximum reviews per day (prevents fatigue)
              </p>
              <input
                type="number"
                defaultValue="20"
                min="5"
                max="50"
                className="px-4 py-2 border rounded-lg w-24"
              />
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Security</h2>
          <div className="p-4 border rounded-lg">
            <label className="block font-medium mb-2">Change Passphrase</label>
            <form className="space-y-4">
              <input
                type="password"
                placeholder="Current passphrase"
                className="w-full px-4 py-2 border rounded-lg"
              />
              <input
                type="password"
                placeholder="New passphrase"
                className="w-full px-4 py-2 border rounded-lg"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
              >
                Update Passphrase
              </button>
            </form>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-destructive">
            Danger Zone
          </h2>
          <div className="p-4 border border-destructive/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-4">
              This action cannot be undone.
            </p>
            <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg">
              Delete All Data
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
