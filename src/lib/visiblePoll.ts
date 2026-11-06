// Runs `fn` now and every `ms`, but only while the page is visible, and
// again as soon as it becomes visible. Polling from hidden/background tabs
// kept the Neon compute awake 24/7 and burned the monthly quota.
// keepWhenHidden: also poll in the background (desktop app, which has no Web Push),
// but only every 5 min so Neon can still suspend (it sleeps after 5 min idle).
const HIDDEN_POLL_MS = 5 * 60 * 1000;

export function visiblePoll(fn: () => void, ms: number, keepWhenHidden = false): () => void {
  let last = 0;
  const tick = () => {
    if (document.hidden && (!keepWhenHidden || Date.now() - last < HIDDEN_POLL_MS)) return;
    last = Date.now();
    fn();
  };
  tick();
  const interval = setInterval(tick, ms);
  document.addEventListener('visibilitychange', tick);
  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', tick);
  };
}
