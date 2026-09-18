"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { announcementSchema, type AnnouncementInput } from "@dorsu/shared-schemas";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAnnouncementsBoard } from "@/lib/hooks/use-announcements-board";
import { useFocusRow } from "@/lib/hooks/use-focus-row";
import { useMutationAction } from "@/lib/hooks/use-mutation-action";
import { useClearSectionBadge } from "@/lib/hooks/use-clear-section-badge";
import { HoverMenu } from "@/components/shared/hover-menu";
import { Button, Card } from "@/components/ui/primitives";
import { notifyStaff } from "@/lib/notify";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ReportDonut, ReportLines } from "@/components/shared/reports-charts";
import { AnnouncementCard, statusOf, type Announcement } from "@/components/announcements/AnnouncementCard";
import { AnnouncementForm, type AudienceValue } from "@/components/announcements/AnnouncementForm";
import { imageValidationError, uploadAnnouncementImage } from "@/components/announcements/image-upload";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const EMPTY_ROWS: Announcement[] = [];
const EMPTY_AUTHORS = new Map<string, string>();

/** Head-only announcements — Facebook-style newsfeed plus an insights tab. */
export default function AnnouncementsPage() {
  const { data: board, isLoading, isError, refetch } = useAnnouncementsBoard();
  const rows = board?.rows ?? EMPTY_ROWS;
  const authors = board?.authors ?? EMPTY_AUTHORS;
  const myName = board?.myName ?? "Guidance";
  const role = board?.role ?? null;
  const loading = isLoading && !board;
  // Visiting the section clears its sidebar badge (badges count unread
  // notification rows, not page views).
  useClearSectionBadge("/announcements", !loading && !!board);
  const [audience, setAudience] = useState<AudienceValue[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { busyId, run: runMutation } = useMutationAction();
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [tab, setTab] = useState("feed");
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState, reset } = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
  });

  // Stats live in a floating panel — same hover/click behavior as the
  // /appointments Stats menu. Closes on mouse leave, outside click, or Escape.
  const [statsOpen, setStatsOpen] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openStats = () => {
    if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    setStatsOpen(true);
  };
  const scheduleStatsClose = () => {
    if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    statsCloseTimer.current = setTimeout(() => setStatsOpen(false), 150);
  };
  const toggleStats = () => {
    if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    setStatsOpen((v) => !v);
  };

  useEffect(() => {
    if (!statsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (statsRef.current && !statsRef.current.contains(e.target as Node)) setStatsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStatsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      if (statsCloseTimer.current) clearTimeout(statsCloseTimer.current);
    };
  }, [statsOpen]);

  useEffect(() => {
    if (isError) toast.error("Couldn't load announcements right now.");
  }, [isError]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const now = Date.now();

  // Publishing is head-only (rbac + RLS). Other staff get a read-only feed
  // of published posts aimed at them (or everyone). Drafts never reach them
  // — RLS already excludes drafts, this also drops other roles' targeting.
  const isHead = role === "guidance_head";
  const audienceKey = role === "faculty" ? "faculty" : "counselor";
  const visibleRows = isHead
    ? rows
    : rows.filter(
        (a) =>
          statusOf(a, now) === "published" &&
          (!a.audience || !a.audience.length || a.audience.includes(audienceKey))
      );
  const focusedId = useFocusRow(visibleRows);

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

  const toggleAudience = (v: AudienceValue) =>
    setAudience((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const pickImage = (f: File | undefined) => {
    if (!f) return;
    const err = imageValidationError(f);
    if (err) {
      toast.error(err);
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
    return uploadAnnouncementImage(createClient(), file);
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
        const { data: created, error } = await supabase.from("announcements").insert({
          author_profile_id: user.id,
          title: v.title,
          body: v.body,
          audience: audience.length ? audience : null,
          image_url,
          published_at: publish ? new Date().toISOString() : null,
        }).select("id").single();
        if (error) throw error;
        reset();
        setAudience([]);
        clearImage();
        await refetch();
        if (publish) {
          let q = supabase.from("profiles").select("id").eq("is_active", true);
          if (audience.length) q = q.in("role", audience);
          const { data: targets } = await q.limit(500);
          // Fire-and-forget: publish success reflects the DB write, not delivery.
          void notifyStaff(((targets ?? []) as { id: string }[]).map((t) => t.id), {
            type: "announcement",
            title: v.title,
            body: v.body.length > 180 ? `${v.body.slice(0, 180)}…` : v.body,
            link: ((created as { id?: string } | null)?.id)
              ? `/announcements#focus-${(created as { id: string }).id}`
              : "/announcements",
            ...(((created as { id?: string } | null)?.id)
              ? { dedupeKey: `announcement:${(created as { id: string }).id}:published` }
              : {}),
            tone: "info",
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
    const result = await runMutation(
      tag,
      async () => {
        const { error } = await createClient().from("announcements").update({ published_at: at }).eq("id", a.id);
        if (error) throw error;
      },
      { label: "update that post" }
    );
    if (!result.ok) return;
    await refetch();
    if (at) {
      // Toggling a draft live notifies the same role-filtered audience as a
      // fresh publish — fire-and-forget, success reflects the DB write.
      try {
        const supabase = createClient();
        let q = supabase.from("profiles").select("id").eq("is_active", true);
        if (a.audience?.length) q = q.in("role", a.audience as AudienceValue[]);
        const { data: targets } = await q.limit(500);
        void notifyStaff(((targets ?? []) as { id: string }[]).map((t) => t.id), {
          type: "announcement",
          title: a.title,
          body: a.body.length > 180 ? `${a.body.slice(0, 180)}…` : a.body,
          link: `/announcements#focus-${a.id}`,
          dedupeKey: `announcement:${a.id}:published`,
          tone: "info",
        });
      } catch {
        // Audience lookup failed — the post is still published; skip the ping.
      }
      toast.success("Post published.");
    } else {
      toast.success("Post unpublished.");
    }
  };

  const removePost = async (a: Announcement) => {
    setConfirmDelete(null);
    const result = await runMutation(
      a.id,
      async () => {
        const { error } = await createClient().from("announcements").delete().eq("id", a.id);
        if (error) throw error;
        if (a.image_url?.includes("/announcement-images/")) {
          const path = a.image_url.split("/announcement-images/")[1];
          if (path) {
            await createClient().storage.from("announcement-images").remove([path]).catch(() => {});
          }
        }
      },
      { label: "delete that post" }
    );
    if (!result.ok) return;
    await refetch();
    toast.success("Post deleted.");
  };

  const statCards = [
    { label: "Total posts", value: stats.total },
    { label: "Published", value: stats.published },
    { label: "Drafts", value: stats.drafts },
    { label: "With images", value: stats.withImages },
    { label: "This week", value: stats.thisWeek },
  ];

  const goInsights = () => setTab("insights");

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
              {isHead
                ? "The office newsfeed — post updates with photos, or check how posting is doing."
                : "Updates from the guidance office — news meant for you."}
            </p>
          </div>
          {isHead && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <HoverMenu
              ariaLabel="Switch view"
              buttonLabel={<>View: {tab === "feed" ? "Newsfeed" : "Insights"}</>}
              options={[
                { value: "feed", label: "Newsfeed" },
                { value: "insights", label: "Insights" },
              ]}
              value={tab}
              onPick={setTab}
            />
            <div
              ref={statsRef}
              className="relative shrink-0"
              onMouseEnter={openStats}
              onMouseLeave={scheduleStatsClose}
            >
              <button
                type="button"
                onClick={toggleStats}
                onFocus={openStats}
                onBlur={scheduleStatsClose}
                aria-haspopup="dialog"
                aria-expanded={statsOpen}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-ink/10 bg-white px-3 text-[13px] font-bold text-ink-soft shadow-card transition hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                Stats
                <ChevronDown aria-hidden className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200", statsOpen && "rotate-180")} />
              </button>
              {statsOpen && (
                <div
                  role="dialog"
                  aria-label="Announcement stats"
                  className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-lg border border-ink/10 bg-white py-1 shadow-card"
                >
                  {loading ? (
                    <div className="animate-pulse px-4 py-3" aria-hidden>
                      <div className="h-10 rounded-lg bg-ink/10" />
                      <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                      <div className="mt-2 h-10 rounded-lg bg-ink/10" />
                    </div>
                  ) : (
                    statCards.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => {
                          goInsights();
                          setStatsOpen(false);
                        }}
                        title={`See ${s.label} in Insights`}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:bg-cream"
                      >
                        <span className="text-[13px] font-medium text-ink-muted">{s.label}</span>
                        <span className="font-display text-xl font-bold text-ink">{s.value}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* ── Newsfeed ── */}
        <TabsContent value="feed">
          <div className="mx-auto max-w-2xl space-y-4">
            {/* Composer (head only — publishing is head-only per rbac + RLS) */}
            {isHead && (
            <AnnouncementForm
              myName={myName}
              register={register}
              errors={formState.errors}
              audience={audience}
              onToggleAudience={toggleAudience}
              imagePreview={imagePreview}
              fileRef={fileRef}
              onPickFile={pickImage}
              onClearImage={clearImage}
              onSubmit={save(true)}
              onSaveDraft={() => void save(false)()}
              saving={saving}
            />
            )}

            {/* Feed */}
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-ink/10 bg-white p-5 shadow-card" aria-hidden>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-ink/10" />
                    <div className="h-3.5 w-1/3 rounded-full bg-ink/10" />
                  </div>
                  <div className="mt-3 h-16 rounded-lg bg-ink/10" />
                </div>
              ))}
            {!loading &&
              visibleRows.map((a) => (
                <AnnouncementCard
                  key={a.id}
                  a={a}
                  now={now}
                  authorName={authors.get(a.author_profile_id) ?? "Staff"}
                  isHead={isHead}
                  busyId={busyId}
                  focused={focusedId === a.id}
                  onPublish={(x) => void setPublished(x, new Date().toISOString(), `pub-${x.id}`)}
                  onUnpublish={(x) => void setPublished(x, null, `unpub-${x.id}`)}
                  onDelete={(x) => setConfirmDelete(x)}
                />
              ))}
            {!loading && !visibleRows.length && (
              <Card><p className="text-center text-sm text-ink-muted">{isHead ? "Nothing posted yet — write the first update above." : "No announcements for you yet."}</p></Card>
            )}
          </div>
        </TabsContent>

        {/* ── Insights ── */}
        <TabsContent value="insights">
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <h2 className="font-display text-base font-bold text-ink">Posts — last 14 days</h2>
                <p className="mt-0.5 text-[13px] text-ink-muted">Publishing rhythm, drafts included.</p>
                {loading ? (
                  <div className="animate-pulse pt-4" aria-hidden>
                    <div className="h-[240px] rounded-lg bg-ink/10" />
                  </div>
                ) : rows.length ? (
                  <ReportLines data={activity} />
                ) : (
                  <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No posts yet.</p>
                )}
              </section>
              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <h2 className="font-display text-base font-bold text-ink">Audience mix</h2>
                <p className="mt-0.5 text-[13px] text-ink-muted">Who posts are aimed at — a post can tag several groups.</p>
                {loading ? (
                  <div className="animate-pulse pt-4" aria-hidden>
                    <div className="h-[200px] rounded-lg bg-ink/10" />
                  </div>
                ) : audienceMix.length ? (
                  <ReportDonut data={audienceMix} />
                ) : (
                  <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No posts yet.</p>
                )}
              </section>
            </div>

            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
              <h2 className="font-display text-base font-bold text-ink">Top authors</h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">Who keeps the newsfeed alive.</p>
              {loading ? (
                <div className="animate-pulse space-y-3 pt-3" aria-hidden>
                  <div className="h-10 rounded-lg bg-ink/10" />
                  <div className="h-10 rounded-lg bg-ink/10" />
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
                <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">No authors yet.</p>
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
          <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-card">
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
