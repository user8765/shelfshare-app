import { useState } from 'react';
import { api } from '../api/client';
import type { Community } from '@shelfshare/shared';
import s from './Communities.module.css';

export default function Communities() {
  const [joined, setJoined] = useState<Community[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Name required');
    try {
      const c = await api.post<Community>('/communities', { name: name.trim() });
      setJoined(j => [c, ...j]);
      setShowCreate(false);
      setName('');
    } catch (err: unknown) { setError((err as { message?: string }).message ?? 'Failed'); }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return setError('Invite code required');
    try {
      const c = await api.post<Community>('/communities/any/join', { inviteCode: inviteCode.trim() });
      setJoined(j => [c, ...j]);
      setShowJoin(false);
      setInviteCode('');
    } catch (err: unknown) { setError((err as { message?: string }).message ?? 'Failed'); }
  }

  return (
    <div className={s.container}>
      <div className={s.header}>
        <h2>Communities</h2>
        <div className={s.btnRow}>
          <button className={s.btn} onClick={() => { setShowCreate(true); setError(''); }}>+ Create</button>
          <button className={`${s.btn} ${s.outline}`} onClick={() => { setShowJoin(true); setError(''); }}>Join via Code</button>
        </div>
      </div>
      {error && <p className={s.error}>{error}</p>}
      {joined.length === 0 ? (
        <p className={s.empty}>No communities yet. Create one or join with an invite code.</p>
      ) : (
        <ul className={s.list}>
          {joined.map(c => (
            <li key={c.id} className={s.card}>
              <span className={s.name}>{c.name}</span>
              <span className={s.code}>Invite code: <strong>{c.inviteCode}</strong></span>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <div className={s.overlay}>
          <div className={s.modal}>
            <h3>Create Community</h3>
            <form onSubmit={create}>
              <input className={s.input} placeholder="Community name" value={name} onChange={e => setName(e.target.value)} required />
              <button type="submit" className={s.btn}>Create</button>
              <button type="button" className={s.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {showJoin && (
        <div className={s.overlay}>
          <div className={s.modal}>
            <h3>Join Community</h3>
            <form onSubmit={join}>
              <input className={s.input} placeholder="Invite code" value={inviteCode} onChange={e => setInviteCode(e.target.value)} required />
              <button type="submit" className={s.btn}>Join</button>
              <button type="button" className={s.cancelBtn} onClick={() => setShowJoin(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
