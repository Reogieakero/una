import type { DbClient } from "../platform";

export const AVATAR_BUCKET = "avatars";

/** Uploaded objects are stored as `<profile_id>/avatar-<ts>.<ext>`; OAuth
 *  sign-ups already have an absolute https URL. Everything else is a path. */
const EXTERNAL_URL = /^https?:\/\//i;

export function isExternalAvatar(value: string | null | undefined): boolean {
  return !!value && EXTERNAL_URL.test(value);
}

/** Path to store after a fresh upload (never contains user-provided text). */
export function avatarStoragePath(profileId: string, contentType: string, now = Date.now()): string {
  const ext =
    contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return `${profileId}/avatar-${now}.${ext}`;
}

/**
 * Exchange `profiles.avatar_url` for something an <img> can load. External
 * OAuth URLs pass through; uploaded objects get a 1-hour signed URL, and
 * storage RLS is what decides whether the caller may sign it at all.
 */
export async function signAvatarUrl(
  db: DbClient,
  value: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!value) return null;
  if (isExternalAvatar(value)) return value;
  if (!db.storage) return null;
  const { data, error } = await db.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(value, expiresIn);
  if (error) return null;
  return (data as { signedUrl?: string } | null)?.signedUrl ?? null;
}

/**
 * Upload raw image bytes, point `profiles.avatar_url` at the new object and
 * delete the previous upload (best-effort). Owner-only via storage + profiles
 * RLS, so `profileId` must be the caller.
 */
export async function uploadAvatar(
  db: DbClient,
  input: {
    profileId: string;
    previousPath?: string | null;
    bytes: Uint8Array | ArrayBuffer;
    contentType: string;
  },
): Promise<string> {
  if (!db.storage) throw new Error("Storage support is required to upload a photo.");
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(input.contentType)) {
    throw new Error("Use a JPG, PNG, or WebP image.");
  }
  const path = avatarStoragePath(input.profileId, input.contentType);
  // ArrayBuffer is the body type Supabase recommends for React Native; a
  // Uint8Array view is normalized so the same service works on web + mobile.
  const body =
    input.bytes instanceof Uint8Array
      ? input.bytes.buffer.slice(
          input.bytes.byteOffset,
          input.bytes.byteOffset + input.bytes.byteLength,
        )
      : input.bytes;
  const { error: uploadError } = await db.storage
    .from(AVATAR_BUCKET)
    .upload(path, body, {
      contentType: input.contentType,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { error: updateError } = await db
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", input.profileId);
  if (updateError) {
    // Don't leave an orphan object behind if the profile write is refused.
    try {
      await db.storage.from(AVATAR_BUCKET).remove([path]);
    } catch {
      // best-effort
    }
    throw updateError;
  }

  if (input.previousPath && !isExternalAvatar(input.previousPath) && input.previousPath !== path) {
    try {
      await db.storage.from(AVATAR_BUCKET).remove([input.previousPath]);
    } catch {
      // A stale object is harmless; the profile already points at the new one.
    }
  }
  return path;
}

/** Clear the profile photo and remove the uploaded object (if any). */
export async function removeAvatar(
  db: DbClient,
  profileId: string,
  currentPath: string | null | undefined,
): Promise<void> {
  const { error } = await db
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", profileId);
  if (error) throw error;
  if (currentPath && !isExternalAvatar(currentPath) && db.storage) {
    try {
      await db.storage.from(AVATAR_BUCKET).remove([currentPath]);
    } catch {
      // best-effort
    }
  }
}

/** Student-only opt-in that lets a linked counselor see the photo. */
export async function setAvatarSharing(
  db: DbClient,
  profileId: string,
  share: boolean,
): Promise<void> {
  const { error } = await db
    .from("profiles")
    .update({ share_avatar_with_counselor: share })
    .eq("id", profileId);
  if (error) throw error;
}
