'use client';
import { useState, type ReactNode } from 'react';
import { CheckCircle2, Clock3, RefreshCw } from 'lucide-react';
import { tr, label, date } from '../locales/tr';
import { api } from '../lib/api';
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={'notice ' + (error ? 'error' : '')} role={error ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
export function Empty({ children = tr.empty }: { children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{children}</h3>
    </div>
  );
}
export function Badge({ state }: { state: string }) {
  return (
    <span
      className={
        'badge ' +
        (['VALID', 'CONFIRMED', 'APPROVED', 'MATCH'].includes(state)
          ? 'positive'
          : ['FAILED', 'REVOKED', 'MISMATCH', 'REJECTED', 'ERROR'].includes(state)
            ? 'negative'
            : '')
      }
    >
      <span aria-hidden="true">
        {['VALID', 'CONFIRMED', 'APPROVED', 'MATCH'].includes(state) ? (
          <CheckCircle2 size={13} />
        ) : (
          <Clock3 size={13} />
        )}
      </span>
      {label(state)}
    </span>
  );
}
export function Panel({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      {title && (
        <div className="panel-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}
export function Action({
  path,
  body,
  method = 'POST',
  children,
  onDone,
  confirm = false,
}: {
  path: string;
  body?: unknown;
  method?: string;
  children: ReactNode;
  onDone?: () => void;
  confirm?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm('Bu işlemi gerçekleştirmek istediğinize emin misiniz?')) return;
          setBusy(true);
          setError('');
          try {
            await api(path, method, body);
            onDone?.();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? tr.saving : children}
      </button>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
export function LoadingError({
  loading,
  error,
  reload,
}: {
  loading: boolean;
  error: string;
  reload: () => void;
}) {
  return (
    <>
      {loading && <p role="status">{tr.loading}</p>}
      {error && (
        <Notice error>
          {error}{' '}
          <button onClick={reload} className="text-button">
            <RefreshCw size={14} /> Yeniden dene
          </button>
        </Notice>
      )}
    </>
  );
}
export function Hash({ value }: { value?: string }) {
  return value ? <code className="hash">{value}</code> : <span className="muted">Henüz oluşmadı</span>;
}
export function Integrity({ version }: { version: any }) {
  const [result, setResult] = useState<any>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="integrity">
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setResult(await api(`records/${version.id}/integrity`));
            setError('');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Denetleniyor…' : 'Bütünlüğü denetle'}
      </button>
      {result && <Badge state={result.state} />}
      <p className="muted">{tr.proof}</p>
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
export function Version({ version, previous }: { version: any; previous?: any }) {
  const tx = version.anchor?.transactions?.find((t: any) => t.blockNumber);
  return (
    <article className="version">
      <div className="row between">
        <h3>Sürüm {version.version}</h3>
        <Badge state={version.anchor?.status || 'UNANCHORED'} />
      </div>
      <p className="muted">{date(version.createdAt)}</p>
      <dl>
        <dt>İçerik özeti (SHA-256)</dt>
        <dd>
          <Hash value={version.contentHash} />
        </dd>
        <dt>İşlem özeti</dt>
        <dd>
          <Hash value={tx?.hash} />
        </dd>
        {tx && (
          <>
            <dt>Blok numarası</dt>
            <dd>{tx.blockNumber.toLocaleString('tr-TR')}</dd>
          </>
        )}
      </dl>
      {previous && (
        <details>
          <summary>Bu sürümdeki değişiklikler</summary>
          {Object.keys(version.snapshot)
            .filter((k) => JSON.stringify(version.snapshot[k]) !== JSON.stringify(previous.snapshot[k]))
            .map((k) => (
              <p key={k}>
                <strong>{tr.fields[k] || k}</strong>: {JSON.stringify(previous.snapshot[k] ?? '—')} →{' '}
                {JSON.stringify(version.snapshot[k])}
              </p>
            ))}
        </details>
      )}
      <Integrity version={version} />
    </article>
  );
}
