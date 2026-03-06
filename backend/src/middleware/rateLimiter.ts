import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again in 15 minutes.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many registration attempts. Please try again in 1 hour.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many password reset attempts. Please try again in 1 hour.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordGenerateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many password generation requests.' } },
  standardHeaders: true,
  legacyHeaders: false,
});
