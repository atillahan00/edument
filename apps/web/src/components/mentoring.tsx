'use client';
import { useState } from 'react';
import { api, useData } from '../lib/api';
import { tr, percent, label, date } from '../locales/tr';
import { Action, Badge, Empty, LoadingError, Notice, Panel } from './ui';
function SharedStudent({ id }: { id: string }) {
  const source = useData(`students/${id}/shared`);
  return (
    <details>
      <summary>İzinli öğrenci gelişim bilgileri</summary>
      <LoadingError {...source} />
      <p>{source.data?.message}</p>
      {Object.entries(source.data?.fields || {}).map(([key, value]) => (
        <p key={key}>
          <strong>{tr.fields[key]}</strong>:{' '}
          {Array.isArray(value)
            ? value
                .map((v) => (typeof v === 'object' ? `${v.name}: ${v.level}/5 (öz değerlendirme)` : v))
                .join(', ')
            : String(value)}
        </p>
      ))}
    </details>
  );
}
export function Mentors({ matches = false }: { matches?: boolean }) {
  const source = useData(matches ? 'recommendations' : 'mentors');
  const [selected, setSelected] = useState('');
  const [note, setNote] = useState('');
  const rows = matches ? source.data?.results : source.data;
  return (
    <>
      <LoadingError {...source} />
      {matches && (
        <Notice>
          {source.data?.message ||
            'Öneriler tanımlı özelliklere göre uyumu puanlar. Nesnel bir “en iyi mentor” iddiası taşımaz.'}
        </Notice>
      )}
      {rows?.length ? (
        <div className="mentor-grid">
          {rows.map((m: any) => (
            <Panel key={m.id || m.userId}>
              <div className="mentor-top">
                <span className="avatar large">{m.name?.[0]}</span>
                <div>
                  <h2>{m.name}</h2>
                  <span className="badge positive">Kurum doğrulamalı mentor</span>
                </div>
              </div>
              {matches ? (
                <>
                  <div className="match-score">
                    {percent(m.score)}
                    <span>Mentor uyum puanı</span>
                  </div>
                  <p className="muted">
                    Model:{' '}
                    {m.model === 'weighted-v1'
                      ? 'Açıklanabilir ağırlıklı model (sürüm 1)'
                      : `Eğitilmiş model · ${m.model}`}
                  </p>
                  <details>
                    <summary>Bu mentor neden önerildi?</summary>
                    {m.explanation.map((e: string, i: number) => (
                      <p key={i}>{e}</p>
                    ))}
                  </details>
                </>
              ) : (
                <>
                  <p>{m.data.bio || 'Mentor kendini henüz tanıtmadı.'}</p>
                  <div className="tags">
                    {m.data.expertise?.map((e: string) => (
                      <span key={e}>{e}</span>
                    ))}
                  </div>
                  <p className="muted">
                    {m.data.experience} yıl deneyim · {label(m.data.mode)}
                  </p>
                </>
              )}
              <button className="button primary" onClick={() => setSelected(m.id || m.userId)}>
                Mentorluk isteği gönder
              </button>
              {selected === (m.id || m.userId) && (
                <div className="request-form">
                  <label>
                    Mentorluk hedefinizi kısaca açıklayın
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      minLength={5}
                      maxLength={1000}
                    />
                  </label>
                  {note.length >= 5 && (
                    <Action
                      path="connections"
                      body={{ mentorId: selected, note }}
                      onDone={() => {
                        setSelected('');
                        setNote('');
                        void source.reload();
                      }}
                    >
                      İsteği gönder
                    </Action>
                  )}
                  <p className="help">
                    Reşit olmayan öğrenciler için görüşmeler kurum onayından sonra açılır.
                  </p>
                </div>
              )}
            </Panel>
          ))}
        </div>
      ) : (
        !source.loading && <Empty>Henüz uygun, doğrulanmış mentor bulunmuyor.</Empty>
      )}
    </>
  );
}
export function Connections({ user }: { user: any }) {
  const source = useData<any[]>('connections');
  const [rating, setRating] = useState(5);
  const [progress, setProgress] = useState(50);
  return (
    <>
      <LoadingError {...source} />
      <Notice>
        Mentor kabulü, reşit olmayan öğrenci için tek başına mesajlaşma izni değildir. Kurum onayı gerekir.
      </Notice>
      {source.data?.length ? (
        source.data.map((c) => (
          <Panel key={c.id} title={`${c.studentName} · ${c.mentorName}`} action={<Badge state={c.state} />}>
            <p>{c.note}</p>
            {user.role === 'MENTOR' && c.state === 'APPROVED' && <SharedStudent id={c.studentId} />}
            <p className="muted">{date(c.createdAt)}</p>
            <div className="row wrap">
              {c.mentorId === user.id && c.state === 'PENDING' && (
                <>
                  <Action
                    path={`connections/${c.id}/action`}
                    body={{ action: 'ACCEPT' }}
                    onDone={source.reload}
                  >
                    Kabul et
                  </Action>
                  <Action
                    path={`connections/${c.id}/action`}
                    body={{ action: 'REJECT' }}
                    onDone={source.reload}
                  >
                    Reddet
                  </Action>
                </>
              )}
              {['ADMIN', 'VERIFIER'].includes(user.role) && c.state === 'MENTOR_ACCEPTED' && (
                <>
                  <Action
                    path={`connections/${c.id}/action`}
                    body={{ action: 'APPROVE' }}
                    onDone={source.reload}
                  >
                    Kurum onayı ver
                  </Action>
                  <Action
                    path={`connections/${c.id}/action`}
                    body={{ action: 'REJECT' }}
                    onDone={source.reload}
                  >
                    Reddet
                  </Action>
                </>
              )}
              {c.studentId === user.id && ['PENDING', 'MENTOR_ACCEPTED'].includes(c.state) && (
                <Action
                  confirm
                  path={`connections/${c.id}/action`}
                  body={{ action: 'CANCEL' }}
                  onDone={source.reload}
                >
                  İsteği iptal et
                </Action>
              )}
              {c.state === 'APPROVED' && (
                <Action
                  confirm
                  path={`connections/${c.id}/action`}
                  body={{ action: 'CLOSE' }}
                  onDone={source.reload}
                >
                  Mentorluğu tamamla ve kapat
                </Action>
              )}
            </div>
            {['APPROVED', 'CLOSED'].includes(c.state) && [c.studentId, c.mentorId].includes(user.id) && (
              <details>
                <summary>Mentorluk geri bildirimi</summary>
                <label>
                  Uyum ve fayda (1–5)
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                  />
                </label>
                <label>
                  Hedef ilerlemesi (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                  />
                </label>
                <Action
                  path={`connections/${c.id}/feedback`}
                  body={{ rating, progress }}
                  onDone={source.reload}
                >
                  Geri bildirimi kaydet
                </Action>
                <p className="muted">Geri bildirimler modeli kendiliğinden eğitmez.</p>
              </details>
            )}
          </Panel>
        ))
      ) : (
        <Empty>Henüz mentorluk isteği bulunmuyor.</Empty>
      )}
    </>
  );
}
export function Messages({ user }: { user: any }) {
  const connections = useData<any[]>('connections');
  const [selected, setSelected] = useState('');
  const messages = useData<any[]>(selected ? `messages/${selected}` : null);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const rows =
    connections.data?.filter((c) => c.conversation && [c.studentId, c.mentorId].includes(user.id)) || [];
  const current = rows.find((c) => c.conversation.id === selected);
  return (
    <>
      <LoadingError {...connections} />
      <div className="two-columns">
        <Panel title="Görüşmeleriniz">
          {rows.length ? (
            rows.map((c) => (
              <button
                className={'conversation-select ' + (selected === c.conversation.id ? 'selected' : '')}
                key={c.id}
                onClick={() => setSelected(c.conversation.id)}
              >
                <strong>{user.id === c.studentId ? c.mentorName : c.studentName}</strong>
                <Badge state={c.conversation.closed ? 'CLOSED' : c.state} />
              </button>
            ))
          ) : (
            <Empty>Görüşme için onaylı mentorluk gerekiyor.</Empty>
          )}
        </Panel>
        <Panel title="Güvenli görüşme">
          {selected ? (
            <>
              <LoadingError {...messages} />
              <div className="message-list">
                {[...(messages.data || [])].reverse().map((m) => (
                  <article key={m.id} className={'message ' + (m.senderId === user.id ? 'own' : '')}>
                    <p>{m.body}</p>
                    <small>
                      {date(m.createdAt)} ·{' '}
                      {new Date(m.createdAt).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {m.senderId === user.id && (m.readAt ? ' · Okundu' : ' · Gönderildi')}
                    </small>
                  </article>
                ))}
              </div>
              {!current?.conversation.closed && current?.state === 'APPROVED' && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                      await api(`messages/${selected}`, 'POST', { body });
                      setBody('');
                      await messages.reload();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Mesajınız
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      required
                      maxLength={4000}
                    />
                  </label>
                  <button disabled={busy} className="button primary">
                    Mesaj gönder
                  </button>
                </form>
              )}
              <button className="text-button" onClick={messages.reload}>
                Mesajları yenile
              </button>
              <details>
                <summary>Görüşmeyi bildir ve kapat</summary>
                <label>
                  Bildirim gerekçesi
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
                {reason.length >= 5 && (
                  <Action
                    confirm
                    path={`messages/${selected}/report`}
                    body={{ reason }}
                    onDone={connections.reload}
                  >
                    Kurum yönetimine bildir
                  </Action>
                )}
              </details>
            </>
          ) : (
            <Empty>Bir görüşme seçin.</Empty>
          )}
          {error && <Notice error>{error}</Notice>}
        </Panel>
      </div>
    </>
  );
}
