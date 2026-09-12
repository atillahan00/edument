import { describe, it, expect } from 'vitest';
import { visibleStudentFields } from '../apps/api/src/privacy-policy';
describe('Field-level disclosure', () => {
  const snapshot = {
    bio: 'private',
    interests: ['robotik'],
    skills: [{ name: 'Python', level: 2 }],
    goals: ['proje'],
    city: 'şehir',
    email: 'never@example.invalid',
  };
  it('defaults to no disclosure even to an approved mentor', () =>
    expect(visibleStudentFields(snapshot, {}, 'MENTOR')).toEqual({}));
  it('only discloses explicitly permitted fields to matching audience', () =>
    expect(
      visibleStudentFields(
        snapshot,
        { interests: 'MENTORS_ONLY', skills: 'INSTITUTION_ONLY', profile: 'PRIVATE', email: 'PUBLIC' },
        'MENTOR',
      ),
    ).toEqual({ interests: ['robotik'] }));
  it('does not treat a verifier as a mentor', () =>
    expect(
      visibleStudentFields(
        snapshot,
        { interests: 'MENTORS_ONLY', skills: 'INSTITUTION_ONLY' },
        'INSTITUTION',
      ),
    ).toEqual({ skills: snapshot.skills }));
});
