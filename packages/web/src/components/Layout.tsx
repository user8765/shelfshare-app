import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken } from '../api/client';
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
        <button className={s.logout} onClick={logout}>Logout</button>
      </nav>
      <main className={s.main}>
        <Outlet />
      </main>
    </div>
  );
}
