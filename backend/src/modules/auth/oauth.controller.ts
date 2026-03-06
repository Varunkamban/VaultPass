import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  ConfidentialClientApplication,
  Configuration,
  AuthorizationCodeRequest,
  AuthorizationUrlRequest,
} from '@azure/msal-node';
import { env } from '../../config/env';
import authService from './auth.service';

// ── PKCE helpers ──────────────────────────────────────────────────────────────
const generateCodeVerifier = (): string =>
  crypto.randomBytes(32).toString('base64url');

const generateCodeChallenge = (verifier: string): string =>
  crypto.createHash('sha256').update(verifier).digest('base64url');

// ── Build a fresh MSAL client for each request (Vercel serverless is stateless)
const buildMsalClient = (): ConfidentialClientApplication => {
  const config: Configuration = {
    auth: {
      clientId: env.MICROSOFT_CLIENT_ID,
      authority: 'https://login.microsoftonline.com/organizations',
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
    },
  };
  return new ConfidentialClientApplication(config);
};

// ── OAuth scopes ──────────────────────────────────────────────────────────────
const SCOPES = ['openid', 'profile', 'email'];

// ── Step 1: Redirect browser to Microsoft login ───────────────────────────────
export const initiateOAuth = async (req: Request, res: Response): Promise<void> => {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    res.status(503).json({ error: 'Microsoft SSO is not configured on this server.' });
    return;
  }

  try {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Pack code_verifier into a short-lived signed JWT used as the OAuth `state`
    // parameter.  This is stateless — no DB/Redis needed on serverless.
    const state = jwt.sign(
      { codeVerifier, purpose: 'oauth_pkce' },
      env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    const msalClient = buildMsalClient();
    const authCodeUrlParams: AuthorizationUrlRequest = {
      scopes: SCOPES,
      redirectUri: env.MICROSOFT_REDIRECT_URI,
      state,
      codeChallenge,
      codeChallengeMethod: 'S256',
    };

    const authUrl = await msalClient.getAuthCodeUrl(authCodeUrlParams);
    res.redirect(authUrl);
  } catch (err) {
    console.error('[oauth] initiateOAuth error:', err);
    res.redirect(`${env.FRONTEND_URL}/auth/callback?error=OAUTH_INIT_FAILED`);
  }
};

// ── Step 2: Handle Microsoft redirect, issue VaultPass JWT ───────────────────
export const handleCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;
  const frontendCallback = `${env.FRONTEND_URL}/auth/callback`;

  // Microsoft returned an error (user declined, etc.)
  if (oauthError) {
    console.warn('[oauth] Microsoft returned error:', oauthError);
    res.redirect(`${frontendCallback}?error=OAUTH_FAILED`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${frontendCallback}?error=MISSING_PARAMS`);
    return;
  }

  // ── Verify state JWT (CSRF + PKCE recovery) ──────────────────────────────
  let codeVerifier: string;
  try {
    const decoded = jwt.verify(state, env.JWT_SECRET) as { codeVerifier: string; purpose: string };
    if (decoded.purpose !== 'oauth_pkce') throw new Error('wrong purpose');
    codeVerifier = decoded.codeVerifier;
  } catch {
    res.redirect(`${frontendCallback}?error=INVALID_STATE`);
    return;
  }

  // ── Exchange authorization code for tokens ────────────────────────────────
  try {
    const msalClient = buildMsalClient();
    const tokenRequest: AuthorizationCodeRequest = {
      code,
      scopes: SCOPES,
      redirectUri: env.MICROSOFT_REDIRECT_URI,
      codeVerifier,
    };

    const tokenResponse = await msalClient.acquireTokenByCode(tokenRequest);
    if (!tokenResponse) throw new Error('No token response from MSAL');

    const claims = tokenResponse.idTokenClaims as Record<string, unknown>;

    // Extract stable identifiers from the ID token
    const microsoftOid = claims['oid'] as string | undefined;
    const microsoftTid = claims['tid'] as string | undefined;
    // Work/school accounts use 'preferred_username'; fallback to 'email' claim
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
    const userAgent = req.headers['user-agent'] || null;
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
