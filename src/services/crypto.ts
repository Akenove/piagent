import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function deriveUserKey(walletId: string, masterKey: string): Buffer {
  return crypto.pbkdf2Sync(
    `${masterKey}:${walletId}`,
    walletId,
    100000,
    32,
    'sha512'
  );
}

export function encrypt(plaintext: string, key: Buffer): EncryptedPayload {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  return {
    ciphertext,
    iv: iv.toString('hex'),
    tag: (cipher as any).getAuthTag().toString('hex'),
  };
}

export function decrypt(payload: EncryptedPayload, key: Buffer): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, 'hex')
  );
  (decipher as any).setAuthTag(Buffer.from(payload.tag, 'hex'));
  let plaintext = decipher.update(payload.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}

export function generateWalletSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function computeTxHash(walletId: string, type: string, amount: number, balanceAfter: number): string {
  const ts = Date.now().toString();
  return sha256(`${walletId}:${type}:${amount}:${balanceAfter}:${ts}`);
}
