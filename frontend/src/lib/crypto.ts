// Client-side cryptography using Web Crypto API
// Implements zero-knowledge encryption for vault items

export const generateSalt = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
};

const bytesToBase64 = (bytes: ArrayBuffer): string => {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
};

const base64ToBytes = (b64: string): Uint8Array => {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
};

export const deriveKey = async (password: string, salt: string, iterations = 100000): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const saltBytes = hexToBytes(salt);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encrypt = async (
  data: string,
  key: CryptoKey
): Promise<{ encrypted: string; nonce: string }> => {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );

  return {
    encrypted: bytesToBase64(encrypted),
    nonce: bytesToBase64(iv.buffer),
  };
};

export const decrypt = async (
  encryptedData: string,
  nonce: string,
  key: CryptoKey
): Promise<string> => {
  const decoder = new TextDecoder();
  const encryptedBytes = base64ToBytes(encryptedData);
  const iv = base64ToBytes(nonce);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBytes
  );

  return decoder.decode(decrypted);
};

export const encryptString = async (text: string, key: CryptoKey): Promise<string> => {
  const { encrypted, nonce } = await encrypt(text, key);
  // Encode as nonce:ciphertext for storage
  return `${nonce}:${encrypted}`;
};

export const decryptString = async (encoded: string, key: CryptoKey): Promise<string> => {
  const colonIndex = encoded.indexOf(':');
  const nonce = encoded.substring(0, colonIndex);
  const encrypted = encoded.substring(colonIndex + 1);
  return decrypt(encrypted, nonce, key);
};

// ── SHA-1 hash (for HIBP k-anonymity breach check) ───────────────
// Returns uppercase hex string of the SHA-1 hash
export const sha1 = async (data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-1', encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
};

// ── HIBP k-anonymity check ────────────────────────────────────────
// Returns the number of times the password has been seen in breaches (0 = safe)
// The full password is NEVER sent — only the first 5 chars of its SHA-1 hash
export const checkPasswordBreached = async (
  password: string,
  fetchHibpRange: (prefix: string) => Promise<string>
): Promise<number> => {
  const fullHash = await sha1(password);
  const prefix = fullHash.slice(0, 5);
  const suffix = fullHash.slice(5);

  const rangeText = await fetchHibpRange(prefix);

  // Each line: SUFFIX:COUNT
  for (const line of rangeText.split('\n')) {
    const [lineSuffix, countStr] = line.trim().split(':');
    if (lineSuffix === suffix) {
      return parseInt(countStr, 10);
    }
  }
  return 0; // Not found in breaches
};
