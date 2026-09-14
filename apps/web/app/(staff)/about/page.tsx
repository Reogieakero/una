"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CheckCheck,
  Clock,
  FileText,
  Inbox,
  Info,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  Users,
  UserPlus,
  Settings,
  Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/primitives";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

type PageDoc = {
  href: string;
  label: string;
  // Loose on purpose: the monorepo graph can hold two copies of React's
  // types (root Next.js marker + app), and a strict component type turns
  // that duplication into a false LucideIcon mismatch on clean installs.
  icon: ComponentType<any>;
  purpose: string;
  displayed: string[];
  actions: string[];
  handoff: string;
};

const COUNSELOR_PAGES: PageDoc[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    purpose: "Your morning briefing — what needs you today, at a glance.",
    displayed: [
      "Quick links tuned to counselors (My appointments, Referrals inbox, Chat, Availability, Reports, Today's sessions).",
      "Referral-status and sessions-this-week charts over your queue.",
      "Today's schedule and the open items waiting on you.",
      "Empty states that say exactly what to do when a card has no records yet.",
    ],
    actions: ["Follow a quick link into the working page — the dashboard itself takes no triage actions."],
    handoff: "Start here daily, then work the Appointments and Referrals queues it points at.",
  },
  {
    href: "/sessions",
    label: "Session calendar",
    icon: CalendarDays,
    purpose: "Your sessions laid over time — month, week, and day views.",
    displayed: [
      "Month grid (42 cells), week strip, or a single day, with a Today shortcut and prev/next stepping.",
      "Per-day session pills (time · student alias) with status colors; days show today/week counts.",
      "Side schedule panel for the selected day; clicking a session opens its detail card (time, mode, status, counselor, concern).",
      "For online sessions with a saved Meet link, a Join Google Meet button right in the detail card.",
    ],
    actions: ["Switch views, pick a day to see its schedule, open a session for details."],
    handoff: "The calendar is read-only scheduling truth — changes happen in Appointments (confirm sets the time).",
  },
  {
    href: "/appointments",
    label: "My appointments",
    icon: CalendarCheck,
    purpose: "Your assigned session queue — confirm them, run them, close them.",
    displayed: [
      "Stat cards: My sessions, Pending, Assigned, Confirmed, Completed, Unassigned.",
      "Status pills (All + every status), mode filter, search across concern and student alias.",
      "Board columns: When, Student (alias only), Counselor, Mode, Status, Concern — plus a Join Meet pill under Mode for online sessions that carry a link.",
      "Legend card decoding the icon-only action buttons.",
    ],
    actions: [
      "Confirm an assigned booking → set the final date/time in the picker; for online sessions a Google Meet link is required. The student and the heads are notified with that schedule.",
      "Complete a confirmed session once held; mark No-show when the student doesn't arrive.",
      "Pending rows are waiting on the head — you cannot confirm before assignment.",
    ],
    handoff: "Confirmed sessions unblock referral resolves; completed sessions unlock student feedback.",
  },
  {
    href: "/availability",
    label: "Availability",
    icon: Clock,
    purpose: "Your bookable week — the open slots students schedule against.",
    displayed: [
      "Your weekly slots on a Monday-first grid with total open hours.",
      "Existing bookings overlaid so you never double-book yourself.",
      "Office coverage summary so you can see the team picture.",
    ],
    actions: [
      "Add slots by picking weekdays (multi-chips), start/end times, and whether they repeat weekly.",
      "Remove a slot through the confirm step.",
    ],
    handoff: "Keep this current — stale slots become missed or phantom sessions downstream.",
  },
  {
    href: "/chat",
    label: "Chat",
    icon: MessagesSquare,
    purpose: "Direct lines to students (threads) and colleagues (DMs), live as you type.",
    displayed: [
      "Conversation list with unread counts, search, and day-grouped message history.",
      "Typing indicator, new-message jump button, and per-message timestamps.",
      "Student names stay aliased where the interaction is anonymous.",
    ],
    actions: ["Send messages (the other side is notified in realtime), start new conversations, mark threads read."],
    handoff: "Anything clinical agreed in chat should be reflected in the session record it belongs to.",
  },
  {
    href: "/students",
    label: "Students",
    icon: Users,
    purpose: "Your caseload directory — never the whole school.",
    displayed: [
      "Only students tied to you (your sessions, your assigned referrals, your chat threads), shown by alias.",
      "Per-student workload: session count, open referrals, latest PSS-10 stress band (Low / Moderate / High).",
      "Program, year-level, and college filters plus search and mix charts.",
    ],
    actions: ["Browse and filter — this page takes no triage actions; it is context for the queues."],
    handoff: "Use it to spot repeat referrals and high-band students, then act in Referrals or Appointments.",
  },
  {
    href: "/referrals",
    label: "My referrals",
    icon: Inbox,
    purpose: "Cases the head assigned to you, from confirm to close.",
    displayed: [
      "Stat cards: My referrals, Pending, Assigned, Confirmed, Resolved, Unassigned.",
      "Status pills, priority filter, search, and a List/Grid toggle — grid cards use full labeled buttons and an 8px radius.",
      "Board columns: Referred, Session (the schedule you set on confirm), Student, Referred by, Counselor, Priority, Status, Reason (eye icon opens the full reason + audit trail in a modal), Actions.",
    ],
    actions: [
      "Confirm an assigned referral → set the session date/time (the student is notified with it).",
      "Resolve a confirmed referral — blocked until the student holds a confirmed session.",
      "Escalate with a required note (why it's urgent, what was tried). Pending rows wait on the head.",
    ],
    handoff: "Resolved is terminal and forever attributed to you — the head cannot resolve on your behalf.",
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    purpose: "Your work in charts — mix, flow, and trend over your own cases.",
    displayed: [
      "Appointment mix, referral mix and pipeline, priority and stress-band breakdowns, and trend lines.",
      "Percentages alongside raw counts so small samples read honestly.",
      "Export and print actions for filing or supervision.",
    ],
    actions: ["Filter the window, export a copy, print a summary. Reports never change case data."],
    handoff: "Bring these to supervision and planning — then act back in the queues.",
  },
  {
    href: "/announcements",
    label: "Announcements",
    icon: Megaphone,
    purpose: "Office news addressed to you — read what the head publishes.",
    displayed: [
      "Newsfeed of published posts (drafts and scheduled posts stay head-visible).",
      "Audience labels so you know who each post was for.",
    ],
    actions: ["Read. Publishing is a head action."],
    handoff: "New posts notify their audience in realtime — the nav badge tells you when one lands.",
  },
  {
    href: "/feedback",
    label: "Feedback",
    icon: FileText,
    purpose: "How your sessions landed — ratings and words from your students.",
    displayed: [
      "KPIs and sentiment bands (Excellent ≥ 4.5, Good ≥ 4.0, Fair ≥ 3.0, else Needs attention).",
      "Trend lines, rating mix, and the comment feed with a follow-up list for low scores.",
      "Only feedback on your own sessions — new submissions notify you in realtime.",
    ],
    actions: ["Filter by sentiment, search comments, work the follow-up list."],
    handoff: "Low scores are supervision material, not triage — the session itself is already complete.",
  },
  {
    href: "/emergency",
    label: "Emergency access",
    icon: ShieldAlert,
    purpose: "Break-glass identity reveal for genuine crises — nothing else.",
    displayed: [
      "Student picker limited to your caseload (your sessions and assigned referrals).",
      "Justification form, 30-minute grant countdown, and the revealed identity panel.",
      "Your active grant state and its expiry.",
    ],
    actions: [
      "Log a justification to open a 30-minute grant, then reveal exactly the student at risk.",
      "Every view is audit-logged and the heads are notified the moment you break glass.",
    ],
    handoff: "The head reviews every event under Security — use it only when safety demands it.",
  },
  {
    href: "/notifications",
    label: "Notifications",
    icon: Bell,
    purpose: "Your inbox for everything the office does — and the power behind the nav badges.",
    displayed: [
      "Stats (Total, Unread, Today, Types active), All/Unread/Read pills, type filter, and search — unread first.",
      "Per-item type badges, relative timestamps, an Open link to the source page, and Mark read.",
      "Mark all read control with a live unread count; new arrivals slide in with a toast, live.",
    ],
    actions: ["Mark items read one by one, or clear the inbox at once. Reading is what clears nav badges."],
    handoff: "Visiting a page does not clear its badge — acknowledging the notification does.",
  },
];

const HEAD_PAGES: PageDoc[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    purpose: "Office-wide command view — every queue's health in one screen.",
    displayed: [
      "Head-tuned quick links (Appointments, Referrals, Users, Chat, Announcements, Reports).",
      "Office referral-status and sessions-week charts, today's sessions, and open/escalated items.",
      "Empty states that direct you to the owning page when a card is clear.",
    ],
    actions: ["Survey, then dive into the owning queue — the dashboard triages nothing itself."],
    handoff: "Unassigned and escalated counts here are your assignment priorities for the day.",
  },
  {
    href: "/sessions",
    label: "Session calendar",
    icon: CalendarDays,
    purpose: "Every counselor's sessions on one calendar, with counselor attribution.",
    displayed: [
      "Same month/week/day geometry as the counselor view, office-wide, with per-counselor names on sessions.",
      "Today/week counts, day schedule panel, and session detail cards with Join Meet for online sessions.",
    ],
    actions: ["Inspect coverage and load across counselors; scheduling changes still happen in Appointments."],
    handoff: "Use clumps and gaps here to rebalance assignments in Appointments and Referrals.",
  },
  {
    href: "/appointments",
    label: "Appointments",
    icon: CalendarCheck,
    purpose: "The office-wide session board — you route, counselors run.",
    displayed: [
      "Stat cards: Total sessions, Pending, Assigned, Confirmed, Completed, Unassigned.",
      "Status pills, mode filter, counselor filter (including Unassigned only), and search.",
      "Same board columns as counselors, plus the Join Meet pill on online sessions that carry a link.",
      "Admin-actions legend: Assign (Pending → assigned), Reject (Pending/assigned → rejected).",
    ],
    actions: [
      "Assign a counselor via the Counselor-column dropdown (pending → assigned; clearing returns it to pending).",
      "Reject invalid requests (pending/assigned only — terminal and counsel to the requester).",
      "You never confirm, complete, or mark no-show — those are counselor hands only.",
    ],
    handoff: "Assigned sessions appear in the counselor's queue instantly (realtime + notification); confirmed ones come back to you as Counselor step.",
  },
  {
    href: "/availability",
    label: "Availability",
    icon: Clock,
    purpose: "Office coverage control — every counselor's slots plus their on/off switch.",
    displayed: [
      "All counselors with specialization, availability toggle state, slots, and booked load.",
      "Monday-first weekly grids per counselor with open-hours totals.",
    ],
    actions: [
      "Toggle any counselor available/unavailable.",
      "Add or remove slots on any counselor's behalf (same day/time/recurring rules).",
    ],
    handoff: "Coverage decisions here prevent unassigned pile-ups in the queues.",
  },
  {
    href: "/chat",
    label: "Chat",
    icon: MessagesSquare,
    purpose: "Message students and staff with the same live threads counselors use.",
    displayed: ["Thread and DM lists with unread counts, search, day-grouped history, and typing presence."],
    actions: ["Send and receive in realtime; the peer is notified on every send."],
    handoff: "Operational asks live here; case decisions belong in the queues they affect.",
  },
  {
    href: "/students",
    label: "Students",
    icon: Users,
    purpose: "The full privacy-safe directory the counselors only see in slices.",
    displayed: [
      "Every student by alias with program, year, college, session counts, open referrals, and stress band.",
      "The same filters and mix charts, office-wide.",
    ],
    actions: ["Browse and filter for oversight — triage still happens in the queues."],
    handoff: "Repeat-referral and high-band patterns here should become assignment decisions.",
  },
  {
    href: "/referrals",
    label: "Referrals",
    icon: Inbox,
    purpose: "The student referral inbox — you route, counselors close.",
    displayed: [
      "Stat cards: Total, Pending, Assigned, Confirmed, Resolved, Unassigned — plus the List/Grid toggle shared with counselors.",
      "Status pills, priority filter, assignee filter (including Unassigned only), and search.",
      "Assign dropdown in the Counselor column; reason eye-icon opens the full reason plus audit trail.",
      "Admin-actions legend: Assign (Pending → assigned), Reject (Pending/assigned → rejected).",
    ],
    actions: [
      "Assign a counselor (pending → assigned) or clear back to pending.",
      "Reject invalid referrals. You never confirm, resolve, or escalate — a row can only ever read Resolved when a counselor resolves it (enforced in the service layer, not just hidden buttons).",
    ],
    handoff: "Assigned referrals land in the counselor's queue live; watch Confirmed rows progress to Resolved.",
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    purpose: "Office evidence — mix, flow, trend, and share for planning and filing.",
    displayed: [
      "Appointment and referral mixes, pipeline flow, priority and stress-band charts, and trend lines.",
      "Export and print actions for reports and records.",
    ],
    actions: ["Slice the window, export, print. Reports observe — they never mutate cases."],
    handoff: "What the numbers flag (backlogs, urgent skew, slow resolution) becomes tomorrow's assignments.",
  },
  {
    href: "/users",
    label: "Users",
    icon: Users,
    purpose: "Every account in the workspace, and their on/off switch.",
    displayed: [
      "Directory with role and active/inactive status, role + status filters, and search.",
      "Per-account detail (program/college/year or staff context) and creation date.",
    ],
    actions: [
      "Activate or deactivate an account through the confirm dialog (service-role route).",
      "Deactivated accounts stop receiving notifications immediately.",
    ],
    handoff: "Deactivation is the safe alternative to deletion — history stays intact.",
  },
  {
    href: "/users/new",
    label: "Add staff",
    icon: UserPlus,
    purpose: "The only place staff accounts are born — counselor, faculty, or head.",
    displayed: [
      "Role picker, identity fields, and live password rules (8+ characters, upper + lower case, a number, matching confirmation).",
      "Success state confirming the created account.",
    ],
    actions: ["Create the account; the new staff member signs in with these credentials."],
    handoff: "New counselors need their counselor record linked before queues scope to them.",
  },
  {
    href: "/announcements",
    label: "Announcements",
    icon: Megaphone,
    purpose: "Office newsroom — write once, reach exactly the right audience.",
    displayed: [
      "Facebook-style newsfeed plus an insights tab (reach and mix).",
      "Draft / scheduled / published states, audience labels (Everyone, Students, Counselors, Faculty), and image support.",
      "Composer with audience picker and scheduling.",
    ],
    actions: ["Publish now or schedule; the chosen audience is notified in realtime on publish."],
    handoff: "Time-sensitive clinical guidance goes here and in Chat — never only in Chat.",
  },
  {
    href: "/feedback",
    label: "Feedback",
    icon: FileText,
    purpose: "Office-wide satisfaction truth — every rating, every counselor, every word.",
    displayed: [
      "Same KPIs and sentiment bands as counselors, across all sessions, plus counselor comparison.",
      "Trend lines, rating mix, comment mining, and the follow-up list.",
    ],
    actions: ["Spot struggling cohorts or counselors early and supervise — not to edit feedback, which is immutable record."],
    handoff: "Sustained low sentiment is a staffing and training decision.",
  },
  {
    href: "/emergency",
    label: "Emergency access",
    icon: ShieldAlert,
    purpose: "Same break-glass as counselors, with the full directory.",
    displayed: [
      "Full student directory (counselors only see their caseload), justification form, 30-minute grant, identity panel.",
    ],
    actions: ["Break glass exactly as counselors do — log, grant, reveal — knowing every view is audited and peers are notified."],
    handoff: "Every event you or a counselor raises lands in Security for your review.",
  },
  {
    href: "/security",
    label: "Security",
    icon: ShieldCheck,
    purpose: "The audit room — who saw what, and whether break-glass use was justified.",
    displayed: [
      "Access and safety log streams with reviewer workflow for break-glass events.",
      "Per-event detail, decision controls, and reviewer attribution.",
    ],
    actions: ["Review each break-glass event, respond to the accessor, and notify peer heads where warranted."],
    handoff: "Unreviewed events are office risk — clear this queue like a triage queue.",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    purpose: "Workspace identity, team pulse, and preferences.",
    displayed: [
      "Your profile and the office card (name, location, contact) with edit mode.",
      "Team roster with per-counselor session load, live activity feed, and glance stats (sessions today, open referrals, published posts).",
      "Report export shortcut.",
    ],
    actions: ["Keep the office card truthful, watch team load, export what records need."],
    handoff: "An overloaded counselor here explains a slow queue in Appointments.",
  },
  {
    href: "/notifications",
    label: "Notifications",
    icon: Bell,
    purpose: "Same inbox as counselors — every transaction addressed to you, and the badge source.",
    displayed: ["Stats, All/Unread/Read pills, type filter, search, per-item Mark read, Mark all read, live arrivals with toast."],
    actions: ["Acknowledge items to clear their nav badges; unread items keep their badges lit."],
    handoff: "Treat the unread count as a second triage queue.",
  },
];

const APPOINTMENT_FLOW = [
  { status: "Pending", who: "Student books (PSS-10 check-in from the last 30 days required)", tone: "bg-amber-100 text-amber-800" },
  { status: "Assigned", who: "Head picks a counselor", tone: "bg-indigo-100 text-indigo-800" },
  { status: "Confirmed", who: "Counselor sets final time (+ Meet link when online)", tone: "bg-blue-100 text-blue-800" },
  { status: "Completed / No-show", who: "Counselor closes the session", tone: "bg-green-100 text-green-800" },
] as const;

const REFERRAL_FLOW = [
  { status: "Pending", who: "Faculty flags a student (heads notified)", tone: "bg-amber-100 text-amber-800" },
  { status: "Assigned", who: "Head picks a counselor", tone: "bg-indigo-100 text-indigo-800" },
  { status: "Confirmed", who: "Counselor sets the session time", tone: "bg-blue-100 text-blue-800" },
  { status: "Resolved", who: "Counselor closes it (needs a confirmed session)", tone: "bg-green-100 text-green-800" },
] as const;

const SPLIT_ROWS: { move: string; admin: boolean; counselor: boolean; note: string }[] = [
  { move: "Assign counselor", admin: true, counselor: false, note: "Pending → assigned (clearing returns to pending)." },
  { move: "Reject request", admin: true, counselor: false, note: "Pending / assigned → rejected. Terminal." },
  { move: "Confirm + schedule", admin: false, counselor: true, note: "Assigned → confirmed. Sets the final time; Meet link required when online." },
  { move: "Complete / No-show", admin: false, counselor: true, note: "Confirmed → completed / no_show. Terminal." },
  { move: "Resolve referral", admin: false, counselor: true, note: "Confirmed → resolved. Blocked until a confirmed session exists." },
  { move: "Escalate referral", admin: false, counselor: true, note: "Flags urgency; requires a written reason." },
  { move: "Cancel / reschedule session", admin: false, counselor: false, note: "Student hands only, from the mobile app." },
  { move: "Flag a student", admin: false, counselor: false, note: "Faculty hands only, from the Referrals page." },
];

function FlowStrip({ steps }: { steps: readonly { status: string; who: string; tone: string }[] }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {steps.map((s, i) => (
        <span key={s.status} className="flex items-stretch gap-2">
          <span className="rounded-xl bg-cream px-3 py-2 text-left">
            <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-bold", s.tone)}>{s.status}</span>
            <span className="mt-1 block max-w-[180px] text-[11px] font-medium leading-snug text-ink-muted">{s.who}</span>
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden className="self-center font-bold text-ink-faint">→</span>
          )}
        </span>
      ))}
    </div>
  );
}

function PageAccordion({ doc }: { doc: PageDoc }) {
  const Icon = doc.icon;
  return (
    <details className="group rounded-2xl border border-ink/10 bg-white shadow-card">
      <summary className="flex cursor-pointer items-center gap-3 px-5 py-4">
        <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-ink">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px] font-bold text-ink">{doc.label}</span>
          <span className="block truncate text-[13px] text-ink-muted">{doc.purpose}</span>
        </span>
        <span aria-hidden className="text-xs font-bold text-ink-faint transition-transform group-open:rotate-90">▶</span>
      </summary>
      <div className="space-y-4 border-t border-ink/10 px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">What you see</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
            {doc.displayed.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">What you can do</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
            {doc.actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
        <p className="rounded-xl bg-cream px-4 py-2.5 text-[13px] leading-relaxed text-ink-soft">
          <span className="font-bold text-ink">Then what: </span>
          {doc.handoff}
        </p>
        <Link href={doc.href} className="inline-block text-[13px] font-bold text-primary-700 hover:underline">
          Open {doc.label} →
        </Link>
      </div>
    </details>
  );
}

/**
 * /about — the in-app handbook, strictly role-scoped: counselors only ever
 * see the counselor guide, the head only ever sees the head guide. No tabs,
 * no cross-viewing. Pipelines, per-page reference (what is displayed, what
 * your role may do, where the work goes next), and the non-negotiable rules.
 */
export default function AboutPage() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setRole((profile as { role: string } | null)?.role ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isHead = role === "guidance_head";

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>About</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">About this workspace</h1>
          <p className="mt-1 text-sm text-ink-muted">Loading your handbook…</p>
        </div>
        <div className="animate-pulse space-y-3" aria-hidden>
          <div className="h-32 rounded-lg bg-ink/10" />
          <div className="h-24 rounded-lg bg-ink/10" />
          <div className="h-24 rounded-lg bg-ink/10" />
        </div>
      </div>
    );
  }

  if (role === "faculty" || !role) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>About</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">About this workspace</h1>
        </div>
        <Card>
          <p className="text-sm font-bold text-ink">Built for the counseling team</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            This handbook documents the counselor and head workflows. As faculty, your home is the
            Referrals page — flag a student, describe what you observed, set urgency, and the office triages from there.
          </p>
          <Link href="/referrals" className="mt-2 inline-block text-[13px] font-bold text-primary-700 hover:underline">
            Open Referrals →
          </Link>
        </Card>
      </div>
    );
  }
  const pages = isHead ? HEAD_PAGES : COUNSELOR_PAGES;
  const checklist = isHead
    ? [
        "Clear Notifications — unread items are a second triage queue, and they drive your nav badges.",
        "Appointments: assign every Pending row (or reject what's invalid), starting with Unassigned only.",
        "Referrals: assign every Pending row; rejected rows leave the queue for good.",
        "Glance at the Dashboard — escalated and aging items are today's priorities.",
        "Review Security for unreviewed break-glass events; check Feedback sentiment for fires.",
        "Top up Availability coverage where the calendar shows gaps.",
      ]
    : [
        "Clear Notifications — unread items are a second triage queue, and they drive your nav badges.",
        "My appointments: confirm every Assigned row — set the final time, paste the Meet link when online.",
        "My referrals: confirm Assigned rows (student gets the schedule), resolve Confirmed rows backed by a session.",
        "Check the Session calendar for today's lineup and Join links.",
        "Answer unread Chat threads; keep Availability slots truthful.",
        "End of day: nothing Assigned should be waiting on you overnight.",
      ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>About</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">About this workspace</h1>
        <p className="mx-auto mt-1 max-w-[640px] text-sm leading-relaxed text-ink-muted">
          {isHead
            ? "The head handbook — the whole office: how cases move, what each page shows, what you may touch, and where every action goes next."
            : "Your counselor handbook — your queues, your pipeline, your rules: how cases move, what each page shows, what you may touch, and where every action goes next."}
        </p>
      </div>

      {/* Master pipeline — the two flows everything else serves. */}
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <BookOpen className="h-4 w-4" aria-hidden /> How a case moves
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          Two start lines, one discipline: the head routes, the counselor runs and closes.
        </p>
        <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Sessions</p>
        <FlowStrip steps={APPOINTMENT_FLOW} />
        <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Referrals</p>
        <FlowStrip steps={REFERRAL_FLOW} />
        <ul className="mt-4 space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
          <li><span className="font-bold text-ink">Rejected, Cancelled, Completed, Resolved, No-show</span> are terminal — nothing moves out of them.</li>
          <li><span className="font-bold text-ink">Every move notifies whoever is affected</span> — student, referrer, counselor, heads — in realtime, and lights their nav badges until read.</li>
          <li><span className="font-bold text-ink">Student names stay aliased</span> everywhere except audited break-glass reveals.</li>
        </ul>
      </section>

      {/* Daily checklist */}
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <CheckCheck className="h-4 w-4" aria-hidden />
          {isHead ? "Head daily checklist" : "Counselor daily checklist"}
        </h2>
        <ol className="mt-3 space-y-2">
          {checklist.map((c, i) => (
            <li key={c} className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
              <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[12px] font-bold text-white">
                {i + 1}
              </span>
              {c}
            </li>
          ))}
        </ol>
      </section>

      {/* Page-by-page reference */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink">
            {isHead ? "Every page, head view" : "Every page, counselor view"}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Open a page to see its purpose, exactly what is displayed, what you may do, and where the work goes next.
          </p>
        </div>
        {pages.map((doc) => (
          <PageAccordion key={doc.href + doc.label} doc={doc} />
        ))}
      </section>

      {/* Non-negotiable rules — scoped to your role, like the rest of this guide. */}
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <ShieldCheck className="h-4 w-4" aria-hidden /> Rules you live by
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs uppercase text-ink-muted">
                <th className="px-3 py-2">Move</th>
                <th className="px-3 py-2 text-center">{isHead ? "Head" : "You"}</th>
                <th className="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {SPLIT_ROWS.filter((r) => (isHead ? r.admin : r.counselor)).map((r) => (
                <tr key={r.move} className="border-b border-ink/5 align-top last:border-0">
                  <td className="px-3 py-2 font-bold text-ink">{r.move}</td>
                  <td className="px-3 py-2 text-center font-bold">✓</td>
                  <td className="px-3 py-2 text-[13px] text-ink-muted">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 space-y-1.5 text-[13px] leading-relaxed text-ink-muted">
          <li className="flex gap-2"><Video className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><span className="font-bold text-ink">Online sessions need a Meet link at confirm</span> — Google blocks Meet inside iframes, so the board and calendar offer Join buttons that open the meeting.</span></li>
          <li className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><span className="font-bold text-ink">Resolve is counselor-only, enforced server-side</span> — a referral can never read Resolved unless a counselor resolved it, even bypassing the UI.</span></li>
          <li className="flex gap-2"><Bell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><span className="font-bold text-ink">Badges equal unread inbox</span> — visiting a page never clears them; marking the notification read does.</span></li>
          <li className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><span className="font-bold text-ink">Student booking needs a fresh PSS-10</span> — a check-in from the last 30 days gates every new booking.</span></li>
        </ul>
      </section>
    </div>
  );
}
