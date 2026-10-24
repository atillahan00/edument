'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { tr } from '../locales/tr';
import { Notice } from './ui';
import { AppearanceSwitcher } from './appearance-switcher';
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
    <main className={'auth-layout' + (registering ? ' registering' : '')}>
      <header className="auth-header">
        <Link href="/login" className="wordmark">
          Edu<span>Ment</span>
        </Link>
        <AppearanceSwitcher />
      </header>
      <section className="auth-form">
        <div className="auth-card">
          <div className="auth-caption">
            <span className="auth-product">Öğrenci kayıtları ve mentorluk</span>
            <h1>{registering ? 'Hesap başvurusu' : 'Giriş yap'}</h1>
            <p>
              {registering
                ? 'Başvurunuz kurum yöneticisi tarafından incelenir.'
                : 'Çalışma alanınıza erişmek için hesap bilgilerinizi girin.'}
            </p>
          </div>
          <div className="auth-fields">
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
                      Adınız, e-postanız ve eğitim kayıtlarınız özel veritabanında tutulur. Blokzincire
                      yalnızca özetler ve takma referanslar yazılır. Mentor önerileri ve açık paylaşım için
                      ayrıca izin vermeniz gerekir. Reşit olmayanların görüşmeleri kurum onayı gerektirir. Bu
                      prototipe gerçek hassas belge yüklemeden önce kurumunuzla görüşün.
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
          </div>
          <div className="privacy-note">
            <ShieldCheck size={18} />
            <span>Paylaşım izinlerinizi hesabınızdan yönetebilirsiniz.</span>
          </div>
        </div>
      </section>
      <footer className="auth-footer">
        <span>TÜBİTAK 2204-A · Araştırma prototipi</span>
        <span>Kişisel bilgileriniz blokzincire yazılmaz.</span>
      </footer>
    </main>
  );
}
