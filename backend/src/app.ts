import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env';
import { generalLimiter } from './middleware/rateLimiter';
import { errorHandler, notFound } from './middleware/errorHandler';
import { sanitizeInput, blockSuspiciousPatterns, rejectOversizedPayload } from './middleware/inputValidator';

import authRoutes from './modules/auth/auth.routes';
import vaultRoutes from './modules/vault/vault.routes';
import adminRoutes from './modules/admin/admin.routes';
import toolsRoutes from './modules/tools/tools.routes';
import securityRoutes from './modules/security/security.routes';

const app = express();

// ── Security headers (Helmet) ───────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      // 'unsafe-inline' not needed for production Vite build (uses hashed filenames).
      // Kept off intentionally; add only if you see CSP errors in the browser console.
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ── CORS ────────────────────────────────────────────────────────
// In production (local server) frontend + backend share the same origin,
// so CORS is only really needed in dev mode.
const allowedOrigins = new Set<string>([env.FRONTEND_URL]);
if (process.env.VERCEL_URL) {
  allowedOrigins.add(`https://${process.env.VERCEL_URL}`);
}
const vercelPreviewRegex = /^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin) || vercelPreviewRegex.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Trust proxy (for accurate IP detection behind reverse proxy / nginx) ─
app.set('trust proxy', 1);

// ── Body parsing (reject oversized payloads early) ───────────────
app.use(rejectOversizedPayload(2 * 1024 * 1024)); // 2 MB hard limit
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Input security middleware ────────────────────────────────────
app.use(sanitizeInput);           // Strip null bytes / control chars
app.use(blockSuspiciousPatterns); // Block SQL injection / XSS probes

// ── Global rate limiter ──────────────────────────────────────────
app.use('/api', generalLimiter);

// ── API Routes ───────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/vault', vaultRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/tools', toolsRoutes);
app.use('/api/v1/security', securityRoutes);

// ── Health check (no rate limit) ─────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Serve built React frontend (production / local-server mode) ───
// When NODE_ENV=production, Express serves the Vite build output
// from frontend/dist so you only need to run ONE process on port 5000.
// In development, Vite's dev server (port 5173) handles the frontend.
if (env.NODE_ENV === 'production') {
  // Path: backend/dist/app.js → ../../frontend/dist
  const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');

  // Serve static assets (hashed JS/CSS bundles, images, fonts, etc.)
  app.use(express.static(frontendDist));

  // SPA catch-all: any non-/api route serves index.html so React Router works.
  // The regex (?!\/api) ensures API 404s still reach the notFound handler below.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({ message: 'VaultPass API', status: 'ok' });
  });
}

// ── 404 & Error handlers (API routes only in production) ─────────
app.use(notFound);
app.use(errorHandler);

export default app;
