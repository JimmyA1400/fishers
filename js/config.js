/* Fishers: settings you can change without touching the game code. */
window.FSH_CONFIG = {
  promptsPerDay: 7,
  secondsPerPrompt: 25,
  metresPerPoint: 10,

  // Fishers #1. Changing this renumbers and reshuffles every daily cast.
  epoch: '2026-11-17',

  // Optional answer logging, used later to replace the estimated tiers with
  // real frequencies. OFF by default: nothing leaves the player's device.
  // To turn it on, see "Collecting real rarity data" in README.md.
  telemetry: {
    enabled: false,
    endpoint: ''   // e.g. 'https://your-worker.example.workers.dev/log'
  }
};
