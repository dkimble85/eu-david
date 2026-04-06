import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';

export type UserProfile = {
  username: string | null;
};

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<UserProfile>({ username: null });

  useEffect(() => {
    if (!user) {
      setProfile({ username: null });
      return;
    }
    const meta = user.user_metadata ?? {};
    setProfile({
      username: meta.username ?? null,
    });
  }, [user]);

  return { profile };
}
