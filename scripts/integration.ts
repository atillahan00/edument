import '../apps/api/src/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Database } from '../apps/api/src/db';
import { StorageService } from '../apps/api/src/storage';
import { privateDefaults } from '../packages/shared/src';
const db = new Database();
const storage = new StorageService();
const base = 'http://127.0.0.1:3001/api/v1/';
const runId = randomUUID().slice(0, 8);
const password = 'Integration9!' + randomUUID();
const ids: string[] = [];
let institutionId = '';
const evidenceKeys: string[] = [];
const proofs: any[] = [];
async function call(path: string, method = 'GET', body?: any, cookie = '', expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
  return { result, cookie: response.headers.get('set-cookie')?.split(';')[0] || cookie };
}
async function post(path: string, body: any, cookie: string, expected = 201) {
  return call(path, 'POST', body, cookie, expected);
}
async function waitAnchor(versionId: string, cookie: string) {
  for (let i = 0; i < 40; i++) {
    const { result } = await call(`records/${versionId}/integrity`, 'GET', undefined, cookie);
    if (result.state === 'VALID') return;
    assert.notEqual(result.state, 'ERROR', 'Anchor failed');
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Gerçek blokzincir onayı zaman aşımı.');
}
async function main() {
  const admin = await post(
    'auth/login',
    { email: process.env.BOOTSTRAP_ADMIN_EMAIL, password: process.env.BOOTSTRAP_ADMIN_PASSWORD },
    '',
  );
  institutionId = (await post('institutions', { name: `Yalıtılmış test kurumu ${runId}` }, admin.cookie))
    .result.id;
  const cookies: Record<string, string> = {};
  for (const role of ['STUDENT', 'MENTOR', 'VERIFIER'] as const) {
    const email = `test-${role.toLowerCase()}-${runId}@example.invalid`;
    await post(
      'auth/register',
      {
        name: `SENTETİK TEST ${role}`,
        email,
        password,
        role: role === 'STUDENT' ? 'STUDENT' : 'MENTOR',
        minor: role === 'STUDENT',
        consent: true,
      },
      '',
    );
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    ids.push(user.id);
    await call(`users/${user.id}`, 'PUT', { role, active: true, institutionId }, admin.cookie);
    cookies[role] = (await post('auth/login', { email, password }, '')).cookie;
  }
  const [studentId, mentorId] = ids;
  await call('users', 'GET', undefined, cookies.STUDENT, 403);
  const profile = {
    bio: 'Sentetik deney profili',
    interests: ['robotik'],
    skills: [{ name: 'Python', level: 2 }],
    goals: ['Python'],
    availability: ['Pazartesi 17:00'],
    languages: ['Türkçe'],
    mode: 'ONLINE',
    city: '',
  };
  const v1 = (await post('students/profile', profile, cookies.STUDENT)).result;
  await waitAnchor(v1.id, cookies.STUDENT);
  const v2 = (
    await post('students/profile', { ...profile, skills: [{ name: 'Python', level: 4 }] }, cookies.STUDENT)
  ).result;
  await waitAnchor(v2.id, cookies.STUDENT);
  const history = (await call('students/history', 'GET', undefined, cookies.STUDENT)).result;
  assert.equal(history.length, 2);
  assert.equal(history[1].snapshot.skills[0].level, 2);
  assert.equal(history[0].version, 2);
  await call(`records/${v1.id}/integrity`, 'GET', undefined, cookies.MENTOR, 404);
  for (const v of history)
    proofs.push({
      kind: 'PROFILE',
      version: v.version,
      transaction: v.anchor.transactions[0].hash,
      block: v.anchor.transactions[0].blockNumber,
    });
  // Reprocessing a confirmed outbox must not create another transaction.
  const before = await db.blockchainTransaction.count({
    where: { anchor: { version: { ownerId: studentId } } },
  });
  await new Promise((r) => setTimeout(r, 3000));
  assert.equal(
    await db.blockchainTransaction.count({ where: { anchor: { version: { ownerId: studentId } } } }),
    before,
  );
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'test.pdf');
  form.append(
    'data',
    JSON.stringify({
      title: 'SENTETİK test başarısı',
      description: 'Bu kayıt yalnızca otomatik kabul testi içindir.',
      category: 'Araştırma',
      date: '2026-09-12',
      institutionId,
    }),
  );
  const achievement = (await post('achievements', form, cookies.STUDENT)).result;
  const version = achievement.version;
  evidenceKeys.push(
    (await db.achievementEvidence.findUniqueOrThrow({ where: { versionId: version.id } })).objectKey,
  );
  await post(
    `verifications/${achievement.id}`,
    { decision: 'APPROVED', note: 'Yetkisiz deneme', versionId: version.id },
    cookies.STUDENT,
    403,
  );
  await post(
    `verifications/${achievement.id}`,
    { decision: 'APPROVED', note: 'Sentetik test belgesi kontrol edildi.', versionId: version.id },
    cookies.VERIFIER,
  );
  await waitAnchor(version.id, cookies.STUDENT);
  for (const changed of [false, true]) {
    const bytes = Buffer.from(pdf);
    if (changed) bytes[20] ^= 1;
    const file = new FormData();
    file.append('file', new Blob([bytes], { type: 'application/pdf' }), 'test.pdf');
    const result = (await post(`records/${version.id}/verify-document`, file, cookies.STUDENT)).result;
    assert.equal(result.state, changed ? 'MISMATCH' : 'MATCH');
  }
  const detail = (await call(`achievements/${achievement.id}`, 'GET', undefined, cookies.STUDENT)).result;
  const anchor = detail.versions[0].anchor;
  proofs.push({
    kind: 'ACHIEVEMENT',
    transaction: anchor.transactions[0].hash,
    block: anchor.transactions[0].blockNumber,
  });
  const publicResult = (await call(`public/verify/${anchor.publicToken}`)).result;
  assert.equal(publicResult.state, 'VALID');
  assert.equal(publicResult.title, undefined);
  assert.equal(publicResult.transactions, undefined);
  await call(
    'privacy',
    'PUT',
    { ...privateDefaults, achievements: 'PUBLIC', publicTitle: true },
    cookies.STUDENT,
  );
  await post('privacy/consent', { type: 'PUBLIC_SHARE', granted: true }, cookies.STUDENT);
  assert.equal((await call(`public/verify/${anchor.publicToken}`)).result.title, 'SENTETİK test başarısı');
  await post('privacy/consent', { type: 'PUBLIC_SHARE', granted: false }, cookies.STUDENT);
  assert.equal((await call(`public/verify/${anchor.publicToken}`)).result.title, undefined);
  await call(
    'mentors/profile',
    'PUT',
    { ...profile, expertise: ['robotik', 'Python'], experience: 5, capacity: 3 },
    cookies.MENTOR,
  );
  await post(`verifier/mentors/${mentorId}`, { verified: true }, cookies.VERIFIER);
  await call('recommendations', 'GET', undefined, cookies.STUDENT, 403);
  await post('privacy/consent', { type: 'MATCHING', granted: true }, cookies.STUDENT);
  const recommendations = (await call('recommendations', 'GET', undefined, cookies.STUDENT)).result;
  const match = recommendations.results.find((m: any) => m.id === mentorId);
  assert.ok(match && match.score > 0);
  assert.ok(match.explanation.length);
  const connection = (
    await post('connections', { mentorId, note: 'Sentetik mentorluk hedefi' }, cookies.STUDENT)
  ).result;
  await post(`connections/${connection.id}/action`, { action: 'ACCEPT' }, cookies.MENTOR);
  assert.equal(
    (await db.mentorConnectionRequest.findUniqueOrThrow({ where: { id: connection.id } })).state,
    'MENTOR_ACCEPTED',
  );
  assert.equal(await db.conversation.count({ where: { connectionId: connection.id } }), 0);
  await post(`connections/${connection.id}/action`, { action: 'APPROVE' }, cookies.STUDENT, 403);
  await post(`connections/${connection.id}/action`, { action: 'APPROVE' }, cookies.VERIFIER);
  const conversation = await db.conversation.findUniqueOrThrow({ where: { connectionId: connection.id } });
  assert.deepEqual(
    (await call(`students/${studentId}/shared`, 'GET', undefined, cookies.MENTOR)).result.fields,
    {},
  );
  await call(
    'privacy',
    'PUT',
    { ...privateDefaults, mentorSearch: true, skills: 'MENTORS_ONLY' },
    cookies.STUDENT,
  );
  const shared = (await call(`students/${studentId}/shared`, 'GET', undefined, cookies.MENTOR)).result.fields;
  assert.deepEqual(Object.keys(shared), ['skills']);
  await call('privacy', 'PUT', privateDefaults, cookies.STUDENT);
  assert.deepEqual(
    (await call(`students/${studentId}/shared`, 'GET', undefined, cookies.MENTOR)).result.fields,
    {},
  );
  await post(`messages/${conversation.id}`, { body: 'Sentetik güvenli görüşme testi' }, cookies.STUDENT);
  assert.equal(
    (await call(`messages/${conversation.id}`, 'GET', undefined, cookies.MENTOR)).result.length,
    1,
  );
  await call(`messages/${conversation.id}`, 'GET', undefined, cookies.VERIFIER, 404);
  await post(
    `messages/${conversation.id}/report`,
    { reason: 'Otomatik koruyucu kapatma testi' },
    cookies.STUDENT,
  );
  await post(`messages/${conversation.id}`, { body: 'Kapalı görüşmeye yazma' }, cookies.MENTOR, 403);
  await post('privacy/consent', { type: 'MATCHING', granted: false }, cookies.STUDENT);
  await call('recommendations', 'GET', undefined, cookies.STUDENT, 403);
  const network = (await call('network', 'GET', undefined, admin.cookie)).result;
  assert.equal(network.mode, 'single');
  assert.equal(network.validators, 1);
  await post('auth/logout', {}, cookies.STUDENT);
  await call('auth/me', 'GET', undefined, cookies.STUDENT, 401);
  fs.mkdirSync('docs/evidence', { recursive: true });
  fs.writeFileSync(
    'docs/evidence/integration.json',
    JSON.stringify(
      {
        at: new Date().toISOString(),
        besu: true,
        mode: 'single',
        checks: [
          'RBAC',
          'immutable-profile-v1-v2',
          'real-outbox-transactions',
          'outbox-idempotency',
          'achievement-approval',
          'document-byte-match-and-mismatch',
          'private-QR',
          'real-matcher',
          'minor-institution-approval',
          'participant-only-messaging',
          'report-closes-conversation',
          'consent-withdrawal',
          'logout-invalidation',
        ],
        proofs,
      },
      null,
      2,
    ),
  );
  console.log('PASS: Gerçek Besu, PostgreSQL, MinIO, API ve matcher kabul senaryosu.');
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const key of evidenceKeys) await storage.remove(key).catch(() => {});
    await db.mentorConnectionRequest.deleteMany({
      where: { OR: [{ studentId: { in: ids } }, { mentorId: { in: ids } }] },
    });
    await db.mentorRecommendation.deleteMany({ where: { studentId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    if (institutionId) await db.institution.delete({ where: { id: institutionId } });
    await db.$disconnect();
    console.log(
      'Sentetik kabul testi kullanıcıları ve özel belgeleri kaldırıldı. Blokzincir kanıtları kalır.',
    );
  });
