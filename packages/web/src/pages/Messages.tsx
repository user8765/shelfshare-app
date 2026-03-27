import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import s from './Messages.module.css';

interface Conversation { userId: string; displayName: string; lastMessage: string; lastAt: string; unread: number }
interface Message { id: string; senderId: string; content: string; createdAt: string }

export default function Messages() {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadConvos() {
    setLoading(true);
    try { setConvos(await api.get<Conversation[]>('/messages/conversations')); }
    catch (err: unknown) { setError((err as { message?: string }).message ?? 'Failed'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadConvos(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function openThread(c: Conversation) {
    setSelected(c);
    try { setMessages(await api.get<Message[]>(`/messages/${c.userId}`)); }
    catch (err: unknown) { setError((err as { message?: string }).message ?? 'Failed'); }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !selected) return;
    try {
      await api.post(`/messages/${selected.userId}`, { content: draft.trim() });
      setDraft('');
      setMessages(await api.get<Message[]>(`/messages/${selected.userId}`));
    } catch (err: unknown) { setError((err as { message?: string }).message ?? 'Failed'); }
  }

  if (selected) return (
    <div className={s.thread}>
      <div className={s.threadHeader}>
        <button className={s.back} onClick={() => { setSelected(null); loadConvos(); }}>← Back</button>
        <span className={s.threadName}>{selected.displayName}</span>
      </div>
      <div className={s.messages}>
        {messages.map(m => (
          <div key={m.id} className={`${s.bubble} ${m.senderId === selected.userId ? s.left : s.right}`}>
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className={s.inputRow} onSubmit={send}>
        <textarea className={s.input} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message…" rows={1} />
        <button type="submit" className={s.sendBtn}>Send</button>
      </form>
    </div>
  );

  return (
    <div className={s.container}>
      <h2 className={s.heading}>Messages</h2>
      {error && <p className={s.error}>{error}</p>}
      {loading ? <p className={s.empty}>Loading…</p> : convos.length === 0 ? (
        <p className={s.empty}>No messages yet.</p>
      ) : (
        <ul className={s.list}>
          {convos.map(c => (
            <li key={c.userId} className={s.convo} onClick={() => openThread(c)}>
              <div className={s.info}>
                <span className={s.name}>{c.displayName}</span>
                <span className={s.last}>{c.lastMessage}</span>
              </div>
              {c.unread > 0 && <span className={s.unread}>{c.unread}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
