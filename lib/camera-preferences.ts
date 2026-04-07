import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export const CAMERA_PERMISSION_METADATA_KEY = 'camera_permission_preference';

export type CameraPermissionPreference = 'granted';

export function getCameraPermissionPreference(
  user: User | null
): CameraPermissionPreference | null {
  const value = user?.user_metadata?.[CAMERA_PERMISSION_METADATA_KEY];
  return value === 'granted' ? value : null;
}

export async function saveCameraPermissionPreference(
  preference: CameraPermissionPreference
) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, error };

  const currentMetadata = data.user.user_metadata ?? {};
  if (currentMetadata[CAMERA_PERMISSION_METADATA_KEY] === preference) {
    return { ok: true as const, error: null };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      ...currentMetadata,
      [CAMERA_PERMISSION_METADATA_KEY]: preference,
    },
  });

  return { ok: !updateError, error: updateError };
}
