'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowUpRight, Award, Target, Layers, Plus } from 'lucide-react';
import { api, useData } from '../lib/api';
import { tr, label, date } from '../locales/tr';
import { Panel, Empty, LoadingError, Notice, Version } from './ui';
const keys = ['bio', 'interests', 'skills', 'goals', 'availability', 'languages', 'mode', 'city'];
function snapshotFields(snapshot: any) {
  return {
    ...snapshot,
    interests: snapshot?.interests?.join(', ') || '',
    goals: snapshot?.goals?.join(', ') || '',
    availability: snapshot?.availability?.join(', ') || '',
    languages: snapshot?.languages?.join(', ') || 'Türkçe',
    skills: snapshot?.skills?.map((s: any) => `${s.name}:${s.level}`).join(', ') || '',
    expertise: snapshot?.expertise?.join(', ') || '',
    mode: snapshot?.mode || 'ONLINE',
    experience: snapshot?.experience || 0,
    capacity: snapshot?.capacity || 3,
  };
}
export function ProfileForm({ mentor = false }: { mentor?: boolean }) {
  const source = useData(mentor ? 'mentors/profile' : 'students/profile');
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<any>();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => {
    reset(snapshotFields(mentor ? source.data?.data : source.data?.snapshot));
  }, [source.data, mentor, reset]);
  return (
    <Panel title={mentor ? 'Uzmanlığınızı ve uygunluğunuzu paylaşın' : 'Gelişim profilinizi oluşturun'}>
      <p className="muted">
        {mentor
          ? 'Uzmanlık veya deneyim değişikliği kurum doğrulamasını yenilemeyi gerektirir.'
          : 'Her anlamlı değişiklik yeni bir sürüm oluşturur. Önceki sürümler korunur.'}
      </p>
      <LoadingError {...source} />
      <form
        className="form-grid"
        onSubmit={handleSubmit(async (values) => {
          setError('');
          setSuccess('');
          const list = (v: string) =>
            (v || '')
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean);
          const data: any = {
            bio: values.bio || '',
            interests: list(values.interests),
            goals: list(values.goals),
            availability: list(values.availability),
            languages: list(values.languages),
            mode: values.mode,
            city: values.city || '',
            skills: list(values.skills).map((v) => {
              const [name, level] = v.split(':');
              return { name, level: Number(level) };
            }),
          };
          if (mentor)
            Object.assign(data, {
              expertise: list(values.expertise),
              experience: Number(values.experience),
              capacity: Number(values.capacity),
            });
          try {
            await api(mentor ? 'mentors/profile' : 'students/profile', mentor ? 'PUT' : 'POST', data);
            setSuccess(
              mentor
                ? 'Mentor profiliniz kaydedildi.'
                : 'Yeni profil sürümünüz oluşturuldu. Blokzincir onayı bekleniyor.',
            );
            void source.reload();
          } catch (e) {
            setError((e as Error).message);
          }
        })}
      >
        {[...keys, ...(mentor ? ['expertise', 'experience', 'capacity'] : [])].map((key) => (
          <label className={key === 'bio' ? 'wide' : ''} key={key}>
            {tr.fields[key]}
            {key === 'mode' ? (
              <select aria-label={tr.fields[key]} {...register(key)}>
                {['ONLINE', 'IN_PERSON', 'BOTH'].map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            ) : key === 'bio' ? (
              <textarea aria-label={tr.fields[key]} rows={3} {...register(key)} maxLength={2000} />
            ) : (
              <input
                aria-label={tr.fields[key]}
                {...register(key)}
                type={['experience', 'capacity'].includes(key) ? 'number' : 'text'}
                min={key === 'capacity' ? 1 : 0}
                max={key === 'capacity' ? 30 : key === 'experience' ? 60 : undefined}
                placeholder={
                  key === 'skills'
                    ? 'Python:4, Arduino:3'
                    : key === 'availability'
                      ? 'Pazartesi 17:00, Çarşamba 18:00'
                      : key === 'interests'
                        ? 'Robotik, Matematik'
                        : undefined
                }
              />
            )}
            <small>
              {key === 'skills'
                ? '1–5 düzeyinde öz değerlendirme. Kurum tarafından onaylanmış yetkinlik değildir.'
                : ['interests', 'goals', 'availability', 'languages', 'expertise'].includes(key)
                  ? 'Birden fazla değeri virgülle ayırın.'
                  : ''}
            </small>
          </label>
        ))}
        <div className="wide">
          {error && <Notice error>{error}</Notice>}
          {success && <Notice>{success}</Notice>}
          <button disabled={isSubmitting} className="button primary">
            {isSubmitting ? tr.saving : tr.save}
          </button>
        </div>
      </form>
    </Panel>
  );
}
export function ProfileView() {
  const source = useData('students/profile');
  return (
    <>
      <LoadingError {...source} />
      <Panel
        title="Güncel profil"
        action={
          <Link className="button primary" href="/profile/edit">
            Profili düzenle
          </Link>
        }
      >
        {source.data ? (
          <>
            {Object.entries(source.data.snapshot).map(([k, v]: any) => (
              <div className="profile-field" key={k}>
                <h3>{tr.fields[k] || k}</h3>
                <p>
                  {Array.isArray(v)
                    ? v
                        .map((x) =>
                          typeof x === 'object' ? `${x.name}: ${x.level}/5 (öz değerlendirme)` : x,
                        )
                        .join(' · ') || 'Henüz belirtilmedi'
                    : label(String(v)) || 'Henüz belirtilmedi'}
                </p>
              </div>
            ))}
            <Version version={source.data} />
          </>
        ) : (
          <Empty>Gelişim profiliniz henüz oluşturulmadı.</Empty>
        )}
      </Panel>
    </>
  );
}
export function History() {
  const source = useData<any[]>('students/history');
  return (
    <>
      <LoadingError {...source} />
      <Notice>Önceki sürümler değiştirilemez. Bütünlük denetimi gerçek blokzincir kaydını sorgular.</Notice>
      {source.data?.length ? (
        source.data.map((v, i) => <Version key={v.id} version={v} previous={source.data?.[i + 1]} />)
      ) : (
        <Empty>Henüz profil sürümü bulunmuyor.</Empty>
      )}
    </>
  );
}
export function Dashboard({ user }: { user: any }) {
  const profile = useData('students/profile');
  const history = useData<any[]>('students/history');
  const achievements = useData<any[]>('achievements');
  const rows = achievements.data || [];
  const verified = rows.filter((a) => a.status === 'APPROVED');
  const goals = profile.data?.snapshot?.goals || [];
  const chart = [...(history.data || [])].reverse().map((v) => ({
    name: `S${v.version}`,
    beceri: v.snapshot.skills?.length || 0,
    hedef: v.snapshot.goals?.length || 0,
  }));
  return (
    <>
      <div className="record-toolbar">
        <span>{user.name}</span>
        <Link href="/profile/edit" className="text-button">
          Profili düzenle <ArrowUpRight size={16} />
        </Link>
      </div>
      <LoadingError {...achievements} />
      <div className="stats record-summary">
        {[
          [Award, 'Onaylanan başarı', verified.length],
          [Target, 'Gelişim hedefi', goals.length],
          [Layers, 'Profil sürümü', profile.data?.version || 0],
        ].map(([Icon, title, count]: any) => (
          <div className="stat" key={title}>
            <span className="stat-icon">
              <Icon size={21} />
            </span>
            <span>
              {title}
              <strong>{count.toLocaleString('tr-TR')}</strong>
            </span>
          </div>
        ))}
      </div>
      <div className="two-columns">
        <Panel title="Profil gelişimi" action={<Link href="/profile/history">Geçmişi gör →</Link>}>
          {chart.length ? (
            <>
              <p className="muted">Profil sürümlerindeki beceri ve hedef sayıları</p>
              <div className="chart">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      isAnimationActive={false}
                      dataKey="beceri"
                      name="Öz değerlendirme becerisi"
                      fill="var(--blue)"
                      radius={[5, 5, 0, 0]}
                    />
                    <Bar
                      isAnimationActive={false}
                      dataKey="hedef"
                      name="Hedef sayısı"
                      fill="var(--teal)"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <Empty>Henüz profil kaydı bulunmuyor.</Empty>
          )}
        </Panel>
        <Panel
          title="Hedeflerim"
          action={
            <Link href="/profile/edit" aria-label="Hedef ekle">
              <Plus size={18} />
            </Link>
          }
        >
          {goals.length ? (
            <ul className="goal-list">
              {goals.map((g: string) => (
                <li key={g}>
                  <Target size={17} />
                  {g}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Henüz gelişim hedefi eklenmedi.</Empty>
          )}
        </Panel>
      </div>
      <Panel
        title="Son başarı kayıtları"
        action={
          <Link href="/achievements/new" className="text-button">
            Yeni başarı ekle <Plus size={16} />
          </Link>
        }
      >
        {rows.length ? (
          rows.slice(0, 5).map((a) => (
            <Link className="list-row" key={a.id} href={`/achievements/${a.id}`}>
              <div>
                <strong>{a.versions[0]?.snapshot.title}</strong>
                <small>{date(a.createdAt)}</small>
              </div>
              <span>{label(a.status)} →</span>
            </Link>
          ))
        ) : (
          <Empty>Henüz başarı kaydı bulunmuyor.</Empty>
        )}
      </Panel>
    </>
  );
}
