import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export class IntegrationEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationEncryptionError";
  }
}

let cachedKey: Buffer | null = null;

function hentMasterKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.SITEDOC_INTEGRATION_KEY;
  if (!raw) {
    throw new IntegrationEncryptionError(
      "SITEDOC_INTEGRATION_KEY mangler. Generer med: openssl rand -hex 32",
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new IntegrationEncryptionError(
      "SITEDOC_INTEGRATION_KEY må være 64 hex-tegn (32 byte). Generer med: openssl rand -hex 32",
    );
  }

  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new IntegrationEncryptionError(
      `SITEDOC_INTEGRATION_KEY må være ${KEY_LENGTH} byte etter hex-dekoding`,
    );
  }

  cachedKey = key;
  return key;
}

/**
 * Krypter en streng med AES-256-GCM.
 * Output: base64 av (iv | authTag | ciphertext) konkatenert.
 * IV er tilfeldig 12 byte per kall — samme klartekst gir alltid forskjellig output.
 */
export function krypter(klartekst: string): string {
  const key = hentMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(klartekst, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Dekrypter en streng kryptert med `krypter`. Throws hvis authTag ikke
 * matcher (data er endret) eller hvis nøkkel/format er feil.
 */
export function dekrypter(kryptert: string): string {
  const key = hentMasterKey();
  const buffer = Buffer.from(kryptert, "base64");
  if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new IntegrationEncryptionError("Kryptert verdi er for kort");
  }
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const klartekst = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return klartekst.toString("utf8");
}

/**
 * Sjekker at master-key er tilgjengelig og gyldig. Kalles ved oppstart
 * for tidlig-feiling før første DB-operasjon.
 */
export function verifiserKrypteringsKonfig(): void {
  hentMasterKey();
}
