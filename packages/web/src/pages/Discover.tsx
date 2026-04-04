import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import type { Book, Community } from '@shelfshare/shared';
import s from './Discover.module.css';

export default function Discover() {
  const [books, setBooks] = useState<Book[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityId, setCommunityId] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locError, setLocError] = useState('');
  const coords = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    api.get<Community[]>('/communities').then(setCommunities).catch(() => {});
    navigator.geolocation.getCurrentPosition(
      pos => { coords.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; search(); },
      () => { setLocError('Location unavailable — enable location permission to discover nearby books.'); },
    );
  }, []);

  async function search() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (coords.current) {
        params.set('lat', String(coords.current.lat));
        params.set('lng', String(coords.current.lng));
      }
      if (communityId) params.set('communityId', communityId);
      setBooks(await api.get<Book[]>(`/discover?${params}`));
    } catch (err: unknown) { setError((err as { message?: string }).message ?? 'Search failed'); }
    finally { setLoading(false); }
  }

  async function requestBorrow(bookId: string) {
    try {
      await api.post('/borrow-requests', { bookId });
      alert('Request sent! The owner will be notified.');
      search();
    } catch (err: unknown) { setError((err as { message?: string }).message ?? 'Request failed'); }
  }

  return (
    <div className={s.container}>
      <div className={s.searchRow}>
        <input
          className={s.input}
          placeholder="Search by title, author, genre…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        {communities.length > 0 && (
          <select className={s.select} value={communityId} onChange={e => setCommunityId(e.target.value)}>
            <option value="">Nearby</option>
            {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <button className={s.searchBtn} onClick={search}>Search</button>
      </div>
      {locError && <p className={s.error}>{locError}</p>}
      {error && <p className={s.error}>{error}</p>}
      {loading ? <p className={s.empty}>Loading…</p> : books.length === 0 ? (
        <p className={s.empty}>No books found. Try a search or join a community.</p>
      ) : (
        <ul className={s.list}>
          {books.map(b => (
            <li key={b.id} className={s.card}>
              <div className={s.info}>
                <span className={s.title}>{b.title}</span>
                <span className={s.sub}>{b.author ?? 'Unknown author'}</span>
                {b.genre && <span className={s.genre}>{b.genre}</span>}
              </div>
              {b.status === 'available' && (
                <button className={s.requestBtn} onClick={() => requestBorrow(b.id)}>Request</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
