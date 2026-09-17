import {
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarDays,
  Clock,
  FileText,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * /about handbook content — the in-app role guide, strictly role-scoped.
 * Extracted from app/(staff)/about/page.tsx so the page stays a thin
 * orchestrator (role fetch + section layout). Edit copy here only.
 */

export type PageDoc = {
  href: string;
  label: string;
  // Same type universe as the values (lucide-react's own LucideIcon), so
  // pnpm's duplicated React-types copies can never false-mismatch this.
  icon: LucideIcon;
  purpose: string;
  displayed: string[];
  actions: string[];
  handoff: string;
};

export const COUNSELOR_PAGES: PageDoc[] = [
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
      "Confirm an assigned booking → pick the date, start and end from the availability-slot dropdowns; for online sessions a Google Meet link is required. The student and the heads are notified with that schedule.",
      "Reschedule an assigned or upcoming confirmed session the same way — inside your availability slots only.",
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
      "Confirm an assigned referral → pick the date/time and the mode (Meet link required when online). Confirming creates the confirmed session itself — it lands on the calendar and board, and the student is notified with the schedule.",
      "Resolve a confirmed referral — now unblocked immediately, since confirming minted its session.",
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
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    purpose: "Your profile and sign-in security.",
    displayed: [
      "Your profile card (name with edit mode) and personal activity feed.",
      "Change password and change email under the Security tab.",
    ],
    actions: ["Keep your name current, rotate your password when needed."],
    handoff: "Workspace identity and the counseling team roster live on the head's Settings view.",
  },
];

export const HEAD_PAGES: PageDoc[] = [
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
      "Admin-actions legend: Assign (Pending → assigned), Reject (Pending → rejected; unassign assigned rows first).",
    ],
    actions: [
      "Assign a counselor via the Counselor-column dropdown (pending → assigned; clearing returns it to pending).",
      "Reject invalid requests (pending only — unassign assigned rows first; terminal and counsel to the requester).",
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
    purpose: "Direct messages with your counselor contacts — student threads stay private to their participants.",
    displayed: ["DM list with unread counts, search, day-grouped history, and typing presence."],
    actions: ["Send and receive in realtime; the peer is notified on every send. Use + to message a counselor."],
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
      "Admin-actions legend: Assign (Pending → assigned), Reject (Pending → rejected; unassign assigned rows first).",
    ],
    actions: [
      "Assign a counselor (pending → assigned) or clear back to pending.",
      "Reject invalid referrals (pending only — unassign assigned rows first). You never confirm, resolve, or escalate — a row can only ever read Resolved when a counselor resolves it (enforced in the service layer, not just hidden buttons).",
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

export type FlowStep = { status: string; who: string; tone: string };

export const APPOINTMENT_FLOW: FlowStep[] = [
  { status: "Pending", who: "Student books (PSS-10 check-in from the last 30 days required)", tone: "bg-amber-100 text-amber-800" },
  { status: "Assigned", who: "Head picks a counselor", tone: "bg-indigo-100 text-indigo-800" },
  { status: "Confirmed", who: "Counselor sets final time (+ Meet link when online)", tone: "bg-blue-100 text-blue-800" },
  { status: "Completed / No-show", who: "Counselor closes the session", tone: "bg-green-100 text-green-800" },
];

export const REFERRAL_FLOW: FlowStep[] = [
  { status: "Pending", who: "Faculty flags a student (heads notified)", tone: "bg-amber-100 text-amber-800" },
  { status: "Assigned", who: "Head picks a counselor", tone: "bg-indigo-100 text-indigo-800" },
  { status: "Confirmed", who: "Counselor sets the session time", tone: "bg-blue-100 text-blue-800" },
  { status: "Resolved", who: "Counselor closes it (needs a confirmed session)", tone: "bg-green-100 text-green-800" },
];

export type SplitRow = { move: string; admin: boolean; counselor: boolean; note: string };

export const SPLIT_ROWS: SplitRow[] = [
  { move: "Assign counselor", admin: true, counselor: false, note: "Pending → assigned (clearing returns to pending)." },
  { move: "Reject request", admin: true, counselor: false, note: "Pending → rejected. Terminal (unassign an assigned row first)." },
  { move: "Confirm + schedule", admin: false, counselor: true, note: "Assigned → confirmed. Mints the session row itself (Meet link required when online)." },
  { move: "Complete / No-show", admin: false, counselor: true, note: "Confirmed → completed / no_show. Terminal." },
  { move: "Resolve referral", admin: false, counselor: true, note: "Confirmed → resolved. Blocked until a confirmed session exists." },
  { move: "Escalate referral", admin: false, counselor: true, note: "Flags urgency; requires a written reason." },
  { move: "Reschedule session", admin: false, counselor: true, note: "Assigned/confirmed → new date + start/end inside your availability slots (student notified). Students can also reschedule from the mobile app." },
  { move: "Cancel session", admin: false, counselor: false, note: "Student hands only, from the mobile app." },
  { move: "Flag a student", admin: false, counselor: false, note: "Faculty hands only, from the Referrals page." },
];

export const COUNSELOR_CHECKLIST = [
  "Clear Notifications — unread items are a second triage queue, and they drive your nav badges.",
  "My appointments: confirm every Assigned row — set the final time, paste the Meet link when online.",
  "My referrals: confirm Assigned rows (student gets the schedule), resolve Confirmed rows backed by a session.",
  "Check the Session calendar for today's lineup and Join links.",
  "Answer unread Chat threads; keep Availability slots truthful.",
  "End of day: nothing Assigned should be waiting on you overnight.",
];

export const HEAD_CHECKLIST = [
  "Clear Notifications — unread items are a second triage queue, and they drive your nav badges.",
  "Appointments: assign every Pending row (or reject what's invalid), starting with Unassigned only.",
  "Referrals: assign every Pending row; rejected rows leave the queue for good.",
  "Glance at the Dashboard — escalated and aging items are today's priorities.",
  "Review Security for unreviewed break-glass events; check Feedback sentiment for fires.",
  "Top up Availability coverage where the calendar shows gaps.",
];

export const FACULTY_PAGES: PageDoc[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    purpose: "Your referral overview — what you flagged and where each case sits.",
    displayed: [
      "Your totals (flagged, waiting for triage, with the office, resolved) in the Stats panel.",
      "Needs-the-office list (your pending + escalated referrals) and your recent referrals.",
      "Office news and quick links to Referrals, Reports, Chat, and Announcements.",
    ],
    actions: ["Follow a quick link into the working page — the dashboard itself takes no triage actions."],
    handoff: "Start here daily, then flag or follow up in Referrals.",
  },
  {
    href: "/refer-student",
    label: "Refer Student",
    icon: UserPlus,
    purpose: "The digitized Counseling Referral Form (FM-DOrSU-GCTC-02) — same fields, wording, and placement as the paper sheet.",
    displayed: [
      "Student picker (I.D. Number and Course & Year fill in automatically), Gender, Age, and Relation to the client.",
      "Case Classification checkboxes (Behavioral, Relational, Financial, Absenteeism, Social Adjustment, Academic-related, Health, Others with specify line) and REMARKS.",
      "Your name auto-signed as referrer with the filing date, plus an office-routing urgency outside the sheet.",
    ],
    actions: ["Fill the sheet, set urgency, submit. Open any submitted referral as the official form to review or print/PDF it."],
    handoff: "Your submission lands in the Referrals inbox instantly; track it there or on the Dashboard.",
  },
  {
    href: "/referrals",
    label: "Referrals",
    icon: Inbox,
    purpose: "Your filed referrals with their live status, each viewable as the official form.",
    displayed: [
      "Your referrals with case classification, urgency, and live status: pending → assigned → confirmed → resolved.",
      "An official-form viewer on every referral (same sheet as submission) with Print / PDF.",
    ],
    actions: ["Watch the status — you'll be notified at each step. Open the official form to review or print a copy."],
    handoff: "The head assigns a counselor; the counselor confirms and resolves. You track, they act.",
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    purpose: "Your referral outcomes in charts — volume, flow, and follow-through on your own flags.",
    displayed: [
      "Your totals and resolution rate, referrals-over-time trend, and status + priority breakdowns.",
      "Pipeline watch: what's still open, what's escalated, and your longest wait.",
    ],
    actions: ["Filter the window, review where your flags land. Reports never change case data."],
    handoff: "Bring slow-moving cases back to Chat or flag again with fresh context.",
  },
  {
    href: "/chat",
    label: "Chat",
    icon: MessagesSquare,
    purpose: "Direct line to the guidance office about your referrals.",
    displayed: [
      "One-to-one conversations with counselors and the guidance head, with unread counts, search, and realtime delivery.",
    ],
    actions: ["Open the + button to message a counselor or the head; follow up on waiting referrals there."],
    handoff: "Case decisions still live in the queues — chat is the nudge, not the record.",
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
    href: "/emergency",
    label: "Emergency access",
    icon: ShieldAlert,
    purpose: "Break-glass identity reveal for genuine crises — nothing else.",
    displayed: [
      "Justification form, 30-minute grant countdown, and the revealed identity panel.",
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
    purpose: "Your inbox for referral updates — and the power behind the nav badges.",
    displayed: [
      "Referral status updates (assigned, confirmed, resolved, escalated) addressed to you.",
      "Per-item Mark read and Mark all read; new arrivals slide in with a toast, live.",
    ],
    actions: ["Mark items read one by one, or clear the inbox at once. Reading is what clears nav badges."],
    handoff: "Visiting a page does not clear its badge — acknowledging the notification does.",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    purpose: "Your profile and sign-in security.",
    displayed: [
      "Your profile card (name with edit mode) and personal activity feed.",
      "Change password and change email under the Security tab.",
    ],
    actions: ["Keep your name current, rotate your password when needed."],
    handoff: "Workspace identity and the counseling team roster live on the head's Settings view.",
  },
];

export const FACULTY_CHECKLIST = [
  "Clear Notifications — referral updates land here, and they drive your nav badges.",
  "Check the Dashboard — pending and escalated flags are waiting on the office.",
  "Flag new concerns in Referrals with a clear reason and the right urgency.",
  "Review Reports weekly — resolution rate and longest wait show what's stuck.",
  "Read Announcements so guidance reminders reach your classroom.",
];
