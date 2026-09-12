'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, useData } from '../lib/api';
import { tr, label, date } from '../locales/tr';
import { Action, Badge, Empty, LoadingError, Notice, Panel, Hash } from './ui';
export function Privacy() {
  const source = useData('privacy');
  const { register, reset, handleSubmit } = useForm<any>();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (source.data) reset(source.data.settings);
  }, [source.data, reset]);
  return (
    <>
      <LoadingError {...source} />
      <Panel title="Paylaşımın kontrolü sizde">
        <Notice>
          İzinlerinizi geri çektiğinizde gelecekteki paylaşım ve öneri kullanımı durur. Önceden blokzincire
          yazılmış özetler silinmez. İletişim bilgileriniz mentorlarla otomatik paylaşılmaz.
        </Notice>
        <form
          className="form-grid"
          onSubmit={handleSubmit(async (body) => {
            try {
              await api('privacy', 'PUT', body);
              setSaved(true);
              setError('');
            } catch (e) {
              setError((e as Error).message);
            }
          })}
        >
          {['profile', 'interests', 'skills', 'goals', 'achievements', 'city'].map((key) => (
            <label key={key}>
              {tr.fields[key]}
              <select {...register(key)}>
                {['PRIVATE', 'MENTORS_ONLY', 'INSTITUTION_ONLY', 'PUBLIC'].map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="check wide">
            <input type="checkbox" {...register('mentorSearch')} />
            Onaylı mentorların izinli gelişim bilgilerimi görmesine izin ver.
          </label>
          <label className="check wide">
            <input type="checkbox" {...register('publicTitle')} />
            Açık paylaşım izni verdiğimde doğrulama sayfasında başarı başlığını göster.
          </label>
          <div className="wide">
            <button className="button primary">Gizlilik ayarlarını kaydet</button>
            {saved && <Notice>Gizlilik ayarları kaydedildi.</Notice>}
            {error && <Notice error>{error}</Notice>}
          </div>
        </form>
      </Panel>
      <Panel title="Açık ve geri alınabilir izinler">
        {['MATCHING', 'PUBLIC_SHARE'].map((type) => {
          const latest = source.data?.consents.find((c: any) => c.type === type);
          return (
            <div className="list-row" key={type}>
              <div>
                <strong>
                  {type === 'MATCHING'
                    ? 'Profilimden mentor önerisi hesaplanması'
                    : 'QR doğrulamasında izinli bilgilerin açık paylaşımı'}
                </strong>
                <small>{latest?.granted ? 'İzin verildi' : 'İzin verilmedi'}</small>
              </div>
              <Action
                confirm={latest?.granted}
                path="privacy/consent"
                body={{ type, granted: !latest?.granted }}
                onDone={source.reload}
              >
                {latest?.granted ? 'İzni geri çek' : 'İzin ver'}
              </Action>
            </div>
          );
        })}
        <details>
          <summary>İzin geçmişi</summary>
          {source.data?.consents.map((c: any) => (
            <p key={c.id}>
              {label(c.type)} · {c.granted ? 'Verildi' : 'Geri çekildi'} · {date(c.createdAt)} · Politika{' '}
              {c.policyVersion}
            </p>
          ))}
        </details>
      </Panel>
    </>
  );
}
function UserRow({ user, institutions, reload }: { user: any; institutions: any[]; reload: () => void }) {
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.active);
  const [institution, setInstitution] = useState('');
  return (
    <div className="user-row">
      <div>
        <strong>{user.name}</strong>
        <small>{user.email}</small>
        <small>{user.memberships.map((m: any) => m.institution.name).join(', ') || 'Kurum atanmamış'}</small>
      </div>
      <label>
        Rol
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {['STUDENT', 'MENTOR', 'VERIFIER', 'ADMIN'].map((r) => (
            <option key={r} value={r}>
              {label(r)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Kurum ekle
        <select value={institution} onChange={(e) => setInstitution(e.target.value)}>
          <option value="">Mevcut üyeliği koru</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Etkin
      </label>
      <Action
        path={`users/${user.id}`}
        method="PUT"
        body={{ role, active, ...(institution ? { institutionId: institution } : {}) }}
        onDone={reload}
      >
        Kaydet
      </Action>
    </div>
  );
}
export function Users() {
  const source = useData<any[]>('users');
  const institutions = useData<any[]>('institutions');
  return (
    <Panel title="Hesap başvuruları ve yetkilendirme">
      <p className="muted">
        Rol değişiklikleri etkin oturumları kapatır. Doğrulayıcıları yalnızca yetkili oldukları kurumlara
        bağlayın.
      </p>
      <LoadingError {...source} />
      {source.data?.map((user) => (
        <UserRow key={user.id} user={user} institutions={institutions.data || []} reload={source.reload} />
      ))}
    </Panel>
  );
}
export function Institutions() {
  const source = useData<any[]>('institutions');
  const [name, setName] = useState('');
  return (
    <Panel title="Kurumlar">
      <LoadingError {...source} />
      <label>
        Kurum adı
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
      </label>
      {name.trim().length >= 3 && (
        <Action
          path="institutions"
          body={{ name }}
          onDone={() => {
            setName('');
            void source.reload();
          }}
        >
          Kurum oluştur
        </Action>
      )}
      {source.data?.map((i) => (
        <div className="list-row" key={i.id}>
          <strong>{i.name}</strong>
          <small>{date(i.createdAt)}</small>
        </div>
      ))}
    </Panel>
  );
}
export function MentorQueue() {
  const source = useData<any[]>('verifier/mentors');
  return (
    <Panel title="Mentor uzmanlık incelemeleri">
      <LoadingError {...source} />
      {source.data?.length ? (
        source.data.map((m) => (
          <div className="list-row" key={m.userId}>
            <div>
              <strong>{m.user.name}</strong>
              <p>
                {m.data.expertise?.join(', ')} · {m.data.experience} yıl deneyim
              </p>
              <p>{m.data.bio}</p>
              <Badge state={m.verified ? 'APPROVED' : 'PENDING'} />
            </div>
            <Action
              path={`verifier/mentors/${m.userId}`}
              body={{ verified: !m.verified }}
              onDone={source.reload}
            >
              {m.verified ? 'Doğrulamayı kaldır' : 'Mentoru doğrula'}
            </Action>
          </div>
        ))
      ) : (
        <Empty>İncelenecek mentor profili bulunmuyor.</Empty>
      )}
    </Panel>
  );
}
export function Network() {
  const source = useData('network');
  return (
    <>
      <LoadingError {...source} />
      {source.data?.warning && <Notice>{source.data.warning}</Notice>}
      <Panel
        title="Yapılandırılmış blokzincir ağı"
        action={
          <button className="button secondary" onClick={source.reload}>
            Durumu yenile
          </button>
        }
      >
        {source.data && (
          <>
            <div className="stats">
              <div className="stat">
                <span>
                  Ağ modu<strong>{source.data.mode === 'multi' ? 'Çok düğüm' : 'Tek düğüm'}</strong>
                </span>
              </div>
              <div className="stat">
                <span>
                  Doğrulayıcı sayısı<strong>{source.data.validators || 'Saptanamadı'}</strong>
                </span>
              </div>
              <div className="stat">
                <span>
                  Ağ kimliği<strong>{source.data.chainId}</strong>
                </span>
              </div>
            </div>
            {source.data.nodes.map((n: any) => (
              <div className="node-card" key={n.name}>
                <div className="row between">
                  <h3>{n.name}</h3>
                  <Badge state={n.online ? 'ACTIVE' : 'ERROR'} />
                </div>
                <p>{n.url}</p>
                <dl>
                  <dt>Son blok</dt>
                  <dd>{n.block?.toLocaleString('tr-TR') ?? 'Saptanamadı'}</dd>
                  <dt>Eş düğüm</dt>
                  <dd>{n.peers ?? 'Saptanamadı'}</dd>
                  <dt>Yanıt süresi</dt>
                  <dd>{n.latencyMs.toLocaleString('tr-TR')} ms</dd>
                  <dt>Son kontrol</dt>
                  <dd>{new Date(n.checkedAt).toLocaleString('tr-TR')}</dd>
                </dl>
                {n.error && <Notice error>{n.error}</Notice>}
              </div>
            ))}
          </>
        )}
      </Panel>
    </>
  );
}
export function Jobs() {
  const source = useData<any[]>('blockchain/jobs');
  return (
    <Panel
      title="Blokzincir işlem kuyruğu"
      action={
        <button onClick={source.reload} className="button secondary">
          Yenile
        </button>
      }
    >
      <LoadingError {...source} />
      {source.data?.length ? (
        source.data.map((j) => (
          <div className="version" key={j.id}>
            <div className="row between">
              <strong>{j.operation === 'REVOKE' ? 'Geçersiz kılma' : 'Kayıt sabitleme'}</strong>
              <Badge state={j.status} />
            </div>
            <p>
              {j.attempts} deneme · {date(j.createdAt)}
            </p>
            {j.error && <Notice error>{j.error}</Notice>}
            {j.transactions.map((t: any) => (
              <Hash key={t.hash} value={t.hash} />
            ))}
            {j.status === 'FAILED' && (
              <Action path={`blockchain/jobs/${j.id}/retry`} onDone={source.reload}>
                Güvenle yeniden dene
              </Action>
            )}
          </div>
        ))
      ) : (
        <Empty>Henüz blokzincir işi bulunmuyor.</Empty>
      )}
    </Panel>
  );
}
export function Audit() {
  const source = useData<any[]>('audit');
  return (
    <Panel title="Uygulama denetim geçmişi">
      <LoadingError {...source} />
      {source.data?.length ? (
        source.data.map((a) => (
          <div className="list-row" key={a.id}>
            <div>
              <strong>{tr.actions[a.action] || 'Sistem işlemi'}</strong>
              <small>{new Date(a.createdAt).toLocaleString('tr-TR')}</small>
            </div>
            <code>{a.objectId?.slice(0, 8)}</code>
          </div>
        ))
      ) : (
        <Empty>Denetim kaydı bulunmuyor.</Empty>
      )}
    </Panel>
  );
}
export function AdminHome() {
  const reports = useData<any[]>('reports');
  const weights = useData<any>('settings/weights');
  const [values, setValues] = useState<any>();
  useEffect(() => {
    if (weights.data) setValues(weights.data);
  }, [weights.data]);
  return (
    <>
      <div className="mentor-grid">
        {[
          '/admin/users',
          '/admin/institutions',
          '/admin/network',
          '/admin/blockchain-jobs',
          '/admin/audit',
          '/research',
        ].map((path) => (
          <Link className="panel admin-link" href={path} key={path}>
            <h2>{tr.pages[path]}</h2>
            <span>Yönetim alanını aç →</span>
          </Link>
        ))}
      </div>
      <Panel title="Mentor öneri ağırlıkları">
        <p className="muted">Tüm ağırlıklar 0–1 arasında olmalı ve toplamları 1 olmalıdır.</p>
        {values && (
          <div className="form-grid">
            {Object.keys(values).map((k) => (
              <label key={k}>
                {tr.fields[k] || k}
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={values[k]}
                  onChange={(e) => setValues({ ...values, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
            <Action path="settings/weights" method="PUT" body={values} onDone={weights.reload}>
              Ağırlıkları kaydet
            </Action>
          </div>
        )}
      </Panel>
      <Panel title="Görüşme güvenlik bildirimleri">
        <LoadingError {...reports} />
        {reports.data?.length ? (
          reports.data.map((r) => (
            <div className="list-row" key={r.id}>
              <p>{r.reason}</p>
              <small>{date(r.createdAt)} · Görüşme kapatıldı</small>
            </div>
          ))
        ) : (
          <Empty>Henüz güvenlik bildirimi bulunmuyor.</Empty>
        )}
      </Panel>
    </>
  );
}
export function Research() {
  const source = useData<any[]>('research');
  const [kind, setKind] = useState('INTEGRITY');
  const [samples, setSamples] = useState(3);
  const [seed, setSeed] = useState(2204);
  return (
    <>
      <Panel title="Tekrarlanabilir deney çalıştır">
        <Notice>
          Gerçek blokzincir deneyleri yalnızca yapılandırılmış ağda çalışır ve kalıcı sentetik kanıtlar
          oluşturur. Ağ kullanılamıyorsa sonuç üretilmez.
        </Notice>
        <div className="form-grid">
          <label>
            Deney türü
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {['INTEGRITY', 'DOCUMENT', 'VERSIONS', 'OVERHEAD', 'MULTI', 'MATCHING'].map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Örnek sayısı
            <input
              type="number"
              min={1}
              max={10}
              value={samples}
              onChange={(e) => setSamples(Number(e.target.value))}
            />
          </label>
          <label>
            Rastgelelik tohumu
            <input type="number" min={0} value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
          </label>
          <div>
            <Action confirm path="research" body={{ kind, samples, seed }} onDone={source.reload}>
              Deneyi çalıştır
            </Action>
          </div>
        </div>
      </Panel>
      <LoadingError {...source} />
      {source.data?.length ? (
        source.data.map((e) => (
          <Panel key={e.id} title={label(e.kind)}>
            <p>
              {date(e.createdAt)} · Tohum {e.config.seed} · {e.config.samples} örnek ·{' '}
              {e.config.mode === 'multi' ? 'Çok düğümlü ağ' : 'Tek düğümlü ağ'}
            </p>
            {e.result.blockchainMs && (
              <div className="stats">
                {[
                  ['Veritabanı ortalaması', e.result.databaseMs.mean],
                  ['Blokzincir onay ortalaması', e.result.blockchainMs.mean],
                  ['Blokzincir p95', e.result.blockchainMs.p95],
                ].map(([name, value]: any) => (
                  <div className="stat" key={name}>
                    <span>
                      {name}
                      <strong>{value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ms</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {e.result.metrics && (
              <table>
                <thead>
                  <tr>
                    <th>Yöntem</th>
                    <th>İlk 5 doğruluğu</th>
                    <th>Duyarlılık</th>
                    <th>İlk uygun sıra (MRR)</th>
                    <th>Sıralama kalitesi (NDCG)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(e.result.metrics).map(([key, m]: any) => (
                    <tr key={key}>
                      <td>{key === 'baseline' ? 'Yalnızca ilgi' : 'Çok özellikli'}</td>
                      {['precision', 'recall', 'mrr', 'ndcg'].map((k) => (
                        <td key={k}>{Number(m[k]).toLocaleString('tr-TR', { maximumFractionDigits: 3 })}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p>{e.result.warning}</p>
            {e.result.proofs?.map((p: any) => (
              <div className="version" key={p.recordId}>
                <p>
                  Özgün kayıt: {p.originalValid ? 'Doğrulandı' : 'Eşleşmedi'} · Değişiklik:{' '}
                  {p.modifiedDetected ? 'Algılandı' : 'Algılanmadı'}
                </p>
                {p.documentModificationDetected !== undefined && (
                  <p>Belge değişikliği: {p.documentModificationDetected ? 'Algılandı' : 'Algılanmadı'}</p>
                )}
                <Hash value={p.transactionHash} />
              </div>
            ))}
            <div className="row">
              <a className="button secondary" href={`/api/v1/research/${e.id}/export?format=csv`}>
                CSV indir
              </a>
              <a className="button secondary" href={`/api/v1/research/${e.id}/export?format=json`}>
                JSON indir
              </a>
            </div>
          </Panel>
        ))
      ) : (
        <Empty>Henüz deney çalıştırılmadı. Hiçbir sonuç önceden doldurulmaz.</Empty>
      )}
    </>
  );
}
