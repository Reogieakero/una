import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  EyeOff,
  HeartHandshake,
  KeyRound,
  LayoutDashboard,
  MessagesSquare,
  Scale,
  ScrollText,
  Send,
  UserPlus,
  Video,
  type LucideIcon,
} from "lucide-react";

/* Shared copy for both the vertical page and the horizontal journey,
   so edits only ever happen in one place. */

export type Feature = {
  icon: LucideIcon;
  tint: string;
  tag: string;
  title: string;
  body: string;
};

export const features: Feature[] = [
  {
    icon: CalendarCheck,
    tint: "bg-sage-600",
    tag: "Booking",
    title: "Online appointment scheduling",
    body: "Book, reschedule, or cancel in minutes — no Facebook threads, no QR-code hunt, no waiting in line.",
  },
  {
    icon: ClipboardList,
    tint: "bg-lav-500",
    tag: "Check-in",
    title: "PSS-10 stress assessment",
    body: "A short, validated 10-question check-in before each session so counselors understand you faster.",
  },
  {
    icon: EyeOff,
    tint: "bg-ink",
    tag: "Privacy",
    title: "Secure anonymous identity",
    body: "Reach out without revealing your name. Your identity stays protected unless you choose otherwise.",
  },
  {
    icon: LayoutDashboard,
    tint: "bg-skysoft-400",
    tag: "Counselors",
    title: "Counselor dashboard",
    body: "Schedules, student records, and session notes in one calm workspace — less admin, more care.",
  },
  {
    icon: BarChart3,
    tint: "bg-peach-500",
    tag: "Analytics",
    title: "Analytics Module",
    body: "Stress trends, common concerns, and peak periods turned into reports for data-driven decisions.",
  },
  {
    icon: MessagesSquare,
    tint: "bg-sage-500",
    tag: "Connection",
    title: "Real-time chat",
    body: "Gentle, private messaging between students and counselors before, between, and after sessions.",
  },
  {
    icon: CalendarDays,
    tint: "bg-lav-400",
    tag: "Community",
    title: "Event management",
    body: "Wellness talks, announcements, and activities — easy to find, easy to join, never buried.",
  },
  {
    icon: Video,
    tint: "bg-skysoft-400",
    tag: "Online",
    title: "Embedded Google Meet",
    body: "Join online sessions right from your booking with a secure Meet link. No extra apps to figure out.",
  },
  {
    icon: KeyRound,
    tint: "bg-peach-400",
    tag: "Safety",
    title: "Break-Glass Emergency Access",
    body: "In critical or self-harm situations, authorized counselors can override anonymity — fully audit-logged.",
  },
  {
    icon: Send,
    tint: "bg-sage-600",
    tag: "Referral",
    title: "Faculty referral",
    body: "Faculty can quietly flag students who may need support, so no one slips through unnoticed.",
  },
];

export type Step = {
  icon: LucideIcon;
  tint: string;
  step: string;
  title: string;
  body: string;
  meta: string;
};

export const steps: Step[] = [
  {
    icon: UserPlus,
    tint: "bg-sage-600",
    step: "Step 1",
    title: "Sign up privately",
    body: "Create your account in a minute. Stay anonymous — share only what feels comfortable.",
    meta: "No walk-in, no explaining at the door",
  },
  {
    icon: ClipboardCheck,
    tint: "bg-lav-500",
    step: "Step 2",
    title: "Take the PSS-10",
    body: "Answer 10 quick questions about the last month. It helps your counselor meet you where you are.",
    meta: "~3 minutes • validated scale",
  },
  {
    icon: CalendarCheck,
    tint: "bg-skysoft-400",
    step: "Step 3",
    title: "Book your appointment",
    body: "Pick an open slot, choose online or in-person, reschedule anytime life gets busy.",
    meta: "Instant confirmation + reminders",
  },
  {
    icon: Video,
    tint: "bg-peach-400",
    step: "Step 4",
    title: "Chat & meet your counselor",
    body: "Message beforehand if you're nervous, then join via embedded Google Meet or visit the office.",
    meta: "Real-time chat • secure Meet link",
  },
  {
    icon: HeartHandshake,
    tint: "bg-sage-500",
    step: "Step 5",
    title: "Follow-up & grow",
    body: "Get notes, next steps, and wellness events. Retake PSS-10 to see your progress over time.",
    meta: "Continuity, not one-off sessions",
  },
];

export type SafetyItem = {
  icon: LucideIcon;
  tint: string;
  title: string;
  body: string;
};

export const safetyItems: SafetyItem[] = [
  {
    icon: EyeOff,
    tint: "bg-sage-600",
    title: "Anonymous by default",
    body: "Your name and student ID are hidden from counselors unless you reveal them. Ask for help without fear of being recognized or judged.",
  },
  {
    icon: KeyRound,
    tint: "bg-peach-400",
    title: "Break-Glass Emergency Protocol",
    body: "Only in critical or self-harm situations can an authorized counselor request to reveal an identity — and only with senior approval.",
  },
  {
    icon: ScrollText,
    tint: "bg-lav-500",
    title: "Fully audit-logged",
    body: "Every emergency access is timestamped, justified, and reviewable. No silent overrides, no missing trail — safety with accountability.",
  },
  {
    icon: Scale,
    tint: "bg-skysoft-400",
    title: "RA 10173 compliant",
    body: "Built around the Data Privacy Act of 2012: consent-first, minimal data, encrypted storage via Supabase, and clear retention rules.",
  },
];

export const stressBars = [
  { label: "Jan", h: 38 },
  { label: "Feb", h: 52 },
  { label: "Mar", h: 71 },
  { label: "Mid", h: 92 },
  { label: "Apr", h: 64 },
  { label: "May", h: 58 },
  { label: "Fin", h: 96 },
];

export const concernBars = [
  { label: "Academic pressure", pct: 68, color: "bg-sage-500" },
  { label: "Anxiety & sleep", pct: 54, color: "bg-lav-400" },
  { label: "Family & finances", pct: 41, color: "bg-skysoft-400" },
  { label: "Relationships", pct: 33, color: "bg-peach-300" },
];
