'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { QRCodeSVG } from 'qrcode.react';
import { FilePicker } from './file-picker';
import { api, useData } from '../lib/api';
import { tr, date, label } from '../locales/tr';
import { Action, Badge, Empty, LoadingError, Notice, Panel, Version, Hash } from './ui';
export function AchievementList({ verifier = false }: { verifier?: boolean }) {
  const source = useData<any[]>('achievements');
  return (
    <Panel
      title={verifier ? 'Kurumunuzdaki başvurular' : 'Başarı kayıtlarınız'}
      action={
        !verifier && (
          <Link className="button primary" href="/achievements/new">
            Yeni başarı ekle
          </Link>
        )
      }
    >
      <LoadingError {...source} />
      {source.data?.length ? (
        source.data.map((a) => (
          <Link className="list-row" key={a.id} href={`${verifier ? '/verifier' : ''}/achievements/${a.id}`}>
            <div>
              <strong>{a.versions[0]?.snapshot.title}</strong>
              <small>
                {a.institution.name} · {date(a.createdAt)}
              </small>
            </div>
            <div className="row">
              <Badge state={a.status} />
              {a.versions[0]?.anchor && <Badge state={a.versions[0].anchor.status} />}
            </div>
          </Link>
        ))
      ) : (
        <Empty>
          {verifier ? 'İncelenecek başarı başvurusu bulunmuyor.' : 'Henüz başarı kaydı eklenmedi.'}
        </Empty>
      )}
    </Panel>
  );
}
export function AchievementForm({ id, initial }: { id?: string; initial?: any }) {
  const institutions = useData<any[]>('institutions');
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<any>({ defaultValues: initial });
  const [error, setError] = useState('');
  return (
    <Panel title={id ? 'Düzeltme için yeni sürüm' : 'Başarınızı belgeleyin'}>
      <p className="muted">
        PDF, PNG veya JPEG · en fazla 10 MB. Belge özel depoda tutulur; blokzincire yalnızca özeti yazılır.
      </p>
      <form
        className="form-grid"
        onSubmit={handleSubmit(async (values) => {
          setError('');
          const form = new FormData();
          form.append('file', values.file[0]);
          form.append(
            'data',
            JSON.stringify({
              title: values.title,
              description: values.description,
              category: values.category,
              date: values.date,
              institutionId: values.institutionId,
            }),
          );
          try {
            const result = await api(id ? `achievements/${id}/versions` : 'achievements', 'POST', form);
            window.location.assign(`/achievements/${result.id}`);
          } catch (e) {
            setError((e as Error).message);
          }
        })}
      >
        <label className="wide">
          Başarı başlığı
          <input {...register('title')} required maxLength={200} />
        </label>
        <label>
          Kategori
          <input {...register('category')} required placeholder="Proje, yarışma, sertifika…" />
        </label>
        <label>
          Etkinlik tarihi
          <input type="date" {...register('date')} required />
        </label>
        <label className="wide">
          Açıklama
          <textarea {...register('description')} required minLength={10} maxLength={4000} rows={4} />
        </label>
        <label>
          Doğrulayacak kurum
          <select {...register('institutionId')} required>
            <option value="">Kurum seçin</option>
            {institutions.data?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kanıt belgesi
          <FilePicker
            aria-label="Kanıt belgesi"
            accept="application/pdf,image/png,image/jpeg"
            {...register('file')}
            required
          />
        </label>
        <div className="wide">
          {institutions.data?.length === 0 && (
            <Notice error>Başarı göndermek için yöneticinizin sizi bir kuruma bağlaması gerekiyor.</Notice>
          )}
          {error && <Notice error>{error}</Notice>}
          <button className="button primary" disabled={isSubmitting || !institutions.data?.length}>
            {isSubmitting ? tr.saving : 'Kurum doğrulamasına gönder'}
          </button>
        </div>
      </form>
    </Panel>
  );
}
export function AchievementDetail({ id, verifier = false }: { id: string; verifier?: boolean }) {
  const source = useData(`achievements/${id}`);
  const [note, setNote] = useState('');
  const [correction, setCorrection] = useState(false);
  const [fileResult, setFileResult] = useState<any>();
  const [error, setError] = useState('');
  const v = source.data?.versions[0];
  return (
    <>
      <LoadingError {...source} />
      {source.data && (
        <>
          <Panel title={v.snapshot.title} action={<Badge state={source.data.status} />}>
            <p>{v.snapshot.description}</p>
            <p className="muted">
              {source.data.institution.name} · {v.snapshot.category} · {date(v.snapshot.date)}
            </p>
            <Notice>{tr.proof}</Notice>
            <div className="row wrap">
              <a className="button secondary" href={`/api/v1/records/${v.id}/evidence`}>
                Kanıt belgesini indir
              </a>
              {!verifier && source.data.status !== 'REVOKED' && (
                <button className="button secondary" onClick={() => setCorrection(!correction)}>
                  Düzeltme sürümü oluştur
                </button>
              )}
            </div>
            {verifier && (
              <div className="review-form">
                <label>
                  Doğrulama gerekçesi
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    minLength={5}
                    maxLength={2000}
                  />
                </label>
                {note.length >= 5 && (
                  <div className="row wrap">
                    {source.data.status === 'PENDING' &&
                      ['APPROVED', 'REJECTED', 'REVISION_REQUIRED'].map((decision) => (
                        <Action
                          key={decision}
                          path={`verifications/${id}`}
                          body={{ decision, note, versionId: v.id }}
                          onDone={source.reload}
                        >
                          {label(decision)}
                        </Action>
                      ))}
                    {source.data.status === 'APPROVED' && (
                      <Action
                        confirm
                        path={`verifications/${id}/revoke`}
                        body={{ note }}
                        onDone={source.reload}
                      >
                        Geçersiz kıl
                      </Action>
                    )}
                  </div>
                )}
              </div>
            )}
          </Panel>
          {correction && <AchievementForm id={id} initial={v.snapshot} />}
          <div className="two-columns">
            <Panel title="Belge bütünlüğünü karşılaştır">
              <p>
                Seçtiğiniz dosya saklanmaz. Bayt özeti, onaylanan sürümün blokzincir özetiyle karşılaştırılır.
              </p>
              <label>
                Karşılaştırılacak dosya
                <FilePicker
                  aria-label="Karşılaştırılacak dosya"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const form = new FormData();
                    form.append('file', file);
                    try {
                      setFileResult(await api(`records/${v.id}/verify-document`, 'POST', form));
                      setError('');
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              </label>
              {fileResult && (
                <>
                  <Badge state={fileResult.state} />
                  <p>Seçilen belgenin özeti</p>
                  <Hash value={fileResult.currentHash} />
                </>
              )}
              {error && <Notice error>{error}</Notice>}
            </Panel>
            <Panel title="QR ile doğrulama">
              {v.anchor?.status === 'CONFIRMED' ? (
                <>
                  <QRCodeSVG
                    value={`${window.location.origin}/verify/${v.anchor.publicToken}`}
                    size={144}
                    title="Belge doğrulama bağlantısı"
                  />
                  <p>
                    <Link href={`/verify/${v.anchor.publicToken}`}>Doğrulama sayfasını aç →</Link>
                  </p>
                  <p className="muted">
                    Görünecek bilgiler gizlilik ayarlarınıza ve açık paylaşım izninize bağlıdır.
                  </p>
                </>
              ) : (
                <Empty>Blokzincir onayından sonra QR oluşacak.</Empty>
              )}
            </Panel>
          </div>
          <Panel title="Kurum kararları">
            {source.data.decisions?.map((d: any) => (
              <div className="list-row" key={d.id}>
                <div>
                  <Badge state={d.decision} />
                  <p>{d.note}</p>
                  <small>{date(d.createdAt)}</small>
                </div>
              </div>
            ))}
          </Panel>
          <h2>Sürüm ve blokzincir geçmişi</h2>
          {source.data.versions.map((version: any, i: number) => (
            <Version key={version.id} version={version} previous={source.data.versions[i + 1]} />
          ))}
        </>
      )}
    </>
  );
}
export function PublicVerify({ token }: { token: string }) {
  const source = useData(`public/verify/${token}`);
  return (
    <main className="public-page">
      <Link className="brand" href="/login">
        <span className="brand-icon">B</span>BILSEM-Chain
      </Link>
      <Panel title="Belge Doğrulama">
        <LoadingError {...source} />
        {source.data && (
          <>
            <Badge state={source.data.state} />
            <h2>{source.data.title || 'BILSEM-Chain doğrulama kaydı'}</h2>
            <p>
              {source.data.state === 'VALID'
                ? 'Bu doğrulama bağlantısına ait dijital kaydın bütünlüğü doğrulandı.'
                : source.data.state === 'REVOKED'
                  ? 'Bu kayıt geçersiz kılınmıştır.'
                  : 'Doğrulama durumu yukarıda gösterilmektedir.'}
            </p>
            <p className="muted">{source.data.message}</p>
            {source.data.transactions?.map((t: any) => (
              <Hash key={t.hash} value={t.hash} />
            ))}
          </>
        )}
      </Panel>
      <p>Kişisel bilgiler yalnızca izin verilen kapsamda paylaşılır.</p>
    </main>
  );
}
