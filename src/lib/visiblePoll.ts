// Runs `fn` now and every `ms`, but only while the page is visible, and
// again as soon as it becomes visible. Polling from hidden/background tabs
// kept the Neon compute awake 24/7 and burned the monthly quota.
// keepWhenHidden: also poll in the background (desktop app, which has no Web Push).
export function visiblePoll(fn: () => void, ms: number, keepWhenHidden = false): () => void {
  const tick = () => { if (keepWhenHidden || !document.hidden) fn(); };
  tick();
  const interval = setInterval(tick, ms);
  document.addEventListener('visibilitychange', tick);
  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', tick);
  };
}
