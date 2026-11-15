const MAGIC = new Uint8Array([0x4e, 0x58, 0x43, 0x31]); // "NXC1"
const SALT_LEN = 16;
const IV_LEN = 12;
const PBKDF2_ITERATIONS = 310_000;

async function deriveAesKey(password: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const saltCopy = new Uint8Array(salt.byteLength);
  saltCopy.set(salt);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltCopy.buffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

export async function encryptBytesAesGcm(
  plainBytes: Uint8Array,
  originalFilename: string,
  password: string
): Promise<Uint8Array> {
  if (!password) {
    throw new Error('Please enter an encryption password.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveAesKey(password, salt, ['encrypt']);

  const nameBytes = new TextEncoder().encode(originalFilename || 'file.bin');
  const safeNameLen = Math.min(4096, nameBytes.byteLength);

  // Header: MAGIC(4) + SALT(16) + IV(12) + NAME_LEN(2) + NAME_BYTES
  const headerLen = MAGIC.byteLength + SALT_LEN + IV_LEN + 2 + safeNameLen;
  const plainCopy = new Uint8Array(plainBytes.byteLength);
  plainCopy.set(plainBytes);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer },
    key,
    plainCopy.buffer
  );
  const cipherBytes = new Uint8Array(cipherBuffer);

  const out = new Uint8Array(headerLen + cipherBytes.byteLength);
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  out.set(salt, MAGIC.byteLength);
  out.set(iv, MAGIC.byteLength + SALT_LEN);
  view.setUint16(MAGIC.byteLength + SALT_LEN + IV_LEN, safeNameLen, false);
  out.set(nameBytes.subarray(0, safeNameLen), MAGIC.byteLength + SALT_LEN + IV_LEN + 2);
  out.set(cipherBytes, headerLen);

  return out;
}

export async function decryptBytesAesGcm(
  encryptedBytes: Uint8Array,
  password: string
): Promise<{ filename: string; data: Uint8Array }> {
  if (!password) {
    throw new Error('Please enter the decryption password.');
  }
  const minHeader = MAGIC.byteLength + SALT_LEN + IV_LEN + 2;
  if (encryptedBytes.byteLength < minHeader + 16) {
    throw new Error('Invalid or truncated encrypted .nexenc file.');
  }

  for (let i = 0; i < MAGIC.byteLength; i++) {
    if (encryptedBytes[i] !== MAGIC[i]) {
      throw new Error('Not a valid NexcTool encrypted (.nexenc) file.');
    }
  }

  const view = new DataView(
    encryptedBytes.buffer,
    encryptedBytes.byteOffset,
    encryptedBytes.byteLength
  );
  const saltOffset = MAGIC.byteLength;
  const ivOffset = saltOffset + SALT_LEN;
  const nameLenOffset = ivOffset + IV_LEN;
  const nameLen = view.getUint16(nameLenOffset, false);
  const cipherOffset = nameLenOffset + 2 + nameLen;

  if (cipherOffset >= encryptedBytes.byteLength) {
    throw new Error('Corrupted encrypted file header.');
  }

  const salt = encryptedBytes.slice(saltOffset, saltOffset + SALT_LEN);
  const iv = encryptedBytes.slice(ivOffset, ivOffset + IV_LEN);
  const filename =
    new TextDecoder().decode(encryptedBytes.subarray(nameLenOffset + 2, cipherOffset)) ||
    'decrypted-file.bin';
  const cipherSlice = encryptedBytes.slice(cipherOffset);

  const key = await deriveAesKey(password, salt, ['decrypt']);

  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer },
      key,
      cipherSlice.buffer
    );
    return {
      filename,
      data: new Uint8Array(plainBuffer),
    };
  } catch {
    throw new Error('Incorrect password or the encrypted file was modified.');
  }
}
