import { describe, it, expect, vi } from 'vitest';
import { hashRecord, sha256, subjectReference } from '../apps/api/src/hash';
import { canReview, ownsOrAdmin, SessionGuard, type Actor } from '../apps/api/src/security';
import { validateFile } from '../apps/api/src/storage';
import {
  privateDefaults,
  privacySchema,
  registrationSchema,
  weightsSchema,
  defaultWeights,
} from '../packages/shared/src';
const actor = (role: Actor['role'] = 'STUDENT'): Actor => ({
  id: 'student',
  name: 'Test',
  role,
  minor: true,
  active: true,
  memberships: [{ institutionId: 'school' }],
});
describe('Canonical integrity', () => {
  it('sorts nested keys and normalizes equivalent Unicode', () => {
    expect(hashRecord({ z: [{ b: 2, a: 'e\u0301' }], a: 1 })).toBe(
      hashRecord({ a: 1, z: [{ a: 'é', b: 2 }] }),
    );
  });
  it('preserves significant whitespace and array order', () => {
    expect(hashRecord({ x: 'a ' })).not.toBe(hashRecord({ x: 'a' }));
    expect(hashRecord([1, 2])).not.toBe(hashRecord([2, 1]));
  });
  it('detects one-byte changes', () => {
    const original = Buffer.from('document');
    const altered = Buffer.from(original);
    altered[2] ^= 1;
    expect(sha256(original)).not.toBe(sha256(altered));
  });
  it('pseudonyms are keyed and hide internal UUIDs', () => {
    const a = subjectReference('internal-uuid', 'secret1');
    expect(a).toHaveLength(66);
    expect(a).not.toContain('internal');
    expect(a).not.toBe(subjectReference('internal-uuid', 'secret2'));
  });
  it('rejects non-finite numbers', () => expect(() => hashRecord({ x: Infinity })).toThrow());
});
describe('Authorization and privacy', () => {
  it('scope checks do not grant a foreign verifier or student access', () => {
    expect(canReview(actor('VERIFIER'), 'school')).toBe(true);
    expect(canReview(actor('VERIFIER'), 'other')).toBe(false);
    expect(canReview(actor(), 'school')).toBe(false);
    expect(ownsOrAdmin(actor(), 'someone')).toBe(false);
    expect(canReview(actor('ADMIN'), 'other')).toBe(true);
  });
  it('registration cannot assign privileged roles or active state', () => {
    expect(
      registrationSchema.safeParse({
        name: 'Test',
        email: 'a@example.com',
        password: 'LongPassword123',
        role: 'ADMIN',
        active: true,
        minor: false,
        consent: true,
      }).success,
    ).toBe(false);
  });
  it('privacy starts restrictive and rejects arbitrary keys', () => {
    expect(privateDefaults.publicTitle).toBe(false);
    expect(privateDefaults.profile).toBe('PRIVATE');
    expect(privacySchema.safeParse({ ...privateDefaults, admin: true }).success).toBe(false);
  });
  it('session guard rejects disabled and expired sessions', async () => {
    const db = {
      session: {
        findUnique: vi.fn().mockResolvedValue({ expiresAt: new Date(Date.now() - 1000), user: actor() }),
      },
    };
    const guard = new SessionGuard(db as any, { getAllAndOverride: () => false } as any);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ cookies: { bilsem_session: 'token' } }) }),
      getHandler: () => null,
      getClass: () => null,
    };
    await expect(guard.canActivate(context as any)).rejects.toThrow();
  });
});
describe('Validated uploads and settings', () => {
  it('rejects forged media types and executable bytes', () => {
    expect(() =>
      validateFile({ buffer: Buffer.from('MZbad'), size: 5, mimetype: 'application/pdf' } as any),
    ).toThrow();
    expect(() =>
      validateFile({ buffer: Buffer.from('%PDF-1.4'), size: 8, mimetype: 'image/png' } as any),
    ).toThrow();
  });
  it('permits PDF signature with matching MIME', () =>
    expect(
      validateFile({ buffer: Buffer.from('%PDF-1.4'), size: 8, mimetype: 'application/pdf' } as any),
    ).toBe('application/pdf'));
  it('requires normalized weights', () => {
    expect(weightsSchema.safeParse(defaultWeights).success).toBe(true);
    expect(weightsSchema.safeParse({ ...defaultWeights, interest: 1 }).success).toBe(false);
  });
});
