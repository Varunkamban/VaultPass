import { Request, Response, NextFunction } from 'express';

// Sanitize a string: strip null bytes, control chars, trim
const sanitizeString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\0/g, '')                  // null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars (keep \t \n \r)
    .trim();
};

// Recursively sanitize all string values in an object
const sanitizeObject = (obj: unknown): unknown => {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, sanitizeObject(v)])
    );
  }
  return obj;
};

// Global input sanitization middleware
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
};

// Validate email format
export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

// Validate password strength server-side
export const isValidPassword = (password: string): { valid: boolean; reason?: string } => {
  if (password.length < 8)
    return { valid: false, reason: 'Password must be at least 8 characters' };
  if (password.length > 256)
    return { valid: false, reason: 'Password exceeds maximum length' };
  return { valid: true };
};

// Validate UUID format
export const isValidUUID = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Validate SHA-1 prefix for HIBP (5 hex chars)
export const isValidHibpPrefix = (prefix: string): boolean =>
  /^[A-F0-9]{5}$/i.test(prefix);

// Middleware: validate UUIDs in route params
export const validateUUID = (paramName: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params[paramName];
    if (!id || !isValidUUID(id)) {
      res.status(400).json({ error: { code: 'INVALID_PARAM', message: `Invalid ${paramName} format` } });
      return;
    }
    next();
  };

// Middleware: reject oversized payloads early
export const rejectOversizedPayload = (maxBytes: number) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxBytes) {
      res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload is too large' } });
      return;
    }
    next();
  };

// Middleware: block requests with suspicious patterns (SQL injection / XSS probes)
export const blockSuspiciousPatterns = (req: Request, res: Response, next: NextFunction): void => {
  const suspicious = [
    /(<script[\s\S]*?>[\s\S]*?<\/script>)/gi,   // XSS
    /(javascript\s*:)/gi,                         // JS protocol
    /(\bUNION\b.*\bSELECT\b)/gi,                 // SQL union
    /(\bDROP\b.*\b(TABLE|DATABASE)\b)/gi,         // SQL drop
    /(\bEXEC\b|\bEXECUTE\b).*\(/gi,              // SQL exec
  ];

  const checkValue = (val: unknown): boolean => {
    if (typeof val !== 'string') return false;
    return suspicious.some((pattern) => pattern.test(val));
  };

  const checkObject = (obj: unknown): boolean => {
    if (typeof obj === 'string') return checkValue(obj);
    if (Array.isArray(obj)) return obj.some(checkObject);
    if (obj !== null && typeof obj === 'object') {
      return Object.values(obj as Record<string, unknown>).some(checkObject);
    }
    return false;
  };

  if (checkObject(req.body) || checkObject(req.query)) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Request contains invalid content' } });
    return;
  }

  next();
};
