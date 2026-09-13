"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, X } from "lucide-react";
import { announcementSchema, type AnnouncementInput } from "@dorsu/shared-schemas";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Card, FieldError, Input, Textarea } from "@/components/ui/primitives";
import { notifyStaff } from "@/lib/notify";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ReportDonut, ReportLines } from "@/components/shared/reports-charts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Announcement = {
  id: string;
  author_profile_id: string;
  title: string;
  body: string;
  audience: string[] | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
};

const AUDIENCES = [
  { value: "student", label: "Students" },
  { value: "counselor", label: "Counselors" },
  { value: "faculty", label: "Faculty" },
] as const;

const MAX_IMAGE_MB = 5;

function statusOf(a: Announcement, now: number): "published" | "draft" | "scheduled" {
  if (!a.published_at) return "draft";
  return new Date(a.published_at).getTime() <= now ? "published" : "scheduled";
}

function statusTone(s: string): "success" | "warning" | "info" {
  if (s === "published") return "success";
  if (s === "scheduled") return "info";
  return "warning";
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function audienceLabel(a: string[] | null): string {
  if (!a || !a.length) return "Everyone";
  const names: Record<string, string> = { student: "Students", counselor: "Counselors", faculty: "Faculty", guidance_head: "Head" };
  return a.map((r) => names[r] ?? r).join(", ");
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";
}

/** Head-only announcements — Facebook-style newsfeed plus an insights tab. */
export default function AnnouncementsPage() {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [authors, setAuthors] = useState<Map<string, string>>(new Map());
  const [myName, setMyName] = useState("Guidance");
  const [audience, setAudience] = useState<("student" | "counselor" | "faculty")[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [tab, setTab] = useState("feed");
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState, reset } = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
  });

  const reload = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if ((me as { full_name: string | null } | null)?.full_name) {
        setMyName((me as { full_name: string }).full_name);
      }
    }
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const list = ((data ?? []) as Announcement[]);
    setRows(list);
    const authorIds = [...new Set(list.map((a) => a.author_profile_id))];
    if (authorIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", authorIds.slice(0, 100));
      setAuthors(
        new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "Staff"]))
      );
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await reload();
      } catch {
        toast.error("Couldn't load announcements right now.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const now = Date.now();

  const stats = useMemo(() => {
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const by = (fn: (a: Announcement) => boolean) => rows.filter(fn).length;
    const byAuthor = new Map<string, number>();
    for (const a of rows) byAuthor.set(a.author_profile_id, (byAuthor.get(a.author_profile_id) ?? 0) + 1);
    return {
      total: rows.length,
      published: by((a) => statusOf(a, now) === "published"),
      drafts: by((a) => statusOf(a, now) === "draft"),
      withImages: by((a) => !!a.image_url),
      thisWeek: by((a) => new Date(a.created_at).getTime() >= weekAgo),
      topAuthors: [...byAuthor.entries()]
        .map(([id, n]) => ({ name: authors.get(id) ?? "Staff", count: n }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, authors]);

  const activity = useMemo(() => {
    const start = new Date(now - 13 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const buckets = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      return {
        key: d.toDateString(),
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: 0,
      };
    });
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const a of rows) {
      const b = byKey.get(new Date(a.created_at).toDateString());
      if (b) b.value += 1;
    }
    return buckets.map(({ label, value }) => ({ label, value }));
  }, [rows, now]);

  const audienceMix = useMemo(() => {
    const defs = [
      { name: "Everyone", color: "#2563EB", match: (a: Announcement) => !a.audience || !a.audience.length },
      { name: "Students", color: "#22C55E", match: (a: Announcement) => !!a.audience?.includes("student") },
      { name: "Counselors", color: "#F59E0B", match: (a: Announcement) => !!a.audience?.includes("counselor") },
      { name: "Faculty", color: "#8B5CF6", match: (a: Announcement) => !!a.audience?.includes("faculty") },
    ];
    return defs
      .map((d) => ({ name: d.name, color: d.color, value: rows.filter(d.match).length }))
      .filter((s) => s.value > 0);
  }, [rows]);

  const toggleAudience = (v: "student" | "counselor" | "faculty") =>
    setAudience((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const pickImage = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("That file isn't an image — pick a JPG, PNG, or WEBP.");
      return;
    }
    if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`Images must be under ${MAX_IMAGE_MB}MB.`);
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadImage = async (file: File): Promise<string> => {
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("announcement-images").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error("Image upload failed — please try again.");
    return supabase.storage.from("announcement-images").getPublicUrl(path).data.publicUrl;
  };

  const save = (publish: boolean) =>
    handleSubmit(async (v) => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You're signed out — please log in again.");
        return;
      }
      setSaving(true);
      try {
        const image_url = imageFile ? await uploadImage(imageFile) : null;
        const { error } = await supabase.from("announcements").insert({
          author_profile_id: user.id,
          title: v.title,
          body: v.body,
          audience: audience.length ? audience : null,
          image_url,
          published_at: publish ? new Date().toISOString() : null,
        });
        if (error) throw error;
        reset();
        setAudience([]);
        clearImage();
        await reload();
        if (publish) {
          let q = supabase.from("profiles").select("id").eq("is_active", true);
          if (audience.length) q = q.in("role", audience);
          const { data: targets } = await q.limit(500);
          await notifyStaff(((targets ?? []) as { id: string }[]).map((t) => t.id), {
            type: "announcement",
            title: v.title,
            body: v.body.length > 180 ? `${v.body.slice(0, 180)}…` : v.body,
            link: "/announcements",
          });
          toast.success("Published to the newsfeed.");
        } else {
          toast.success("Saved as a draft.");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save — please try again.");
      } finally {
        setSaving(false);
      }
    });

  const setPublished = async (a: Announcement, at: string | null, tag: string) => {
    setBusyId(tag);
    try {
      const { error } = await createClient().from("announcements").update({ published_at: at }).eq("id", a.id);
      if (error) throw error;
      await reload();
      toast.success(at ? "Post published." : "Post unpublished.");
    } catch {
      toast.error("Couldn't update that post — please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const removePost = async (a: Announcement) => {
    setConfirmDelete(null);
    setBusyId(a.id);
    try {
      const { error } = await createClient().from("announcements").delete().eq("id", a.id);
      if (error) throw error;
      if (a.image_url?.includes("/announcement-images/")) {
        const path = a.image_url.split("/announcement-images/")[1];
        if (path) {
          await createClient().storage.from("announcement-images").remove([path]).catch(() => {});
        }
      }
      await reload();
      toast.success("Post deleted.");
    } catch {
      toast.error("Couldn't delete that post — please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const statCards = [
    { label: "Total posts", value: stats.total },
    { label: "Published", value: stats.published },
    { label: "Drafts", value: stats.drafts },
    { label: "With images", value: stats.withImages },
    { label: "This week", value: stats.thisWeek },
  ];

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Announcements</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Announcements</h1>
            <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-ink-muted">
              The office newsfeed — post updates with photos, or check how posting is doing.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Announcements views"
            className="inline-flex shrink-0 rounded-xl border border-ink/10 bg-white p-1 shadow-card"
          >
            {(
              [
                { value: "feed", label: "Newsfeed" },
                { value: "insights", label: "Insights" },
              ] as const
            ).map((t) => {
              const selected = tab === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(t.value)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                    selected ? "bg-primary-600 text-white shadow-soft" : "text-ink-muted hover:bg-cream hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Newsfeed ── */}
        <TabsContent value="feed">
          <div className="mx-auto max-w-2xl space-y-4">
            {/* Composer */}
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
              <form className="mt-3 space-y-3" onSubmit={save(true)}>
                <div>
                  <Input placeholder="Post title — e.g. Booking opens for finals week" {...register("title")} />
                  <FieldError message={formState.errors.title?.message} />
                </div>
                <div>
                  <Textarea rows={3} placeholder="What's happening? Keep it short and warm." {...register("body")} />
                  <FieldError message={formState.errors.body?.message} />
                </div>
                {imagePreview ? (
                  <div className="relative overflow-hidden rounded-2xl border border-ink/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Attached preview" className="max-h-64 w-full object-cover" />
                    <button
                      type="button"
                      onClick={clearImage}
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
                  onChange={(e) => pickImage(e.target.files?.[0])}
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
                          onClick={() => toggleAudience(a.value)}
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
                    <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void save(false)()}>
                      Save draft
                    </Button>
                    <Button size="sm" disabled={saving}>
                      {saving ? "Posting…" : "Post now"}
                    </Button>
                  </div>
                </div>
              </form>
            </Card>

            {/* Feed */}
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card" aria-hidden>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-ink/10" />
                    <div className="h-3.5 w-1/3 rounded-full bg-ink/10" />
                  </div>
                  <div className="mt-3 h-16 rounded-xl bg-ink/10" />
                </div>
              ))}
            {!loading &&
              rows.map((a) => {
                const st = statusOf(a, now);
                const name = authors.get(a.author_profile_id) ?? "Staff";
                return (
                  <article key={a.id} className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 font-display text-sm font-bold text-white"
                      >
                        {initials(name)}
                      </span>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-sm font-bold text-ink">{name}</p>
                        <p className="truncate text-xs font-medium text-ink-muted">
                          {timeAgo(a.published_at ?? a.created_at)} · {audienceLabel(a.audience)}
                        </p>
                      </div>
                      {st !== "published" && <Badge tone={statusTone(st)}>{st === "draft" ? "Draft" : "Scheduled"}</Badge>}
                    </div>
                    <h2 className="mt-3 font-display text-base font-bold text-ink">{a.title}</h2>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{a.body}</p>
                    {a.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.image_url}
                        alt=""
                        loading="lazy"
                        className="mt-3 max-h-96 w-full rounded-2xl border border-ink/10 object-cover"
                      />
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink/10 pt-3">
                      {st !== "published" && (
                        <Button size="sm" variant="accent" disabled={busyId === `pub-${a.id}`} onClick={() => void setPublished(a, new Date().toISOString(), `pub-${a.id}`)}>
                          Publish
                        </Button>
                      )}
                      {st === "published" && (
                        <Button size="sm" variant="outline" disabled={busyId === `unpub-${a.id}`} onClick={() => void setPublished(a, null, `unpub-${a.id}`)}>
                          Unpublish
                        </Button>
                      )}
                      <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => setConfirmDelete(a)}>
                        Delete
                      </Button>
                    </div>
                  </article>
                );
              })}
            {!loading && !rows.length && (
              <Card><p className="text-center text-sm text-ink-muted">Nothing posted yet — write the first update above.</p></Card>
            )}
          </div>
        </TabsContent>

        {/* ── Insights ── */}
        <TabsContent value="insights">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                      <div className="h-3.5 w-2/3 rounded-full bg-ink/10" />
                      <div className="mt-3 h-8 w-1/3 rounded-lg bg-ink/10" />
                    </div>
                  ))
                : statCards.map((s) => (
                    <div key={s.label} className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                      <p className="text-[13px] font-medium text-ink-muted">{s.label}</p>
                      <p className="mt-1 font-display text-3xl font-bold text-ink">{s.value}</p>
                    </div>
                  ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <h2 className="font-display text-base font-bold text-ink">Posts — last 14 days</h2>
                <p className="mt-0.5 text-[13px] text-ink-muted">Publishing rhythm, drafts included.</p>
                {loading ? (
                  <div className="animate-pulse pt-4" aria-hidden>
                    <div className="h-[240px] rounded-xl bg-ink/10" />
                  </div>
                ) : rows.length ? (
                  <ReportLines data={activity} />
                ) : (
                  <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No posts yet.</p>
                )}
              </section>
              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <h2 className="font-display text-base font-bold text-ink">Audience mix</h2>
                <p className="mt-0.5 text-[13px] text-ink-muted">Who posts are aimed at — a post can tag several groups.</p>
                {loading ? (
                  <div className="animate-pulse pt-4" aria-hidden>
                    <div className="h-[200px] rounded-xl bg-ink/10" />
                  </div>
                ) : audienceMix.length ? (
                  <ReportDonut data={audienceMix} />
                ) : (
                  <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No posts yet.</p>
                )}
              </section>
            </div>

            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
              <h2 className="font-display text-base font-bold text-ink">Top authors</h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">Who keeps the newsfeed alive.</p>
              {loading ? (
                <div className="animate-pulse space-y-3 pt-3" aria-hidden>
                  <div className="h-10 rounded-xl bg-ink/10" />
                  <div className="h-10 rounded-xl bg-ink/10" />
                </div>
              ) : stats.topAuthors.length ? (
                <ul className="mt-3 divide-y divide-ink/10">
                  {stats.topAuthors.map((a, i) => (
                    <li key={a.name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <p className="truncate text-sm font-bold text-ink">
                        <span className="mr-2 text-xs font-bold text-ink-faint">#{i + 1}</span>
                        {a.name}
                      </p>
                      <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                        {a.count} post{a.count === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No authors yet.</p>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete confirm */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ann-del-title"
          aria-describedby="ann-del-desc"
        >
          <div aria-hidden className="absolute inset-0 bg-ink/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-card">
            <h2 id="ann-del-title" className="font-display text-lg font-bold text-ink">Delete this post?</h2>
            <p id="ann-del-desc" className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">
              “{confirmDelete.title}” disappears for everyone, photo included. This can&apos;t be undone — unpublish instead to hide it temporarily.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)} autoFocus>
                Back
              </Button>
              <Button size="sm" variant="danger" onClick={() => void removePost(confirmDelete)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
