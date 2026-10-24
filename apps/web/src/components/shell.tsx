'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { api, useData } from '../lib/api';
import { tr, label } from '../locales/tr';
import { Notice } from './ui';
import { AppearanceSwitcher } from './appearance-switcher';

type NavigationGroup = { title: string; paths: string[] };
const groups: Record<string, NavigationGroup[]> = {
  ADMIN: [
    { title: 'Yönetim', paths: ['/admin', '/admin/users', '/admin/institutions'] },
    { title: 'İnceleme', paths: ['/verifier/queue', '/verifier/mentors', '/connections'] },
    { title: 'Sistem', paths: ['/admin/network', '/admin/blockchain-jobs', '/admin/audit', '/research'] },
  ],
  STUDENT: [
    { title: 'Kayıtlarım', paths: ['/dashboard', '/profile', '/achievements', '/profile/history'] },
    { title: 'Mentorluk', paths: ['/mentors', '/matches', '/connections', '/messages'] },
  ],
  MENTOR: [
    { title: 'Profil', paths: ['/mentor/profile', '/mentor/availability'] },
    { title: 'Mentorluk', paths: ['/mentor/requests', '/mentor/students', '/messages'] },
  ],
  VERIFIER: [{ title: 'İnceleme', paths: ['/verifier/queue', '/verifier/mentors', '/connections'] }],
};
const pageNotes: Record<string, string> = {
  '/admin': 'Kurum işlemleri, incelemeler ve eşleştirme ayarları.',
  '/admin/users': 'Hesap başvuruları, kurum üyelikleri ve erişim yetkileri.',
  '/admin/institutions': 'Kayıtlı kurumları yönetin.',
  '/admin/network': 'Doğrulayıcı düğümleri ve ağ bağlantıları.',
  '/admin/blockchain-jobs': 'Kayıtların blokzincire gönderim ve onay durumu.',
  '/admin/audit': 'Sistemde gerçekleştirilen işlemlerin geçmişi.',
  '/research': 'Deneyleri çalıştırın, sonuçları inceleyin ve dışa aktarın.',
  '/dashboard': 'Profil, hedefler ve başarı kayıtları.',
  '/profile/edit': 'Değişiklikler yeni bir profil sürümü olarak kaydedilir.',
  '/achievements/new': 'Başarı bilgilerini ve kanıt belgesini kurum incelemesine gönderin.',
  '/settings/privacy': 'Bilgilerinizi kimlerin görebileceğini belirleyin.',
};
export function allowed(path: string, role: string) {
  if (path === '/settings/privacy') return true;
  if (path.startsWith('/admin') || path.startsWith('/research')) return role === 'ADMIN';
  if (path.startsWith('/verifier')) return ['ADMIN', 'VERIFIER'].includes(role);
  if (path.startsWith('/mentor/')) return role === 'MENTOR';
  if (path.startsWith('/profile') || ['/dashboard', '/matches', '/achievements/new'].includes(path))
    return role === 'STUDENT';
  return true;
}
export function Shell({ children }: { children: (user: any) => ReactNode }) {
  const pathname = usePathname();
  const { data: user, error } = useData('auth/me');
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (error) window.location.replace('/login');
  }, [error]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  if (!user) return <main className="loading-screen">{tr.loading}</main>;
  const navigation = [...groups[user.role], { title: 'Hesap', paths: ['/settings/privacy'] }];
  const title =
    tr.pages[pathname] || (pathname.includes('achievements') ? 'Başarı Ayrıntıları' : 'Gelişim Alanı');
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        İçeriğe geç
      </a>
      <header className="work-header">
        <div className="identity">
          <Link href={navigation[0].paths[0]} className="wordmark" aria-label="EduMent ana sayfa">
            Edu<span>Ment</span>
          </Link>
          <span className="role-label">{label(user.role)}</span>
        </div>
        <div className="header-utilities">
          <AppearanceSwitcher />
          <div className="account-control">
            <span className="account-name">{user.name}</span>
            <button
              className="sign-out"
              aria-label={tr.logout}
              onClick={async () => {
                await api('auth/logout', 'POST');
                window.location.assign('/login');
              }}
            >
              <LogOut size={16} />
              <span>Çıkış</span>
            </button>
          </div>
          <button
            ref={menuButton}
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Menüyü aç"
            aria-expanded={open}
            aria-controls="main-navigation"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>
      {open && (
        <button
          className="nav-backdrop"
          aria-label="Menüyü kapat"
          onClick={() => {
            setOpen(false);
            menuButton.current?.focus();
          }}
        />
      )}
      <nav
        id="main-navigation"
        className={'workspace-navigation' + (open ? ' open' : '')}
        aria-label="Ana gezinme"
      >
        <div className="navigation-heading">
          <span>Çalışma alanı</span>
          <button
            className="sidebar-close"
            aria-label="Menüyü kapat"
            onClick={() => {
              setOpen(false);
              menuButton.current?.focus();
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="nav-groups">
          {navigation.map((group) => (
            <div className="nav-group" key={group.title}>
              <p>{group.title}</p>
              <div className="nav-links">
                {group.paths.map((path) => (
                  <Link
                    key={path}
                    href={path}
                    onClick={() => setOpen(false)}
                    className={pathname === path ? 'active' : ''}
                    aria-current={pathname === path ? 'page' : undefined}
                  >
                    {tr.pages[path]}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
      <div className="main-area">
        <main id="main-content" className="content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              {pageNotes[pathname] && <p>{pageNotes[pathname]}</p>}
            </div>
            <span className="page-context">
              {label(user.role)}
              <span>Araştırma prototipi</span>
            </span>
          </div>
          {allowed(pathname, user.role) ? (
            children(user)
          ) : (
            <Notice error>Bu sayfayı görüntüleme yetkiniz bulunmuyor.</Notice>
          )}
        </main>
        <footer>
          <span>Kişisel bilgiler blokzincire yazılmaz.</span>
          <span>{tr.proof}</span>
        </footer>
      </div>
    </div>
  );
}
