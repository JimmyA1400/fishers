/* Fishers: settings you can change without touching the game code. */
window.FSH_CONFIG = {
  // Stamped with the commit SHA by tools/build-site.js at deploy time.
  version: 'dev',

  promptsPerDay: 7,
  secondsPerPrompt: 25,
  metresPerPoint: 10,

  // Fishers #1. Changing this renumbers and reshuffles every daily cast.
  epoch: '2026-11-17',

  // Live Coal, the multiplayer mode: its realtime server (a Cloudflare
  // Worker, see server/). The URL is public by nature. On localhost the game
  // uses a local `wrangler dev` instead; ?coal=<url> overrides both.
  liveCoal: {
    server: 'https://fishers-live-coal.fishes-595.workers.dev',
    localServer: 'http://127.0.0.1:8787'
  },

  // Optional answer logging, used later to replace the estimated tiers with
  // real frequencies. OFF by default: nothing leaves the player's device.
  // To turn it on, see "Collecting real rarity data" in README.md.
  telemetry: {
    enabled: false,
    endpoint: ''   // e.g. 'https://your-worker.example.workers.dev/log'
  }
};
