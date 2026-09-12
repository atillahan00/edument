import { createHash, createHmac } from 'node:crypto';
import canonicalize from 'canonicalize';
export function normalize(value: unknown): unknown {
  if (typeof value === 'string') return value.normalize('NFC');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Sonlu olmayan sayı.');
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  return value;
}
export const sha256 = (value: Buffer | string) => '0x' + createHash('sha256').update(value).digest('hex');
export function hashRecord(value: unknown) {
  const canonical = canonicalize(normalize(value));
  if (canonical === undefined) throw new Error('Kayıt serileştirilemedi.');
  return sha256(canonical);
}
export const subjectReference = (id: string, secret: string) =>
  '0x' + createHmac('sha256', secret).update(id).digest('hex');
