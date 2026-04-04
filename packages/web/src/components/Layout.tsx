import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken, api } from '../api/client';
import s from './Layout.module.css';

const NAV = [
  { to: '/discover',    label: 'Discover' },
  { to: '/library',     label: 'Library' },
  { to: '/borrows',     label: 'Borrows' },
  { to: '/communities', label: 'Communities' },
  { to: '/messages',    label: 'Messages' },
];

export default function Layout() {
  const navigate = useNavigate();

  function logout() {
    clearToken();
    navigate('/login');
  }

  async function invite() {
    const { code } = await api.post<{ code: string }>('/invites', {});
    const link = `${window.location.origin}/login?invite=${code}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    window.prompt('Share this invite link (copied to clipboard):', link);
  }

  return (
    <div className={s.shell}>
      <nav className={s.nav}>
        <span className={s.logo}>ShelfShare</span>
        <div className={s.links}>
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `${s.link} ${isActive ? s.active : ''}`}>
              {n.label}
            </NavLink>
          ))}
        </div>
        <button className={s.logout} onClick={invite}>Invite</button>
        <button className={s.logout} onClick={logout}>Logout</button>
      </nav>
      <main className={s.main}>
        <Outlet />
      </main>
    </div>
  );
}
