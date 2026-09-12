'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, ArrowRight, BookOpen, Network } from 'lucide-react';
import { api } from '../lib/api';
import { tr } from '../locales/tr';
import { Notice } from './ui';
const schema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin.'),
  password: z.string().min(1, 'Parolanızı girin.'),
  name: z.string().optional(),
  role: z.string().optional(),
  minor: z.boolean().optional(),
  consent: z.boolean().optional(),
});
export function AuthPage({ registering = false }: { registering?: boolean }) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', name: '', role: 'STUDENT', minor: true, consent: false },
  });
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link href="/login" className="brand">
          <span className="brand-icon">B</span>
          {tr.brand}
        </Link>
        <span className="eyebrow">BİLSEM · GELİŞİM VE MENTORLUK</span>
        <h1>
          Her adımınız
          <br />
          geleceğe bir iz.
        </h1>
        <p>Başarılarınızı güvenle saklayın, gelişiminizi görün ve hedeflerinize uygun mentorlarla buluşun.</p>
        <div className="story-features">
          <p>
            <BookOpen /> Kişisel gelişim yolculuğunuz
          </p>
          <p>
            <ShieldCheck /> Doğrulanabilir başarı kayıtları
          </p>
          <p>
            <Network /> Açıklanabilir mentor önerileri
          </p>
        </div>
        <div className="research-note">
          TÜBİTAK 2204-A araştırma prototipi
          <br />
          <span>Kişisel bilgileriniz blokzincire yazılmaz.</span>
        </div>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <span className="eyebrow">BILSEM-CHAIN’E HOŞ GELDİNİZ</span>
          <h2>{registering ? 'Yolculuğunuza başlayın' : 'Tekrar merhaba.'}</h2>
          <p className="muted">
            {registering
              ? 'Hesabınız kurum yöneticisi tarafından incelendikten sonra etkinleşir.'
              : 'Gelişim yolculuğunuza kaldığınız yerden devam edin.'}
          </p>
          <form
            onSubmit={handleSubmit(async (values) => {
              setError('');
              setSuccess('');
              try {
                const result = await api(
                  registering ? 'auth/register' : 'auth/login',
                  'POST',
                  registering ? values : { email: values.email, password: values.password },
                );
                if (registering) setSuccess(result.message);
                else
                  window.location.assign(
                    result.role === 'ADMIN'
                      ? '/admin'
                      : result.role === 'VERIFIER'
                        ? '/verifier/queue'
                        : result.role === 'MENTOR'
                          ? '/mentor/profile'
                          : '/dashboard',
                  );
              } catch (e) {
                setError((e as Error).message);
              }
            })}
          >
            {registering && (
              <>
                <label>
                  {tr.name}
                  <input {...register('name')} required autoComplete="name" />
                </label>
                <label>
                  Hesap türü
                  <select {...register('role')}>
                    <option value="STUDENT">Öğrenci</option>
                    <option value="MENTOR">Mentor</option>
                  </select>
                </label>
              </>
            )}
            <label>
              {tr.email}
              <input
                type="email"
                autoComplete="email"
                placeholder="adiniz@ornek.com"
                {...register('email')}
              />
              {errors.email && <span className="field-error">{errors.email.message}</span>}
            </label>
            <label>
              {tr.password}
              <input
                type="password"
                autoComplete={registering ? 'new-password' : 'current-password'}
                {...register('password')}
                minLength={registering ? 12 : 1}
              />
              {errors.password && <span className="field-error">{errors.password.message}</span>}
            </label>
            {registering && (
              <>
                <p className="help">En az 12 karakter; büyük harf, küçük harf ve rakam kullanın.</p>
                <label className="check">
                  <input type="checkbox" {...register('minor')} />
                  18 yaşından küçüğüm.
                </label>
                <label className="check">
                  <input type="checkbox" {...register('consent')} required />
                  Kullanım ve gizlilik açıklamasını okudum; hesap başvurumun işlenmesine izin veriyorum.
                </label>
                <details>
                  <summary>Kullanım ve gizlilik açıklaması · sürüm 1.0</summary>
                  <p>
                    Adınız, e-postanız ve eğitim kayıtlarınız özel veritabanında tutulur. Blokzincire yalnızca
                    özetler ve takma referanslar yazılır. Mentor önerileri ve açık paylaşım için ayrıca izin
                    vermeniz gerekir. Reşit olmayanların görüşmeleri kurum onayı gerektirir. Bu prototipe
                    gerçek hassas belge yüklemeden önce kurumunuzla görüşün.
                  </p>
                </details>
              </>
            )}
            {error && <Notice error>{error}</Notice>}
            {success && <Notice>{success}</Notice>}
            <button className="button primary full" disabled={isSubmitting}>
              {isSubmitting ? tr.saving : registering ? 'Başvuru oluştur' : tr.login}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {registering ? 'Hesabınız var mı?' : 'Henüz hesabınız yok mu?'}{' '}
            <Link href={registering ? '/login' : '/register'}>{registering ? tr.login : tr.register}</Link>
          </p>
          <div className="privacy-note">
            <ShieldCheck size={18} />
            <span>Gizlilik varsayılandır. Paylaşım sizin izninizle başlar.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
