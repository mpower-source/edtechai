import React from 'react';
import { useProfile } from '../hooks/useProfile';
import { useUpsertProfile } from '../hooks/useUpsertProfile';

export default function Profile() {
  const { data: profile, isLoading, isError } = useProfile();
  const upsert = useUpsertProfile();

  const [form, setForm] = React.useState({
    display_name: '',
    avatar_url: '',
    bio: '',
  });

  React.useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? '',
        avatar_url: profile.avatar_url ?? '',
        bio: profile.bio ?? '',
      });
    }
  }, [profile]);

  if (isLoading) return <div className="p-6">Loading profile…</div>;
  if (isError) return <div className="p-6 text-red-600">Failed to load profile.</div>;

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsert.mutateAsync({
      display_name: form.display_name || null,
      avatar_url: form.avatar_url || null,
      bio: form.bio || null,
      updated_at: new Date().toISOString(),
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your Profile</h1>
        <p className="text-sm text-muted-foreground">View and update your account profile.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="display_name" className="block text-sm font-medium">Display name</label>
          <input
            id="display_name"
            name="display_name"
            className="w-full border rounded px-3 py-2"
            value={form.display_name}
            onChange={onChange}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="avatar_url" className="block text-sm font-medium">Avatar URL</label>
          <input
            id="avatar_url"
            name="avatar_url"
            className="w-full border rounded px-3 py-2"
            value={form.avatar_url}
            onChange={onChange}
            placeholder="https://…"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="bio" className="block text-sm font-medium">Bio</label>
          <textarea
            id="bio"
            name="bio"
            className="w-full border rounded px-3 py-2 min-h-[100px]"
            value={form.bio}
            onChange={onChange}
            placeholder="Tell us about yourself"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded bg-primary text-white px-4 py-2 disabled:opacity-50"
          disabled={upsert.isPending}
        >
          {upsert.isPending ? 'Saving…' : 'Save changes'}
        </button>
        {upsert.isSuccess && (
          <span className="ml-3 text-sm text-green-600">Saved!</span>
        )}
        {upsert.isError && (
          <span className="ml-3 text-sm text-red-600">Save failed</span>
        )}
      </form>
    </div>
  );
}
