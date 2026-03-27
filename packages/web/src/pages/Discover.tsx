import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Book } from '@shelfshare/shared';
import s from './Discover.module.css';

export default function Discover() {
  const [books, setBooks] = useState<Book[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      setBooks(await api.get<Book[]>(`/discover?${params}`));
    } catch (err: unknown) { setError((err as { message?: string }).message ?? 'Search failed'); }
    finally { setLoading(false); }
  }

  useEffect(() => { search(); }, []);

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
        <button className={s.searchBtn} onClick={search}>Search</button>
      </div>
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
