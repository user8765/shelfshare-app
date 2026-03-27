import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { BorrowRequest } from '@shelfshare/shared';
import s from './Borrows.module.css';

type Role = 'borrower' | 'owner';

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', accepted: '#22c55e', declined: '#ef4444', expired: '#9ca3af', returned: '#6366f1',
};

export default function Borrows() {
  const [role, setRole] = useState<Role>('borrower');
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(r: Role) {
    setLoading(true);
    setError('');
    try { setRequests(await api.get<BorrowRequest[]>(`/borrow-requests?role=${r}`)); }
    catch (err: unknown) { setError((err as { message?: string }).message ?? 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(role); }, [role]);

  async function action(id: string, act: string, extra?: Record<string, string>) {
    try { await api.patch(`/borrow-requests/${id}`, { action: act, ...extra }); load(role); }
    catch (err: unknown) { setError((err as { message?: string }).message ?? 'Action failed'); }
  }

  return (
    <div className={s.container}>
      <div className={s.toggle}>
        {(['borrower', 'owner'] as Role[]).map(r => (
          <button key={r} className={`${s.toggleBtn} ${role === r ? s.active : ''}`} onClick={() => setRole(r)}>
            {r === 'borrower' ? 'My Borrows' : 'My Lends'}
          </button>
        ))}
      </div>
      {error && <p className={s.error}>{error}</p>}
      {loading ? <p className={s.empty}>Loading…</p> : requests.length === 0 ? (
        <p className={s.empty}>No {role === 'borrower' ? 'borrows' : 'lends'} yet.</p>
      ) : (
        <ul className={s.list}>
          {requests.map(r => (
            <li key={r.id} className={s.card}>
              <div className={s.info}>
                <span className={s.bookId}>Book: {r.bookId.slice(0, 8)}…</span>
                <span className={s.badge} style={{ background: STATUS_COLOR[r.status] ?? '#9ca3af' }}>{r.status}</span>
                {r.dueDate && <span className={s.due}>Due: {r.dueDate}</span>}
              </div>
              <div className={s.actions}>
                {role === 'owner' && r.status === 'pending' && <>
                  <button className={s.acceptBtn} onClick={() => {
                    const due = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]!;
                    action(r.id, 'accept', { dueDate: due });
                  }}>Accept</button>
                  <button className={s.declineBtn} onClick={() => action(r.id, 'decline')}>Decline</button>
                </>}
                {r.status === 'accepted' && (
                  <button className={s.returnBtn} onClick={() => action(r.id, 'return')}>Returned</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
