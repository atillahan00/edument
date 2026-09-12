export function visibleStudentFields(
  snapshot: Record<string, unknown>,
  settings: Record<string, unknown>,
  audience: 'MENTOR' | 'INSTITUTION',
) {
  const result: Record<string, unknown> = {};
  const allowed = audience === 'MENTOR' ? ['MENTORS_ONLY', 'PUBLIC'] : ['INSTITUTION_ONLY', 'PUBLIC'];
  for (const key of ['bio', 'interests', 'skills', 'goals', 'city'])
    if (allowed.includes(String(settings[key === 'bio' ? 'profile' : key]))) result[key] = snapshot[key];
  return result;
}
