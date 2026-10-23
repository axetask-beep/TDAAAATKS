// Vercel serverless function source. This is bundled with esbuild into a
// single self-contained api/index.js file at build time (see the
// "vercel-build" script in package.json) — Vercel's own per-file TypeScript
// compilation does not resolve cross-directory relative imports at runtime,
// so we pre-bundle instead of letting api/index.ts import sibling .ts files
// directly.
import type { Request, Response } from 'express';
import { createApp } from './app.ts';
import { ensureAdminUser } from '../db/queries.ts';

let app: ReturnType<typeof createApp> | null = null;
let initError: Error | null = null;

try {
  app = createApp();
  // Runs once per cold start, before the function starts serving requests.
  await ensureAdminUser().catch(err => {
    console.warn('[AxeTask Boot] Could not ensure admin account:', err);
  });
} catch (err: any) {
  initError = err;
  console.error('[AxeTask Boot] Failed to initialize app:', err);
}

export default function handler(req: Request, res: Response) {
  if (!app) {
    res.status(500).json({
      error: 'Server misconfigured — the app failed to initialize.',
      detail: initError?.message,
    });
    return;
  }
  return app(req, res);
}
