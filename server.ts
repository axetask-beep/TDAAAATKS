import 'dotenv/config';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './src/server/app.ts';
import { ensureAdminUser } from './src/db/queries.ts';

async function startServer() {
  const app = createApp();
  const PORT = Number(process.env.PORT) || 3000;

  // Vite Middleware Setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Ensure the initial admin account exists in the database
  try {
    await ensureAdminUser();
    console.log('[AxeTask Boot] Admin account verified in PostgreSQL database.');
  } catch (e) {
    console.warn('[Server Boot] Could not run ensureAdminUser:', e);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Axe Task Server running at http://127.0.0.1:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Axe Task server:', err);
});
