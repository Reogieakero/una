"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { SETTINGS_BOARD_KEY, useSettingsBoard } from "@/lib/hooks/use-settings-board";
import { Card } from "@/components/ui/primitives";
import { ProfileAbout, ProfileForm } from "@/components/settings/ProfileForm";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { WorkspaceForm, WorkspaceOverview } from "@/components/settings/WorkspaceOverview";
import { ActivitySection, TeamSection } from "@/components/settings/TeamList";
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

/**
 * Shared /settings — profile, password, and email for counselors, faculty,
 * admins, and the head. The head additionally gets the workspace/team/activity
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

  if (!loading && (!role || !["counselor", "guidance_head", "faculty", "admin"].includes(role))) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <Card><p className="text-sm text-ink-muted">Only counselors, faculty, admins, and the guidance head can open settings.</p></Card>
      </div>
    );
  }

  const roleLabel = isHead ? "Guidance head" : role === "admin" ? "Admin" : role === "faculty" ? "Faculty" : "Counselor";

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
          <ProfileForm
            loading={loading}
            fullName={fullName}
            email={email}
            roleLabel={roleLabel}
            isHead={isHead}
            officeLocation={officeLocation}
            joined={joined}
            completeness={completeness}
            editing={editing}
            saving={saving}
            onFullNameChange={setFullName}
            onEditToggle={() => (editing ? void saveProfile() : setEditing(true))}
          />

          <div
            role="tablist"
            aria-label="Profile sections"
            className="inline-flex rounded-lg border border-ink/10 bg-white p-1 shadow-card"
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
                  className={`h-8 rounded px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
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
              <ProfileAbout
                loading={loading}
                fullName={fullName}
                roleLabel={roleLabel}
                email={email}
                isHead={isHead}
                officeName={officeName}
                officeLocation={officeLocation}
                officeContact={officeContact}
              />
              {isHead && (
                <WorkspaceForm
                  officeName={officeName}
                  officeLocation={officeLocation}
                  officeContact={officeContact}
                  saving={saving}
                  onOfficeName={setOfficeName}
                  onOfficeLocation={setOfficeLocation}
                  onOfficeContact={setOfficeContact}
                  onSave={() => void saveOffice()}
                />
              )}
            </div>
          )}

          {isHead && tab === "team" && (
            <TeamSection loading={loading} counselors={counselors} />
          )}

          {tab === "activity" && (
            <ActivitySection loading={loading} feed={feed} />
          )}

          {tab === "security" && (
            <PasswordForm
              newPw={newPw}
              confirmPw={confirmPw}
              showPw={showPw}
              showConfirm={showConfirm}
              pwDone={pwDone}
              pwRules={pwRules}
              pwMatch={pwMatch}
              saving={saving}
              email={email}
              newEmail={newEmail}
              onNewPw={setNewPw}
              onConfirmPw={setConfirmPw}
              onShowPw={() => setShowPw((v) => !v)}
              onShowConfirm={() => setShowConfirm((v) => !v)}
              onPwBlur={() => setPwDone(true)}
              onNewEmail={setNewEmail}
              onChangePassword={(e) => void changePassword(e)}
              onChangeEmail={(e) => void changeEmail(e)}
            />
          )}
        </div>

        {/* Right column — head-only office overview */}
        {isHead && (
          <WorkspaceOverview
            loading={loading}
            counselorsCount={counselors.length}
            sessionsToday={glance.sessionsToday}
            openReferrals={glance.openReferrals}
            published={glance.published}
            posts={posts}
          />
        )}
      </div>
    </div>
  );
}
