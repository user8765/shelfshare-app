import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Book } from '@shelfshare/shared';
import s from './Library.module.css';

interface AddForm { isbn: string; title: string; author: string; genre: string }

const STATUS_COLOR: Record<string, string> = {
  available: '#22c55e', pending: '#f59e0b', lent_out: '#ef4444', unavailable: '#9ca3af',
};

export default function Library() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>({ isbn: '', title: '', author: '', genre: '' });
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try { setBooks(await api.get<Book[]>('/books')); }
    catch (err: unknown) { setError((err as { message?: string }).message ?? 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function lookupIsbn() {
    if (!form.isbn) return;
    setLookingUp(true);
    try {
      const meta = await api.get<{ title: string; author?: string; genre?: string }>(`/books/isbn/${form.isbn}`);
      setForm(f => ({ ...f, title: meta.title, author: meta.author ?? '', genre: meta.genre ?? '' }));
    } catch { setError('ISBN not found. Fill in manually.'); }
    finally { setLookingUp(false); }
  }

  async function addBook(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) return setError('Title is required');
    try {
      await api.post('/books', { isbn: form.isbn || undefined, title: form.title, author: form.author || undefined, genre: form.genre || undefined });
      setShowAdd(false);
      setForm({ isbn: '', title: '', author: '', genre: '' });
      load();
    } catch (err: unknown) { setError((err as { message?: string }).message ?? 'Failed to add'); }
  }

  async function deleteBook(id: string) {
    if (!confirm('Remove this book?')) return;
    try { await api.delete(`/books/${id}`); load(); }
    catch (err: unknown) { setError((err as { message?: string }).message ?? 'Failed to delete'); }
  }

  return (
    <div className={s.container}>
      <div className={s.header}>
        <h2>My Library</h2>
        <button className={s.addBtn} onClick={() => setShowAdd(true)}>+ Add Book</button>
      </div>
      {error && <p className={s.error}>{error}</p>}
      {loading ? <p className={s.empty}>Loading…</p> : books.length === 0 ? (
        <p className={s.empty}>No books yet. Add your first book!</p>
      ) : (
        <ul className={s.list}>
          {books.map(b => (
            <li key={b.id} className={s.card}>
              <div className={s.info}>
                <span className={s.title}>{b.title}</span>
                <span className={s.sub}>{b.author ?? 'Unknown author'}</span>
                <span className={s.badge} style={{ background: STATUS_COLOR[b.status] ?? '#9ca3af' }}>
                  {b.status.replace('_', ' ')}
                </span>
              </div>
              {b.status !== 'lent_out' && (
                <button className={s.deleteBtn} onClick={() => deleteBook(b.id)}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <div className={s.overlay}>
          <div className={s.modal}>
            <h3>Add Book</h3>
            <form onSubmit={addBook}>
              <div className={s.isbnRow}>
                <input className={s.input} placeholder="ISBN (optional)" value={form.isbn} onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))} />
                <button type="button" className={s.lookupBtn} onClick={lookupIsbn} disabled={lookingUp}>
                  {lookingUp ? '…' : 'Lookup'}
                </button>
              </div>
              <input className={s.input} placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              <input className={s.input} placeholder="Author" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
              <input className={s.input} placeholder="Genre" value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} />
              <button type="submit" className={s.addBtn}>Add to Library</button>
              <button type="button" className={s.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
