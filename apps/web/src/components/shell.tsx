'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UserRound,
  Award,
  Users,
  ShieldCheck,
  FlaskConical,
  Network,
  History,
  Settings,
  MessageSquare,
  LogOut,
  Menu,
  ChevronRight,
} from 'lucide-react';
import { api, useData } from '../lib/api';
import { tr, label } from '../locales/tr';
import { Notice } from './ui';
const links: Record<string, string[]> = {
  STUDENT: [
    '/dashboard',
    '/profile',
    '/achievements',
    '/mentors',
    '/matches',
    '/connections',
    '/messages',
    '/profile/history',
  ],
  MENTOR: ['/mentor/profile', '/mentor/availability', '/mentor/requests', '/mentor/students', '/messages'],
  VERIFIER: ['/verifier/queue', '/verifier/mentors', '/connections'],
  ADMIN: [
    '/admin',
    '/admin/users',
    '/admin/institutions',
    '/verifier/queue',
    '/verifier/mentors',
    '/connections',
    '/admin/network',
    '/admin/blockchain-jobs',
    '/admin/audit',
    '/research',
  ],
};
const icons = [
  LayoutDashboard,
  UserRound,
  Award,
  Users,
  ShieldCheck,
  MessageSquare,
  Network,
  History,
  FlaskConical,
  Settings,
];
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
  useEffect(() => {
    if (error) window.location.replace('/login');
  }, [error]);
  if (!user) return <main className="loading-screen">{tr.loading}</main>;
  const title =
    tr.pages[pathname] || (pathname.includes('achievements') ? 'Başarı Ayrıntıları' : 'Gelişim Alanı');
  return (
    <div className="app-layout">
      <aside className={'sidebar ' + (open ? 'open' : '')}>
        <Link href={links[user.role][0]} className="brand">
          <span className="brand-icon">B</span>
          {tr.brand}
        </Link>
        <div className="workspace-label">KİŞİSEL GELİŞİM ALANI</div>
        <nav aria-label="Ana gezinme">
          {links[user.role].map((path, i) => {
            const Icon = icons[i % icons.length];
            return (
              <Link
                onClick={() => setOpen(false)}
                className={pathname === path ? 'active' : ''}
                href={path}
                key={path}
              >
                <Icon size={18} />
                {tr.pages[path]}
              </Link>
            );
          })}
          <Link href="/settings/privacy" className={pathname === '/settings/privacy' ? 'active' : ''}>
            <ShieldCheck size={18} />
            Gizlilik ve İzinler
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-mini">
            <ShieldCheck size={22} />
            <strong>Bilgileriniz güvende</strong>
            <p>Kişisel verileriniz blokzincire yazılmaz.</p>
          </div>
          <div className="user-card">
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{label(user.role)}</small>
            </span>
            <button
              aria-label={tr.logout}
              onClick={async () => {
                await api('auth/logout', 'POST');
                window.location.assign('/login');
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Menüyü aç">
            <Menu />
          </button>
          <div className="breadcrumb">
            Çalışma alanım <ChevronRight size={14} /> <strong>{title}</strong>
          </div>
          <span className="environment">Araştırma prototipi</span>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">BILSEM-CHAIN</span>
              <h1>{title}</h1>
            </div>
            <span className="today">
              {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          {allowed(pathname, user.role) ? (
            children(user)
          ) : (
            <Notice error>Bu sayfayı görüntüleme yetkiniz bulunmuyor.</Notice>
          )}
        </main>
        <footer>
          Kişisel gelişim, güvenilir kayıtlar. <span>{tr.proof}</span>
        </footer>
      </div>
    </div>
  );
}
