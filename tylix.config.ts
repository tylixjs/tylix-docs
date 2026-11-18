import { defineConfig } from "@tylix/shared";

export default defineConfig({
  // Installable app and offline support (@tylix/pwa). Tylix serves the
  // manifest and the service worker; icons and offline.html are in public/.
  // Pages are never cached (they can hold a signed-in user's data): offline
  // visitors get public/offline.html. See the @tylix/pwa README for caching
  // rules, shortcuts and screenshots.
  pwa: {
    name: "Tylix Docs",
    shortName: "Tylix Docs",
    themeColor: "#0034CA",
    backgroundColor: "#ffffff",
  },
  auth: {
    // Lifetime of an access token, in seconds. Kept short on purpose: the
    // refresh session (rotated on every use, 30 days) keeps people signed
    // in, and ending it (logout, password reset) applies at once.
    tokenExpiresInSeconds: 15 * 60,
    // Refuse passwords found in public data breaches (Have I Been Pwned).
    checkBreachedPasswords: false,
  },
  logging: {
    // LOG_CHANNEL picks the channel; "stack" writes to every channel in
    // LOG_STACK (default console,daily). Daily files are kept in
    // storage/logs for LOG_DAILY_DAYS (14) days. Use them with
    // Log.info(...), Log.channel("name").error(...) from @tylix/core.
    channels: {
      // payments: { driver: "daily", path: "storage/logs/payments.log", level: "warning" },
    },
  },
  queue: {
    // Defaults for every job; a job can set its own tries/backoff/timeout.
    tries: 3,
    backoff: "exponential",
  },
  // Plugins: packages, files, or plugin objects. Files in app/plugins/
  // are loaded too.
  plugins: [],
});
