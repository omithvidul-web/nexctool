export interface DecodedJwtResult {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signatureB64Url: string;
  signingInput: string;
  algorithm: string;
  issuedAtIso: string | null;
  expiresAtIso: string | null;
  notBeforeIso: string | null;
  isExpired: boolean | null;
}

function base64UrlToBytes(b64Url: string): Uint8Array {
  const padded = b64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64Url.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJsonPart(part: string, label: string): Record<string, unknown> {
  try {
    const bytes = base64UrlToBytes(part);
    const jsonStr = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} is not a JSON object.`);
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid JWT ${label.toLowerCase()} encoding.`);
  }
}

export function decodeJwtToken(token: string, nowMs = Date.now()): DecodedJwtResult {
  const cleaned = token.trim().replace(/^Bearer\s+/i, '');
  const parts = cleaned.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1]) {
    throw new Error('JWT must contain 3 dot-separated parts (header.payload.signature).');
  }

  const header = decodeJsonPart(parts[0], 'Header');
  const payload = decodeJsonPart(parts[1], 'Payload');

  const toIso = (val: unknown): string | null =>
    typeof val === 'number' && Number.isFinite(val) ? new Date(val * 1000).toISOString() : null;

  const expSec = typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp : null;

  return {
    header,
    payload,
    signatureB64Url: parts[2],
    signingInput: `${parts[0]}.${parts[1]}`,
    algorithm: typeof header.alg === 'string' ? header.alg : 'unknown',
    issuedAtIso: toIso(payload.iat),
    expiresAtIso: toIso(payload.exp),
    notBeforeIso: toIso(payload.nbf),
    isExpired: expSec !== null ? expSec * 1000 < nowMs : null,
  };
}

export async function verifyJwtHmacSignature(
  signingInput: string,
  signatureB64Url: string,
  algorithm: string,
  secret: string
): Promise<boolean> {
  const hashMap: Record<string, string> = {
    HS256: 'SHA-256',
    HS384: 'SHA-384',
    HS512: 'SHA-512',
  };
  const hashName = hashMap[algorithm.toUpperCase()];
  if (!hashName) {
    throw new Error(`Local HMAC verification supports HS256, HS384, or HS512 (found ${algorithm}).`);
  }
  const keyBytes = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer,
    { name: 'HMAC', hash: hashName },
    false,
    ['verify']
  );
  const sigBytes = base64UrlToBytes(signatureB64Url);
  const sigCopy = new Uint8Array(sigBytes.byteLength);
  sigCopy.set(sigBytes);
  const dataBytes = new TextEncoder().encode(signingInput);
  return crypto.subtle.verify('HMAC', cryptoKey, sigCopy.buffer, dataBytes.buffer);
}

export const SAMPLE_JWT_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfNzk0MjEiLCJuYW1lIjoiTmV4Y1Rvb2wgVXNlciIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczMTU2MDAwMCwiZXhwIjoxODkzNDU2MDAwfQ.dummySignatureForLocalInspection';
