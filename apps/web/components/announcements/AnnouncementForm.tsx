"use client";

import type { BaseSyntheticEvent } from "react";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { ImagePlus, X } from "lucide-react";
import type { AnnouncementInput } from "@dorsu/shared-schemas";
import { initials } from "@/lib/format";
import { Button, Card, FieldError, Input, Textarea } from "@/components/ui/primitives";

export const AUDIENCES = [
  { value: "student", label: "Students" },
  { value: "counselor", label: "Counselors" },
  { value: "faculty", label: "Faculty" },
] as const;

export type AudienceValue = (typeof AUDIENCES)[number]["value"];

/**
 * Head-only composer — extracted verbatim from page.tsx.
 * Page owns useForm + image/audience state + save(); this is pure presentation.
 */
export function AnnouncementForm({
  myName,
  register,
  errors,
  audience,
  onToggleAudience,
  imagePreview,
  fileRef,
  onPickFile,
  onClearImage,
  onSubmit,
  onSaveDraft,
  saving,
}: {
  myName: string;
  register: UseFormRegister<AnnouncementInput>;
  errors: FieldErrors<AnnouncementInput>;
  audience: AudienceValue[];
  onToggleAudience: (v: AudienceValue) => void;
  imagePreview: string | null;
  fileRef: { readonly current: HTMLInputElement | null };
  onPickFile: (f: File | undefined) => void;
  onClearImage: () => void;
  onSubmit: (e?: BaseSyntheticEvent) => Promise<void>;
  onSaveDraft: () => void;
  saving: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 font-display text-sm font-bold text-white"
        >
          {initials(myName)}
        </span>
        <p className="min-w-0 text-sm font-semibold text-ink-soft">
          Share an update, {myName.split(" ")[0]}…
        </p>
      </div>
      <form className="mt-3 space-y-3" onSubmit={onSubmit}>
        <div>
          <Input placeholder="Post title — e.g. Booking opens for finals week" {...register("title")} />
          <FieldError message={errors.title?.message} />
        </div>
        <div>
          <Textarea rows={3} placeholder="What's happening? Keep it short and warm." {...register("body")} />
          <FieldError message={errors.body?.message} />
        </div>
        {imagePreview ? (
          <div className="relative overflow-hidden rounded-2xl border border-ink/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Attached preview" className="max-h-64 w-full object-cover" />
            <button
              type="button"
              onClick={onClearImage}
              aria-label="Remove image"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink/60 text-white transition hover:bg-ink/80"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Attach a photo"
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />
        <div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Audience (none ticked means everyone)">
            {AUDIENCES.map((a) => {
              const on = audience.includes(a.value);
              return (
                <button
                  key={a.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggleAudience(a.value)}
                  className={
                    on
                      ? "rounded-full bg-primary-600 px-3 py-1.5 text-xs font-bold text-white shadow-soft"
                      : "rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-cream-dark"
                  }
                >
                  {a.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] font-medium text-ink-faint">None ticked = everyone sees it.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            className="px-4"
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
            Photo
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onSaveDraft}>
              Save draft
            </Button>
            <Button size="sm" disabled={saving}>
              {saving ? "Posting…" : "Post now"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
