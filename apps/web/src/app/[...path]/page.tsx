'use client';
import { useParams } from 'next/navigation';
import { Shell } from '../../components/shell';
import { Dashboard, ProfileForm, ProfileView, History } from '../../components/profile';
import {
  AchievementList,
  AchievementForm,
  AchievementDetail,
  PublicVerify,
} from '../../components/achievements';
import { Mentors, Connections, Messages } from '../../components/mentoring';
import {
  Privacy,
  Users,
  Institutions,
  MentorQueue,
  Network,
  Jobs,
  Audit,
  AdminHome,
  Research,
} from '../../components/admin';
import { Notice } from '../../components/ui';
export default function Page() {
  const { path } = useParams<{ path: string[] }>();
  const route = '/' + path.join('/');
  if (path[0] === 'verify') return <PublicVerify token={path[1]} />;
  return (
    <Shell>
      {(user) => {
        if (route === '/dashboard') return <Dashboard user={user} />;
        if (route === '/profile') return <ProfileView />;
        if (route === '/profile/edit') return <ProfileForm />;
        if (route === '/profile/history') return <History />;
        if (route === '/achievements/new') return <AchievementForm />;
        if (route === '/achievements') return <AchievementList />;
        if (path[0] === 'achievements' && path[1]) return <AchievementDetail id={path[1]} />;
        if (route === '/verifier/queue') return <AchievementList verifier />;
        if (path[0] === 'verifier' && path[1] === 'achievements')
          return <AchievementDetail id={path[2]} verifier />;
        if (route === '/verifier/mentors') return <MentorQueue />;
        if (route === '/mentors') return <Mentors />;
        if (route === '/matches') return <Mentors matches />;
        if (['/connections', '/mentor/requests', '/mentor/students'].includes(route))
          return <Connections user={user} />;
        if (['/mentor/profile', '/mentor/availability'].includes(route)) return <ProfileForm mentor />;
        if (route === '/messages') return <Messages user={user} />;
        if (route === '/settings/privacy') return <Privacy />;
        if (route === '/admin') return <AdminHome />;
        if (route === '/admin/users') return <Users />;
        if (route === '/admin/institutions') return <Institutions />;
        if (route === '/admin/network') return <Network />;
        if (route === '/admin/blockchain-jobs') return <Jobs />;
        if (route === '/admin/audit') return <Audit />;
        if (route.startsWith('/research')) return <Research />;
        return <Notice error>Sayfa bulunamadı.</Notice>;
      }}
    </Shell>
  );
}
