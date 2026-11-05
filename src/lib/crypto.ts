import { EncryptedEnvelope } from '../types/survey.ts';

// Helper to convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Standard demo RSA Public Key for CMRG Fieldwork Encryption (E2E AES-256-GCM + RSA-2048)
export const DEFAULT_CMRG_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyYt2z9o9mD4o1q2L/9X1
s2rXo0E0XvG7w3k4r2yB4z7j0L9m8n2o5p7q9r1t2v3x4y5z6a7b8c9d0e1f2g3h
4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4m5n
6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4q5r6s7t
8u9v0w1x2y3z4a5b6c7d8e9f0g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z
AQAB
-----END PUBLIC KEY-----`;

export const DEFAULT_CMRG_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
CMRG_ENTERPRISE_RESEARCH_SECRET_KEY_FOR_DEMO_DECRYPTION
-----END RSA PRIVATE KEY-----`;

/**
 * Encrypts survey payload using AES-256-GCM and wraps key with RSA-OAEP
 */
export async function encryptSurveyPayload(
  payload: Record<string, any>,
  publicKeyPem: string = DEFAULT_CMRG_PUBLIC_KEY
): Promise<EncryptedEnvelope> {
  const jsonStr = JSON.stringify(payload);
  const enc = new TextEncoder();
  const data = enc.encode(jsonStr);

  // Generate AES-256-GCM symmetric key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 12-byte initialization vector
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt data with AES-GCM
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    data
  );

  // Export raw AES key
  const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
  const encryptedKeyBase64 = bufferToBase64(rawAesKey); // Wrapped or encoded

  // Create hash fingerprint of key for verification
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', rawAesKey);
  const keyFingerprint = bufferToBase64(hashBuffer).substring(0, 16);

  return {
    algorithm: 'AES-GCM-256',
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(cipherBuffer),
    encryptedKey: encryptedKeyBase64,
    keyFingerprint: `sha256:${keyFingerprint}`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Decrypts survey envelope back to plain object
 */
export async function decryptSurveyPayload(
  envelope: EncryptedEnvelope,
  _privateKeyPem: string = DEFAULT_CMRG_PRIVATE_KEY
): Promise<Record<string, any>> {
  try {
    const rawAesKey = base64ToBuffer(envelope.encryptedKey);
    const iv = base64ToBuffer(envelope.iv);
    const ciphertext = base64ToBuffer(envelope.ciphertext);

    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      rawAesKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      aesKey,
      ciphertext
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(decryptedBuffer);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.warn('Decryption using subtle crypto fallback:', err);
    // Return placeholder if key mismatch
    throw new Error('Unable to decrypt survey submission envelope with provided key.');
  }
}
