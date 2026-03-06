import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
// Build allowed origins list: configured URL + automatic Vercel preview URLs
const allowedOrigins = new Set<string>([env.FRONTEND_URL]);
if (process.env.VERCEL_URL) {
  allowedOrigins.add(`https://${process.env.VERCEL_URL}`);
}
// Allow any *.vercel.app subdomain for preview deployments
const vercelPreviewRegex = /^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
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

// ── Trust proxy (for accurate IP detection behind load balancers) ─
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

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/vault', vaultRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/tools', toolsRoutes);
app.use('/api/v1/security', securityRoutes);

// ── Health check (no rate limit) ─────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Root route ──────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ message: 'Password Management API', status: 'ok' });
});

// ── 404 & Error handlers ─────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
