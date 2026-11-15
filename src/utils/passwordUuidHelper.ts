export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/';
const AMBIGUOUS = new Set(['0', 'O', 'o', '1', 'l', 'I']);

function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % maxExclusive;
  }
}

export function generateSecurePassword(opts: PasswordOptions): {
  password: string;
  entropyBits: number;
  strengthLabel: 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
} {
  const cleanPool = (s: string) =>
    opts.excludeAmbiguous ? [...s].filter((ch) => !AMBIGUOUS.has(ch)).join('') : s;

  const groups: string[] = [];
  if (opts.uppercase) groups.push(cleanPool(UPPER));
  if (opts.lowercase) groups.push(cleanPool(LOWER));
  if (opts.numbers) groups.push(cleanPool(DIGITS));
  if (opts.symbols) groups.push(cleanPool(SYMBOLS));

  const activeGroups = groups.filter((g) => g.length > 0);
  if (activeGroups.length === 0) {
    activeGroups.push(cleanPool(LOWER));
  }

  const fullPool = activeGroups.join('');
  const length = Math.max(4, Math.min(128, Math.round(opts.length)));
  const chars: string[] = [];

  // Guarantee at least one char from each selected group when length allows
  for (let i = 0; i < activeGroups.length && i < length; i++) {
    const g = activeGroups[i];
    chars.push(g[secureRandomInt(g.length)]);
  }
  while (chars.length < length) {
    chars.push(fullPool[secureRandomInt(fullPool.length)]);
  }

  // Fisher-Yates unbiased shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  const entropyBits = Math.round(length * Math.log2(Math.max(2, fullPool.length)));
  const strengthLabel =
    entropyBits >= 90
      ? 'Very Strong'
      : entropyBits >= 64
        ? 'Strong'
        : entropyBits >= 42
          ? 'Fair'
          : 'Weak';

  return {
    password: chars.join(''),
    entropyBits,
    strengthLabel,
  };
}

export function generateUuidV4Batch(
  count: number,
  uppercase = false,
  noHyphens = false
): string[] {
  const safeCount = Math.max(1, Math.min(500, Math.round(count)));
  const results: string[] = [];

  for (let i = 0; i < safeCount; i++) {
    let uuid = '';
    if (typeof crypto.randomUUID === 'function') {
      uuid = crypto.randomUUID();
    } else {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    if (noHyphens) uuid = uuid.replace(/-/g, '');
    if (uppercase) uuid = uuid.toUpperCase();
    results.push(uuid);
  }

  return results;
}
