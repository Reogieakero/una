import {
  BarChart3,
  Bell,
  CalendarCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessagesSquare,
  PartyPopper,
  Send,
  Users,
  Video,
  Siren,
  type LucideIcon,
} from "lucide-react";
import { JourneyPanel, JourneyHeading } from "../shell";
import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";

type RoleMini = { icon: LucideIcon; title: string; body: string };

const columns: { heading: string; sub: string; items: RoleMini[] }[] = [
  {
    heading: "Students",
    sub: "Help without the hurdle.",
    items: [
      { icon: CalendarCheck, title: "Book in minutes", body: "Open slots, online or in-person, one-tap reschedule." },
      { icon: ClipboardList, title: "PSS-10 check-ins", body: "A 3-minute stress check before each session." },
      { icon: MessagesSquare, title: "Chat + Google Meet", body: "Message when nervous; join from anywhere." },
      { icon: PartyPopper, title: "Wellness events", body: "Talks and activities with gentle reminders." },
    ],
  },
  {
    heading: "Counselors",
    sub: "Less admin, more presence.",
    items: [
      { icon: LayoutDashboard, title: "Schedules & records", body: "Caseload views with history at a glance." },
      { icon: FileText, title: "Session notes", body: "Structured notes and PSS-10 history, searchable." },
      { icon: Video, title: "Chat + Meet together", body: "Continue conversations and launch sessions in one place." },
      { icon: Siren, title: "Break-Glass protocol", body: "Emergency override only — fully audit-logged." },
    ],
  },
  {
    heading: "Head & Faculty",
    sub: "See sooner, act earlier.",
    items: [
      { icon: BarChart3, title: "Trends & reports", body: "Peak periods and program impact, exportable." },
      { icon: Users, title: "Caseload oversight", body: "Balance loads before waitlists grow." },
      { icon: Send, title: "Faculty referrals", body: "Quietly flag students who seem withdrawn." },
      { icon: Bell, title: "Event management", body: "Publish announcements, measure what helps." },
    ],
  },
];

export function RolesPanel() {
  return (
    <JourneyPanel id="j-roles" width="w-[125vw]">
      <div className="mx-auto flex max-w-none items-center gap-[3vw]">
        <AnimatedSection className="w-[24vw] max-w-[340px] shrink-0">
          <JourneyHeading
            eyebrow={<Eyebrow>Made for every role</Eyebrow>}
            title={
              <>
                One system, <span className="text-blue-600">three kinds of relief.</span>
              </>
            }
          />
        </AnimatedSection>
        <Stagger className="grid flex-1 grid-cols-3 gap-4" delay={0.05}>
          {columns.map((col) => (
            <StaggerItem key={col.heading} className="h-full">
              <div className="h-full rounded-[1.75rem] border border-white/60 bg-white/80 p-5 shadow-card backdrop-blur">
                <h3 className="font-display text-lg font-semibold">{col.heading}</h3>
                <p className="text-[12.5px] font-medium text-ink-muted">{col.sub}</p>
                <ul className="mt-3 space-y-2.5">
                  {col.items.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex gap-2.5">
                       <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span>
                        <span className="block text-[13px] font-bold leading-tight">{title}</span>
                        <span className="block text-[12px] leading-snug text-ink-muted">{body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </JourneyPanel>
  );
}
