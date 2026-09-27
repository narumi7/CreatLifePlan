// バックアップファイル（JSON）の書き出し・読み込み。
// パスワードを設定すると AES-GCM（鍵は PBKDF2 で導出）で暗号化し、ファイルが漏れても読めないようにする。
// 暗号化はブラウザ内の Web Crypto API で行い、データやパスワードを外部に送ることはない。

import { normalizeSaved, type SavedPlan } from './planStore';

const FORMAT = 'creatlifeplan-backup';
const ENC_FORMAT = 'creatlifeplan-encrypted';
const ITERATIONS = 310_000;

interface PlainBackup {
  format: typeof FORMAT;
  version: 1;
  exportedAt: string;
  plans: SavedPlan[];
}

interface EncryptedBackup {
  format: typeof ENC_FORMAT;
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

const fromB64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function createBackup(plans: SavedPlan[], password?: string): Promise<string> {
  const plain: PlainBackup = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), plans };
  const json = JSON.stringify(plain);
  if (!password) return JSON.stringify(plain, null, 2);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(json));
  const enc: EncryptedBackup = {
    format: ENC_FORMAT,
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(data),
  };
  return JSON.stringify(enc);
}

export class PasswordRequiredError extends Error {
  constructor() {
    super('このファイルはパスワードで暗号化されています');
  }
}

export function isEncrypted(text: string): boolean {
  try {
    return (JSON.parse(text) as { format?: string }).format === ENC_FORMAT;
  } catch {
    return false;
  }
}

export async function readBackup(text: string, password?: string): Promise<SavedPlan[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('ファイルの形式が正しくありません');
  }
  const obj = raw as { format?: string };
  if (obj.format === ENC_FORMAT) {
    if (!password) throw new PasswordRequiredError();
    const enc = raw as EncryptedBackup;
    const key = await deriveKey(password, fromB64(enc.salt), enc.iterations);
    let decrypted: ArrayBuffer;
    try {
      decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(enc.iv) }, key, fromB64(enc.data));
    } catch {
      throw new Error('パスワードが違います');
    }
    return readBackup(new TextDecoder().decode(decrypted));
  }
  if (obj.format !== FORMAT) throw new Error('ライフプランのバックアップファイルではありません');
  const plans = ((raw as PlainBackup).plans ?? []).map(normalizeSaved).filter((p): p is SavedPlan => p !== null);
  if (plans.length === 0) throw new Error('プランが含まれていません');
  return plans;
}
