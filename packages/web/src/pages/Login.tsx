import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api/client';
import s from './Login.module.css';

declare const google: {
  accounts: {
    id: {
      initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      prompt: () => void;
    };
  };
};

export default function Login() {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    google.accounts.id.initialize({
      client_id: import.meta.env['VITE_GOOGLE_CLIENT_ID'] as string,
      callback: async ({ credential }) => {
        try {
          const res = await api.post<{ token: string }>('/auth/google/callback', {
            idToken: credential,
            inviteCode: inviteCode.trim() || undefined,
          });
          setToken(res.token);
          navigate('/discover');
        } catch (err: unknown) {
          setError((err as { message?: string }).message ?? 'Sign in failed');
        } finally {
          setLoading(false);
        }
      },
    });
    google.accounts.id.prompt();
  }

  return (
    <div className={s.container}>
      <h1 className={s.title}>ShelfShare</h1>
      <p className={s.subtitle}>Community book lending</p>
      <input
        className={s.input}
        placeholder="Invite code (required for new users)"
        value={inviteCode}
        onChange={e => setInviteCode(e.target.value)}
      />
      {error && <p className={s.error}>{error}</p>}
      <button className={s.button} onClick={handleGoogleSignIn} disabled={loading}>
        {loading ? 'Signing in…' : 'Continue with Google'}
      </button>
    </div>
  );
}
