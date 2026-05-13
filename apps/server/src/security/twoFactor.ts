import { generateSecret as otplibGenerateSecret, generateURI, verify as otplibVerify } from "otplib";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";

/**
 * 2FA TOTP support через otplib + AES-256-GCM encryption secret'а в БД.
 *
 * Threat model:
 *   - Если БД дамп утёк → attacker не может восстановить TOTP secrets без
 *     `TWOFA_ENCRYPTION_KEY` env var (kept в сервере, не в БД).
 *   - Recovery codes хранятся как bcrypt-хэши (одноразовые, использованные
 *     удаляются из array).
 *
 * Config:
 *   TWOFA_ENCRYPTION_KEY=<32-байт hex или passphrase>  — required если 2FA
 *     включён хоть у одного user. Derived через scrypt(passphrase, "eclipse-chat-2fa").
 *
 * Issuer name в URI = "Eclipse Chat" + email — стандартный TOTP URL.
 */

const TOTP_PERIOD = 30;
const TOTP_WINDOW = 1;

const ALGO = "aes-256-gcm";
const KEY_SCRYPT_SALT = "eclipse-chat-2fa-salt-v1";

function getEncryptionKey(): Buffer {
  const raw = process.env.TWOFA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TWOFA_ENCRYPTION_KEY env required для 2FA. Сгенерируй: `openssl rand -hex 32` и положи в .env",
    );
  }
  // Если выглядит как 64-hex символа → использовать как сырой ключ.
  // Иначе derive через scrypt (passphrase mode).
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return scryptSync(raw, KEY_SCRYPT_SALT, 32);
}

/** Шифруем secret перед сохранением в БД. Формат: `<iv-hex>:<tag-hex>:<cipher-hex>`. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getEncryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(blob: string): string {
  const [ivHex, tagHex, encHex] = blob.split(":");
  if (!ivHex || !tagHex || !encHex) {
    throw new Error("Invalid encrypted secret format");
  }
  const decipher = createDecipheriv(ALGO, getEncryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function generateSecret(): string {
  return otplibGenerateSecret();
}

export function buildOtpAuthUrl(secret: string, accountName: string): string {
  return generateURI({
    strategy: "totp",
    issuer: "Eclipse Chat",
    label: accountName,
    secret,
    period: TOTP_PERIOD,
  });
}

export async function generateQrDataUrl(otpAuthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUrl, { errorCorrectionLevel: "M", margin: 1 });
}

export async function verifyCode(secret: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    const result = await otplibVerify({
      strategy: "totp",
      token: code,
      secret,
      // epochTolerance в секундах: TOTP_WINDOW * TOTP_PERIOD = ±30 секунд.
      epochTolerance: TOTP_WINDOW * TOTP_PERIOD,
      period: TOTP_PERIOD,
    });
    return result.valid === true;
  } catch {
    return false;
  }
}

/**
 * Recovery codes — 10 штук по 10 символов (base32-style human-readable).
 * Возвращаем plaintext (показываем user 1 раз) и bcrypt-хэши (storage).
 */
export async function generateRecoveryCodes(): Promise<{
  plain: string[];
  hashedJson: string;
}> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const buf = randomBytes(10);
    let code = "";
    for (let j = 0; j < 10; j++) {
      code += alphabet[buf[j] % alphabet.length];
    }
    codes.push(code.slice(0, 5) + "-" + code.slice(5));
  }
  const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, 8)));
  return {
    plain: codes,
    hashedJson: JSON.stringify(hashed),
  };
}

/**
 * Проверка recovery code: возвращает remaining-codes JSON если match.
 * null = не валидный или уже использованный.
 */
export async function verifyRecoveryCode(
  inputCode: string,
  hashedJson: string | null,
): Promise<{ remainingJson: string } | null> {
  if (!hashedJson) return null;
  let codes: string[];
  try {
    codes = JSON.parse(hashedJson);
  } catch {
    return null;
  }
  const normalized = inputCode.toUpperCase().replace(/\s+/g, "");
  for (let i = 0; i < codes.length; i++) {
    if (await bcrypt.compare(normalized, codes[i])) {
      // Match — удалить этот hash из array (одноразовый)
      const remaining = codes.filter((_, idx) => idx !== i);
      return { remainingJson: JSON.stringify(remaining) };
    }
  }
  return null;
}
