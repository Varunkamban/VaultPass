import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import authService from './auth.service';

// ── Microsoft OAuth2 endpoints (organizations tenant = work/school accounts) ──
const MS_AUTHORITY = 'https://login.microsoftonline.com/organizations';
const MS_AUTH_URL  = `${MS_AUTHORITY}/oauth2/v2.0/authorize`;
const MS_TOKEN_URL = `${MS_AUTHORITY}/oauth2/v2.0/token`;
const SCOPES       = 'openid profile email';

// ── PKCE helpers ──────────────────────────────────────────────────────────────
const generateCodeVerifier = (): string =>
  crypto.randomBytes(32).toString('base64url');

const generateCodeChallenge = (verifier: string): string =>
  crypto.createHash('sha256').update(verifier).digest('base64url');

// ── Step 1: Redirect browser to Microsoft login ───────────────────────────────
export const initiateOAuth = async (req: Request, res: Response): Promise<void> => {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    res.status(503).json({ error: 'Microsoft SSO is not configured on this server.' });
    return;
  }

  try {
    const codeVerifier  = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Pack code_verifier into a short-lived signed JWT used as the OAuth `state`
    // parameter.  Fully stateless — no DB/Redis/session store needed.
    const state = jwt.sign(
      { codeVerifier, purpose: 'oauth_pkce' },
      env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Build the authorization URL manually (no MSAL, fully stateless)
    const params = new URLSearchParams({
      client_id:             env.MICROSOFT_CLIENT_ID,
      response_type:         'code',
      redirect_uri:          env.MICROSOFT_REDIRECT_URI,
      response_mode:         'query',
      scope:                 SCOPES,
      state,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
    });

    res.redirect(`${MS_AUTH_URL}?${params.toString()}`);
  } catch (err) {
    console.error('[oauth] initiateOAuth error:', err);
    res.redirect(`${env.FRONTEND_URL}/auth/callback?error=OAUTH_INIT_FAILED`);
  }
};

// ── Step 2: Handle Microsoft redirect, issue VaultPass JWT ───────────────────
export const handleCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;
  const frontendCallback = `${env.FRONTEND_URL}/auth/callback`;

  // Microsoft returned an error (user declined, misconfigured app, etc.)
  if (oauthError) {
    console.warn('[oauth] Microsoft returned error:', oauthError, req.query['error_description']);
    res.redirect(`${frontendCallback}?error=OAUTH_FAILED`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${frontendCallback}?error=MISSING_PARAMS`);
    return;
  }

  // ── Verify state JWT (CSRF protection + PKCE code_verifier recovery) ─────
  let codeVerifier: string;
  try {
    const decoded = jwt.verify(state, env.JWT_SECRET) as { codeVerifier: string; purpose: string };
    if (decoded.purpose !== 'oauth_pkce') throw new Error('wrong purpose');
    codeVerifier = decoded.codeVerifier;
  } catch {
    res.redirect(`${frontendCallback}?error=INVALID_STATE`);
    return;
  }

  // ── Exchange authorization code for tokens via direct HTTP POST ───────────
  // Using fetch() directly to Microsoft's token endpoint — no MSAL library.
  // MSAL requires its own internal per-instance state from getAuthCodeUrl,
  // which breaks when the client is re-created per request (stateless design).
  try {
    const tokenRes = await fetch(MS_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     env.MICROSOFT_CLIENT_ID,
        client_secret: env.MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri:  env.MICROSOFT_REDIRECT_URI,
        code_verifier: codeVerifier,
        scope:         SCOPES,
      }).toString(),
    });

    const tokenData = await tokenRes.json() as Record<string, unknown>;

    if (!tokenRes.ok || tokenData['error']) {
      console.error('[oauth] Token exchange failed:', tokenData);
      res.redirect(`${frontendCallback}?error=OAUTH_FAILED`);
      return;
    }

    // ── Decode ID token (trusted — came directly from Microsoft over TLS) ──
    const idToken = tokenData['id_token'] as string | undefined;
    if (!idToken) {
      console.error('[oauth] No id_token in token response');
      res.redirect(`${frontendCallback}?error=MISSING_ID_TOKEN`);
      return;
    }

    // JWT payload is the base64url-encoded middle segment
    const payloadB64 = idToken.split('.')[1];
    const claims = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as Record<string, unknown>;

    // Extract stable identifiers from the ID token claims
    const microsoftOid = claims['oid'] as string | undefined;
    const microsoftTid = claims['tid'] as string | undefined;
    // Work/school accounts: 'preferred_username' is the UPN (email-like)
    const microsoftEmail =
      (claims['preferred_username'] as string | undefined) ||
      (claims['email'] as string | undefined);

    if (!microsoftOid || !microsoftEmail) {
      console.error('[oauth] Missing oid or email in ID token claims', claims);
      res.redirect(`${frontendCallback}?error=MISSING_CLAIMS`);
      return;
    }

    // ── Derive device info for session / audit log ────────────────────────
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      null;
    const userAgent  = req.headers['user-agent'] || null;
    const deviceInfo = { ip, userAgent, provider: 'microsoft' };

    // ── Find or create VaultPass user ─────────────────────────────────────
    const result = await authService.ssoLogin(
      microsoftOid,
      microsoftTid ?? '',
      microsoftEmail,
      deviceInfo
    );

    if (result.error === 'EMAIL_EXISTS') {
      // A local (email/password) account already exists with this email address.
      res.redirect(`${frontendCallback}?error=EMAIL_EXISTS`);
      return;
    }

    // ── Build redirect fragment (tokens never appear in server logs via #) ─
    const fragment = [
      `access_token=${encodeURIComponent(result.accessToken)}`,
      `refresh_token=${encodeURIComponent(result.refreshToken)}`,
      `sso_vault_secret=${encodeURIComponent(result.ssoVaultSecret)}`,
      `kdf_salt=${encodeURIComponent(result.kdfSalt)}`,
      `kdf_iterations=${result.kdfIterations}`,
    ].join('&');

    res.redirect(`${frontendCallback}#${fragment}`);
  } catch (err) {
    console.error('[oauth] handleCallback error:', err);
    res.redirect(`${frontendCallback}?error=OAUTH_FAILED`);
  }
};
