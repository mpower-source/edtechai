import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';

const AuthPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setStatus(error.message);
    else setStatus('Check your email for a magic link to sign in.');
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sign In</h1>
      <form onSubmit={handleMagicLink} className="space-y-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded bg-primary text-white disabled:opacity-60"
        >
          {loading ? 'Sending…' : 'Send Magic Link'}
        </button>
      </form>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  );
};

export default AuthPage;
