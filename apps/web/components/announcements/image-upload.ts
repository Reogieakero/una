import type { SupabaseClient } from "@supabase/supabase-js";

/** Max attached photo size — enforced before preview + upload. */
export const MAX_IMAGE_MB = 5;

/** Verbatim validation from page.tsx — returns the toast message or null when OK. */
export function imageValidationError(f: File): string | null {
  if (!f.type.startsWith("image/")) {
    return "That file isn't an image — pick a JPG, PNG, or WEBP.";
  }
  if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
    return `Images must be under ${MAX_IMAGE_MB}MB.`;
  }
  return null;
}

/** Verbatim upload from page.tsx — stores under announcement-images, returns the public URL. */
export async function uploadAnnouncementImage(
  supabase: SupabaseClient,
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("announcement-images").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error("Image upload failed — please try again.");
  return supabase.storage.from("announcement-images").getPublicUrl(path).data.publicUrl;
}
