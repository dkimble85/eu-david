import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export type UserProfile = {
  glutenFree: boolean;
  username: string | null;
};

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<UserProfile>({ glutenFree: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile({ glutenFree: false });
      return;
    }
    const meta = user.user_metadata ?? {};
    setProfile({
      glutenFree: meta.gluten_free === true,
      username: meta.username ?? null,
    });
  }, [user]);

  const saveProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      if (!user) return;
      setSaving(true);
      // Optimistic update
      setProfile((prev) => ({ ...prev, ...updates }));
      try {
        await supabase.auth.updateUser({
          data: { gluten_free: updates.glutenFree ?? profile.glutenFree },
        });
      } catch {
        // Roll back on failure
        setProfile({
          glutenFree: user.user_metadata?.gluten_free === true,
          username: user.user_metadata?.username ?? null,
        });
      } finally {
        setSaving(false);
      }
    },
    [user, profile.glutenFree]
  );

  return { profile, saveProfile, saving };
}
