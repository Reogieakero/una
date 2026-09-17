"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { SETTINGS_BOARD_KEY, useSettingsBoard } from "@/lib/hooks/use-settings-board";
import { Badge, Button, Card, Input } from "@/components/ui/primitives";
import { ExportReportsButton } from "@/components/shared/reports-actions";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type Counselor = { id: string; name: string; spec: string | null; available: boolean; sessions: number };
type FeedItem = { id: string; at: string; text: string; tone: "info" | "success" | "warning" | "danger" };
type Post = { id: string; title: string; created_at: string; published_at: string | null };

const EMPTY_COUNSELORS: Counselor[] = [];
const EMPTY_FEED: FeedItem[] = [];
const EMPTY_POSTS: Post[] = [];
const EMPTY_GLANCE = { sessionsToday: 0, openReferrals: 0, published: 0 };

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";
}

/**
 * Shared /settings — profile, password, and email for counselors, admins,
 * and the head. The head additionally gets the workspace/team/activity
 * overview (office identity, counseling team, glance stats, posts, export).
 */
export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: board, isLoading, isError } = useSettingsBoard();
  const me = board?.me ?? null;
  const role = board?.role ?? null;
  const isHead = role === "guidance_head";
  const joined = board?.joined ?? "";
  const counselors = board?.counselors ?? EMPTY_COUNSELORS;
  const feed = board?.feed ?? EMPTY_FEED;
  const posts = board?.posts ?? EMPTY_POSTS;
  const glance = board?.glance ?? EMPTY_GLANCE;
  const loading = isLoading && !board;
  // Editable copies — seeded from the cache once per visit so typing never
  // fights a background refetch.
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [officeLocation, setOfficeLocation] = useState("");
  const [officeContact, setOfficeContact] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("overview");
  const [saving, setSaving] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwDone, setPwDone] = useState(false);

  const pwRules = [
    { label: "At least 8 characters", ok: newPw.length >= 8 },
    { label: "Upper and lower case letters", ok: /[a-z]/.test(newPw) && /[A-Z]/.test(newPw) },
    { label: "At least one number", ok: /\d/.test(newPw) },
  ];
  const pwMatch = !confirmPw ? null : confirmPw === newPw && newPw.length > 0;

  useEffect(() => {
    if (isError) toast.error("Couldn't load settings right now.");
  }, [isError]);

  // Seed the editable copies from the cache once per visit so typing never
  // fights a background refetch. The email heal stays here (a write), never
  // in the cached query: email changed + confirmed elsewhere means auth is
  // source of truth, so the directory copy is healed silently.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!board || seededRef.current) return;
    seededRef.current = true;
    setEmail(board.email);
    setNewEmail(board.email);
    setFullName(board.fullName);
    setOfficeName(board.office.name);
    setOfficeLocation(board.office.location);
    setOfficeContact(board.office.contact);
    if (board.authEmail && board.email && board.authEmail.toLowerCase() !== board.email.toLowerCase() && board.me) {
      const healed = board.authEmail;
      const who = board.me;
      void createClient()
        .from("profiles")
        .update({ email: healed })
        .eq("id", who)
        .then(({ error: healErr }) => {
          if (!healErr) {
            setEmail(healed);
            setNewEmail(healed);
            toast.success("Email updated everywhere.");
          }
        });
    }
  }, [board]);

  const completeness = useMemo(() => {
    const checks = isHead
      ? [fullName.trim().length >= 2, officeName.trim().length > 0, officeLocation.trim().length > 0, officeContact.trim().length > 0]
      : [fullName.trim().length >= 2];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [fullName, officeName, officeLocation, officeContact, isHead]);

  const saveProfile = async () => {
    if (!me || fullName.trim().length < 2) {
      toast.error("Name needs at least 2 characters.");
      return;
    }
    setSaving("profile");
    try {
      const { error } = await createClient().from("profiles").update({ full_name: fullName.trim() }).eq("id", me);
      if (error) throw error;
      setEditing(false);
      void qc.invalidateQueries({ queryKey: [...SETTINGS_BOARD_KEY] });
      toast.success("Profile updated.");
    } catch {
      toast.error("Couldn't update profile — please try again.");
    } finally {
      setSaving(null);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8 || !/[a-z]/.test(newPw) || !/[A-Z]/.test(newPw) || !/\d/.test(newPw) || newPw.length > 72) {
      toast.error("Password must be 8+ characters with upper, lower case and a number.");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Those passwords don't match.");
      return;
    }
    setSaving("password");
    try {
      const { error } = await createClient().auth.updateUser({ password: newPw });
      if (error) throw error;
      setNewPw("");
      setConfirmPw("");
      setPwDone(false);
      toast.success("Password changed — use it next time you log in.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change password.");
    } finally {
      setSaving(null);
    }
  };

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (next.toLowerCase() === email.toLowerCase()) {
      toast.error("That's already your email.");
      return;
    }
    setSaving("email");
    try {
      const { error } = await createClient().auth.updateUser({ email: next });
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: [...SETTINGS_BOARD_KEY] });
      toast.success("Confirmation sent — approve it in both inboxes, then your email switches over.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the email change.");
    } finally {
      setSaving(null);
    }
  };

  const saveOffice = async () => {
    if (!isHead) return;
    if (!officeName.trim()) {
      toast.error("Office name can't be empty.");
      return;
    }
    setSaving("office");
    try {
      const { error } = await createClient()
        .from("workspace_settings")
        .upsert(
          {
            key: "office",
            value: { name: officeName.trim(), location: officeLocation.trim(), contact: officeContact.trim() },
            updated_by: me,
          },
          { onConflict: "key" }
        );
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: [...SETTINGS_BOARD_KEY] });
      toast.success("Workspace saved — sidebar updates within a minute.");
    } catch {
      toast.error("Couldn't save workspace — please try again.");
    } finally {
      setSaving(null);
    }
  };

  if (!loading && (!role || !["counselor", "guidance_head", "admin"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors, admins, and the guidance head can open settings.</p></Card>
      </div>
    );
  }

  const roleLabel = isHead ? "Guidance head" : role === "admin" ? "Admin" : "Counselor";

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className={isHead ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]" : "grid items-start gap-4"}>
        {/* Left — profile + tabs */}
        <div className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-card">
            <div aria-hidden className="h-24 bg-gradient-to-r from-primary-700 via-primary-600 to-accent-400" />
            <div className="px-5 pb-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="-mt-10 flex items-end gap-3">
                  <span
                    aria-hidden
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-600 font-display text-2xl font-bold text-white ring-4 ring-white"
                  >
                    {loading ? "?" : initials(fullName || email)}
                  </span>
                  <div className="pb-1 leading-tight">
                    <p className="font-display text-xl font-bold text-ink">{loading ? "…" : fullName || "Unnamed"}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-medium text-ink-muted">
                      <Badge tone={isHead ? "warning" : "info"}>{loading ? "…" : roleLabel}</Badge>
                      {isHead && <span>{officeLocation || "—"}</span>}
                      {joined && <span>· Joined {new Date(joined).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant={editing ? "ghost" : "outline"} onClick={() => (editing ? saveProfile() : setEditing(true))} disabled={saving === "profile"}>
                  {saving === "profile" ? "Saving…" : editing ? "Done" : "Edit profile"}
                </Button>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[13px] font-bold text-ink">Profile complete</p>
                  <p className="font-display text-sm font-bold text-primary-700">{completeness}%</p>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
                  <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${completeness}%` }} />
                </div>
              </div>
              {editing && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="settings-name">Full name</label>
                    <Input id="settings-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-ink-muted">Email (managed by Auth)</label>
                    <Input value={email} disabled />
                  </div>
                </div>
              )}
            </div>
          </section>

          <div
            role="tablist"
            aria-label="Profile sections"
            className="inline-flex rounded-xl border border-ink/10 bg-white p-1 shadow-card"
          >
            {(
              [
                { value: "overview", label: "Overview" },
                ...(isHead ? [{ value: "team", label: `Team · ${counselors.length}` }] : []),
                { value: "activity", label: `Activity · ${feed.length}` },
                { value: "security", label: "Security" },
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

          {tab === "overview" && (
            <div className="space-y-4" role="tabpanel">
              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <h2 className="font-display text-base font-bold text-ink">About</h2>
                {loading ? (
                  <div className="animate-pulse space-y-2 pt-3" aria-hidden>
                    <div className="h-4 rounded-full bg-ink/10" />
                    <div className="h-4 w-2/3 rounded-full bg-ink/10" />
                  </div>
                ) : (
                  <dl className="mt-3 divide-y divide-ink/10 text-sm">
                    {[
                      ["Name", fullName || "—"],
                      ["Role", roleLabel],
                      ["Email", email || "—"],
                      ...(isHead
                        ? [
                            ["Office", officeName || "—"],
                            ["Location", officeLocation || "—"],
                            ["Contact", officeContact || "—"],
                          ]
                        : []),
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                        <dt className="font-medium text-ink-muted">{k}</dt>
                        <dd className="truncate font-bold text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
              {isHead && (
              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <h2 className="font-display text-base font-bold text-ink">Workspace</h2>
                <p className="mt-0.5 text-[13px] text-ink-muted">Shown in the sidebar on every staff page.</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="office-name">Office name</label>
                    <Input id="office-name" value={officeName} onChange={(e) => setOfficeName(e.target.value)} placeholder="DOrSU Guidance" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="office-location">Location</label>
                    <Input id="office-location" value={officeLocation} onChange={(e) => setOfficeLocation(e.target.value)} placeholder="Mati City" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="office-contact">Contact (optional)</label>
                    <Input id="office-contact" value={officeContact} onChange={(e) => setOfficeContact(e.target.value)} placeholder="guidance@dorsu.edu.ph" />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" disabled={saving === "office"} onClick={saveOffice}>
                    {saving === "office" ? "Saving…" : "Save workspace"}
                  </Button>
                </div>
              </section>
              )}
            </div>
          )}

          {isHead && tab === "team" && (
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card" role="tabpanel">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-ink">Counseling team</h2>
                <Link href="/users" className="text-[13px] font-bold text-primary-600 hover:underline">
                  Manage accounts
                </Link>
              </div>
              {loading ? (
                <div className="animate-pulse space-y-3 pt-3" aria-hidden>
                  <div className="h-12 rounded-xl bg-ink/10" />
                  <div className="h-12 rounded-xl bg-ink/10" />
                </div>
              ) : counselors.length ? (
                <ul className="mt-3 divide-y divide-ink/10">
                  {counselors.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 font-display text-sm font-bold text-white">
                        {initials(c.name)}
                      </span>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-sm font-bold text-ink">{c.name}</p>
                        <p className="truncate text-xs font-medium text-ink-muted">
                          {c.spec ?? "Counselor"} · {c.sessions} session{c.sessions === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Badge tone={c.available ? "success" : "warning"}>{c.available ? "Available" : "Off"}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">
                  No counselors yet — <Link href="/users/new" className="font-bold text-primary-600 hover:underline">add the first one</Link>.
                </p>
              )}
            </section>
          )}

          {tab === "activity" && (
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card" role="tabpanel">
              <h2 className="font-display text-base font-bold text-ink">My activity</h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">Triage moves, posts, and emergency accesses you made.</p>
              {loading ? (
                <div className="animate-pulse space-y-3 pt-3" aria-hidden>
                  <div className="h-10 rounded-xl bg-ink/10" />
                  <div className="h-10 rounded-xl bg-ink/10" />
                </div>
              ) : feed.length ? (
                <ul className="mt-3 space-y-0">
                  {feed.map((f) => (
                    <li key={f.id} className="relative flex gap-3 pb-4 last:pb-0">
                      <span aria-hidden className="flex flex-col items-center">
                        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${f.tone === "success" ? "bg-green-500" : f.tone === "warning" ? "bg-amber-500" : "bg-primary-500"}`} />
                        <span aria-hidden className="w-px flex-1 bg-ink/10" />
                      </span>
                      <div className="min-w-0 flex-1 leading-snug">
                        <p className="text-sm font-semibold text-ink">{f.text}</p>
                        <p className="text-[11px] font-medium text-ink-faint">{timeAgo(f.at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">
                  Nothing yet — triage a referral or publish a post and it shows up here.
                </p>
              )}
            </section>
          )}

          {tab === "security" && (
            <div className="space-y-4" role="tabpanel">
              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <h2 className="font-display text-base font-bold text-ink">Change password</h2>
                <p className="mt-0.5 text-[13px] text-ink-muted">Takes effect immediately on next login.</p>
                <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={changePassword}>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="sec-password">New password</label>
                    <div className="relative">
                      <Input
                        id="sec-password"
                        type={showPw ? "text" : "password"}
                        placeholder="8+ chars, upper, lower & number"
                        autoComplete="new-password"
                        className="pr-11"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        onBlur={() => setPwDone(true)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
                      >
                        {showPw ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>
                    {pwDone && (
                      <ul className="mt-1.5 space-y-1" aria-label="Password requirements">
                        {pwRules.map((r) => (
                          <li key={r.label} className={`flex items-center gap-1.5 text-xs font-semibold ${r.ok ? "text-green-700" : "text-ink-faint"}`}>
                            {r.ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                            {r.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="sec-confirm">Confirm new password</label>
                    <div className="relative">
                      <Input
                        id="sec-confirm"
                        type={showConfirm ? "text" : "password"}
                        placeholder="Repeat the password"
                        autoComplete="new-password"
                        className="pr-11"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>
                    {pwMatch !== null && (
                      <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-semibold ${pwMatch ? "text-green-700" : "text-red-600"}`}>
                        {pwMatch ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                        {pwMatch ? "Passwords match" : "Passwords don't match"}
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end md:col-span-2">
                    <Button size="sm" disabled={saving === "password"}>
                      {saving === "password" ? "Saving…" : "Change password"}
                    </Button>
                  </div>
                </form>
              </section>

              <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
                <h2 className="font-display text-base font-bold text-ink">Change email</h2>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
                  Supabase sends a confirmation to <span className="font-bold text-ink">both</span> the old and
                  the new address — approve both and the switch completes. Current:{" "}
                  <span className="font-bold text-ink">{email || "—"}</span>
                </p>
                <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={changeEmail}>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-bold text-ink-muted" htmlFor="sec-email">New email</label>
                    <Input id="sec-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" />
                  </div>
                  <Button size="sm" disabled={saving === "email"} className="shrink-0">
                    {saving === "email" ? "Sending…" : "Send confirmation"}
                  </Button>
                </form>
              </section>
            </div>
          )}
        </div>

        {/* Right column — head-only office overview */}
        {isHead && (
        <div className="min-w-0 space-y-4">
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
            <h2 className="font-display text-base font-bold text-ink">Office at a glance</h2>
            {loading ? (
              <div className="mt-3 grid animate-pulse grid-cols-2 gap-3" aria-hidden>
                <div className="h-16 rounded-xl bg-ink/10" />
                <div className="h-16 rounded-xl bg-ink/10" />
                <div className="h-16 rounded-xl bg-ink/10" />
                <div className="h-16 rounded-xl bg-ink/10" />
              </div>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-3">
                {[
                  ["Counselors", counselors.length],
                  ["Sessions today", glance.sessionsToday],
                  ["Referrals waiting", glance.openReferrals],
                  ["Posts live", glance.published],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-xl bg-cream px-3 py-2.5">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{k}</dt>
                    <dd className="font-display text-2xl font-bold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-ink">Latest posts</h2>
              <Link href="/announcements" className="text-[13px] font-bold text-primary-600 hover:underline">
                View all
              </Link>
            </div>
            {loading ? (
              <div className="animate-pulse space-y-2 pt-3" aria-hidden>
                <div className="h-10 rounded-xl bg-ink/10" />
                <div className="h-10 rounded-xl bg-ink/10" />
              </div>
            ) : posts.length ? (
              <ul className="mt-3 divide-y divide-ink/10">
                {posts.slice(0, 3).map((p) => (
                  <li key={p.id} className="py-2 first:pt-0 last:pb-0">
                    <p className="truncate text-sm font-bold text-ink">{p.title}</p>
                    <p className="text-[11px] font-medium text-ink-faint">{timeAgo(p.published_at ?? p.created_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-[13px] text-ink-muted">No posts yet.</p>
            )}
          </section>

          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
            <h2 className="font-display text-base font-bold text-ink">Data export</h2>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
              One styled workbook — cover, summary, sessions, referrals, feedback, wellbeing, team & posts. Print-ready with filters, totals & proper spacing. Aliases only, never student names.
            </p>
            <div className="mt-3 print:hidden">
              <ExportReportsButton />
            </div>
          </section>
        </div>
        )}
      </div>
    </div>
  );
}
