import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { isValidHibpPrefix } from '../../middleware/inputValidator';

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const AMBIGUOUS = 'Il1O0o';

export class ToolsController {
  generatePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        length = 16,
        uppercase = true,
        lowercase = true,
        numbers = true,
        symbols = true,
        excludeAmbiguous = false,
      } = req.body;

      if (length < 4 || length > 128) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Length must be between 4 and 128' }
        });
      }

      if (!uppercase && !lowercase && !numbers && !symbols) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'At least one character type must be selected' }
        });
      }

      let charset = '';
      const requiredChars: string[] = [];

      if (uppercase) {
        let chars = UPPERCASE;
        if (excludeAmbiguous) chars = chars.split('').filter(c => !AMBIGUOUS.includes(c)).join('');
        charset += chars;
        requiredChars.push(chars[crypto.randomInt(chars.length)]);
      }
      if (lowercase) {
        let chars = LOWERCASE;
        if (excludeAmbiguous) chars = chars.split('').filter(c => !AMBIGUOUS.includes(c)).join('');
        charset += chars;
        requiredChars.push(chars[crypto.randomInt(chars.length)]);
      }
      if (numbers) {
        let chars = NUMBERS;
        if (excludeAmbiguous) chars = chars.split('').filter(c => !AMBIGUOUS.includes(c)).join('');
        charset += chars;
        requiredChars.push(chars[crypto.randomInt(chars.length)]);
      }
      if (symbols) {
        charset += SYMBOLS;
        requiredChars.push(SYMBOLS[crypto.randomInt(SYMBOLS.length)]);
      }

      const remaining = length - requiredChars.length;
      const passwordChars = [...requiredChars];
      for (let i = 0; i < remaining; i++) {
        passwordChars.push(charset[crypto.randomInt(charset.length)]);
      }

      // Fisher-Yates shuffle
      for (let i = passwordChars.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
      }

      const password = passwordChars.join('');

      let strength = 0;
      if (length >= 8) strength++;
      if (length >= 12) strength++;
      if (length >= 16) strength++;
      if (uppercase && lowercase) strength++;
      if (numbers) strength++;
      if (symbols) strength++;

      const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
      const strengthIndex = Math.min(strength, strengthLabels.length - 1);

      return res.json({
        password,
        strength: strengthIndex,
        strength_label: strengthLabels[strengthIndex],
        length: password.length,
      });
    } catch (error) {
      return next(error);
    }
  }

  // HIBP k-anonymity breach check proxy
  // Client computes SHA-1 of password, sends first 5 hex chars (prefix)
  // We proxy to HIBP and return suffix list — client checks locally
  async breachCheck(req: Request, res: Response, next: NextFunction) {
    try {
      const hashPrefix = (req.query.prefix || req.body?.prefix) as string;

      if (!hashPrefix || !isValidHibpPrefix(hashPrefix)) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid hash prefix. Must be 5 uppercase hex characters.' }
        });
      }

      const prefix = hashPrefix.toUpperCase();

      // Use Node.js built-in fetch (Node 18+) or https module
      const hibpUrl = `https://api.pwnedpasswords.com/range/${prefix}`;

      let responseText: string;
      try {
        const hibpResponse = await fetch(hibpUrl, {
          headers: {
            'User-Agent': 'VaultPass-PasswordManager/1.0',
            'Add-Padding': 'true',  // Prevents traffic analysis via response size
          },
          signal: AbortSignal.timeout(5000), // 5s timeout
        });

        if (!hibpResponse.ok) {
          throw new Error(`HIBP returned ${hibpResponse.status}`);
        }
        responseText = await hibpResponse.text();
      } catch (fetchError) {
        // If HIBP is unavailable, return a safe error (don't block the user)
        console.error('[HIBP] API request failed:', fetchError);
        return res.status(503).json({
          error: { code: 'BREACH_SERVICE_UNAVAILABLE', message: 'Breach check service temporarily unavailable' }
        });
      }

      // Return the suffix:count list — client does the final lookup
      return res.json({ hashes: responseText });
    } catch (error) {
      return next(error);
    }
  }

  health(_req: Request, res: Response) {
    return res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  }
}

export default new ToolsController();
